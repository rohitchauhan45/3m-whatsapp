'use client';

import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { usePageHeader, type DashboardTab } from '@/lib/utils/page-header-context';

const DASHBOARD_TABS: { id: DashboardTab; label: string }[] = [
  { id: 'task', label: 'Task' },
  { id: 'user', label: 'User' },
  { id: 'time', label: 'Time' },
];

export default function PageHeader() {
  const pathname = usePathname();
  const { breadcrumb, onBack, showDashboardTabs, dashboardTab, setDashboardTab } = usePageHeader();

  const segments = pathname.split('/').filter(Boolean);
  const defaultBreadcrumb = segments.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' / ');
  const displayText = breadcrumb || defaultBreadcrumb;

  if (showDashboardTabs) {
    return (
      <div className="flex items-center justify-center px-6 md:px-8 py-2 bg-white border-b border-gray-200 flex-shrink-0 rounded-xl w-full">
        <div className="inline-flex bg-gray-100 rounded-full p-1.5 gap-1.5">
          {DASHBOARD_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDashboardTab(t.id)}
              className={`px-6 md:px-11 py-2 rounded-full text-[16px] font-semibold transition-all ${
                dashboardTab === t.id
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-6 md:px-8 py-4 bg-white border-b border-gray-200 flex-shrink-0 rounded-xl">
      {onBack && (
        <button
          onClick={onBack}
          className="rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={26} className="text-gray-600" />
        </button>
      )}
      <span className="text-xl font-semibold text-gray-700">{displayText}</span>
    </div>
  );
}
