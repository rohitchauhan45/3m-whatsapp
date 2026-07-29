'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Upload, CheckCircle2, XCircle, FileCheck, UserPlus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, isAdmin } from '@/lib/utils/auth';
import { useToast } from '@/lib/providers/toast-provider';
import { usePageHeader } from '@/lib/utils/page-header-context';
import AdminDashboard from '@/components/features/admin/AdminDashboard';
import TaskImportPreviewTable, {
  type PreviewRow,
} from '@/components/features/admin/TaskImportPreviewTable';
import {
  previewTaskFile,
  createTasksFromPreview,
  enrichPreviewRowsForCreate,
  formatUploadErrorMessage,
} from '@/lib/services/taskService';
import AddUserTaskModal from '@/components/features/admin/AddUserTaskModal';
import {
  getSharedPreviewDate,
  validatePreviewRows,
} from '@/lib/utils/taskImportValidation';
import { ui } from '@/lib/utils/ui-classes';
import {
  invalidateAdminTasks,
  invalidateDashboardQueries,
} from '@/lib/query-keys';

type View = 'task' | 'upload' | 'preview' | 'done';

function TasksPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';
  const { setBreadcrumb, setOnBack } = usePageHeader();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('task');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const { showError } = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);

  const previewMutation = useMutation({
    mutationFn: previewTaskFile,
    onSuccess: (res) => {
      if (!res.success) {
        showError(formatUploadErrorMessage(res));
        return;
      }
      setPreviewRows(
        res.rows.map((row, index) => ({
          ...row,
          id: `${row.startRow}-${index}`,
        })),
      );
      setView('preview');
    },
    onError: (err: Error) => showError(err.message),
  });

  const createMutation = useMutation({
    mutationFn: createTasksFromPreview,
    onSuccess: (res) => {
      if (!res.success) {
        showError(formatUploadErrorMessage(res));
        return;
      }
      invalidateAdminTasks(queryClient);
      invalidateDashboardQueries(queryClient);
      setView('done');
    },
    onError: (err: Error) => showError(err.message),
  });

  const createResult = createMutation.data;

  useEffect(() => {
    if (view === 'task') {
      setBreadcrumb('Task');
      setOnBack(null);
    } else if (view === 'upload') {
      setBreadcrumb('Task / Add Task');
      setOnBack(() => setView('task'));
    } else if (view === 'preview') {
      setBreadcrumb('Task / Review');
      setOnBack(() => {
        setPreviewRows([]);
        setView('upload');
      });
    } else {
      setBreadcrumb('Task / Done');
      setOnBack(null);
    }
    return () => {
      setBreadcrumb(null);
      setOnBack(null);
    };
  }, [view, setBreadcrumb, setOnBack]);

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

  const handleCreate = () => {
    const validation = validatePreviewRows(previewRows);
    if (!validation.valid) {
      showError(validation.errors.join('\n'));
      return;
    }
    createMutation.mutate(enrichPreviewRowsForCreate(previewRows));
  };

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
              setView('task');
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

  if (view === 'preview') {
    return (
      <div className="animate-fade-in space-y-6">
        <TaskImportPreviewTable rows={previewRows} onChange={setPreviewRows} />

        <div className="flex justify-end gap-3">
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

  return (
    <AdminDashboard
      tab="task"
      initialSearch={initialSearch}
      onAddTask={() => setView('upload')}
    />
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksPageContent />
    </Suspense>
  );
}
