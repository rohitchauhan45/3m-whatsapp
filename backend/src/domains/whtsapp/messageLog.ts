import {
    MessageStyle,
    messageStatus,
    Prisma,
} from "@prisma/client";
import { prisma } from "../../libraries/db";
import logger from "../../libraries/log/logger";
import { notifyAdminWhatsAppFailure } from "../../libraries/util/notifyAdminError";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const STATUS_RANK: Record<messageStatus, number> = {
    PENDING: 0,
    SENT: 1,
    DELIVERED: 2,
    READ: 3,
    FAILED: 4,
};

function normalizeWhatsAppNumber(raw: string): string {
    return raw.replace(/\D/g, "");
}

export type SaveOutgoingMessageInput = {
    number: string;
    body: string;
    style: MessageStyle;
    /** Business type string from caller, e.g. "assignTask". */
    type: string;
    whatsappMessageId?: string | null;
    status: messageStatus;
    /** Only for the first outbound message of that DailyTask. */
    dailyTaskId?: string | null;
    /** Only for the first outbound message of that Task. */
    taskId?: string | null;
    errorCode?: string | null;
    errorTitle?: string | null;
    errorDetails?: string | null;
    errorPayload?: Prisma.InputJsonValue | null;
};

async function findUserIdByNumber(number: string): Promise<string | null> {
    const normalized = normalizeWhatsAppNumber(number);
    if (!normalized) return null;

    const user = await prisma.user.findFirst({
        where: { deletedAt: null, number: normalized },
        select: { id: true },
    });
    return user?.id ?? null;
}

export async function upsertConversation(userId: string, number: string) {
    const normalized = normalizeWhatsAppNumber(number) || number.trim();

    return prisma.whatsAppConversation.upsert({
        where: { userId },
        create: {
            userId,
            number: normalized,
        },
        update: {
            number: normalized,
        },
    });
}

/**
 * Stamp deliveryStatus on DailyTask / Task only when still null (first message).
 * Later webhook updates go through syncDeliveryStatusFromMessage.
 */
async function stampFirstDeliveryStatus(opts: {
    dailyTaskId?: string | null;
    taskId?: string | null;
    status: messageStatus;
    at: Date;
}): Promise<{ dailyTaskId: string | null; taskId: string | null }> {
    let linkedDailyTaskId: string | null = null;
    let linkedTaskId: string | null = null;

    if (opts.dailyTaskId) {
        const updated = await prisma.dailyTask.updateMany({
            where: { id: opts.dailyTaskId, deliveryStatus: null },
            data: {
                deliveryStatus: opts.status,
                sendAt: opts.status === messageStatus.FAILED ? null : opts.at,
            },
        });
        if (updated.count > 0) linkedDailyTaskId = opts.dailyTaskId;
    }

    if (opts.taskId) {
        const updated = await prisma.task.updateMany({
            where: { id: opts.taskId, deliveryStatus: null },
            data: {
                deliveryStatus: opts.status,
                sendAt: opts.status === messageStatus.FAILED ? null : opts.at,
            },
        });
        if (updated.count > 0) linkedTaskId = opts.taskId;
    }

    return { dailyTaskId: linkedDailyTaskId, taskId: linkedTaskId };
}

/** Propagate Message status → DailyTask/Task.deliveryStatus (first-message link only). */
async function syncDeliveryStatusFromMessage(opts: {
    dailyTaskId: string | null;
    taskId: string | null;
    status: messageStatus;
    at: Date;
}): Promise<void> {
    const data: Prisma.DailyTaskUpdateManyMutationInput = {
        deliveryStatus: opts.status,
    };
    if (
        opts.status === messageStatus.SENT ||
        opts.status === messageStatus.DELIVERED ||
        opts.status === messageStatus.READ
    ) {
        data.sendAt = opts.at;
    }

    if (opts.dailyTaskId) {
        await prisma.dailyTask.updateMany({
            where: { id: opts.dailyTaskId },
            data,
        });
    }
    if (opts.taskId) {
        await prisma.task.updateMany({
            where: { id: opts.taskId },
            data: {
                deliveryStatus: opts.status,
                ...(opts.status === messageStatus.SENT ||
                opts.status === messageStatus.DELIVERED ||
                opts.status === messageStatus.READ
                    ? { sendAt: opts.at }
                    : {}),
            },
        });
    }
}

/** Save outgoing message + update conversation last-sent fields. Never throws. */
export async function saveOutgoingMessage(
    input: SaveOutgoingMessageInput,
): Promise<{ messageId: string; conversationId: string } | null> {
    try {
        const userId = await findUserIdByNumber(input.number);
        if (!userId) {
            logger.warn(
                `messageLog skip: no user for number=${input.number} type=${input.type}`,
            );
            return null;
        }

        const conversation = await upsertConversation(userId, input.number);
        const now = new Date();
        const body = input.body ?? "";

        // Stamp deliveryStatus on first attempt (incl. FAILED) so cron does not retry Meta rejects.
        const linked =
            input.dailyTaskId || input.taskId
                ? await stampFirstDeliveryStatus({
                      dailyTaskId: input.dailyTaskId,
                      taskId: input.taskId,
                      status: input.status,
                      at: now,
                  })
                : { dailyTaskId: null, taskId: null };

        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                dailyTaskId: linked.dailyTaskId,
                taskId: linked.taskId,
                style: input.style,
                type: input.type,
                body,
                length: body.length,
                whatsappMessageId: input.whatsappMessageId ?? null,
                status: input.status,
                sendAt: input.status === messageStatus.FAILED ? null : now,
                failedAt: input.status === messageStatus.FAILED ? now : null,
                errorCode: input.errorCode ?? null,
                errorTitle: input.errorTitle ?? null,
                errorDetails: input.errorDetails ?? null,
                errorPayload: input.errorPayload ?? undefined,
                attemptCount: 1,
                lastAttemptAt: now,
            },
        });

        await prisma.whatsAppConversation.update({
            where: { id: conversation.id },
            data: {
                lastSentMessageId: message.id,
                lastSentMessageAt: now,
                lastSentMessageType: input.type,
                lastSentMessageStyle: input.style,
                lastSentMessageStatus: input.status,
            },
        });

        if (
            input.status === messageStatus.FAILED &&
            (linked.dailyTaskId || linked.taskId)
        ) {
            await notifyAdminWhatsAppFailure({
                type: input.type,
                number: input.number,
                errorCode: input.errorCode,
                errorTitle: input.errorTitle,
                errorDetails: input.errorDetails,
                dailyTaskId: linked.dailyTaskId,
                taskId: linked.taskId,
            });
        }

        return { messageId: message.id, conversationId: conversation.id };
    } catch (err) {
        logger.error("messageLog saveOutgoingMessage failed", err);
        return null;
    }
}

function mapMetaStatus(status: string): messageStatus | null {
    switch (status.toLowerCase()) {
        case "sent":
            return messageStatus.SENT;
        case "delivered":
            return messageStatus.DELIVERED;
        case "read":
            return messageStatus.READ;
        case "failed":
            return messageStatus.FAILED;
        default:
            return null;
    }
}

/** Apply Meta status webhook (sent / delivered / read / failed). */
export async function applyWhatsAppStatusUpdate(input: {
    whatsappMessageId: string;
    status: string;
    timestamp?: string | number;
    errors?: unknown;
}): Promise<void> {
    try {
        const wamid = input.whatsappMessageId?.trim();
        if (!wamid) return;

        const mapped = mapMetaStatus(input.status);
        if (!mapped) {
            logger.warn(`messageLog unknown meta status="${input.status}" id=${wamid}`);
            return;
        }

        const existing = await prisma.message.findUnique({
            where: { whatsappMessageId: wamid },
            select: {
                id: true,
                conversationId: true,
                status: true,
                dailyTaskId: true,
                taskId: true,
            },
        });
        if (!existing) return;

        if (
            existing.status !== messageStatus.FAILED &&
            mapped !== messageStatus.FAILED &&
            STATUS_RANK[mapped] < STATUS_RANK[existing.status]
        ) {
            return;
        }

        const at = input.timestamp
            ? new Date(Number(input.timestamp) * 1000)
            : new Date();

        const errorObj = Array.isArray(input.errors) ? input.errors[0] : null;
        const errorRecord =
            errorObj && typeof errorObj === "object"
                ? (errorObj as Record<string, unknown>)
                : null;

        await prisma.message.update({
            where: { id: existing.id },
            data: {
                status: mapped,
                sendAt:
                    mapped === messageStatus.SENT ||
                    mapped === messageStatus.DELIVERED ||
                    mapped === messageStatus.READ
                        ? at
                        : undefined,
                deliveredAt:
                    mapped === messageStatus.DELIVERED || mapped === messageStatus.READ
                        ? at
                        : undefined,
                readAt: mapped === messageStatus.READ ? at : undefined,
                failedAt: mapped === messageStatus.FAILED ? at : undefined,
                errorCode:
                    mapped === messageStatus.FAILED && errorRecord?.code != null
                        ? String(errorRecord.code)
                        : undefined,
                errorTitle:
                    mapped === messageStatus.FAILED && errorRecord?.title != null
                        ? String(errorRecord.title)
                        : undefined,
                errorDetails:
                    mapped === messageStatus.FAILED && errorRecord?.message != null
                        ? String(errorRecord.message)
                        : undefined,
                errorPayload:
                    mapped === messageStatus.FAILED && input.errors != null
                        ? (input.errors as Prisma.InputJsonValue)
                        : undefined,
                lastAttemptAt: at,
            },
        });

        const conversation = await prisma.whatsAppConversation.findUnique({
            where: { id: existing.conversationId },
            select: { lastSentMessageId: true },
        });
        if (conversation?.lastSentMessageId === existing.id) {
            await prisma.whatsAppConversation.update({
                where: { id: existing.conversationId },
                data: { lastSentMessageStatus: mapped },
            });
        }

        // Only first-message links propagate to DailyTask / Task.
        if (existing.dailyTaskId || existing.taskId) {
            await syncDeliveryStatusFromMessage({
                dailyTaskId: existing.dailyTaskId,
                taskId: existing.taskId,
                status: mapped,
                at,
            });
        }

        if (
            mapped === messageStatus.FAILED &&
            existing.status !== messageStatus.FAILED &&
            (existing.dailyTaskId || existing.taskId)
        ) {
            const conv = await prisma.whatsAppConversation.findUnique({
                where: { id: existing.conversationId },
                select: { number: true },
            });
            await notifyAdminWhatsAppFailure({
                type: "webhookDeliveryFailed",
                number: conv?.number ?? existing.conversationId,
                errorCode:
                    errorRecord?.code != null ? String(errorRecord.code) : null,
                errorTitle:
                    errorRecord?.title != null
                        ? String(errorRecord.title)
                        : null,
                errorDetails:
                    errorRecord?.message != null
                        ? String(errorRecord.message)
                        : null,
                dailyTaskId: existing.dailyTaskId,
                taskId: existing.taskId,
            });
        }
    } catch (err) {
        logger.error("messageLog applyWhatsAppStatusUpdate failed", err);
    }
}

/** Mark incoming activity + open 24h window. */
export async function markIncomingOnConversation(
    userId: string,
    number: string,
    incomingType?: string,
    incomingWhatsAppId?: string,
): Promise<void> {
    try {
        const now = new Date();
        const normalized = normalizeWhatsAppNumber(number) || number.trim();

        await prisma.whatsAppConversation.upsert({
            where: { userId },
            create: {
                userId,
                number: normalized,
                lastIncomingMessageId: incomingWhatsAppId ?? null,
                lastIncomingMessageAt: now,
                lastIncomingMessageType: incomingType ?? null,
                windowExpiresAt: new Date(now.getTime() + DAY_IN_MS),
            },
            update: {
                number: normalized,
                lastIncomingMessageId: incomingWhatsAppId ?? null,
                lastIncomingMessageAt: now,
                lastIncomingMessageType: incomingType ?? null,
                windowExpiresAt: new Date(now.getTime() + DAY_IN_MS),
            },
        });
    } catch (err) {
        logger.error("messageLog markIncomingOnConversation failed", err);
    }
}
