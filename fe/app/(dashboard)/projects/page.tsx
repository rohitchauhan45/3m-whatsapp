'use client';

import { useAuth, isAdmin } from '@/lib/utils/auth';
import ProjectManagement from '@/components/features/project/ProjectManagement';

export default function ProjectsPage() {
  const { user } = useAuth();

  if (!isAdmin(user)) {
    return (
      <div className="text-center py-20 text-gray-500">
        You do not have access to this page.
      </div>
    );
  }

  return <ProjectManagement />;
}
