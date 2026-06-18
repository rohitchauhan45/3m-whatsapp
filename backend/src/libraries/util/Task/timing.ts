/** True when both dates share the same calendar day, hour, and minute. */
export const isTaskStartNow = (startAt: Date, now = new Date()): boolean => {
    return (
        startAt.getFullYear() === now.getFullYear() &&
        startAt.getMonth() === now.getMonth() &&
        startAt.getDate() === now.getDate() &&
        startAt.getHours() === now.getHours() &&
        startAt.getMinutes() === now.getMinutes()
    );
};

export const parseTimeOnDate = (baseDate: Date, raw: string): Date | null => {
    const value = raw.trim().toLowerCase();
    if (!value) return null;

    const ampm = value.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)$/i);
    if (ampm) {
        let hour = Number(ampm[1]);
        const minute = Number(ampm[2] ?? "0");
        if (Number.isNaN(hour) || Number.isNaN(minute) || minute < 0 || minute > 59) return null;
        const period = ampm[3].toLowerCase();
        if (hour < 1 || hour > 12) return null;
        if (period === "am") {
            if (hour === 12) hour = 0;
        } else if (hour !== 12) {
            hour += 12;
        }
        return new Date(
            baseDate.getFullYear(),
            baseDate.getMonth(),
            baseDate.getDate(),
            hour,
            minute,
            0,
            0
        );
    }

    const twentyFour = value.match(/^(\d{1,2}):(\d{2})$/);
    if (twentyFour) {
        const hour = Number(twentyFour[1]);
        const minute = Number(twentyFour[2]);
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
        return new Date(
            baseDate.getFullYear(),
            baseDate.getMonth(),
            baseDate.getDate(),
            hour,
            minute,
            0,
            0
        );
    }

    return null;
}

export const convertUserTimeToHour = (input: string): string | null => {
    if (!input) return null;

    const time = input.toLowerCase().trim();

    const hourMatch = time.match(
        /(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs|h|kalak|કલાક)/i
    );

    const minuteMatch = time.match(
        /(\d+)\s*(minute|minutes|min|mins|m|મિનિટ|મિનિટો)/i
    );

    let hours = 0;
    let minutes = 0;

    if (hourMatch) {
        hours = Math.floor(Number(hourMatch[1]));
    }

    if (minuteMatch) {
        minutes = Number(minuteMatch[1]);
    }

    // only minutes
    if (!hourMatch && minuteMatch) {
        return `0.${String(minutes).padStart(2, "0")}`;
    }

    // only hours
    if (hourMatch && !minuteMatch) {
        return `${hours}.00`;
    }

    if (hourMatch && minuteMatch) {
        return `${hours}.${String(minutes).padStart(2, "0")}`;
    }

    return null;
};