type AssignTaskItem = { name: string; rawStartTime: string; rawEndTime: string };

/** Meta body (template static + params) max is 1024; keep task_list well under that. */
export const ASSIGN_TEMPLATE_TASK_LIST_MAX_CHARS = 700;
/** Show only the first N tasks in assign template / preview; full list after Accept. */
export const ASSIGN_TASK_PREVIEW_COUNT = 5;

const formatTaskLine = (t: AssignTaskItem, separator: "-->" | "--->"): string =>
    `${t.rawStartTime.trim()} ${separator} ${t.rawEndTime.trim()} : *📌${t.name.trim()}*`;

const formatTaskLineTemplate = (t: AssignTaskItem): string =>
    `${t.rawStartTime.trim()} --> ${t.rawEndTime.trim()} : 📌 *${t.name.trim()}*`;

/** WhatsApp interactive / button message body max. */
export const ASSIGN_INTERACTIVE_BODY_MAX_CHARS = 1024;

export const sendAssignTaskMessage = (
    userName: string,
    tasks: AssignTaskItem[],
    options?: { preview?: boolean },
): string => {
    const preview = options?.preview === true;
    const shown = preview ? tasks.slice(0, ASSIGN_TASK_PREVIEW_COUNT) : tasks;
    const truncated = preview && tasks.length > shown.length;

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
        lines.push(`(+${tasks.length - shown.length} more — full list after you Accept)`);
    }
    return lines.join("\n");
};

/** Single-line task list for WhatsApp template {{task_list}} (no newlines allowed). */
export const formatAssignTaskListForTemplate = (
    tasks: AssignTaskItem[],
): string => {
    return tasks.map(formatTaskLineTemplate).join(" | ");
};

/**
 * Template {{task_list}}: full list when under the char budget; otherwise first 4–5 tasks + "....".
 */
export const formatAssignTaskListForTemplatePreview = (
    tasks: AssignTaskItem[],
    maxChars: number = ASSIGN_TEMPLATE_TASK_LIST_MAX_CHARS,
): { text: string; truncated: boolean } => {
    if (tasks.length === 0) {
        return { text: "No tasks", truncated: false };
    }

    const join = (slice: AssignTaskItem[]) => slice.map(formatTaskLineTemplate).join(" | ");
    const full = join(tasks);
    if (full.length <= maxChars) {
        return { text: full, truncated: false };
    }

    let count = Math.min(ASSIGN_TASK_PREVIEW_COUNT, tasks.length);
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

/**
 * Interactive assign body: full list when under 1024 chars; otherwise preview + ellipsis.
 */
export const buildAssignInteractiveMessage = (
    userName: string,
    tasks: AssignTaskItem[],
): { message: string; truncated: boolean } => {
    const full = sendAssignTaskMessage(userName, tasks);
    if (full.length <= ASSIGN_INTERACTIVE_BODY_MAX_CHARS) {
        return { message: full, truncated: false };
    }

    let message = sendAssignTaskMessage(userName, tasks, { preview: true });
    if (message.length > ASSIGN_INTERACTIVE_BODY_MAX_CHARS) {
        message = `${message.slice(0, ASSIGN_INTERACTIVE_BODY_MAX_CHARS - 4)}\n....`;
    }
    return { message, truncated: true };
};

/** True when assign content did not fit in one template/interactive message — send full list after Accept. */
export const assignNeedsFullSummaryAfterAccept = (
    userName: string,
    tasks: AssignTaskItem[],
): boolean => {
    if (formatAssignTaskListForTemplate(tasks).length > ASSIGN_TEMPLATE_TASK_LIST_MAX_CHARS) {
        return true;
    }
    if (sendAssignTaskMessage(userName, tasks).length > ASSIGN_INTERACTIVE_BODY_MAX_CHARS) {
        return true;
    }
    return false;
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
