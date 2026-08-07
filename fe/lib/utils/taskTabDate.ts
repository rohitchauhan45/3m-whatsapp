/** Shared date helpers for task tab cards, drafts, dashboard tables, and validation. */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const SHORT_MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

const MONTH_ALIASES: Record<string, string> = {
  jan: 'jan',
  january: 'jan',
  feb: 'feb',
  february: 'feb',
  mar: 'mar',
  march: 'mar',
  apr: 'apr',
  april: 'apr',
  may: 'may',
  jun: 'jun',
  june: 'jun',
  jul: 'jul',
  july: 'jul',
  aug: 'aug',
  august: 'aug',
  sep: 'sep',
  sept: 'sep',
  september: 'sep',
  oct: 'oct',
  october: 'oct',
  nov: 'nov',
  november: 'nov',
  dec: 'dec',
  december: 'dec',
};

function normalizeMonthToken(token: string): string | null {
  const key = token.trim().toLowerCase();
  return MONTH_ALIASES[key] ?? MONTH_ALIASES[key.slice(0, 3)] ?? null;
}

export function getUTCDateParts(date: Date): { y: number; m: number; d: number } {
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
  };
}

export function getISTCalendarParts(value: string | Date): { y: number; m: number; d: number } {
  const date = typeof value === 'string' ? new Date(value) : value;
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
  };
}

export function getISTTodayCalendarDate(now = new Date()): Date {
  const { y, m, d } = getISTCalendarParts(now);
  return new Date(Date.UTC(y, m - 1, d));
}

/** `27-jun`, `01-jan`, etc. */
export function formatDayMonth(day: number, monthIndex: number): string {
  const month = SHORT_MONTHS[monthIndex - 1] ?? '';
  return `${String(day).padStart(2, '0')}-${month}`;
}

/** Parse common date strings into `27-jun` format. */
export function formatTaskTabDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const dmy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    if (month >= 1 && month <= 12) {
      return formatDayMonth(day, month);
    }
  }

  const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (month >= 1 && month <= 12) {
      return formatDayMonth(day, month);
    }
  }

  const short = trimmed.match(/^(\d{1,2})[-/]([a-z]+)$/i);
  if (short) {
    const day = Number(short[1]);
    const month = normalizeMonthToken(short[2]);
    if (month) {
      const monthIndex = SHORT_MONTHS.indexOf(month as (typeof SHORT_MONTHS)[number]) + 1;
      if (monthIndex > 0) return formatDayMonth(day, monthIndex);
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDayMonth(parsed.getUTCDate(), parsed.getUTCMonth() + 1);
  }

  return trimmed;
}

/** Format ISO timestamp using IST calendar day (e.g. draft `createdAt`). */
export function formatTaskTabDateFromIso(iso: string): string {
  const parts = getISTCalendarParts(iso);
  return formatDayMonth(parts.d, parts.m);
}

/** Format stored calendar `Date` using UTC parts (e.g. daily task date). */
export function formatTaskTabDateFromDate(date: Date): string {
  const parts = getUTCDateParts(date);
  return formatDayMonth(parts.d, parts.m);
}

/** Group drafts without task date by created day (IST). */
export function createdDayKey(iso: string): string {
  const parts = getISTCalendarParts(iso);
  return `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
}

/** `DD-MM-YYYY` for API / validation messages. */
export function formatCalendarDateLabel(date: Date): string {
  const { y, m, d } = getUTCDateParts(date);
  return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
}

/** `DD-MM-YYYY` from ISO string (UTC calendar parts). */
export function formatDayMonthYearFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return formatCalendarDateLabel(d);
}

/** Dashboard tables — same `27-jun` format (UTC calendar parts). */
export function formatShortDisplayDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return formatTaskTabDateFromDate(d);
}

/** Completed task time in IST — e.g. `10:30am`, `11:34pm`. */
export function formatCompletedAtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const formatted = d.toLocaleString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
  return formatted.replace(':00 ', ' ').replace(/\s(am|pm)/i, '$1').toLowerCase();
}
