import { messageStatus, Prisma } from "@prisma/client";
import { prisma } from "../../../libraries/db";
import { AppError } from "../../../libraries/error-handling/AppError";
import logger from "../../../libraries/log/logger";
import { notifyAdminError } from "../../../libraries/util/notifyAdminError";

export type ConversationStatusFilter = "all" | "open" | "expired" | "failed";
export type ConversationDirection = "incoming" | "outgoing";

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

export const messageCardDetails = async () => {
    try {
        const now = new Date();

        const [totalConversations, windowOpen, windowExpired, totalMessages, failedMessages] =
            await Promise.all([
                prisma.whatsAppConversation.count(),
                prisma.whatsAppConversation.count({
                    where: { windowExpiresAt: { gt: now } },
                }),
                prisma.whatsAppConversation.count({
                    where: {
                        OR: [{ windowExpiresAt: null }, { windowExpiresAt: { lte: now } }],
                    },
                }),
                prisma.message.count(),
                prisma.message.count({
                    where: { status: messageStatus.FAILED },
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
) => {
    try {
        const now = new Date();
        const page = query.page && query.page > 0 ? query.page : 1;
        const limit = query.limit && query.limit > 0 ? query.limit : 10;
        const skip = (page - 1) * limit;
        const searchTerm = query.search?.trim() || "";
        const statusFilter = query.status ?? "all";

        const where: Prisma.WhatsAppConversationWhereInput = {
            AND: [
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

        const [rows, total] = await Promise.all([
            prisma.whatsAppConversation.findMany({
                where,
                skip,
                take: limit,
                orderBy: [
                    { lastSentMessageAt: "desc" },
                    { lastIncomingMessageAt: "desc" },
                    { updatedAt: "desc" },
                ],
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            number: true,
                            role: true,
                        },
                    },
                    _count: { select: { messages: true } },
                },
            }),
            prisma.whatsAppConversation.count({ where }),
        ]);

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
    query: { page?: number; limit?: number; search?: string } = {},
) => {
    try {
        const page = query.page && query.page > 0 ? query.page : 1;
        const limit = query.limit && query.limit > 0 ? query.limit : 10;
        const skip = (page - 1) * limit;
        const searchTerm = query.search?.trim() || "";

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
                lastSentMessageAt: conversation.lastSentMessageAt,
                lastSentMessageType: conversation.lastSentMessageType,
                lastSentMessageStatus: conversation.lastSentMessageStatus,
            },
            messages,
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
