const formatDueDateTime = (d: Date): string => {
    return d.toLocaleString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
};

export const sendAssignTaskMessage = (
    userName: string,
    tasks: { name: string; endAt: Date }[]
): string => {
    const lines: string[] = [];
    lines.push(`👋 Hi *${userName.trim()}*`);
    lines.push("");
    lines.push("📋 *Today's tasks* — complete before due time:");
    lines.push("");
    tasks.forEach((t, i) => {
        lines.push(`${i + 1}. *${t.name.trim()}*`);
        lines.push(`   ⏰ Due: ${formatDueDateTime(t.endAt)}`);
        lines.push("");
    });
    lines.push("✅ Accept  ·  ❌ Decline — tap a button below.");
    return lines.join("\n");
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
    lines.push(`👋 Hi *${managerName.trim()}*`);
    lines.push("");
    lines.push("📊 *Assignment summary*");
    lines.push(`✅ Sent to *${sent}* / *${totalUsers}* team members.`);
    lines.push("");
    if (skippedNoTasks > 0 || skippedNoPhone > 0 || failedSends > 0) {
        if (skippedNoTasks > 0) lines.push(`⏭️ ${skippedNoTasks} skipped (no tasks)`);
        if (skippedNoPhone > 0) lines.push(`📵 ${skippedNoPhone} skipped (no phone)`);
        if (failedSends > 0) lines.push(`⚠️ ${failedSends} send error(s)`);
        lines.push("");
    }
    return lines.join("\n");
};

export const sendManagerRemainingStatusMessage = (
    managerName: string,
    members: { name: string; number: string; tasks: string[] }[],
): string => {
    const lines: string[] = [];
    lines.push(`👋 Hi *${managerName.trim()}*`);
    lines.push("");
    lines.push("⏳ *Pending responses* — not accepted/declined yet:");
    lines.push("");

    members.forEach((m, i) => {
        lines.push(`${i + 1}. *${m.name.trim()}* (${m.number})`);
        lines.push("");
    });

    lines.push(`👥 Total: *${members.length}* member(s) remaining.`);
    return lines.join("\n");
};
