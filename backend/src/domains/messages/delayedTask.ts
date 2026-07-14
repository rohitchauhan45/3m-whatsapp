const formatExtraMinutes = (mins: number): string => {
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (minutes === 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
    return `${hours} hour${hours > 1 ? "s" : ""} ${minutes} min`;
};

export const delayinprogressTaskMessagetoManager = (
    managerName: string,
    userName: string,
    number: string,
    task: {
        name: string;
        startTime: string;
        oldEndTime: string;
        newEndTime: string;
        extraMinutes: number;
    },
): string => {
    const lines: string[] = [];
    lines.push(`👋 Hi *${managerName.trim()}*`);
    lines.push("");
    lines.push("⚠️ *Task delayed*");
    lines.push(`*${userName.trim()}* (${number.trim()})`);
    lines.push("");
    lines.push(`📌 *${task.name.trim()}*`);
    lines.push(`▶️ Start: *${task.startTime.trim()}*`);
    lines.push(`🕐 End was: *${task.oldEndTime.trim()}*`);
    lines.push(`🔴 New end: *${task.newEndTime.trim()}*`);
    lines.push(`⏳ Extra time: *+${formatExtraMinutes(task.extraMinutes)}*`);
    return lines.join("\n");
};


export const delaystartTaskMessagetoManager = (
    managerName: string,
    userName: string,
    number: string,
    task: {
        name: string;
        oldStartTime: string;
        newStartTime:string
        oldEndTime: string;
        newEndTime: string;
        extraMinutes: number;
    },
): string => {
    const lines: string[] = [];
    lines.push(`👋 Hi *${managerName.trim()}*`);
    lines.push("");
    lines.push("⚠️ *Start Task delayed*");
    lines.push(`*${userName.trim()}* (${number.trim()})`);
    lines.push("");
    lines.push(`📌 *${task.name.trim()}*`);
    lines.push(`⏱️ Start was : *${task.oldStartTime.trim()}*`);
    lines.push(`▶️ New Start : *${task.oldStartTime.trim()}*`);
    lines.push(`🕐 End was: *${task.oldEndTime.trim()}*`);
    lines.push(`🔴 New end: *${task.newEndTime.trim()}*`);
    lines.push(`⏳ Extra time : *+${formatExtraMinutes(task.extraMinutes)}*`);
    return lines.join("\n");
};