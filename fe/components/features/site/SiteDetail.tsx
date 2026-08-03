'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Crosshair,
  Loader2,
  MapPin,
  Plus,
  Ruler,
  Users,
} from 'lucide-react';
import AssignSiteUsersModal from '@/components/features/site/AssignSiteUsersModal';
import { useToast } from '@/lib/providers/toast-provider';
import { usePageHeader } from '@/lib/utils/page-header-context';
import { ui } from '@/lib/utils/ui-classes';
import {
  assignUsersToSite,
  fetchAssignableSiteUsers,
  fetchSiteById,
  formatSiteApiError,
  type SiteDetail,
} from '@/lib/services/siteService';
import { cachedQueryOptions } from '@/lib/query-config';
import { queryKeys } from '@/lib/query-keys';
import type { ElementType } from 'react';

function formatDisplayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

function DetailItem({
  icon: Icon,
  label,
  value,
  valueClassName,
}: Readonly<{
  icon: ElementType;
  label: string;
  value: string;
  valueClassName?: string;
}>) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-4 shadow-sm">
      <div className="mb-2.5 flex items-center gap-2.5 text-[15px] font-medium text-gray-500">
        <Icon size={18} className="shrink-0 text-gray-400" strokeWidth={2} />
        {label}
      </div>
      <p
        className={`text-[15px] font-semibold leading-relaxed text-gray-600 ${valueClassName ?? ''}`}
      >
        {value}
      </p>
    </div>
  );
}

function AssignedUsersTable({
  users,
}: Readonly<{
  users: SiteDetail['users'];
}>) {
  if (users.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
        <Users className="mb-3 text-gray-300" size={36} strokeWidth={1.5} />
        <p className="text-base font-semibold text-gray-600">No users assigned yet</p>
        <p className="mt-1 max-w-sm text-sm text-gray-500">
          Assign users to this site so they can be tracked at this location.
        </p>
      </div>
    );
  }

  return (
    <table className="w-full text-base">
      <thead>
        <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-sm uppercase tracking-wide text-gray-500">
          <th className="px-5 py-3.5 font-semibold">Name</th>
          <th className="px-5 py-3.5 font-semibold">Number</th>
          <th className="px-5 py-3.5 font-semibold">Assigned on</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {users.map((user) => (
          <tr key={user.id} className="transition-colors hover:bg-gray-50/70">
            <td className="px-5 py-4 font-semibold text-gray-700">{user.name}</td>
            <td className="px-5 py-4 tabular-nums text-gray-600">{user.number}</td>
            <td className="px-5 py-4 text-gray-600">{formatDisplayDate(user.assignedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type SiteDetailViewProps = Readonly<{
  siteId: string;
}>;

export default function SiteDetailView({ siteId }: SiteDetailViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();
  const { setBreadcrumb, setOnBack } = usePageHeader();
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  const siteQuery = useQuery({
    queryKey: queryKeys.siteDetail(siteId),
    queryFn: () => fetchSiteById(siteId),
    ...cachedQueryOptions,
  });

  const assignableQuery = useQuery({
    queryKey: queryKeys.siteAssignableUsers(siteId),
    queryFn: () => fetchAssignableSiteUsers(siteId),
    enabled: assignModalOpen,
    ...cachedQueryOptions,
  });

  const site = siteQuery.data?.success ? siteQuery.data.data : null;

  useEffect(() => {
    if (site) {
      setBreadcrumb(`Site / ${site.name}`);
    } else {
      setBreadcrumb('Site');
    }
    setOnBack(() => router.push('/sites'));
    return () => {
      setOnBack(null);
    };
  }, [site, setBreadcrumb, setOnBack, router]);

  const assignMutation = useMutation({
    mutationFn: (userIds: string[]) => assignUsersToSite(siteId, userIds),
    onSuccess: (res) => {
      if (!res.success) {
        showError(res.message || 'Failed to assign users');
        return;
      }
      showToast(res.message || 'Users assigned', 'success');
      setAssignModalOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.siteDetail(siteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.siteAssignableUsers(siteId) });
    },
    onError: (error) => showError(formatSiteApiError(error, 'Failed to assign users')),
  });

  if (siteQuery.isLoading) {
    return (
      <div className="flex min-h-[480px] items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="flex min-h-[480px] flex-col items-center justify-center text-center">
        <p className="text-lg font-medium text-gray-700">Site not found</p>
        <Link href="/sites" className={`mt-4 ${ui.linkPrimary}`}>
          Back to sites
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-500 shadow-sm">
              <Building2 size={17} className="text-white" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold tracking-tight text-brand-primary">
                  {site.name}
                </h1>
                <p className="shrink-0 text-lg sm:text-xl">
                  <span className="font-medium text-gray-400">user : </span>
                  <span className="font-semibold text-gray-600">{site.users.length}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          <DetailItem icon={MapPin} label="Address" value={site.address} />
          <DetailItem
            icon={Crosshair}
            label="Coordinates"
            value={`${site.latitude.toFixed(6)}, ${site.longitude.toFixed(6)}`}
            valueClassName="tabular-nums"
          />
          <DetailItem icon={Ruler} label="Radius" value={`${site.radius} m`} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 sm:px-2">
          <h2 className="text-lg font-semibold text-gray-700">Assigned users</h2>
          <button type="button" onClick={() => setAssignModalOpen(true)} className={ui.btnPrimary}>
            <Plus size={16} />
            Assign user
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <AssignedUsersTable users={site.users} />
          </div>
        </div>
      </section>

      <AssignSiteUsersModal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        users={assignableQuery.data?.data ?? []}
        isLoading={assignableQuery.isLoading}
        isSubmitting={assignMutation.isPending}
        onAssign={(userIds) => assignMutation.mutate(userIds)}
      />
    </div>
  );
}
