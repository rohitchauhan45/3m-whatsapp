export const finalDecisionMessage = (userName: string, tasks: { name: string }[]): string => {
    const lines: string[] = [
        `☀️ Hi ${userName.trim()}`,
        "",
        "Morning check — are today's tasks on track?",
    ];
    if (tasks.length > 0) {
        lines.push("");
        tasks.forEach((t, i) => lines.push(`${i + 1}. 📌 *${t.name.trim()}*`));
    }
    return lines.join("\n");
};
