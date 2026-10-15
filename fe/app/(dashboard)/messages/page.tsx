'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, isAdmin } from '@/lib/utils/auth';
import { usePageHeader } from '@/lib/utils/page-header-context';
import MessageManagement from '@/components/features/admin/MessageManagement';

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { setBreadcrumb, setOnBack } = usePageHeader();

  useEffect(() => {
    if (!loading && !isAdmin(user)) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  useEffect(() => {
    setBreadcrumb('Message');
    setOnBack(null);
    return () => {
      setBreadcrumb(null);
      setOnBack(null);
    };
  }, [setBreadcrumb, setOnBack]);

  if (loading || !isAdmin(user)) {
    return null;
  }

  return <MessageManagement />;
}
