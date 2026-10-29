import { MessageDirection, messageStatus, Prisma } from "@prisma/client";
import { prisma } from "../../../libraries/db";
import { AppError } from "../../../libraries/error-handling/AppError";
import logger from "../../../libraries/log/logger";
import { notifyAdminError } from "../../../libraries/util/notifyAdminError";
import { convertTimeRangeintoDate } from "../../../libraries/util/Admin/timing";
import type { timeRange } from "./service";
import { ASSIGN_TASK_TYPE } from "../../whtsapp/messageLog";
import { isAssignRetryPending } from "../../Task/Assign/service";

export type ConversationStatusFilter = "all" | "open" | "expired" | "failed";
export type ConversationDirection = "incoming" | "outgoing";
export type MessageDirectionFilter = "all" | ConversationDirection;
/** Same presets as task/user tabs, plus "all" (no date filter). */
export type MessageTimeRange = timeRange | "all";

/** Message.createdAt filter for the range; null = no date filter ("all"). */
function buildMessageDateWhere(time: MessageTimeRange): Prisma.MessageWhereInput | null {
    if (time === "all") return null;
    return { createdAt: convertTimeRangeintoDate(time) };
}

/** Conversations with at least one message in the range. */
function buildConversationTimeWhere(
    messageDateWhere: Prisma.MessageWhereInput | null,
): Prisma.WhatsAppConversationWhereInput {
    return messageDateWhere ? { messages: { some: messageDateWhere } } : {};
}

/** Compare last incoming vs last sent timestamps → which side was most recent. */
function resolveLastDirection(
    lastIncomingMessageAt: Date | null,
    lastSentMessageAt: Date | null,
): ConversationDirection | null {
    const incomingAt = lastIncomingMessageAt?.getTime() ?? null;
    const sentAt = lastSentMessageAt?.getTime() ?? null;
    if (incomingAt == null && sentAt == null) return null;
    if (incomingAt == null) return "outgoing";
    if (sentAt == null) return "incoming";
    return incomingAt >= sentAt ? "incoming" : "outgoing";
}

/** Newer of the two stored message times. Missing side does not count. */
function lastActivityMs(
    lastIncomingMessageAt: Date | null,
    lastSentMessageAt: Date | null,
): number {
    const incomingAt = lastIncomingMessageAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const sentAt = lastSentMessageAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    return Math.max(incomingAt, sentAt);
}

function buildConversationStatusWhere(
    statusFilter: ConversationStatusFilter,
    now: Date,
): Prisma.WhatsAppConversationWhereInput {
    switch (statusFilter) {
        case "open":
            return { windowExpiresAt: { gt: now } };
        case "expired":
            return {
                OR: [{ windowExpiresAt: null }, { windowExpiresAt: { lte: now } }],
            };
        case "failed":
            return { lastSentMessageStatus: messageStatus.FAILED };
        case "all":
        default:
            return {};
    }
}

export const messageCardDetails = async (time: MessageTimeRange = "today") => {
    try {
        const now = new Date();
        const messageDateWhere = buildMessageDateWhere(time);
        const messageWhere: Prisma.MessageWhereInput = messageDateWhere ?? {};
        const conversationWhere = buildConversationTimeWhere(messageDateWhere);

        const [
            totalConversations,
            windowOpen,
            windowExpired,
            totalMessages,
            failedMessages,
            incomingMessages,
            outgoingMessages,
        ] = await Promise.all([
                prisma.whatsAppConversation.count({ where: conversationWhere }),
                prisma.whatsAppConversation.count({
                    where: {
                        AND: [conversationWhere, buildConversationStatusWhere("open", now)],
                    },
                }),
                prisma.whatsAppConversation.count({
                    where: {
                        AND: [conversationWhere, buildConversationStatusWhere("expired", now)],
                    },
                }),
                prisma.message.count({ where: messageWhere }),
                prisma.message.count({
                    where: { ...messageWhere, status: messageStatus.FAILED },
                }),
                prisma.message.count({
                    where: { ...messageWhere, direction: MessageDirection.INCOMING },
                }),
                prisma.message.count({
                    where: { ...messageWhere, direction: MessageDirection.OUTGOING },
                }),
            ]);

        return {
            success: true,
            status: 200,
            data: {
                totalConversations,
                windowOpen,
                windowExpired,
                totalMessages,
                failedMessages,
                incomingMessages,
                outgoingMessages,
            },
        };
    } catch (error) {
        logger.error("Error in message card details", error);
        await notifyAdminError("fetch message cards for Admin");
        throw new AppError(
            "Internal server Error while fetch message-cards for Dashboard",
            (error as Error).message,
        );
    }
};

export const conversationTable = async (
    query: {
        page?: number;
        limit?: number;
        search?: string;
        status?: ConversationStatusFilter;
    } = {},
    time: MessageTimeRange = "today",
) => {
    try {
        const now = new Date();
        const page = query.page && query.page > 0 ? query.page : 1;
        const limit = query.limit && query.limit > 0 ? query.limit : 10;
        const skip = (page - 1) * limit;
        const searchTerm = query.search?.trim() || "";
        const statusFilter = query.status ?? "all";
        const messageDateWhere = buildMessageDateWhere(time);

        const where: Prisma.WhatsAppConversationWhereInput = {
            AND: [
                buildConversationTimeWhere(messageDateWhere),
                buildConversationStatusWhere(statusFilter, now),
                ...(searchTerm
                    ? [
                          {
                              OR: [
                                  { number: { contains: searchTerm, mode: "insensitive" as const } },
                                  {
                                      user: {
                                          deletedAt: null,
                                          OR: [
                                              {
                                                  name: {
                                                      contains: searchTerm,
                                                      mode: "insensitive" as const,
                                                  },
                                              },
                                              {
                                                  number: {
                                                      contains: searchTerm,
                                                      mode: "insensitive" as const,
                                                  },
                                              },
                                          ],
                                      },
                                  },
                              ],
                          } satisfies Prisma.WhatsAppConversationWhereInput,
                      ]
                    : []),
            ],
        };

        // Prisma cannot ORDER BY the later of two columns. Load only the
        // timestamps, sort by the real last message (incoming or outgoing),
        // then load the page. Status webhooks must not change this order.
        const activityRows = await prisma.whatsAppConversation.findMany({
            where,
            select: {
                id: true,
                lastIncomingMessageAt: true,
                lastSentMessageAt: true,
            },
        });
        activityRows.sort(
            (a, b) =>
                lastActivityMs(b.lastIncomingMessageAt, b.lastSentMessageAt) -
                lastActivityMs(a.lastIncomingMessageAt, a.lastSentMessageAt),
        );
        const total = activityRows.length;
        const pageIds = activityRows.slice(skip, skip + limit).map((row) => row.id);

        const unorderedRows =
            pageIds.length === 0
                ? []
                : await prisma.whatsAppConversation.findMany({
                      where: { id: { in: pageIds } },
                      include: {
                          user: {
                              select: {
                                  id: true,
                                  name: true,
                                  number: true,
                                  role: true,
                              },
                          },
                          _count: {
                              select: {
                                  messages: messageDateWhere
                                      ? { where: messageDateWhere }
                                      : true,
                              },
                          },
                      },
                  });
        const pageOrder = new Map(pageIds.map((id, index) => [id, index]));
        const rows = unorderedRows.sort(
            (a, b) => (pageOrder.get(a.id) ?? 0) - (pageOrder.get(b.id) ?? 0),
        );

        const conversations = rows.map((row) => {
            const windowOpen =
                row.windowExpiresAt != null && row.windowExpiresAt.getTime() > now.getTime();
            const lastDirection = resolveLastDirection(
                row.lastIncomingMessageAt,
                row.lastSentMessageAt,
            );
            return {
                id: row.id,
                number: row.number,
                userId: row.userId,
                userName: row.user?.name ?? "—",
                userNumber: row.user?.number ?? row.number,
                userRole: row.user?.role ?? null,
                windowExpiresAt: row.windowExpiresAt,
                windowOpen,
                lastDirection,
                lastIncomingMessageAt: row.lastIncomingMessageAt,
                lastIncomingMessageType: row.lastIncomingMessageType,
                lastSentMessageAt: row.lastSentMessageAt,
                lastSentMessageType: row.lastSentMessageType,
                lastSentMessageStyle: row.lastSentMessageStyle,
                lastSentMessageStatus: row.lastSentMessageStatus,
                messageCount: row._count.messages,
                updatedAt: row.updatedAt,
            };
        });

        return {
            conversations,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    } catch (error) {
        logger.error("Error in conversation table", error);
        await notifyAdminError("fetch conversation table for Admin");
        throw new AppError(
            "Internal server Error while fetch message-table for Dashboard",
            (error as Error).message,
        );
    }
};

export const conversationMessages = async (
    conversationId: string,
    query: {
        page?: number;
        limit?: number;
        search?: string;
        direction?: MessageDirectionFilter;
    } = {},
) => {
    try {
        const page = query.page && query.page > 0 ? query.page : 1;
        const limit = query.limit && query.limit > 0 ? query.limit : 10;
        const skip = (page - 1) * limit;
        const searchTerm = query.search?.trim() || "";
        const directionWhere =
            query.direction === "incoming"
                ? MessageDirection.INCOMING
                : query.direction === "outgoing"
                  ? MessageDirection.OUTGOING
                  : undefined;

        const conversation = await prisma.whatsAppConversation.findUnique({
            where: { id: conversationId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        number: true,
                        role: true,
                    },
                },
            },
        });

        if (!conversation) {
            throw new AppError("Not found", "Conversation not found", 404);
        }

        const now = new Date();
        const upperSearch = searchTerm.toUpperCase();
        const matchedStatus = (Object.values(messageStatus) as string[]).includes(upperSearch)
            ? (upperSearch as messageStatus)
            : null;

        const messageWhere: Prisma.MessageWhereInput = {
            conversationId,
            ...(directionWhere ? { direction: directionWhere } : {}),
            ...(searchTerm
                ? {
                      OR: [
                          { type: { contains: searchTerm, mode: "insensitive" } },
                          { body: { contains: searchTerm, mode: "insensitive" } },
                          ...(matchedStatus ? [{ status: matchedStatus }] : []),
                      ],
                  }
                : {}),
        };

        const [messages, total] = await Promise.all([
            prisma.message.findMany({
                where: messageWhere,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.message.count({ where: messageWhere }),
        ]);

        const windowOpen =
            conversation.windowExpiresAt != null &&
            conversation.windowExpiresAt.getTime() > now.getTime();

        const failedAssignDailyTaskIds = [
            ...new Set(
                messages
                    .filter(
                        (m) =>
                            m.direction === MessageDirection.OUTGOING &&
                            m.type === ASSIGN_TASK_TYPE &&
                            m.status === messageStatus.FAILED &&
                            m.dailyTaskId,
                    )
                    .map((m) => m.dailyTaskId as string),
            ),
        ];
        const pendingDailyTasks = failedAssignDailyTaskIds.length
            ? await prisma.dailyTask.findMany({
                  where: { id: { in: failedAssignDailyTaskIds }, deletedAt: null },
                  select: {
                      id: true,
                      date: true,
                      deliveryStatus: true,
                      retryFailedMessage: { select: { messageId: true, resolvedAt: true } },
                  },
              })
            : [];
        const pendingById = new Map(
            pendingDailyTasks
                .filter((dt) =>
                    isAssignRetryPending(dt.deliveryStatus, dt.retryFailedMessage, dt.date),
                )
                .map((dt) => [dt.id, dt]),
        );

        // Button only on the latest failed message of each pending DailyTask.
        const retryShownFor = new Set<string>();
        const messagesWithRetry = messages.map((m) => {
            const pending = m.dailyTaskId ? pendingById.get(m.dailyTaskId) : undefined;
            const isLatestFailed =
                pending &&
                m.type === ASSIGN_TASK_TYPE &&
                m.status === messageStatus.FAILED &&
                !retryShownFor.has(pending.id) &&
                (pending.retryFailedMessage?.messageId
                    ? pending.retryFailedMessage.messageId === m.id
                    : true);
            if (isLatestFailed) retryShownFor.add(pending.id);
            return {
                ...m,
                assignRetry: isLatestFailed ? { dailyTaskId: pending.id, windowOpen } : null,
            };
        });

        return {
            conversation: {
                id: conversation.id,
                number: conversation.number,
                userId: conversation.userId,
                userName: conversation.user?.name ?? "—",
                userNumber: conversation.user?.number ?? conversation.number,
                userRole: conversation.user?.role ?? null,
                windowExpiresAt: conversation.windowExpiresAt,
                windowOpen,
                lastIncomingMessageAt: conversation.lastIncomingMessageAt,
                lastIncomingMessageType: conversation.lastIncomingMessageType,
                lastSentMessageAt: conversation.lastSentMessageAt,
                lastSentMessageType: conversation.lastSentMessageType,
                lastSentMessageStatus: conversation.lastSentMessageStatus,
            },
            messages: messagesWithRetry,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error("Error in conversation messages", error);
        await notifyAdminError("fetch conversation messages for Admin");
        throw new AppError(
            "Internal server Error while fetch conversation messages",
            (error as Error).message,
        );
    }
};
