'use client';

import { useAuth, isAdmin } from '@/lib/utils/auth';
import ProjectCreate from '@/components/features/project/ProjectCreate';

export default function NewProjectPage() {
  const { user } = useAuth();

  if (!isAdmin(user)) {
    return (
      <div className="text-center py-20 text-gray-500">
        You do not have access to this page.
      </div>
    );
  }

  return <ProjectCreate />;
}
