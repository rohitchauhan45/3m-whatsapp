import { MessageDirection, Role } from "@prisma/client";
import { prisma } from "../../libraries/db";
import logger from "../../libraries/log/logger";
import { AppError } from "../../libraries/error-handling/AppError";
import { notifyAdminError } from "../../libraries/util/notifyAdminError";
import {
    normalizeWhatsAppNumber,
    sanitizeWhatsAppTemplateParam,
    sendWhatsappTemplate,
} from "../whtsapp/sendWhatsApp";
import { markIncomingOnConversation } from "../whtsapp/messageLog";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MANAGER_REMINDER_TEMPLATE = "manager_reminder";
const MANAGER_REMINDER_TYPE = "managerReminder";
const MANAGER_REMINDER_BUTTON_ID = "hii";

export type ManagerWindowReminderResult = {
    sent: number;
    failed: number;
    skipped: number;
};

type ManagerContact = {
    id: string;
    name: string;
    number: string | null;
};

type ReminderConversation = {
    windowExpiresAt: Date | null;
    lastIncomingMessageAt?: Date | null;
    lastSentMessageAt: Date | null;
    lastSentMessageType: string | null;
};

/**
 * Open until the later of the stored expiry and 24h after the last incoming message.
 * A "Hi" at 2:41 PM keeps the window open until 2:41 PM the next day.
 */
export function isWhatsAppWindowOpen(
    conversation: {
        windowExpiresAt: Date | null;
        lastIncomingMessageAt?: Date | null;
    } | null,
    now = new Date(),
): boolean {
    if (!conversation) return false;
    const storedExpiry = conversation.windowExpiresAt?.getTime() ?? 0;
    const incomingExpiry = conversation.lastIncomingMessageAt
        ? conversation.lastIncomingMessageAt.getTime() + DAY_IN_MS
        : 0;
    return Math.max(storedExpiry, incomingExpiry) > now.getTime();
}

/**
 * Reminder only when:
 * 1) 24h customer window is closed (or never opened)
 * 2) no managerReminder was sent in the last 24 hours
 */
export function shouldSendManagerReminder(
    conversation: ReminderConversation | null,
    lastReminderAt: Date | null,
    now = new Date(),
): boolean {
    if (isWhatsAppWindowOpen(conversation, now)) return false;

    const reminderAt =
        lastReminderAt ??
        (conversation?.lastSentMessageType === MANAGER_REMINDER_TYPE
            ? conversation.lastSentMessageAt
            : null);

    if (reminderAt && now.getTime() - reminderAt.getTime() < DAY_IN_MS) {
        return false;
    }

    return true;
}

/** Stamp reminder cooldown on conversation even if messageLog lookup fails. */
async function markManagerReminderSent(manager: ManagerContact, at: Date): Promise<void> {
    const phone = normalizeWhatsAppNumber(manager.number ?? "") || (manager.number?.trim() ?? "");
    if (!phone) return;

    await prisma.whatsAppConversation.upsert({
        where: { userId: manager.id },
        create: {
            userId: manager.id,
            number: phone,
            lastSentMessageAt: at,
            lastSentMessageType: MANAGER_REMINDER_TYPE,
        },
        update: {
            number: phone,
            lastSentMessageAt: at,
            lastSentMessageType: MANAGER_REMINDER_TYPE,
        },
    });
}

async function sendManagerReminderTemplate(manager: ManagerContact): Promise<boolean> {
    const phone = manager.number?.trim() ?? "";
    if (!phone) return false;

    const result = await sendWhatsappTemplate({
        number: phone,
        tname: MANAGER_REMINDER_TEMPLATE,
        type: MANAGER_REMINDER_TYPE,
        parameters: [
            {
                parameter_name: "name",
                text: sanitizeWhatsAppTemplateParam(manager.name),
            },
        ],
        buttons: [{ title: "Hii", id: MANAGER_REMINDER_BUTTON_ID }],
    });

    if (!result.success) {
        logger.warn(
            `manager_reminder template failed managerId=${manager.id} number=${phone} detail=${result.message}`,
        );
        return false;
    }

    // Always stamp cooldown locally (do not rely only on messageLog).
    await markManagerReminderSent(manager, new Date());
    return true;
}

async function getLastManagerReminderAt(conversationId: string): Promise<Date | null> {
    const last = await prisma.message.findFirst({
        where: {
            conversationId,
            direction: MessageDirection.OUTGOING,
            type: MANAGER_REMINDER_TYPE,
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, sendAt: true },
    });
    return last?.sendAt ?? last?.createdAt ?? null;
}

/** Each manager and admin is checked on their own conversation. */
export async function sendManagerWindowReminders(): Promise<ManagerWindowReminderResult> {
    const now = new Date();
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    const people = await prisma.user.findMany({
        where: { role: { in: [Role.manager, Role.admin] }, deletedAt: null },
        select: {
            id: true,
            name: true,
            number: true,
        },
    });

    for (const person of people) {
        const phone = person.number?.trim() ?? "";
        if (!phone) {
            skipped += 1;
            continue;
        }

        const conversation = await prisma.whatsAppConversation.findUnique({
            where: { userId: person.id },
            select: {
                id: true,
                windowExpiresAt: true,
                lastIncomingMessageAt: true,
                lastSentMessageAt: true,
                lastSentMessageType: true,
            },
        });

        const lastReminderAt = conversation
            ? await getLastManagerReminderAt(conversation.id)
            : null;

        if (!shouldSendManagerReminder(conversation, lastReminderAt, now)) {
            skipped += 1;
            continue;
        }

        const ok = await sendManagerReminderTemplate({
            id: person.id,
            name: person.name,
            number: person.number,
        });

        if (ok) {
            sent += 1;
            logger.info(`manager_reminder sent userId=${person.id}`);
        } else {
            failed += 1;
            logger.warn(`manager_reminder failed userId=${person.id}`);
        }
    }

    return { sent, failed, skipped };
}

export const touchConversation = async (userId: string, number: string) => {
    try {
        await markIncomingOnConversation(userId, number);
        return await prisma.whatsAppConversation.findUnique({ where: { userId } });
    } catch (error) {
        logger.error("Error in Add whatsapp Conversation", error);
        await notifyAdminError("add whatsapp conversation");
        throw new AppError("Error in add whatsapp Conversation , Internal server Error", error.message);
    }
};