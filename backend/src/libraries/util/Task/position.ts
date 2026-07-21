/**
 * Order tasks by their start time and assign a 1-based position.
 * e.g. 10am→1pm = 1, 1pm→3pm = 2, 3pm→7pm = 3.
 */
export const resolveTaskPositions = <T extends { startAt: Date }>(tasks: T[]): (T & { position: number })[] => {
    return [...tasks]
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
        .map((task, index) => ({ ...task, position: index + 1 }));
}
