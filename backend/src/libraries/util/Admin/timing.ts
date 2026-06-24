import { Prisma } from "@prisma/client";
import { timeRange } from "domains/admin/Dashboard/service";
import {
    addCalendarDays,
    calendarDateFromParts,
    endOfCalendarDay,
    getISTCalendarParts,
    IST_OFFSET_MS,
} from "../Task/istDate";

export const convertTimeRangeintoDate = (
    time: timeRange
): Prisma.DateTimeFilter => {
    const now = new Date();
    const { y, m, d } = getISTCalendarParts(now);
    const todayStart = calendarDateFromParts(y, m, d);

    let startDate: Date;
    let endDate: Date = endOfCalendarDay(todayStart);

    switch (time) {
        case "today":
            startDate = todayStart;
            endDate = endOfCalendarDay(todayStart);
            break;

        case "yesterday": {
            const yesterday = addCalendarDays(todayStart, -1);
            startDate = yesterday;
            endDate = endOfCalendarDay(yesterday);
            break;
        }

        case "thisweek": {
            const shifted = new Date(now.getTime() + IST_OFFSET_MS);
            const day = shifted.getUTCDay();
            const diff = day === 0 ? -6 : 1 - day;
            startDate = addCalendarDays(todayStart, diff);
            endDate = endOfCalendarDay(addCalendarDays(startDate, 6));
            break;
        }

        case "lastweek": {
            const shifted = new Date(now.getTime() + IST_OFFSET_MS);
            const day = shifted.getUTCDay();
            const diff = day === 0 ? -6 : 1 - day;
            const thisMonday = addCalendarDays(todayStart, diff);
            startDate = addCalendarDays(thisMonday, -7);
            endDate = endOfCalendarDay(addCalendarDays(startDate, 6));
            break;
        }

        case "thismonth": {
            startDate = calendarDateFromParts(y, m, 1);
            const nextMonthStart =
                m === 12
                    ? calendarDateFromParts(y + 1, 1, 1)
                    : calendarDateFromParts(y, m + 1, 1);
            endDate = new Date(nextMonthStart.getTime() - 1);
            break;
        }

        case "lastmonth": {
            const lastMonthAnchor = addCalendarDays(calendarDateFromParts(y, m, 1), -1);
            const lm = getISTCalendarParts(lastMonthAnchor);
            startDate = calendarDateFromParts(lm.y, lm.m, 1);
            endDate = endOfCalendarDay(lastMonthAnchor);
            break;
        }

        case "thisyear":
            startDate = calendarDateFromParts(y, 1, 1);
            endDate = endOfCalendarDay(addCalendarDays(calendarDateFromParts(y + 1, 1, 1), -1));
            break;
    }

    return {
        gte: startDate,
        lte: endDate,
    };
};