'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, ClipboardList, Clock, Pencil, Package, User } from 'lucide-react';
import EntitySummaryCard from '@/components/ui/EntitySummaryCard';
import { EntityCardGridSkeleton, OverviewPanelSkeleton } from '@/components/ui/skeletons';
import ProjectTaskEditModal from '@/components/features/project/ProjectTaskEditModal';
import { ProjectOverviewPanel, ProjectStatusLabel } from '@/components/features/project/projectDisplay';
import { useToast } from '@/lib/providers/toast-provider';
import { usePageHeader } from '@/lib/utils/page-header-context';
import { ui } from '@/lib/utils/ui-classes';
import {
  fetchProjectById,
  formatProjectApiError,
  formatProjectCompletion,
  formatProjectDateRange,
  formatProjectQty,
  updateProjectTask,
  type ProjectTaskNode,
  type UpdateProjectTaskInput,
} from '@/lib/services/projectService';
import { cachedQueryOptions } from '@/lib/query-config';
import { invalidateProjectQueries, queryKeys } from '@/lib/query-keys';

type ProjectDetailViewProps = Readonly<{
  projectId: string;
}>;

export default function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { setBreadcrumb, setOnBack } = usePageHeader();
  const [editMode, setEditMode] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTaskNode | null>(null);

  const projectQuery = useQuery({
    queryKey: queryKeys.projectDetail(projectId),
    queryFn: () => fetchProjectById(projectId),
    ...cachedQueryOptions,
  });

  const project = projectQuery.data;

  const updateMutation = useMutation({
    mutationFn: (input: { taskId: string; payload: UpdateProjectTaskInput }) =>
      updateProjectTask(projectId, input.taskId, input.payload),
    onSuccess: (result) => {
      if (!result.success) {
        showError(result.message);
        return;
      }
      invalidateProjectQueries(queryClient, projectId);
      showSuccess(result.message);
      setEditingTask(null);
    },
    onError: (error) => showError(formatProjectApiError(error, 'Failed to update task')),
  });

  useEffect(() => {
    if (project) {
      setBreadcrumb(`Project / ${project.name}`);
    } else {
      setBreadcrumb('Project');
    }
    setOnBack(() => router.push('/projects'));
    return () => setOnBack(null);
  }, [project, router, setBreadcrumb, setOnBack]);

  if (projectQuery.isLoading) {
    return (
      <div className="space-y-5">
        <OverviewPanelSkeleton />
        <EntityCardGridSkeleton count={6} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[480px] flex-col items-center justify-center text-center">
        <p className="text-lg font-medium text-gray-700">Project not found</p>
      </div>
    );
  }

  const handleToggleEdit = () => {
    if (editMode) setEditingTask(null);
    setEditMode((open) => !open);
  };

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex justify-end">
        <button type="button" onClick={handleToggleEdit} className={`${ui.btnPrimary} max-md:w-full`}>
          <Pencil size={16} />
          {editMode ? 'Done' : 'Edit'}
        </button>
      </div>

      <ProjectOverviewPanel
        name={project.name}
        description={project.description}
        plannedStart={project.plannedStart}
        plannedEnd={project.plannedEnd}
        actualStart={project.actualStart}
        actualEnd={project.actualEnd}
        taskCount={project.taskCount}
        subtaskCount={project.subtaskCount}
        createdAt={project.createdAt}
        updatedAt={project.updatedAt}
      />

      {editMode && (
        <p className="text-sm text-gray-500 px-1">Select a task card to edit.</p>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {project.rootTasks.map((task) => (
          <EntitySummaryCard
            key={task.id}
            href={editMode ? undefined : `/projects/${project.id}/tasks/${task.id}`}
            onClick={editMode ? () => setEditingTask(task) : undefined}
            icon={ClipboardList}
            iconBgClassName="bg-indigo-500"
            title={task.code}
            subtitle={task.name}
            headerEnd={formatProjectCompletion(task.completionPct)}
            className={editMode ? 'cursor-pointer ring-2 ring-transparent hover:ring-brand-primary/25' : ''}
            metaRows={[
              {
                icon: ClipboardList,
                content: (
                  <p>
                    {task.type} · <ProjectStatusLabel status={task.status} /> ·{' '}
                    {task.childCount} subtask
                  </p>
                ),
              },
              {
                icon: Calendar,
                content: (
                  <p>
                    Planned: {formatProjectDateRange(task.plannedStart, task.plannedEnd)}
                  </p>
                ),
              },
              {
                icon: Clock,
                content: (
                  <p>
                    Actual: {formatProjectDateRange(task.actualStart, task.actualEnd)}
                  </p>
                ),
              },
              {
                icon: Package,
                content: (
                  <p>
                    Qty: {formatProjectQty(task.completedQty)} / {formatProjectQty(task.totalQty)}
                  </p>
                ),
              },
              ...(task.assigneeName
                ? [
                    {
                      icon: User,
                      content: <p>Assignee: {task.assigneeName}</p>,
                    },
                  ]
                : []),
            ]}
            footer={`Duration: ${task.durationDays ?? '—'} days`}
          />
        ))}
      </div>

      {project.rootTasks.length === 0 && (
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/40">
          <p className="text-sm text-gray-500">No root tasks in this project.</p>
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
