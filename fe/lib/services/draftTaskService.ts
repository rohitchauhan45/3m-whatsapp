import { apiClient } from '@/lib/api/client';
import { ensurePreviewRowsHaveSharedDate } from '@/lib/utils/taskImportValidation';

export interface DraftTaskRecord {
  id: string;
  uname: string;
  number: string | null;
  date: string | null;
  tname: string;
  start: string | null;
  end: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DraftTaskImportRow {
  name: string;
  number?: string;
  date?: string;
  taskName: string;
  rawStartTime?: string;
  rawEndTime?: string;
}

export interface CreateDraftTasksResponse {
  success: boolean;
  status: number;
  message: string;
  data?: {
    items: DraftTaskRecord[];
    created: number;
  };
  error?: string;
}

export interface ListDraftTasksResponse {
  success: boolean;
  status: number;
  message: string;
  data?: {
    items: DraftTaskRecord[];
  };
  error?: string;
}

export interface DraftTaskResponse {
  success: boolean;
  status: number;
  message: string;
  data?: {
    item: DraftTaskRecord;
  };
  error?: string;
}

export interface UpdateDraftTaskPayload {
  uname?: string;
  number?: string | null;
  date?: string | null;
  tname?: string;
  start?: string | null;
  end?: string | null;
}

export async function createDraftTasks(rows: DraftTaskImportRow[]): Promise<CreateDraftTasksResponse> {
  const res = await apiClient.post('/draft', { rows }, { validateStatus: () => true });
  return res.data as CreateDraftTasksResponse;
}

export async function fetchDraftTasks(): Promise<ListDraftTasksResponse> {
  const { data } = await apiClient.get<ListDraftTasksResponse>('/draft');
  return data;
}

export async function fetchDraftTaskById(id: string): Promise<DraftTaskResponse> {
  const { data } = await apiClient.get<DraftTaskResponse>(`/draft/${id}`);
  return data;
}

export async function updateDraftTask(
  id: string,
  payload: UpdateDraftTaskPayload,
): Promise<DraftTaskResponse> {
  const res = await apiClient.patch(`/draft/${id}`, { data: payload }, { validateStatus: () => true });
  return res.data as DraftTaskResponse;
}

export async function deleteDraftTask(id: string): Promise<DraftTaskResponse> {
  const res = await apiClient.delete(`/draft/${id}`, { validateStatus: () => true });
  return res.data as DraftTaskResponse;
}

export async function deleteDraftTasks(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => deleteDraftTask(id)));
}

export function previewRowsToDraftImportRows(
  rows: Array<{
    name: string;
    number: string;
    date?: string;
    taskName: string;
    rawStartTime: string;
    rawEndTime: string;
  }>,
): DraftTaskImportRow[] {
  return rows.map((row) => ({
    name: row.name.trim(),
    ...(row.number.trim() ? { number: row.number.trim() } : {}),
    ...(row.date?.trim() ? { date: row.date.trim() } : {}),
    taskName: row.taskName.trim(),
    ...(row.rawStartTime.trim() ? { rawStartTime: row.rawStartTime.trim() } : {}),
    ...(row.rawEndTime.trim() ? { rawEndTime: row.rawEndTime.trim() } : {}),
  }));
}

export function isNewDraftPreviewRowId(id: string): boolean {
  return id.startsWith('new-');
}

function previewRowToDraftUpdatePayload(row: {
  name: string;
  number: string;
  date?: string;
  taskName: string;
  rawStartTime: string;
  rawEndTime: string;
}): UpdateDraftTaskPayload {
  return {
    uname: row.name.trim(),
    number: row.number.trim() ? row.number.trim() : null,
    date: row.date?.trim() || null,
    tname: row.taskName.trim(),
    start: row.rawStartTime.trim() || null,
    end: row.rawEndTime.trim() || null,
  };
}

export interface SyncDraftTasksResponse {
  success: boolean;
  status: number;
  message: string;
  error?: string;
  data?: {
    updated: number;
    created: number;
    deleted: number;
    createdItems: DraftTaskRecord[];
  };
}

/** Update existing draft rows, create new ones, and remove deleted rows. */
export async function syncDraftTasksFromPreview(
  existingDraftIds: string[],
  rows: Array<{
    id: string;
    name: string;
    number: string;
    date?: string;
    taskName: string;
    rawStartTime: string;
    rawEndTime: string;
  }>,
): Promise<SyncDraftTasksResponse> {
  const rowsWithDate = ensurePreviewRowsHaveSharedDate(rows);
  const currentIds = new Set(
    rowsWithDate.filter((row) => !isNewDraftPreviewRowId(row.id)).map((row) => row.id),
  );
  const idsToDelete = existingDraftIds.filter((id) => !currentIds.has(id));

  for (const id of idsToDelete) {
    const result = await deleteDraftTask(id);
    if (!result.success) {
      return {
        success: false,
        status: result.status,
        message: result.message || 'Failed to delete removed draft task',
        error: result.error,
      };
    }
  }

  const rowsToUpdate = rowsWithDate.filter((row) => !isNewDraftPreviewRowId(row.id));
  for (const row of rowsToUpdate) {
    const result = await updateDraftTask(row.id, previewRowToDraftUpdatePayload(row));
    if (!result.success) {
      return {
        success: false,
        status: result.status,
        message: result.message || 'Failed to update draft task',
        error: result.error,
      };
    }
  }

  const rowsToCreate = rowsWithDate.filter((row) => isNewDraftPreviewRowId(row.id));
  let createdItems: DraftTaskRecord[] = [];
  if (rowsToCreate.length > 0) {
    const createResult = await createDraftTasks(previewRowsToDraftImportRows(rowsToCreate));
    if (!createResult.success) {
      return {
        success: false,
        status: createResult.status,
        message: createResult.message || 'Failed to create new draft tasks',
        error: createResult.error,
      };
    }
    createdItems = createResult.data?.items ?? [];
  }

  const parts: string[] = [];
  if (rowsToUpdate.length > 0) parts.push(`${rowsToUpdate.length} updated`);
  if (createdItems.length > 0) parts.push(`${createdItems.length} added`);
  if (idsToDelete.length > 0) parts.push(`${idsToDelete.length} removed`);

  return {
    success: true,
    status: 200,
    message: parts.length > 0 ? `Draft saved (${parts.join(', ')}).` : 'Draft saved.',
    data: {
      updated: rowsToUpdate.length,
      created: createdItems.length,
      deleted: idsToDelete.length,
      createdItems,
    },
  };
}

export function applySyncedDraftRowIds<T extends { id: string }>(
  rows: T[],
  createdItems: DraftTaskRecord[],
): T[] {
  let createdIndex = 0;
  return rows.map((row) => {
    if (!isNewDraftPreviewRowId(row.id)) return row;
    const created = createdItems[createdIndex];
    if (!created) return row;
    createdIndex += 1;
    return { ...row, id: created.id };
  });
}

export function previewRowDraftIds(rows: Array<{ id: string }>): string[] {
  return rows.filter((row) => !isNewDraftPreviewRowId(row.id)).map((row) => row.id);
}
