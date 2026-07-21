export const reasonMessage = (type: string, name: string) => {
    const lines: string[] = [`👋 Heyy ${name}`];
    if (type === "decline") {
        lines.push("");
        lines.push("❓ Please share why you're declining this task:");
    } else if (type === "remark") {
        lines.push("");
        lines.push("📝 Please share the reason for this Bloack/Remark:");
    } else if (type === "absent") {
        lines.push("")
        lines.push(" ❓ We noticed that you are absent today. Yesterday, you mentioned that you would be attending. Could you please share the reason for your absence ? ")
    }
    return lines.join("\n");
};
