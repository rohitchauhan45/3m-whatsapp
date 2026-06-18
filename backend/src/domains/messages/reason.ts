export const reasonMessage = (type: string, name: string) => {
    const lines: string[] = [`👋 Hi *${name}*`];
    if (type === "decline") {
        lines.push("");
        lines.push("❓ Please share why you're declining this task:");
    } else if (type === "remark") {
        lines.push("");
        lines.push("📝 Please share the reason for this remark:");
    }
    return lines.join("\n");
};
