import { Role } from "@prisma/client";
import { prisma } from "../../libraries/db";
import { normalizeWhatsAppNumber } from "../whtsapp/sendWhatsApp";

/** WhatsApp task flows only apply to team members (role user), not managers/admins. */
export async function findActiveTaskUserByWhatsAppNumber(number: string) {
    const normalized = normalizeWhatsAppNumber(number);
    if (!normalized) return null;

    return prisma.user.findFirst({
        where: {
            deletedAt: null,
            number: normalized,
            role: Role.user,
        },
    });
}
