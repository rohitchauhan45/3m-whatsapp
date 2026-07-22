'use client';

import { useAuth, isAdmin } from '@/lib/utils/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AdminDashboard from '@/components/features/admin/AdminDashboard';

export default function UserPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin(user)) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  if (loading || !isAdmin(user)) {
    return null;
  }

  return <AdminDashboard tab="user" />;
}
