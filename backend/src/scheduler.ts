import { CronJob } from "cron";
import logger from "./libraries/log/logger";
import { prisma } from "./libraries/db"; 
import {
    assignTask,
    finalDecisionDailyTask,
    sendRemaingstatusTomanager,
    sendStartTask,
    sendTaskFollowUp,
} from "./domains/Task/service";
import { AcceptStatus, TaskStaus } from "@prisma/client";
import { isTaskStartDueEarly, isTaskStartNow } from "./libraries/util/Task/timing";
import {
    CRON_SETTING_NAMES,
    DEFAULT_REMAINING_STATUS_DELAY_MIN,
    DEFAULT_START_TASK_EARLY_MIN,
    resolveCronSetting,
    resolveMinuteSetting,
} from "./constants/cronSettings";

let assignJob: CronJob | null = null;
let followUpJob: CronJob | null = null;
let onTrackJob: CronJob | null = null;
let remainingStatusTimeout: NodeJS.Timeout | null = null;

const DEFAULT_ASSIGN_TIME = "0 21 * * *";
const DEFAULT_ONTRACK_TIME = "0 7 * * *";
/** Every minute — follow-up sends only tasks whose startAt matches current time. */
const FOLLOWUP_EVERY_MINUTE = "*/30 * * * *";

let remainingStatusDelayMs = DEFAULT_REMAINING_STATUS_DELAY_MIN * 60 * 1000;
let startTaskEarlyMs = DEFAULT_START_TASK_EARLY_MIN * 60 * 1000;

function scheduleRemainingStatusToManager() {
    if (remainingStatusTimeout) clearTimeout(remainingStatusTimeout);
    remainingStatusTimeout = setTimeout(() => {
        void runRemainingStatusToManager();
    }, remainingStatusDelayMs);
    logger.info(
        `cron remaining status to manager scheduled in ${remainingStatusDelayMs / 60_000} minutes`,
    );
}

async function runRemainingStatusToManager() {
    logger.info("cron Starting sendRemaingstatusTomanager");
    try {
        const result = await sendRemaingstatusTomanager();
        logger.info(`cron remaining status done: ${result.message}`);
    } catch (err) {
        logger.error("cron remaining status failed", err);
    }
}

async function runAssignTaskForAll() {
    logger.info("cron Starting assignTask for all managers");
    try {
        const result = await assignTask();
        logger.info(`cron assignTask done: ${result.message}`);
        scheduleRemainingStatusToManager();
    } catch (err) {
        logger.error("cron assignTask failed", err);
    }
}

async function runFinalDecisionForAll() {
    logger.info("cron Starting finalDecisionDailyTask");
    try {
        const result = await finalDecisionDailyTask();
        logger.info(`cron finalDecision done: ${result.message}`);
    } catch (err) {
        logger.error("cron finalDecision failed", err);
    }
}

export async function getDueFollowUpTaskIds(managerId?: string): Promise<string[]> {
    const now = new Date();
    const tasks = await prisma.task.findMany({
        where: {
            deletedAt: null,
            OR: [
                { status: { notIn: [TaskStaus.cancelled, TaskStaus.inProgress, TaskStaus.deleted] } },
                { status: null },
            ],
            dailyTask: {
                deletedAt: null,
                sent: true,
                status: AcceptStatus.accept,
            },
            user: {
                deletedAt: null,
                ...(managerId ? { parentId: managerId } : {}),
            },
        },
        select: { id: true, endAt: true },
    });

    return tasks.filter((t) => isTaskStartNow(t.endAt, now)).map((t) => t.id);
}

export async function getDueStartTaskIds(managerId?: string): Promise<string[]> {
    const now = new Date();
    const tasks = await prisma.task.findMany({
        where: {
            deletedAt: null,
            sent: false,
            OR: [
                { status: { notIn: [TaskStaus.cancelled, TaskStaus.inProgress, TaskStaus.deleted] } },
                { status: null },
            ],
            dailyTask: {
                deletedAt: null,
                sent: true,
                status: AcceptStatus.accept,
            },
            user: {
                deletedAt: null,
                ...(managerId ? { parentId: managerId } : {}),
            },
        },
        select: { id: true, startAt: true },
    });

    return tasks
        .filter((t) => isTaskStartDueEarly(t.startAt, startTaskEarlyMs, now))
        .map((t) => t.id);
}

async function runFollowUpForAll() {
    logger.info("cron Starting start/follow-up for due tasks");
    try {
        const startTaskIds = await getDueStartTaskIds();
        const startResult = await sendStartTask(startTaskIds);
        logger.info(`cron start-task done: ${startResult.message}`);

        const followUpTaskIds = await getDueFollowUpTaskIds();
        const followUpResult = await sendTaskFollowUp(followUpTaskIds);
        logger.info(`cron followUp done: ${followUpResult.message}`);
    } catch (err) {
        logger.error("cron start/follow-up failed", err);
    }
}

export async function startCronJobs() {
    await readCronjob();
}

export async function readCronjob() {
    if (assignJob) { assignJob.stop(); assignJob = null; }
    if (followUpJob) { followUpJob.stop(); followUpJob = null; }
    if (onTrackJob) { onTrackJob.stop(); onTrackJob = null; }
    if (remainingStatusTimeout) { clearTimeout(remainingStatusTimeout); remainingStatusTimeout = null; }

    let assignTime = DEFAULT_ASSIGN_TIME;
    let onTrackTime = DEFAULT_ONTRACK_TIME;

    try {
        const crons = await prisma.cron.findMany();

        assignTime = resolveCronSetting(crons, CRON_SETTING_NAMES.ASSIGN, DEFAULT_ASSIGN_TIME);
        onTrackTime = resolveCronSetting(crons, CRON_SETTING_NAMES.ONTRACK, DEFAULT_ONTRACK_TIME);

        const remainingMin = resolveMinuteSetting(
            crons,
            CRON_SETTING_NAMES.REMAINING_STATUS_DELAY,
            DEFAULT_REMAINING_STATUS_DELAY_MIN,
        );
        const startEarlyMin = resolveMinuteSetting(
            crons,
            CRON_SETTING_NAMES.START_TASK_EARLY,
            DEFAULT_START_TASK_EARLY_MIN,
        );
        remainingStatusDelayMs = remainingMin * 60 * 1000;
        startTaskEarlyMs = startEarlyMin * 60 * 1000;
    } catch (err) {
        logger.warn("cron Could not read cron from DB, using defaults", err);
    }

    assignJob = new CronJob(assignTime, runAssignTaskForAll, null, true, "Asia/Kolkata");
    assignJob.start();
    logger.info(`cron Assign task scheduled: ${assignTime}`);

    followUpJob = new CronJob(FOLLOWUP_EVERY_MINUTE, runFollowUpForAll, null, true, "Asia/Kolkata");
    followUpJob.start();
    logger.info(
        `cron Follow-up scheduled every minute (start tasks send ${startTaskEarlyMs / 60_000} min before startAt)`,
    );

    onTrackJob = new CronJob(onTrackTime, runFinalDecisionForAll, null, true, "Asia/Kolkata");
    onTrackJob.start();
    logger.info(`cron Final decision (on track) scheduled: ${onTrackTime}`);
}