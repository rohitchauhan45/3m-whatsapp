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

/** Fixed IST slots for hourly follow-up (11am, 1pm, 4pm, 6pm). */
export const HOURLY_FOLLOW_UP_SLOTS = [
    { hour: 11, minute: 0 },
    { hour: 13, minute: 0 },
    { hour: 16, minute: 0 },
    { hour: 18, minute: 0 },
] as const;

/** Cron expressions (minute hour * * *) for each hourly follow-up slot in IST. */
export const HOURLY_FOLLOW_UP_CRON_SCHEDULES = HOURLY_FOLLOW_UP_SLOTS.map(
    (slot) => `${slot.minute} ${slot.hour} * * *`,
);

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Hourly follow-up window: task started at least 2h ago and ends at least 2h from now.
 * e.g. at 11am → start <= 9am and end >= 1pm.
 */
export const isTaskDueForHourlyFollowUp = (
    startAt: Date,
    endAt: Date,
    now = new Date(),
): boolean => {
    const earliestStart = now.getTime() - TWO_HOURS_MS;
    const latestEnd = now.getTime() + TWO_HOURS_MS;
    return startAt.getTime() <= earliestStart && endAt.getTime() >= latestEnd;
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
};

/** Format an IST wall-clock time like Excel uploads (`9am`, `9:30pm`). */
export const formatISTTimeLabel = (date: Date): string => {
    const { hour: h24, minute } = getISTTimeParts(date);
    let hour = h24;
    const period = hour >= 12 ? "pm" : "am";
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    if (minute > 0) {
        return `${hour}:${String(minute).padStart(2, "0")}${period}`;
    }
    return `${hour}${period}`;
};

/** Shift a stored raw time string by minutes; preserves 24h vs am/pm style when possible. */
export const shiftRawTimeByMinutes = (
    baseDate: Date,
    raw: string,
    minutes: number,
): string | null => {
    const parsed = parseTimeOnDate(baseDate, raw);
    if (!parsed) return null;

    const shifted = new Date(parsed.getTime() + minutes * 60_000);
    const value = raw.trim().toLowerCase();

    if (/^\d{1,2}:\d{2}$/.test(value)) {
        const { hour, minute: min } = getISTTimeParts(shifted);
        return `${hour}:${String(min).padStart(2, "0")}`;
    }

    return formatISTTimeLabel(shifted);
};

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