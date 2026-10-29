export const CRON_SETTING_NAMES = {
    ASSIGN: "default_task_assign_time",
    /** Copy today's unfinished tasks onto tomorrow. Must run before assign. */
    REMAINING_TASK: "default_remaining_task_time",
    FOLLOWUP: "default_task_followup_time",
    ONTRACK: "default_task_ontrack_time",
    REMAINING_STATUS_DELAY: "default_remaining_status_delay",
    START_TASK_EARLY: "default_start_task_early",
} as const;

/** 9:00 PM IST. Assign sends tomorrow's tasks. */
export const DEFAULT_ASSIGN_CRON = "0 21 * * *";
/** 7:00 PM IST. Collects today's unfinished tasks before assign. */
export const DEFAULT_REMAINING_TASK_CRON = "0 19 * * *";

export const MINUTE_SETTING_NAMES = new Set<string>([
    CRON_SETTING_NAMES.REMAINING_STATUS_DELAY,
    CRON_SETTING_NAMES.START_TASK_EARLY,
]);

export const DEFAULT_REMAINING_STATUS_DELAY_MIN = 30;
export const DEFAULT_START_TASK_EARLY_MIN = 10;

export function isMinuteSettingName(name: string): boolean {
    return MINUTE_SETTING_NAMES.has(name);
}

export function parsePositiveMinutes(value: string | undefined, fallback: number): number {
    const parsed = parseInt(value ?? "", 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

type CronRow = { id: string; name: string; time: string };

export function resolveMinuteSetting(crons: CronRow[], name: string, fallbackMin: number): number {
    const entries = crons.filter((c) => c.name === name);
    const adminEntry = entries.find((c) => !c.id.startsWith("default_"));
    const raw = adminEntry?.time ?? entries.find((c) => c.id.startsWith("default_"))?.time;
    return parsePositiveMinutes(raw, fallbackMin);
}

/** Minute-of-day for a once-daily cron (`minute hour * * *`). Null if it is not that shape. */
export function dailyCronMinutes(cron: string): number | null {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return null;
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    if (dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*") return null;
    if (!/^\d{1,2}$/.test(minute) || !/^\d{1,2}$/.test(hour)) return null;
    const minuteNum = Number(minute);
    const hourNum = Number(hour);
    if (minuteNum > 59 || hourNum > 23) return null;
    return hourNum * 60 + minuteNum;
}

export function formatDailyMinutes(totalMinutes: number): string {
    const hour24 = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const period = hour24 < 12 ? "AM" : "PM";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

/**
 * Remaining-task collection must finish before assign sends tomorrow's list.
 * Returns an error message when the two daily times overlap or are out of order.
 */
export function remainingTaskScheduleError(remainingCron: string, assignCron: string): string | null {
    const remainingMinutes = dailyCronMinutes(remainingCron);
    const assignMinutes = dailyCronMinutes(assignCron);
    if (remainingMinutes == null || assignMinutes == null) {
        return "Remaining task time and task assign time must each be a once-daily time.";
    }
    if (remainingMinutes >= assignMinutes) {
        return `Remaining task time (${formatDailyMinutes(remainingMinutes)}) must be before task assign time (${formatDailyMinutes(assignMinutes)}).`;
    }
    return null;
}

export function resolveCronSetting(crons: CronRow[], name: string, fallback: string): string {
    const entries = crons.filter((c) => c.name === name);
    const adminEntry = entries.find((c) => !c.id.startsWith("default_"));
    return adminEntry?.time ?? entries.find((c) => c.id.startsWith("default_"))?.time ?? fallback;
}
