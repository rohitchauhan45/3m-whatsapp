'use client';

import { useState, useEffect } from 'react';
import { Plus, Loader2, Upload, CheckCircle2, XCircle, Clock, FileCheck, Users, Calendar } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/utils/auth';
import { useToast } from '@/lib/providers/toast-provider';
import { usePageHeader } from '@/lib/utils/page-header-context';
import {
  fetchAllTasks,
  uploadTaskFile,
  formatUploadErrorMessage,
  type AdminTaskDay,
} from '@/lib/services/taskService';
import {
  invalidateAdminTasks,
  invalidateDashboardQueries,
  queryKeys,
} from '@/lib/query-keys';
import { cachedQueryOptions } from '@/lib/query-config';

type View = 'list' | 'detail' | 'upload';

export default function TasksPage() {
  const { user } = useAuth();
  const { setBreadcrumb, setOnBack } = usePageHeader();
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState<AdminTaskDay | null>(null);
  const [view, setView] = useState<View>('list');
  const { showToast, showError } = useToast();
  const [dragOver, setDragOver] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminTasks,
    queryFn: fetchAllTasks,
    enabled: !!user?.id,
    ...cachedQueryOptions,
  });

  const days = data?.days || [];

  const uploadMutation = useMutation({
    mutationFn: uploadTaskFile,
    onSuccess: (res) => {
      const fullMessage = formatUploadErrorMessage(res);
      showToast(fullMessage, res.success ? 'success' : 'error');
      if (res.success) {
        invalidateAdminTasks(queryClient);
        invalidateDashboardQueries(queryClient);
      }
    },
    onError: (err: Error) => {
      showError(err.message);
    },
  });

  const uploadResult = uploadMutation.data;
  const uploadSucceeded = uploadResult?.success === true;
  const uploadFailed = uploadMutation.isSuccess && uploadResult && !uploadResult.success;

  useEffect(() => {
    if (view === 'list') {
      setBreadcrumb('Tasks');
      setOnBack(null);
    } else if (view === 'detail') {
      setBreadcrumb('Tasks / Detail');
      setOnBack(() => { setView('list'); setSelectedDay(null); });
    } else if (view === 'upload') {
      setBreadcrumb('Tasks / Add Task');
      setOnBack(() => { setView('list'); });
    }
    return () => { setBreadcrumb(null); setOnBack(null); };
  }, [view]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadMutation.mutate(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  const handleAddDone = () => {
    uploadMutation.reset();
    setView('list');
  };

  const handleUploadRetry = () => {
    uploadMutation.reset();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-50 text-green-700 border border-green-200"><CheckCircle2 size={12} /> Done</span>;
      case 'inProgress':
        return <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200"><Clock size={12} /> In Progress</span>;
      case 'delete':
        return <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-700 border border-red-200"><XCircle size={12} /> Deleted</span>;
      default:
        return <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 border border-amber-200"><Clock size={12} /> Pending</span>;
    }
  };

  // Upload View
  if (view === 'upload') {
    return (
      <div className="animate-fade-in">
        {uploadSucceeded ? (
          <div className="border border-green-200 bg-green-50 rounded-2xl p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
                <FileCheck size={28} className="text-green-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-1">File uploaded successfully</p>
                <p className="text-sm text-gray-500 mb-6">{uploadResult?.message || 'Tasks have been added. Click below to view them.'}</p>
              </div>
              <button
                onClick={handleAddDone}
                className="flex items-center gap-2 px-8 py-3 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors"
              >
                <CheckCircle2 size={16} />
                Done
              </button>
            </div>
          </div>
        ) : uploadFailed && uploadResult ? (
          <div className="border border-red-200 bg-red-50 rounded-2xl p-12 text-center">
            <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
                <XCircle size={28} className="text-red-600" />
              </div>
              <div className="w-full text-left">
                <p className="text-lg font-semibold text-red-900 mb-3 text-center whitespace-pre-wrap">
                  {formatUploadErrorMessage(uploadResult)}
                </p>
                {(uploadResult.failedRows?.length ?? 0) > 1 && (
                  <ul className="mt-2 space-y-2 text-sm text-red-900">
                    {uploadResult.failedRows.map((row) => (
                      <li key={`${row.row}-${row.reason}`} className="rounded-lg bg-white/70 border border-red-200 px-3 py-2">
                        <span className="font-semibold">Row {row.row}:</span> {row.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                onClick={handleUploadRetry}
                className="flex items-center gap-2 px-8 py-3 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${dragOver ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
              }`}
          >
            {uploadMutation.isPending ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={40} className="animate-spin text-gray-400" />
                <p className="text-gray-600 font-medium">Processing file...</p>
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
                <label className="cursor-pointer px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors">
                  Choose File
                  <input type="file" accept=".xlsx" onChange={handleFileInput} className="hidden" />
                </label>
                <p className="text-xs text-gray-400 mt-2">
                  File must be named <span className="font-mono">assignTask.xlsx</span>
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    );
  }

  // Detail View (selected day's tasks)
  if (view === 'detail' && selectedDay) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedDay.label === 'Today' || selectedDay.label === 'Yesterday' ? selectedDay.label : selectedDay.date}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedDay.taskCount} tasks · {selectedDay.userCount} users · {selectedDay.managerCount} managers
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {selectedDay.tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:shadow-sm transition-shadow"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 truncate">{task.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-500">{task.userName}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{task.managerName}</span>
                </div>
              </div>
              <div className="flex-shrink-0 ml-4">
                {getStatusBadge(task.status)}
              </div>
            </div>
          ))}
        </div>

      </div>
    );
  }

  // List View (date cards)
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <button
          onClick={() => setView('upload')}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors"
        >
          <Plus size={16} />
          Add Task
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-400" />
        </div>
      )}

      {!isLoading && days.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Calendar size={28} className="text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium">No tasks yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload an assignTask.xlsx to get started</p>
        </div>
      )}

      {!isLoading && days.length > 0 && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {days.map((day) => (
            <button
              key={day.date}
              onClick={() => { setSelectedDay(day); setView('detail'); }}
              className="bg-white border border-gray-200 rounded-xl p-3 min-h-[140px] text-left hover:shadow-md hover:border-brand-primary/30 transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-brand-primary">{day.taskCount}</span>
                  <span className="text-xs text-gray-500">tasks</span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-800">{day.date}</p>
                  {(day.label === 'Today' || day.label === 'Yesterday') && (
                    <p className="text-xs text-brand-primary font-medium">{day.label}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><Users size={13} className="text-brand-primary/60" /> {day.userCount} {day.userCount === 1 ? "user" : "users"}</span>
                <span>{day.managerCount} {day.managerCount === 1 ? "manager" : "managers"}</span>
              </div>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
