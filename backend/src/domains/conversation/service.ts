import { Role } from "@prisma/client";
import { prisma } from "../../libraries/db";
import logger from "../../libraries/log/logger";
import { AppError } from "../../libraries/error-handling/AppError";
import { notifyAdminError } from "../../libraries/util/notifyAdminError";
import {
    sanitizeWhatsAppTemplateParam,
    sendWhatsappTemplate,
} from "../whtsapp/sendWhatsApp";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MANAGER_REMINDER_TEMPLATE = "manager_reminder";
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

export function isWhatsAppWindowOpen(
    conversation: { windowExpiresAt: Date | null } | null,
    now = new Date(),
): boolean {
    const expiresAt = conversation?.windowExpiresAt;
    if (!expiresAt) return false;
    return expiresAt.getTime() > now.getTime();
}

/** True when reminder should be sent (window closed and no reminder already sent for this expiry). */
export function shouldSendManagerReminder(
    conversation: { windowExpiresAt: Date | null; lastOutgoingAt: Date | null } | null,
    now = new Date(),
): boolean {
    if (isWhatsAppWindowOpen(conversation, now)) return false;

    if (!conversation) return true;

    const { windowExpiresAt, lastOutgoingAt } = conversation;
    if (!windowExpiresAt) {
        return !lastOutgoingAt;
    }

    if (windowExpiresAt.getTime() > now.getTime()) return false;

    if (!lastOutgoingAt) return true;
    return lastOutgoingAt.getTime() <= windowExpiresAt.getTime();
}

async function sendManagerReminderTemplate(manager: ManagerContact): Promise<boolean> {
    const phone = manager.number?.trim() ?? "";
    if (!phone) return false;

    const result = await sendWhatsappTemplate({
        number: phone,
        tname: MANAGER_REMINDER_TEMPLATE,
        parameters: [
            {
                parameter_name: "name",
                text: sanitizeWhatsAppTemplateParam(manager.name),
            },
        ],
        buttons: [{ title: "Hii", id: MANAGER_REMINDER_BUTTON_ID }],
    });

    return result.success;
}

/** Send manager_reminder to managers whose 24h WhatsApp window has expired. */
export async function sendManagerWindowReminders(): Promise<ManagerWindowReminderResult> {
    const now = new Date();
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    const managers = await prisma.user.findMany({
        where: { role: Role.manager, deletedAt: null },
        select: {
            id: true,
            name: true,
            number: true,
            conversation: {
                select: { windowExpiresAt: true, lastOutgoingAt: true },
            },
        },
    });

    for (const manager of managers) {
        const phone = manager.number?.trim() ?? "";
        if (!phone) {
            skipped += 1;
            continue;
        }

        const conversation = manager.conversation[0] ?? null;
        if (!shouldSendManagerReminder(conversation, now)) {
            skipped += 1;
            continue;
        }

        const ok = await sendManagerReminderTemplate({
            id: manager.id,
            name: manager.name,
            number: manager.number,
        });

        if (ok) {
            await prisma.whatsAppConversation.upsert({
                where: { userId: manager.id },
                update: { lastOutgoingAt: now, number: phone },
                create: { userId: manager.id, number: phone, lastOutgoingAt: now },
            });
            sent += 1;
            logger.info(`manager_reminder sent managerId=${manager.id}`);
        } else {
            failed += 1;
            logger.warn(`manager_reminder failed managerId=${manager.id}`);
        }
    }

    return { sent, failed, skipped };
}

export const touchConversation = async (userId: string, number: string) => {
    try {
        const now = new Date();

        return await prisma.whatsAppConversation.upsert({
            where: {
                userId,
            },
            update: {
                lastIncomingAt: now,
                windowExpiresAt: new Date(now.getTime() + DAY_IN_MS),
            },
            create: {
                userId,
                number,
                lastIncomingAt: now,
                windowExpiresAt: new Date(now.getTime() + DAY_IN_MS),
            },
        });
    } catch (error) {
        logger.error("Error in Add whatsapp Conversation", error);
        await notifyAdminError("add whatsapp conversation");
        throw new AppError("Error in add whatsapp Conversation , Internal server Error", error.message);
    }
};
