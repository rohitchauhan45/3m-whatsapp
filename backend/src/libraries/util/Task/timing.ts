import { getISTCalendarParts, getISTTimeParts, getUTCDateParts, istDateTimeFromParts } from "./istDate";

/** True when both dates share the same IST calendar day, hour, and minute. */
export const isTaskStartNow = (startAt: Date, now = new Date()): boolean => {
    const sDate = getISTCalendarParts(startAt);
    const nDate = getISTCalendarParts(now);
    const sTime = getISTTimeParts(startAt);
    const nTime = getISTTimeParts(now);
    return (
        sDate.y === nDate.y &&
        sDate.m === nDate.m &&
        sDate.d === nDate.d &&
        sTime.hour === nTime.hour &&
        sTime.minute === nTime.minute
    );
};

/** True when `now` is the IST minute that is `earlyMs` before `startAt`. */
export const isTaskStartDueEarly = (
    startAt: Date,
    earlyMs: number,
    now = new Date(),
): boolean => {
    const sendAt = new Date(startAt.getTime() - earlyMs);
    return isTaskStartNow(sendAt, now);
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
        const { y, m, d } = getUTCDateParts(baseDate);
        return istDateTimeFromParts(y, m, d, hour, minute);
    }

    const twentyFour = value.match(/^(\d{1,2}):(\d{2})$/);
    if (twentyFour) {
        const hour = Number(twentyFour[1]);
        const minute = Number(twentyFour[2]);
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
        const { y, m, d } = getUTCDateParts(baseDate);
        return istDateTimeFromParts(y, m, d, hour, minute);
    }

    return null;
}
export const convertUserTimeToMinutes = (
    input: string
): number | null => {
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
        hours = Number(hourMatch[1]);
    }

    if (minuteMatch) {
        minutes = Number(minuteMatch[1]);
    }

    return hours * 60 + minutes;
};