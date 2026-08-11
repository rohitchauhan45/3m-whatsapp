'use client';

import { use } from 'react';
import { useAuth, isAdmin } from '@/lib/utils/auth';
import ProjectDetailView from '@/components/features/project/ProjectDetail';

type ProjectDetailPageProps = Readonly<{
  params: Promise<{ projectId: string }>;
}>;

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = use(params);
  const { user } = useAuth();

  if (!isAdmin(user)) {
    return (
      <div className="text-center py-20 text-gray-500">
        You do not have access to this page.
      </div>
    );
  }

  return <ProjectDetailView projectId={projectId} />;
}
