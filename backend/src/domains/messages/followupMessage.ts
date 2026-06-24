export const userFollowUpTaskMessage = (task: {
    name: string;
    description: string | null;
    rawStartTime?: string;
}): string => {
    const lines: string[] = [`🔔 *${task.name.trim()}*`];
    if (task.rawStartTime?.trim()) {
        lines.push(`⏰ Starts at *${task.rawStartTime.trim()}*`);
    }
    if (task.description?.trim()) {
        lines.push(`📝 ${task.description.trim()}`);
    }
    lines.push("");
    lines.push("Update status — tap a button:");
    return lines.join("\n");
};

export const managerFollowUpSummaryMessage = (
    managerName: string,
    sent: number,
    totalTasks: number,
    totalUsers: number,
    skippedNoTasks: number,
    skippedNoPhone: number,
    failedSends: number
): string => {
    const lines: string[] = [];
    lines.push(`👋 Hi *${managerName.trim()}*`);
    lines.push("");
    lines.push("📊 *Follow-up summary*");
    lines.push(`✅ *${sent}* sent · *${totalTasks}* tasks · *${totalUsers}* members`);
    lines.push("");
    if (skippedNoTasks > 0 || skippedNoPhone > 0 || failedSends > 0) {
        if (skippedNoTasks > 0) lines.push(`⏭️ ${skippedNoTasks} skipped (no tasks)`);
        if (skippedNoPhone > 0) lines.push(`📵 ${skippedNoPhone} skipped (no phone)`);
        if (failedSends > 0) lines.push(`⚠️ ${failedSends} send error(s)`);
        lines.push("");
    }
    return lines.join("\n");
};

export const userInprogressTask = (): string => {
    return "⏳ How much of this task is complete? Reply with % or status.";
};

export const taskremarkresontoManager = (
    manager: string,
    user: string,
    number: string,
    task: string,
    reason: string,
): string => {
    const taskShort = task.trim().length > 14 ? task.trim().slice(0, 14) : task.trim();
    const lines: string[] = [];
    lines.push(`👋 Hi *${manager.trim()}*`);
    lines.push("");
    lines.push("📝 *Task remark*");
    lines.push(`*${user.trim()}* (${number.trim()})`);
    lines.push(`📌 ${taskShort}`);
    lines.push(`💬 ${reason.trim()}`);
    return lines.join("\n");
};