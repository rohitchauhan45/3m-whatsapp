'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, FolderKanban, Plus } from 'lucide-react';
import EntitySummaryCard from '@/components/ui/EntitySummaryCard';
import { EntityCardGridSkeleton } from '@/components/ui/skeletons';
import { usePageHeader } from '@/lib/utils/page-header-context';
import { ui } from '@/lib/utils/ui-classes';
import {
  fetchProjects,
  formatProjectCreatedDate,
  formatProjectDateRange,
} from '@/lib/services/projectService';
import { cachedQueryOptions } from '@/lib/query-config';
import { queryKeys } from '@/lib/query-keys';

export default function ProjectManagement() {
  const { setBreadcrumb, setOnBack } = usePageHeader();

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: fetchProjects,
    ...cachedQueryOptions,
  });

  const projects = projectsQuery.data?.data ?? [];

  useEffect(() => {
    setBreadcrumb('Project');
    setOnBack(null);
    return () => setOnBack(null);
  }, [setBreadcrumb, setOnBack]);

  const isLoading = projectsQuery.isLoading;
  const isEmpty = !isLoading && projects.length === 0;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-end mb-5">
        <Link href="/projects/new" className={ui.btnPrimary}>
          <Plus size={16} />
          Add Project
        </Link>
      </div>

      {isLoading ? (
        <EntityCardGridSkeleton count={6} />
      ) : isEmpty ? (
        <div
          className="flex min-h-[520px] w-full items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/40 px-8 py-16"
        >
          <div className="text-center max-w-md">
            <FolderKanban className="mx-auto mb-4 text-gray-300" size={40} strokeWidth={1.5} />
            <p className="text-lg font-medium text-gray-700">No project yet</p>
            <p className="mt-2 text-sm text-gray-500">
              Upload a progress report Excel file to create your first project with tasks and
              subtasks.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <EntitySummaryCard
              key={project.id}
              href={`/projects/${project.id}`}
              icon={FolderKanban}
              iconBgClassName="bg-indigo-500"
              title={project.name}
              subtitle={
                <>
                  <span className="font-medium text-[14px] text-brand-primary tabular-nums">
                    {project.subtaskCount}
                  </span>
                  {' subtask'}
                </>
              }
              headerEnd={
                <>
                  total{' '}
                  <span className="font-medium text-[15px] text-brand-primary tabular-nums">
                    {project.taskCount}
                  </span>
                </>
              }
              metaRows={[
                {
                  icon: Calendar,
                  content: (
                    <p>
                      Planned:{' '}
                      {formatProjectDateRange(project.plannedStart, project.plannedEnd)}
                    </p>
                  ),
                },
                {
                  icon: Clock,
                  content: (
                    <p>
                      Actual:{' '}
                      {formatProjectDateRange(project.actualStart, project.actualEnd)}
                    </p>
                  ),
                },
              ]}
              footer={`Created : ${formatProjectCreatedDate(project.createdAt)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
