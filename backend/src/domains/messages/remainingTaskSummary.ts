export const formatRemainingTaskSummaryMessage = (
    total: number,
    completed: number,
    cancelled: number,
    createdForTomorrow: number,
): string => {
    const lines: string[] = [];
    lines.push("today");
    lines.push(`total task : ${total}`);
    lines.push(`completed task : ${completed}`);
    lines.push(`cancelled task : ${cancelled}`);
    lines.push(`create for the tomorrow task : ${createdForTomorrow}`);
    return lines.join("\n");
};
