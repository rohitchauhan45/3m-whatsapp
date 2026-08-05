import type { DraftTaskRecord } from '@/lib/services/draftTaskService';
import type { PreviewRow } from '@/components/features/admin/TaskImportPreviewTable';
import {
  createdDayKey,
  formatTaskTabDate,
  formatTaskTabDateFromIso,
} from '@/lib/utils/taskTabDate';

export type DraftTaskCard = {
  key: string;
  taskCount: number;
  userCount: number;
  /** Task assignment date — shown in small text below "Draft" when set. */
  taskDate: string | null;
  createdAtLabel: string;
  createdAtSort: number;
  draftIds: string[];
  items: DraftTaskRecord[];
};

/** Drafts with a task date → one card per date. Drafts without date → one card per created day. */
export function groupDraftTasksIntoCards(items: DraftTaskRecord[]): DraftTaskCard[] {
  const map = new Map<string, DraftTaskRecord[]>();

  for (const item of items) {
    const rawTaskDate = item.date?.trim() || null;
    const normalizedTaskDate = rawTaskDate ? formatTaskTabDate(rawTaskDate) : null;
    const groupKey = normalizedTaskDate
      ? `task:${normalizedTaskDate}`
      : `created:${createdDayKey(item.createdAt)}`;
    const existing = map.get(groupKey) ?? [];
    existing.push(item);
    map.set(groupKey, existing);
  }

  return Array.from(map.entries())
    .map(([key, group]) => {
      const users = new Set(group.map((row) => row.uname.trim().toLowerCase()).filter(Boolean));
      const latestCreatedMs = group.reduce(
        (max, row) => Math.max(max, new Date(row.createdAt).getTime()),
        0,
      );
      const latestCreatedIso = new Date(latestCreatedMs).toISOString();
      const rawTaskDate = group[0]?.date?.trim() || null;
      const taskDate = rawTaskDate ? formatTaskTabDate(rawTaskDate) : null;

      return {
        key,
        taskCount: group.length,
        userCount: users.size,
        taskDate,
        createdAtLabel: formatTaskTabDateFromIso(latestCreatedIso),
        createdAtSort: latestCreatedMs,
        draftIds: group.map((row) => row.id),
        items: group,
      };
    })
    .sort((a, b) => b.createdAtSort - a.createdAtSort);
}

export function draftRecordsToPreviewRows(items: DraftTaskRecord[]): PreviewRow[] {
  return items.map((item, index) => ({
    id: item.id,
    name: item.uname,
    number: item.number ?? '',
    taskName: item.tname,
    rawStartTime: item.start ?? '',
    rawEndTime: item.end ?? '',
    date: item.date ?? undefined,
    startRow: index + 1,
  }));
}
