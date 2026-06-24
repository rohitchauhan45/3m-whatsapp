'use client';

import { useAuth, isAdmin } from '@/lib/utils/auth';
import Dashboard from '@/components/features/Dashboard';
import AdminDashboard from '@/components/features/admin/AdminDashboard';
import { INITIAL_STATS } from '@/lib/constants';

export default function DashboardPage() {
  const { user } = useAuth();

  if (isAdmin(user)) {
    return <AdminDashboard />;
  }

  const firstName = user?.name?.split(' ')[0];
  const heading = firstName
    ? `Welcome to ${firstName}'${firstName.endsWith('s') ? '' : 's'} Dashboard`
    : 'Welcome to your Dashboard';

  return <Dashboard stats={INITIAL_STATS} heading={heading} />;
}
