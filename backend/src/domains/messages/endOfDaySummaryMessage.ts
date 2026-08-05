type EndOfDayUserStats = {
    totaluser: number;
    accept: number;
    decline: number;
};

type EndOfDayTaskStats = {
    totalTask: number;
    cancelledTask: number;
    pendingTask: number;
    remarkTask: number;
    complete: number;
};

export const formatEndOfDayManagerSummaryMessage = (
    managerName: string,
    dateLabel: string,
    users: EndOfDayUserStats,
    tasks: EndOfDayTaskStats,
): string => {
    const lines: string[] = [];
    lines.push(`👋 Hi ${managerName.trim()},`);
    lines.push("");
    lines.push(`📊 *End of day summary* — 📅 ${dateLabel}`);
    lines.push("");
    lines.push("👥 *Users (today)*");
    lines.push(`• 👤 Total users: *${users.totaluser}*`);
    lines.push(`• ✅ Accepted: *${users.accept}*`);
    lines.push(`• ❌ Declined: *${users.decline}*`);
    lines.push("");
    lines.push("📋 *Tasks (today)*");
    lines.push(`• 📌 Total tasks: *${tasks.totalTask}*`);
    lines.push(`• ✔️ Completed: *${tasks.complete}*`);
    lines.push(`• ⏳ Pending: *${tasks.pendingTask}*`);
    lines.push(`• 💬 Remark: *${tasks.remarkTask}*`);
    lines.push(`• 🚫 Cancelled: *${tasks.cancelledTask}*`);
    lines.push("");
    lines.push("🌙 How today worked for your team.");
    return lines.join("\n");
};

export const formatEndOfDayAdminSummaryMessage = (
    dateLabel: string,
    users: EndOfDayUserStats,
    tasks: EndOfDayTaskStats,
): string => {
    const lines: string[] = [];
    lines.push(`📊 *End of day summary (all users)* — 📅 ${dateLabel}`);
    lines.push("");
    lines.push("👥 *Users (today)*");
    lines.push(`• 👤 Total users: *${users.totaluser}*`);
    lines.push(`• ✅ Accepted: *${users.accept}*`);
    lines.push(`• ❌ Declined: *${users.decline}*`);
    lines.push("");
    lines.push("📋 *Tasks (today)*");
    lines.push(`• 📌 Total tasks: *${tasks.totalTask}*`);
    lines.push(`• ✔️ Completed: *${tasks.complete}*`);
    lines.push(`• ⏳ Pending: *${tasks.pendingTask}*`);
    lines.push(`• 💬 Remark: *${tasks.remarkTask}*`);
    lines.push(`• 🚫 Cancelled: *${tasks.cancelledTask}*`);
    lines.push("");
    lines.push("🌙 How today worked across all users.");
    return lines.join("\n");
};