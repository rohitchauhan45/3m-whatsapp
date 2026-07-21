export const previousTaskmsg = (tname: string, startTime: string, endTime: string) => {
    const lines: string[] = [` 📌 ${tname}`]
    lines.push(`⏱️ ${startTime} ---> ${endTime}`)
    lines.push("")
    lines.push("Task Already Ended so please update Final the Status")

    return lines.join("\n")
}