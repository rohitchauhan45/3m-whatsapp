import {
    WHATSAPP_BODY_MAX_CHARS,
    WHATSAPP_TASK_PREVIEW_COUNT,
    WHATSAPP_TEMPLATE_PARAM_MAX_CHARS,
    clampWhatsAppBody,
} from "./whatsappBodyLimit";

type AssignTaskItem = { name: string; rawStartTime: string; rawEndTime: string };

/** @deprecated use WHATSAPP_TEMPLATE_PARAM_MAX_CHARS */
export const ASSIGN_TEMPLATE_TASK_LIST_MAX_CHARS = WHATSAPP_TEMPLATE_PARAM_MAX_CHARS;
/** @deprecated use WHATSAPP_TASK_PREVIEW_COUNT */
export const ASSIGN_TASK_PREVIEW_COUNT = WHATSAPP_TASK_PREVIEW_COUNT;
/** @deprecated use WHATSAPP_BODY_MAX_CHARS */
export const ASSIGN_INTERACTIVE_BODY_MAX_CHARS = WHATSAPP_BODY_MAX_CHARS;

const formatTaskLine = (t: AssignTaskItem, separator: "-->" | "--->"): string =>
    `${t.rawStartTime.trim()} ${separator} ${t.rawEndTime.trim()} : *📌${t.name.trim()}*`;

const formatTaskLineTemplate = (t: AssignTaskItem): string =>
    `${t.rawStartTime.trim()} --> ${t.rawEndTime.trim()} : 📌 *${t.name.trim()}*`;

/**
 * Assign message body — always ≤ 1024 chars (Meta interactive / body limit).
 * If full list is too long: first few tasks + "....".
 */
export const sendAssignTaskMessage = (
    userName: string,
    tasks: AssignTaskItem[],
): string => {
    const build = (shown: AssignTaskItem[], truncated: boolean): string => {
        const lines: string[] = [];
        lines.push(`Hi ${userName.trim()}`);
        lines.push("");
        lines.push("📋 Tomorrow's tasks:");
        lines.push("");
        shown.forEach((t) => {
            lines.push(formatTaskLine(t, "--->"));
        });
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

/** Single-line task list for WhatsApp template {{task_list}} (no newlines allowed). */
export const formatAssignTaskListForTemplate = (
    tasks: AssignTaskItem[],
): string => {
    return tasks.map(formatTaskLineTemplate).join(" | ");
};

/**
 * Template {{task_list}}: full list when under char budget; otherwise first tasks + "....".
 * Always ≤ maxChars so Meta body stays under 1024.
 */
export const formatAssignTaskListForTemplatePreview = (
    tasks: AssignTaskItem[],
    maxChars: number = WHATSAPP_TEMPLATE_PARAM_MAX_CHARS,
): { text: string; truncated: boolean } => {
    if (tasks.length === 0) {
        return { text: "No tasks", truncated: false };
    }

    const join = (slice: AssignTaskItem[]) => slice.map(formatTaskLineTemplate).join(" | ");
    const full = join(tasks);
    if (full.length <= maxChars) {
        return { text: full, truncated: false };
    }

    let count = Math.min(WHATSAPP_TASK_PREVIEW_COUNT, tasks.length);
    let text = join(tasks.slice(0, count));

    while (text.length > maxChars && count > 1) {
        count -= 1;
        text = join(tasks.slice(0, count));
    }

    const withEllipsis = `${text} | ....`;
    text = withEllipsis.length <= maxChars
        ? withEllipsis
        : `${text.slice(0, Math.max(0, maxChars - 8))} | ....`;

    return { text, truncated: true };
};

/** Interactive assign body — always ≤ 1024 chars. */
export const buildAssignInteractiveMessage = (
    userName: string,
    tasks: AssignTaskItem[],
): { message: string; truncated: boolean } => {
    const full = (() => {
        const lines: string[] = [];
        lines.push(`Hi ${userName.trim()}`);
        lines.push("");
        lines.push("📋 Tomorrow's tasks:");
        lines.push("");
        tasks.forEach((t) => lines.push(formatTaskLine(t, "--->")));
        return lines.join("\n");
    })();

    const message = sendAssignTaskMessage(userName, tasks);
    return { message, truncated: full.length > WHATSAPP_BODY_MAX_CHARS };
};

export const sendManagerSummaryofAssisgnMessage = (
    managerName: string,
    sent: number,
    totalUsers: number,
    skippedNoTasks: number,
    skippedNoPhone: number,
    failedSends: number
): string => {
    const lines: string[] = [];
    lines.push(`Hi ${managerName.trim()}`);
    lines.push("");
    lines.push("Assignment summary");
    lines.push(`Sent to *${sent}* / *${totalUsers}* team members.`);
    lines.push("");
    if (skippedNoTasks > 0 || skippedNoPhone > 0 || failedSends > 0) {
        if (skippedNoTasks > 0) lines.push(`${skippedNoTasks} skipped (no tasks)`);
        if (skippedNoPhone > 0) lines.push(`📵 ${skippedNoPhone} skipped (no phone)`);
        if (failedSends > 0) lines.push(`⚠️ ${failedSends} send error(s)`);
        lines.push("");
    }
    return lines.join("\n");
};

const trimTaskName = (name: string): string => {
    const t = name.trim();
    return t.length > 14 ? t.slice(0, 14) : t;
};

export const sendManagerRemainingStatusMessage = (
    managerName: string,
    members: { name: string; number: string; tasks: string[] }[],
    declined: { name: string; number: string; tasks: string[]; reason: string }[] = [],
): string => {
    const lines: string[] = [];
    lines.push(`Hi ${managerName.trim()}`);
    lines.push("");

    if (members.length > 0) {
        lines.push("⏳ Pending responses — not accepted/declined yet:");
        lines.push("");
        members.forEach((m, i) => {
            lines.push(`${i + 1}. ${m.name.trim()} (${m.number})`);
            lines.push("");
        });
        lines.push(`👥 Total: *${members.length}* member remaining.`);
        lines.push("");
    }

    if (declined.length > 0) {
        lines.push("❌ Declined — with reason:");
        lines.push("");
        declined.forEach((m, i) => {
            lines.push(`${i + 1}. ${m.name.trim()} (${m.number})`);
            m.tasks.forEach((t) => lines.push(`   📌 ${trimTaskName(t)}`));
            lines.push(`   💬 ${m.reason.trim()}`);
            lines.push("");
        });
    }

    return lines.join("\n").trimEnd();
};
