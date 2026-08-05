'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Upload, CheckCircle2, XCircle, FileCheck, UserPlus, FilePenLine } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, isAdmin } from '@/lib/utils/auth';
import { useToast } from '@/lib/providers/toast-provider';
import { usePageHeader } from '@/lib/utils/page-header-context';
import AdminDashboard from '@/components/features/admin/AdminDashboard';
import TaskDayCards from '@/components/features/admin/TaskDayCards';
import TaskImportPreviewTable, {
  type PreviewRow,
} from '@/components/features/admin/TaskImportPreviewTable';
import {
  previewTaskFile,
  createTasksFromPreview,
  enrichPreviewRowsForCreate,
  formatUploadErrorMessage,
  fetchAllTasks,
  type AdminTaskDay,
} from '@/lib/services/taskService';
import type { TimeRange } from '@/lib/services/dashboardService';
import {
  applySyncedDraftRowIds,
  createDraftTasks,
  previewRowDraftIds,
  previewRowsToDraftImportRows,
  fetchDraftTasks,
  deleteDraftTasks,
  syncDraftTasksFromPreview,
} from '@/lib/services/draftTaskService';
import {
  groupDraftTasksIntoCards,
  draftRecordsToPreviewRows,
  type DraftTaskCard,
} from '@/lib/utils/draftTaskCards';
import AddUserTaskModal from '@/components/features/admin/AddUserTaskModal';
import {
  getSharedPreviewDate,
  validatePreviewRows,
  validateDraftPreviewRows,
  ensurePreviewRowsHaveSharedDate,
} from '@/lib/utils/taskImportValidation';
import { ui } from '@/lib/utils/ui-classes';
import {
  invalidateAdminTasks,
  invalidateDashboardQueries,
  invalidateDraftTasks,
  queryKeys,
} from '@/lib/query-keys';
import { cachedQueryOptions } from '@/lib/query-config';

type View = 'days' | 'dashboard' | 'upload' | 'preview' | 'draft-preview' | 'done';

function dayToTimeRange(day: AdminTaskDay): TimeRange {
  if (day.label === 'Today') return 'today';
  if (day.label === 'Yesterday') return 'yesterday';
  if (day.label === 'Tomorrow') return 'tomorrow';
  return day.date;
}

function dayBreadcrumbLabel(day: AdminTaskDay): string {
  if (day.label === 'Today' || day.label === 'Yesterday' || day.label === 'Tomorrow') {
    return day.label;
  }
  return day.date;
}

function TasksPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';
  const { setBreadcrumb, setOnBack } = usePageHeader();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>(initialSearch ? 'dashboard' : 'days');
  const [selectedDay, setSelectedDay] = useState<AdminTaskDay | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [activeDraftIds, setActiveDraftIds] = useState<string[]>([]);
  const { showError, showSuccess } = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: queryKeys.adminTasks,
    queryFn: fetchAllTasks,
    enabled: !!user?.id && isAdmin(user),
    ...cachedQueryOptions,
  });

  const days = tasksData?.days ?? [];

  const { data: draftsData, isLoading: draftsLoading } = useQuery({
    queryKey: queryKeys.draftTasks,
    queryFn: fetchDraftTasks,
    enabled: !!user?.id && isAdmin(user),
    ...cachedQueryOptions,
  });

  const draftCards = groupDraftTasksIntoCards(draftsData?.data?.items ?? []);
  const cardsLoading = tasksLoading || draftsLoading;

  const previewMutation = useMutation({
    mutationFn: previewTaskFile,
    onSuccess: (res) => {
      if (!res.success) {
        showError(formatUploadErrorMessage(res));
        return;
      }
      const mappedRows = res.rows.map((row, index) => ({
        ...row,
        id: `${row.startRow}-${index}`,
      }));
      setPreviewRows(mappedRows);
      setView('preview');
    },
    onError: (err: Error) => showError(err.message),
  });

  const createMutation = useMutation({
    mutationFn: createTasksFromPreview,
    onSuccess: async (res) => {
      if (!res.success) {
        showError(formatUploadErrorMessage(res));
        return;
      }
      if (activeDraftIds.length > 0) {
        try {
          await deleteDraftTasks(activeDraftIds);
        } catch {
          showError('Tasks created but draft cleanup failed. Please delete drafts manually.');
        }
        setActiveDraftIds([]);
      }
      invalidateAdminTasks(queryClient);
      invalidateDashboardQueries(queryClient);
      invalidateDraftTasks(queryClient);
      setView('done');
    },
    onError: (err: Error) => showError(err.message),
  });

  const draftMutation = useMutation({
    mutationFn: async (input: {
      mode: 'create' | 'sync';
      rows: PreviewRow[];
      existingIds?: string[];
    }) => {
      if (input.mode === 'sync' && input.existingIds) {
        return syncDraftTasksFromPreview(input.existingIds, input.rows);
      }
      return createDraftTasks(previewRowsToDraftImportRows(input.rows));
    },
    onSuccess: (res, variables) => {
      if (!res.success) {
        showError(res.message || res.error || 'Failed to save draft');
        return;
      }
      showSuccess(res.message || 'Draft saved');
      invalidateDraftTasks(queryClient);

      if (variables.mode === 'sync') {
        const createdItems =
          'data' in res && res.data && 'createdItems' in res.data
            ? res.data.createdItems
            : [];
        const datedRows = ensurePreviewRowsHaveSharedDate(variables.rows);
        const nextRows = applySyncedDraftRowIds(datedRows, createdItems);
        setPreviewRows(nextRows);
        setActiveDraftIds(previewRowDraftIds(nextRows));
        return;
      }

      setPreviewRows([]);
      setActiveDraftIds([]);
      setView('days');
    },
    onError: (err: Error) => showError(err.message),
  });

  const createResult = createMutation.data;

  useEffect(() => {
    if (view === 'days') {
      setBreadcrumb('Task');
      setOnBack(null);
    } else if (view === 'dashboard') {
      const detail = selectedDay ? dayBreadcrumbLabel(selectedDay) : 'Detail';
      setBreadcrumb(`Task / ${detail}`);
      setOnBack(() => {
        setSelectedDay(null);
        setView('days');
      });
    } else if (view === 'upload') {
      setBreadcrumb('Task / Add Task');
      setOnBack(() => setView(selectedDay ? 'dashboard' : 'days'));
    } else if (view === 'preview') {
      setBreadcrumb('Task / Review');
      setOnBack(() => {
        setPreviewRows([]);
        setView('upload');
      });
    } else if (view === 'draft-preview') {
      setBreadcrumb('Task / Draft');
      setOnBack(() => {
        setPreviewRows([]);
        setActiveDraftIds([]);
        setView('days');
      });
    } else {
      setBreadcrumb('Task / Done');
      setOnBack(null);
    }
    return () => {
      setBreadcrumb(null);
      setOnBack(null);
    };
  }, [view, selectedDay, setBreadcrumb, setOnBack]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) previewMutation.mutate(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) previewMutation.mutate(file);
  };

  const handleSelectDay = (day: AdminTaskDay) => {
    setSelectedDay(day);
    setView('dashboard');
  };

  const handleSelectDraft = (card: DraftTaskCard) => {
    setActiveDraftIds(card.draftIds);
    setPreviewRows(draftRecordsToPreviewRows(card.items));
    setView('draft-preview');
  };

  const handleCreate = () => {
    const validation = validatePreviewRows(previewRows);
    if (!validation.valid) {
      showError(validation.errors.join('\n'));
      return;
    }
    createMutation.mutate(enrichPreviewRowsForCreate(previewRows));
  };

  const handleDraft = () => {
    const rowsToSave = ensurePreviewRowsHaveSharedDate(previewRows);
    const validation = validateDraftPreviewRows(rowsToSave);
    if (!validation.valid) {
      showError(validation.errors.join('\n'));
      return;
    }

    if (rowsToSave !== previewRows) {
      setPreviewRows(rowsToSave);
    }

    if (activeDraftIds.length > 0) {
      draftMutation.mutate({
        mode: 'sync',
        existingIds: activeDraftIds,
        rows: rowsToSave,
      });
      return;
    }

    draftMutation.mutate({ mode: 'create', rows: rowsToSave });
  };

  const previewActions = () => (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        disabled={draftMutation.isPending || previewRows.length === 0}
        onClick={handleDraft}
        className={ui.btnDraft}
      >
        <FilePenLine size={16} />
        {draftMutation.isPending
          ? activeDraftIds.length > 0
            ? 'Updating draft...'
            : 'Saving draft...'
          : activeDraftIds.length > 0
            ? 'Update draft'
            : 'Draft'}
      </button>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setAddUserOpen(true)}
          className={ui.btnPrimary}
        >
          <UserPlus size={16} />
          Add User
        </button>
        <button
          type="button"
          disabled={createMutation.isPending || previewRows.length === 0}
          onClick={handleCreate}
          className={ui.btnPrimaryLg}
        >
          {createMutation.isPending ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  );

  if (!isAdmin(user)) {
    return (
      <div className="text-center py-20 text-gray-500">
        You do not have access to this page.
      </div>
    );
  }

  if (view === 'done') {
    return (
      <div className="animate-fade-in border border-green-200 bg-green-50 rounded-2xl p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
            <FileCheck size={28} className="text-green-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900 mb-1">Tasks created successfully</p>
            <p className="text-sm text-gray-500 mb-6">
              {createResult?.message || 'Welcome messages are sending in the background.'}
            </p>
          </div>
          <button
            onClick={() => {
              createMutation.reset();
              previewMutation.reset();
              setPreviewRows([]);
              setActiveDraftIds([]);
              setView('days');
            }}
            className={ui.btnPrimaryWide}
          >
            <CheckCircle2 size={16} />
            Done
          </button>
        </div>
      </div>
    );
  }

  if (view === 'preview' || view === 'draft-preview') {
    return (
      <div className="animate-fade-in space-y-6">
        <TaskImportPreviewTable rows={previewRows} onChange={setPreviewRows} />
        {previewActions()}

        <AddUserTaskModal
          open={addUserOpen}
          onClose={() => setAddUserOpen(false)}
          defaultDate={getSharedPreviewDate(previewRows)}
          submitLabel="Add to list"
          onSubmit={(rows) => {
            setPreviewRows((prev) => [...prev, ...rows]);
            setAddUserOpen(false);
          }}
        />
      </div>
    );
  }

  if (view === 'upload') {
    return (
      <div className="animate-fade-in">
        {previewMutation.isError ? (
          <div className="border border-red-200 bg-red-50 rounded-2xl p-12 text-center">
            <XCircle size={28} className="text-red-600 mx-auto mb-3" />
            <p className="text-red-900">Could not read file. Please try again.</p>
            <button
              onClick={() => previewMutation.reset()}
              className={`mt-4 ${ui.btnPrimaryLg}`}
            >
              Try again
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
              dragOver ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {previewMutation.isPending ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={40} className="animate-spin text-gray-400" />
                <p className="text-gray-600 font-medium">Reading file...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <Upload size={28} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900 mb-1">Upload assignTask.xlsx</p>
                  <p className="text-sm text-gray-500 mb-4">Drag and drop your file here, or click to browse</p>
                </div>
                <label className={`cursor-pointer ${ui.btnPrimaryLg}`}>
                  Choose File
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (view === 'dashboard') {
    return (
      <AdminDashboard
        tab="task"
        initialSearch={initialSearch}
        initialTimeRange={selectedDay ? dayToTimeRange(selectedDay) : 'today'}
        onAddTask={() => setView('upload')}
      />
    );
  }

  if (view === 'days') {
    return (
      <TaskDayCards
        days={days}
        draftCards={draftCards}
        isLoading={cardsLoading}
        onSelectDay={handleSelectDay}
        onSelectDraft={handleSelectDraft}
        onAddTask={() => setView('upload')}
      />
    );
  }

  return null;
}

export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksPageContent />
    </Suspense>
  );
}
