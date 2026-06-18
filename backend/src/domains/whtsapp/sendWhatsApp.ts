import axios, { isAxiosError } from "axios";
import dotenv from "dotenv";

dotenv.config();

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v25.0";
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

/** Max length for interactive reply `id` (Meta limit 256; keep margin). */
const BUTTON_REPLY_ID_MAX = 250;

export function normalizeWhatsAppNumber(raw: string): string {
    return raw.replace(/\D/g, "");
}

interface whatsappButton {
    title: string,
    id: string
}

interface whatsappmessagePayload {
    number:string,
    message:string
}

interface SendWhatsAppButtonPayload {
    number: string,
    message: string,
    buttons: whatsappButton[]
};

function axiosErrorPayload(error: unknown): string {
    if (isAxiosError(error)) {
        const data = error.response?.data;
        if (data !== undefined) return JSON.stringify(data);
        return error.message;
    }
    if (error instanceof Error) return error.message;
    return String(error);
}

export const sendMessageOnWhatsapp = async (data: whatsappmessagePayload) => {
    const { number, message } = data;

    const to = normalizeWhatsAppNumber(number);
    if (!to) {
        return { success: false, status: 400, message: "Invalid or empty phone number" };
    }

    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_ID) {
        return {
            success: false,
            status: 500,
            message: "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_ID in environment",
        };
    }

    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_ID}/messages`;

    try {
        const response = await axios.post<{
            messages?: { id: string }[];
        }>(
            url,
            {
                messaging_product: "whatsapp",
                to,
                type: "text",
                text: { body: message },
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
                validateStatus: () => true,
            }
        );

        if (response.status >= 200 && response.status < 300) {
            const id = response.data.messages?.[0]?.id;
            if (id) return { success: true, status: 200, message: id };
            return {
                success: false,
                status: response.status,
                message: JSON.stringify(response.data),
            };
        }

        return {
            success: false,
            status: response.status,
            message: JSON.stringify(response.data),
        };
    } catch (error) {
        console.error("WhatsApp send failed:", axiosErrorPayload(error));
        return {
            success: false,
            status: 500,
            message: axiosErrorPayload(error),
        };
    }
};

/**
 * Sends a plain-text body with Accept / Decline reply buttons (WhatsApp Cloud API `interactive.type: "button"`).
 */

export const sendWhatsAppButtons = async (data: SendWhatsAppButtonPayload) => {

    const { number, message, buttons } = data;

    const to = normalizeWhatsAppNumber(number);
    if (!to) {
        return { success: false, status: 400, message: "Invalid or empty phone number" };
    }

    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_ID) {
        return {
            success: false,
            status: 500,
            message: "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_ID in environment",
        };
    }

    if (!buttons || buttons.length === 0 || buttons.length > 3) {
        return {
            success: false,
            status: 400,
            message: "Buttons must be between 1 and 3",
        };
    }

    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_ID}/messages`;

    try {
        const response = await axios.post<{
            messages?: { id: string }[];
        }>(
            url,
            {
                messaging_product: "whatsapp",
                to,
                type: "interactive",
                interactive: {
                    type: "button",
                    body: {
                        text: message
                    },
                    action: {
                        buttons: buttons.map((btn) => ({
                            type: "reply",
                            reply: {
                                id: btn.id.trim().slice(0, BUTTON_REPLY_ID_MAX),
                                title: btn.title
                            }
                        }))
                    }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
                validateStatus:()=>true
            }
        );

        if (response.status >= 200 && response.status < 300) {
            const id = response.data.messages?.[0]?.id;
            if (id) return { success: true, status: 200, message: id };
            return {
                success: false,
                status: response.status,
                message: JSON.stringify(response.data),
            };
        }

        return {
            success: false,
            status: response.status,
            message: JSON.stringify(response.data),
        };
    } catch (error: unknown) {
        console.error("WhatsApp interactive send failed:", axiosErrorPayload(error));
        return {
            success: false,
            status: 500,
            message: axiosErrorPayload(error),
        };
    }
};
