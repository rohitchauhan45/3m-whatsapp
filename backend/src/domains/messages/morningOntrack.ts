const trimTaskName = (name: string): string => {
    const t = name.trim();
    return t.length > 14 ? t.slice(0, 14) : t;
};

export const morningRemarkResontoManager = (
    manager: string,
    user: string,
    number: string,
    tasks: [],
    reason: string,
): string => {
    const lines: string[] = [];
    lines.push(`Hi ${manager.trim()}`);
    lines.push("");
    lines.push("remark — with reason:");
    lines.push(`${user.trim()} (${number.trim()})`);
    tasks.forEach((t) => lines.push(`   📌 ${trimTaskName(t)}`));
    lines.push(`🚨 *${reason.trim()}*`);
    return lines.join("\n");
};

export const morningAbsentResontoManager = (
    manager: string,
    user: string,
    number: string,
    tasks: [],
    reason: string,
): string => {
    const lines: string[] = [];
    lines.push(`Heyy ${manager.trim()}`);
    lines.push("");
    lines.push("❌ *Declined — with reason:*");
    lines.push(`${user.trim()} (${number.trim()})`);
    tasks.forEach((t) => lines.push(`   📌 ${trimTaskName(t)}`));
    lines.push(`🚨 *${reason.trim()}*`);
    return lines.join("\n");
};