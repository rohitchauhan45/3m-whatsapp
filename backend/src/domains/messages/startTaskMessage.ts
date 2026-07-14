export const startTaskEarlyMessage = (task: {
    name: string;
    rawStartTime: string;
    rawEndTime: string;
    description: string | null;
}): string => {
    const lines: string[] = [`📌 *${task.name.trim()}*`];
    lines.push(`⏰ ${task.rawStartTime.trim()} ---> ${task.rawEndTime.trim()}`);
    if (task.description?.trim()) {
        lines.push(`📝 ${task.description.trim()}`);
    }
    lines.push("");
    lines.push("Update status — tap a button below.");
    return lines.join("\n");
};

export const taskStartNowMessage = (task: {
    name: string;
    rawEndTime: string;
}): string => {
    const lines: string[] = [];
    lines.push(`📌 *${task.name.trim()}*`);
    lines.push(`⏰ Complete by: *${task.rawEndTime.trim()}*`);
    lines.push("");
    lines.push("▶️ Please start this task now.");
    return lines.join("\n");
};
