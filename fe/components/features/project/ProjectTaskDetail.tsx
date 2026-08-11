'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import ProjectTaskRow from '@/components/features/project/ProjectTaskRow';
import ProjectTaskEditModal from '@/components/features/project/ProjectTaskEditModal';
import { ProjectTaskDetailSkeleton } from '@/components/ui/skeletons';
import { ProjectTaskMetrics, ProjectStatusLabel } from '@/components/features/project/projectDisplay';
import { useToast } from '@/lib/providers/toast-provider';
import { usePageHeader } from '@/lib/utils/page-header-context';
import { ui } from '@/lib/utils/ui-classes';
import {
  fetchProjectTaskBranch,
  formatProjectApiError,
  updateProjectTask,
  type ProjectTaskNode,
  type UpdateProjectTaskInput,
} from '@/lib/services/projectService';
import { cachedQueryOptions } from '@/lib/query-config';
import { invalidateProjectQueries, queryKeys } from '@/lib/query-keys';

type ProjectTaskDetailViewProps = Readonly<{
  projectId: string;
  taskId: string;
}>;

export default function ProjectTaskDetailView({
  projectId,
  taskId,
}: ProjectTaskDetailViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { setBreadcrumb, setOnBack } = usePageHeader();
  const [editMode, setEditMode] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTaskNode | null>(null);

  const branchQuery = useQuery({
    queryKey: queryKeys.projectTaskBranch(projectId, taskId),
    queryFn: () => fetchProjectTaskBranch(projectId, taskId),
    ...cachedQueryOptions,
  });

  const branch = branchQuery.data;

  const updateMutation = useMutation({
    mutationFn: (input: { taskId: string; payload: UpdateProjectTaskInput }) =>
      updateProjectTask(projectId, input.taskId, input.payload),
    onSuccess: (result) => {
      if (!result.success) {
        showError(result.message);
        return;
      }
      invalidateProjectQueries(queryClient, projectId, taskId);
      showSuccess(result.message);
      setEditingTask(null);
    },
    onError: (error) => showError(formatProjectApiError(error, 'Failed to update task')),
  });

  useEffect(() => {
    if (branch) {
      setBreadcrumb(`Project / ${branch.project.name} / ${branch.task.code}`);
      setOnBack(() => router.push(`/projects/${projectId}`));
    } else {
      setBreadcrumb('Project');
      setOnBack(() => router.push('/projects'));
    }
    return () => setOnBack(null);
  }, [branch, projectId, router, setBreadcrumb, setOnBack]);

  if (branchQuery.isLoading) {
    return <ProjectTaskDetailSkeleton />;
  }

  if (!branch) {
    return (
      <div className="flex min-h-[480px] flex-col items-center justify-center text-center">
        <p className="text-lg font-medium text-gray-700">Task not found</p>
      </div>
    );
  }

  const handleToggleEdit = () => {
    setEditMode((open) => {
      if (open) setEditingTask(null);
      return !open;
    });
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={handleToggleEdit} className={ui.btnPrimary}>
          <Pencil size={16} />
          {editMode ? 'Done' : 'Edit'}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base text-gray-500">Task {branch.task.code}</p>
            <ProjectStatusLabel status={branch.task.status} className="text-sm font-semibold" />
          </div>
          <h2 className="mt-1 text-2xl font-semibold text-brand-primary leading-tight">
            {branch.task.name}
          </h2>
          <p className="mt-2 text-base text-gray-500">
            {branch.children.length} direct subtask
          </p>
        </div>
        <ProjectTaskMetrics task={branch.task} />
      </div>

      {editMode && (
        <p className="text-sm text-gray-500 px-1">Select a subtask row to edit.</p>
      )}

      <div className="space-y-2">
        {branch.children.map((child) => (
          <ProjectTaskRow
            key={child.id}
            task={child}
            editMode={editMode}
            onEditSelect={setEditingTask}
          />
        ))}
      </div>

      {branch.children.length === 0 && (
        <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/40">
          <p className="text-sm text-gray-500">No subtasks for this task.</p>
        </div>
      )}

      <ProjectTaskEditModal
        open={editingTask != null}
        task={editingTask}
        isSaving={updateMutation.isPending}
        onClose={() => setEditingTask(null)}
        onSave={(payload) => {
          if (!editingTask) return;
          updateMutation.mutate({ taskId: editingTask.id, payload });
        }}
      />
    </div>
  );
}
