export const CRON_SETTING_NAMES = {
    ASSIGN: "default_task_assign_time",
    FOLLOWUP: "default_task_followup_time",
    ONTRACK: "default_task_ontrack_time",
    REMAINING_STATUS_DELAY: "default_remaining_status_delay",
    START_TASK_EARLY: "default_start_task_early",
} as const;

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

export function resolveCronSetting(crons: CronRow[], name: string, fallback: string): string {
    const entries = crons.filter((c) => c.name === name);
    const adminEntry = entries.find((c) => !c.id.startsWith("default_"));
    return adminEntry?.time ?? entries.find((c) => c.id.startsWith("default_"))?.time ?? fallback;
}
