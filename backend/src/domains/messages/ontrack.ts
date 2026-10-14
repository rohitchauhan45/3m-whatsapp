import {
    WHATSAPP_BODY_MAX_CHARS,
    WHATSAPP_TASK_PREVIEW_COUNT,
    clampWhatsAppBody,
} from "./whatsappBodyLimit";

/**
 * Morning on-track interactive body — always ≤ 1024 chars (Meta limit).
 * Long task lists: first few names + "....".
 */
export const finalDecisionMessage = (userName: string, tasks: { name: string }[]): string => {
    const header = [
        `☀️ Hi ${userName.trim()}`,
        "",
        "Morning check — are today's tasks on track?",
    ];

    const build = (shown: { name: string }[], truncated: boolean): string => {
        const lines = [...header];
        if (shown.length > 0) {
            lines.push("");
            shown.forEach((t, i) => lines.push(`${i + 1}. 📌 *${t.name.trim()}*`));
        }
        if (truncated) {
            lines.push("....");
            lines.push(`(+${tasks.length - shown.length} more tasks)`);
        }
        return lines.join("\n");
    };

    const full = build(tasks, false);
    if (full.length <= WHATSAPP_BODY_MAX_CHARS) {
        return full;
    }

    let count = Math.min(WHATSAPP_TASK_PREVIEW_COUNT, tasks.length);
    let message = build(tasks.slice(0, count), tasks.length > count);

    while (message.length > WHATSAPP_BODY_MAX_CHARS && count > 1) {
        count -= 1;
        message = build(tasks.slice(0, count), true);
    }

    return clampWhatsAppBody(message);
};
