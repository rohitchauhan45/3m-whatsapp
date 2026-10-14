/** Meta interactive / template body max (characters). */
export const WHATSAPP_BODY_MAX_CHARS = 1024;

/** Max tasks to show when truncating long assign / morning lists. */
export const WHATSAPP_TASK_PREVIEW_COUNT = 5;

/** Keep template {{task_list}} under this so static template text + params stay ≤ 1024. */
export const WHATSAPP_TEMPLATE_PARAM_MAX_CHARS = 700;

/** Hard clamp a WhatsApp message body to the Meta max length. */
export function clampWhatsAppBody(
    text: string,
    maxChars: number = WHATSAPP_BODY_MAX_CHARS,
): string {
    if (text.length <= maxChars) return text;
    if (maxChars <= 4) return text.slice(0, maxChars);
    return `${text.slice(0, maxChars - 4)}\n....`;
}
