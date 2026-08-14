'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useToast } from '@/lib/providers/toast-provider';
import { UploadZoneSkeleton } from '@/components/ui/skeletons';
import { usePageHeader } from '@/lib/utils/page-header-context';
import { ui } from '@/lib/utils/ui-classes';
import {
  createProjectFromFile,
  formatProjectApiError,
  formatProjectUploadErrorMessage,
  previewProjectFile,
  projectNameFromFileName,
  type ProjectPreviewRow,
} from '@/lib/services/projectService';
import { queryKeys } from '@/lib/query-keys';

type View = 'upload' | 'preview' | 'done';

export default function ProjectCreate() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setBreadcrumb, setOnBack } = usePageHeader();
  const { showToast, showError } = useToast();

  const [view, setView] = useState<View>('upload');
  const [projectName, setProjectName] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [taskCount, setTaskCount] = useState(0);
  const [sampleRows, setSampleRows] = useState<ProjectPreviewRow[]>([]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (view === 'upload') {
      setBreadcrumb('Project / Add Project');
      setOnBack(() => router.push('/projects'));
    } else if (view === 'preview') {
      setBreadcrumb('Project / Review');
      setOnBack(() => {
        setUploadedFile(null);
        setSampleRows([]);
        setTaskCount(0);
        setView('upload');
      });
    } else {
      setBreadcrumb('Project / Created');
      setOnBack(() => router.push('/projects'));
    }
    return () => setOnBack(null);
  }, [view, router, setBreadcrumb, setOnBack]);

  const previewMutation = useMutation({
    mutationFn: previewProjectFile,
    onSuccess: (res, file) => {
      if (!res.success || !res.data) {
        showError(formatProjectUploadErrorMessage(res));
        return;
      }
      setSampleRows(res.data.sampleRows);
      setTaskCount(res.data.taskCount);
      setUploadedFile(file);
      if (!projectName.trim()) {
        setProjectName(projectNameFromFileName(file.name));
      }
      setView('preview');
    },
    onError: (error) => showError(formatProjectApiError(error, 'Failed to read file')),
  });

  const createMutation = useMutation({
    mutationFn: createProjectFromFile,
    onSuccess: (res) => {
      if (!res.success) {
        showError(formatProjectUploadErrorMessage(res));
        return;
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      showToast(res.message || 'Project created', 'success');
      setView('done');
    },
    onError: (error) => showError(formatProjectApiError(error, 'Failed to create project')),
  });

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx')) {
      showError('Only .xlsx files are allowed');
      return;
    }
    previewMutation.mutate(file);
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  const handleCreate = () => {
    const name = projectName.trim();
    if (!name) {
      showError('Project name is required');
      return;
    }
    if (!uploadedFile) {
      showError('Upload file is missing. Please choose the file again.');
      return;
    }
    createMutation.mutate({
      file: uploadedFile,
      name,
    });
  };

  if (view === 'done') {
    return (
      <div className="animate-fade-in flex min-h-[420px] items-center justify-center">
        <div className="text-center max-w-md">
          <CheckCircle2 size={48} className="mx-auto mb-4 text-green-600" />
          <p className="text-xl font-semibold text-gray-900">Project created</p>
          <p className="mt-2 text-sm text-gray-500">
            Your progress report has been imported successfully.
          </p>
          <button
            type="button"
            onClick={() => router.push('/projects')}
            className={`mt-6 ${ui.btnPrimaryLg}`}
          >
            Back to projects
          </button>
        </div>
      </div>
    );
  }

  if (view === 'preview') {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <label htmlFor="project-name" className="mb-2 block text-sm font-medium text-gray-700">
            Project name
          </label>
          <input
            id="project-name"
            type="text"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="e.g. ORYX Progress Report"
            className={ui.inputEditable}
            autoComplete="off"
          />
          <p className="mt-3 text-sm text-gray-500">
            {taskCount} task ready to import, including nested subtask.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-base font-semibold text-gray-900">Preview sample</h3>
            <p className="text-sm text-gray-500">Showing first {sampleRows.length} rows</p>
          </div>
          <div className="overflow-x-auto touch-scroll">
            <table className="w-full text-sm max-md:min-w-[480px]">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Completion</th>
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row) => (
                  <tr key={`${row.startRow}-${row.code}`} className="border-t border-gray-100">
                    <td className="px-4 py-3 tabular-nums text-gray-700">{row.code}</td>
                    <td className="px-4 py-3 text-gray-800">{row.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.completionPct != null ? `${row.completionPct}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 max-md:flex-col">
          <button
            type="button"
            onClick={() => {
              setUploadedFile(null);
              setSampleRows([]);
              setTaskCount(0);
              setView('upload');
            }}
            className={`${ui.btnSecondary} max-md:w-full`}
          >
            Choose another file
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={createMutation.isPending || !projectName.trim()}
            className={`${ui.btnPrimaryLg} max-md:w-full`}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating…
              </>
            ) : (
              'Create Project'
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {previewMutation.isError ? (
        <div className="border border-red-200 bg-red-50 rounded-2xl p-12 max-md:p-6 text-center">
          <XCircle size={28} className="text-red-600 mx-auto mb-3" />
          <p className="text-red-900">Could not read file. Please try again.</p>
          <button
            type="button"
            onClick={() => previewMutation.reset()}
            className={`mt-4 ${ui.btnPrimaryLg}`}
          >
            Try again
          </button>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-12 max-md:p-6 text-center transition-all ${
            dragOver ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          {previewMutation.isPending ? (
            <UploadZoneSkeleton />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Upload size={28} className="text-gray-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-1">
                  Upload progress report .xlsx
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Drag and drop your file here, or click to browse
                </p>
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
