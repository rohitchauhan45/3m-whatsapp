'use client';

import { useAuth, isAdmin } from '@/lib/utils/auth';
import SiteManagement from '@/components/features/site/SiteManagement';

export default function SitesPage() {
  const { user } = useAuth();

  if (!isAdmin(user)) {
    return (
      <div className="text-center py-20 text-gray-500">
        You do not have access to this page.
      </div>
    );
  }

  return <SiteManagement />;
}
