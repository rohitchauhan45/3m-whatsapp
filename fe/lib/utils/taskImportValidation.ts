import type { TaskPreviewRow } from '@/lib/services/taskService';

export const INDIAN_MOBILE_10_ERROR =
  'number must be exactly 10 digits starting with 6, 7, 8, or 9 (without country code 91)';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function digitsOnlyPhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidIndianMobile10(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(digits);
}

/** `DD-MM-YYYY` for API ↔ `YYYY-MM-DD` for `<input type="date">`. */
export function taskDateToInputValue(date: string): string {
  const match = date.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!match) return '';
  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function inputValueToTaskDate(value: string): string {
  const [y, m, d] = value.split('-');
  if (!y || !m || !d) return '';
  return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
}

function parseTaskDate(dateStr: string): Date | null {
  const match = dateStr.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!match) return null;

  const d = Number(match[1]);
  const m = Number(match[2]);
  const y = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt;
}

function getISTTodayCalendarDate(now = new Date()): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

function formatCalendarDateLabel(date: Date): string {
  const d = date.getUTCDate();
  const m = date.getUTCMonth() + 1;
  const y = date.getUTCFullYear();
  return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
}

export function validateTaskDate(date: string): string | null {
  const trimmed = date.trim();
  if (!trimmed) return 'Date is required.';
  if (!parseTaskDate(trimmed)) {
    return 'Date must be valid and use format DD-MM-YYYY (e.g. 30-05-2026).';
  }
  const parsed = parseTaskDate(trimmed);
  if (!parsed) return 'Date must be valid and use format DD-MM-YYYY (e.g. 30-05-2026).';
  if (parsed.getTime() <= getISTTodayCalendarDate().getTime()) {
    return `Date must be in the future (not today or past). Today is ${formatCalendarDateLabel(getISTTodayCalendarDate())} (IST).`;
  }
  return null;
}

export function isValidTaskTime(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (!value) return false;

  const ampm = value.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)$/i);
  if (ampm) {
    const hour = Number(ampm[1]);
    const minute = Number(ampm[2] ?? '0');
    if (Number.isNaN(hour) || Number.isNaN(minute) || minute < 0 || minute > 59) return false;
    if (hour < 1 || hour > 12) return false;
    return true;
  }

  const twentyFour = value.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  }

  return false;
}

const TIME_HINT = 'Use values like 9am, 11am, 4:25pm, or 16:30.';

export type PreviewValidationResult = {
  valid: boolean;
  errors: string[];
};

export function getSharedPreviewDate(rows: TaskPreviewRow[]): string {
  return rows.find((row) => row.date?.trim())?.date?.trim() ?? '';
}

export function validatePreviewRows(rows: TaskPreviewRow[]): PreviewValidationResult {
  const errors: string[] = [];

  if (rows.length === 0) {
    return { valid: false, errors: ['Add at least one task row.'] };
  }

  const sharedDate = getSharedPreviewDate(rows);
  const dateError = validateTaskDate(sharedDate);
  if (dateError) errors.push(dateError);

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const userLabel = row.name.trim() || `User ${index + 1}`;
    const taskLabel = row.taskName.trim() || `task ${index + 1}`;
    const label = `${userLabel} — ${taskLabel}`;

    if (!row.name.trim()) {
      errors.push(`${userLabel}: name is required.`);
    }

    const digits = digitsOnlyPhone(row.number);
    if (!isValidIndianMobile10(digits)) {
      errors.push(`${userLabel}: ${INDIAN_MOBILE_10_ERROR}`);
    }

    if (!row.taskName.trim()) {
      errors.push(`${label}: task name is required.`);
    }

    if (!row.rawStartTime.trim()) {
      errors.push(`${label}: start time is required.`);
    } else if (!isValidTaskTime(row.rawStartTime)) {
      errors.push(`${label}: invalid start time. ${TIME_HINT}`);
    }

    if (!row.rawEndTime.trim()) {
      errors.push(`${label}: end time is required.`);
    } else if (!isValidTaskTime(row.rawEndTime)) {
      errors.push(`${label}: invalid end time. ${TIME_HINT}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
