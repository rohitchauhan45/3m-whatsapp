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