import { Role, TaskFinalStatus, TaskStaus } from "@prisma/client";
import { prisma } from "../../../libraries/db";
import logger from "../../../libraries/log/logger";
import { notifyDashboardUpdate } from "../../../libraries/realtime";
import { notifyAdminMessage } from "../../../libraries/util/notifyAdminError";
import { getISTTodayCalendarDate, getISTTomorrowCalendarDate } from "../../../libraries/util/Task/istDate";
import { identicalTaskKey } from "../../../libraries/util/Task/readfromxl";
import { parseTimeOnDate } from "../../../libraries/util/Task/timing";
import { formatRemainingTaskSummaryMessage } from "../../messages/remainingTaskSummary";
import { sendMessageOnWhatsapp } from "../../whtsapp/sendWhatsApp";

export type CreateRemainingTasksResult = {
    copied: number;
    skippedDuplicate: number;
    skippedBadTime: number;
    users: number;
};

type CarryTask = {
    name: string;
    description: string | null;
    rawStartTime: string;
    rawEndTime: string;
};

type RemainingSummaryCounts = {
    total: number;
    completed: number;
    cancelled: number;
    created: number;
};

function emptySummary(): RemainingSummaryCounts {
    return { total: 0, completed: 0, cancelled: 0, created: 0 };
}

async function sendRemainingTaskSummaries(
    today: Date,
    copiedByUser: Map<string, number>,
): Promise<void> {
    const tasks = await prisma.task.findMany({
        where: {
            deletedAt: null,
            status: { not: TaskStaus.deleted },
            user: { deletedAt: null, role: Role.user },
            dailyTask: { deletedAt: null, date: today },
        },
        select: {
            finaldecision: true,
            user: { select: { parentId: true } },
        },
    });

    const admin = emptySummary();
    const byManager = new Map<string, RemainingSummaryCounts>();

    const add = (bucket: RemainingSummaryCounts, finaldecision: TaskFinalStatus | null) => {
        bucket.total += 1;
        if (finaldecision === TaskFinalStatus.completed) bucket.completed += 1;
        if (finaldecision === TaskFinalStatus.cancelled) bucket.cancelled += 1;
    };

    for (const task of tasks) {
        add(admin, task.finaldecision);
        const managerId = task.user.parentId;
        if (!managerId) continue;
        const bucket = byManager.get(managerId) ?? emptySummary();
        add(bucket, task.finaldecision);
        byManager.set(managerId, bucket);
    }

    for (const count of copiedByUser.values()) {
        admin.created += count;
    }

    const managers = await prisma.user.findMany({
        where: { role: Role.manager, deletedAt: null },
        select: {
            id: true,
            number: true,
            children: { where: { deletedAt: null }, select: { id: true } },
        },
    });

    for (const manager of managers) {
        const bucket = byManager.get(manager.id) ?? emptySummary();
        bucket.created = manager.children.reduce(
            (sum, child) => sum + (copiedByUser.get(child.id) ?? 0),
            0,
        );
        const phone = manager.number?.trim() ?? "";
        if (!phone) {
            logger.info(`remaining-task summary skip managerId=${manager.id}: no phone`);
            continue;
        }
        try {
            const result = await sendMessageOnWhatsapp({
                number: phone,
                message: formatRemainingTaskSummaryMessage(
                    bucket.total,
                    bucket.completed,
                    bucket.cancelled,
                    bucket.created,
                ),
                type: "remainingTaskSummary",
            });
            if (!result.success) {
                logger.warn(
                    `remaining-task summary failed managerId=${manager.id} detail=${result.message}`,
                );
            }
        } catch (error) {
            logger.error(`remaining-task summary error managerId=${manager.id}`, error);
        }
    }

    await notifyAdminMessage(
        formatRemainingTaskSummaryMessage(
            admin.total,
            admin.completed,
            admin.cancelled,
            admin.created,
        ),
        "remainingTaskSummary",
    );
}

/**
 * Copy today's unfinished tasks onto tomorrow.
 * Completed and cancelled stay behind. Every other task is created again,
 * so one task keeps moving forward each day until it is finished.
 * Safe to run twice: a task already on tomorrow (from this job or a sheet) is skipped.
 */
export async function createRemainingTasks(now = new Date()): Promise<CreateRemainingTasksResult> {
    const today = getISTTodayCalendarDate(now);
    const tomorrow = getISTTomorrowCalendarDate(now);

    const source = await prisma.task.findMany({
        where: {
            deletedAt: null,
            status: { not: TaskStaus.deleted },
            user: { deletedAt: null, role: Role.user },
            dailyTask: { deletedAt: null, date: today },
            OR: [
                { finaldecision: null },
                {
                    finaldecision: {
                        notIn: [TaskFinalStatus.completed, TaskFinalStatus.cancelled],
                    },
                },
            ],
        },
        select: {
            userId: true,
            name: true,
            description: true,
            rawStartTime: true,
            rawEndTime: true,
        },
    });

    const byUser = new Map<string, CarryTask[]>();
    for (const task of source) {
        const list = byUser.get(task.userId) ?? [];
        const key = identicalTaskKey(task);
        if (!list.some((row) => identicalTaskKey(row) === key)) {
            list.push({
                name: task.name,
                description: task.description,
                rawStartTime: task.rawStartTime,
                rawEndTime: task.rawEndTime,
            });
        }
        byUser.set(task.userId, list);
    }

    let copied = 0;
    let skippedDuplicate = 0;
    let skippedBadTime = 0;
    const copiedByUser = new Map<string, number>();

    for (const [userId, tasks] of byUser) {
        let dailyTask = await prisma.dailyTask.findFirst({
            where: { userId, date: tomorrow, deletedAt: null },
            select: { id: true },
        });

        const existing = dailyTask
            ? await prisma.task.findMany({
                  where: { dailyTaskId: dailyTask.id, deletedAt: null },
                  select: {
                      name: true,
                      rawStartTime: true,
                      rawEndTime: true,
                      position: true,
                  },
              })
            : [];
        const existingKeys = new Set(existing.map((task) => identicalTaskKey(task)));
        let nextPosition = existing.reduce((max, task) => Math.max(max, task.position), 0);

        const toCreate: Array<{
            name: string;
            description: string | null;
            rawStartTime: string;
            rawEndTime: string;
            startAt: Date;
            endAt: Date;
        }> = [];

        for (const task of tasks) {
            if (existingKeys.has(identicalTaskKey(task))) {
                skippedDuplicate += 1;
                continue;
            }
            const startAt = parseTimeOnDate(tomorrow, task.rawStartTime);
            const endAt = parseTimeOnDate(tomorrow, task.rawEndTime);
            if (!startAt || !endAt || endAt.getTime() <= startAt.getTime()) {
                skippedBadTime += 1;
                logger.warn(
                    `remaining-task skip bad time userId=${userId} task="${task.name}" start=${task.rawStartTime} end=${task.rawEndTime}`,
                );
                continue;
            }
            toCreate.push({ ...task, startAt, endAt });
        }

        if (toCreate.length === 0) continue;

        toCreate.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

        if (!dailyTask) {
            dailyTask = await prisma.dailyTask.create({
                data: { userId, date: tomorrow },
                select: { id: true },
            });
        }
        const dailyTaskId = dailyTask.id;

        await prisma.task.createMany({
            data: toCreate.map((task) => {
                nextPosition += 1;
                return {
                    name: task.name,
                    description: task.description,
                    userId,
                    dailyTaskId,
                    position: nextPosition,
                    status: TaskStaus.notSend,
                    rawStartTime: task.rawStartTime,
                    rawEndTime: task.rawEndTime,
                    startAt: task.startAt,
                    endAt: task.endAt,
                };
            }),
        });
        copied += toCreate.length;
        copiedByUser.set(userId, (copiedByUser.get(userId) ?? 0) + toCreate.length);
    }

    if (copied > 0) notifyDashboardUpdate();

    try {
        await sendRemainingTaskSummaries(today, copiedByUser);
    } catch (error) {
        logger.error("remaining-task summary failed", error);
    }

    logger.info(
        `remaining-task copied=${copied} duplicate=${skippedDuplicate} badTime=${skippedBadTime} users=${byUser.size}`,
    );

    return {
        copied,
        skippedDuplicate,
        skippedBadTime,
        users: byUser.size,
    };
}
