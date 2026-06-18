'use client';

import Dashboard from '@/components/features/Dashboard';
import { INITIAL_STATS } from '@/lib/constants';
import { useAuth, isAdmin } from '@/lib/utils/auth';

export default function DashboardPage() {
  const { user } = useAuth();
  const adminUser = isAdmin(user);
  const firstName = user?.name?.split(' ')[0];

  const heading = adminUser
    ? 'Welcome to Admin Dashboard'
    : firstName
      ? `Welcome to ${firstName}'${firstName.endsWith('s') ? '' : 's'} Dashboard`
      : 'Welcome to your Dashboard';

  return <Dashboard stats={INITIAL_STATS} heading={heading} />;
}

