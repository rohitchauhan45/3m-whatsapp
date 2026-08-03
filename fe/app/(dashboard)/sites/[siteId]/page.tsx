'use client';

import { use } from 'react';
import { useAuth, isAdmin } from '@/lib/utils/auth';
import SiteDetailView from '@/components/features/site/SiteDetail';

type SiteDetailPageProps = Readonly<{
  params: Promise<{ siteId: string }>;
}>;

export default function SiteDetailPage({ params }: SiteDetailPageProps) {
  const { siteId } = use(params);
  const { user } = useAuth();

  if (!isAdmin(user)) {
    return (
      <div className="py-20 text-center text-gray-500">
        You do not have access to this page.
      </div>
    );
  }

  return <SiteDetailView siteId={siteId} />;
}
