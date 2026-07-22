'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth, isAdmin } from '@/lib/utils/auth';
import { usePageHeader } from '@/lib/utils/page-header-context';
import ScheduleSettings from '@/components/features/admin/ScheduleSettings';

export default function SettingsPage() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const { setBreadcrumb, setOnBack } = usePageHeader();

  useEffect(() => {
    setBreadcrumb('Settings');
    setOnBack(null);
    return () => {
      setBreadcrumb(null);
      setOnBack(null);
    };
  }, [setBreadcrumb, setOnBack]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-fade-in space-y-8">
      {isAdmin(user) && <ScheduleSettings />}

      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-gray-900">Account</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>
            <span className="font-medium text-gray-800">Name:</span> {user?.name || '—'}
          </p>
          <p>
            <span className="font-medium text-gray-800">Email:</span> {user?.email || '—'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-5 py-3 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
