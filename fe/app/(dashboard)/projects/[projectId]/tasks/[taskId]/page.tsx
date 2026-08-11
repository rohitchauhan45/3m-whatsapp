'use client';

import { use } from 'react';
import { useAuth, isAdmin } from '@/lib/utils/auth';
import ProjectTaskDetailView from '@/components/features/project/ProjectTaskDetail';

type ProjectTaskPageProps = Readonly<{
  params: Promise<{ projectId: string; taskId: string }>;
}>;

export default function ProjectTaskPage({ params }: ProjectTaskPageProps) {
  const { projectId, taskId } = use(params);
  const { user } = useAuth();

  if (!isAdmin(user)) {
    return (
      <div className="text-center py-20 text-gray-500">
        You do not have access to this page.
      </div>
    );
  }

  return <ProjectTaskDetailView projectId={projectId} taskId={taskId} />;
}
