/** India Standard Time — fixed UTC+5:30 (no DST). */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Store a calendar day exactly as written in Excel (UTC midnight, no timezone shift). */
export function calendarDateFromParts(y: number, m: number, d: number): Date {
    return new Date(Date.UTC(y, m - 1, d));
}

export function getUTCDateParts(date: Date): { y: number; m: number; d: number } {
    return {
        y: date.getUTCFullYear(),
        m: date.getUTCMonth() + 1,
        d: date.getUTCDate(),
    };
}

export function addCalendarDays(date: Date, days: number): Date {
    const { y, m, d } = getUTCDateParts(date);
    return new Date(Date.UTC(y, m - 1, d + days));
}

/** Last millisecond of the stored calendar day (UTC date parts). */
export function endOfCalendarDay(date: Date): Date {
    return new Date(addCalendarDays(date, 1).getTime() - 1);
}

/** What calendar day is it right now in India? */
export function getISTCalendarParts(date: Date): { y: number; m: number; d: number } {
    const shifted = new Date(date.getTime() + IST_OFFSET_MS);
    return {
        y: shifted.getUTCFullYear(),
        m: shifted.getUTCMonth() + 1,
        d: shifted.getUTCDate(),
    };
}

export function getISTTimeParts(date: Date): { hour: number; minute: number; second: number } {
    const shifted = new Date(date.getTime() + IST_OFFSET_MS);
    return {
        hour: shifted.getUTCHours(),
        minute: shifted.getUTCMinutes(),
        second: shifted.getUTCSeconds(),
    };
}

/** IST wall-clock time on a stored calendar date. */
export function istDateTimeFromParts(
    y: number,
    m: number,
    d: number,
    hour: number,
    minute: number,
    second = 0
): Date {
    return new Date(Date.UTC(y, m - 1, d, hour, minute, second) - IST_OFFSET_MS);
}
