'use client';

import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { usePageHeader } from '@/lib/utils/page-header-context';

export default function PageHeader() {
  const pathname = usePathname();
  const { breadcrumb, onBack } = usePageHeader();

  const segments = pathname.split('/').filter(Boolean);
  const defaultBreadcrumb = segments.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' / ');
  const displayText = breadcrumb || defaultBreadcrumb;

  return (
    <div className="flex min-w-0 items-center gap-3 px-3 md:px-8 py-2.5 md:py-4 bg-white border-b border-gray-200 flex-shrink-0 rounded-xl">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-lg hover:bg-gray-100 transition-colors max-md:inline-flex max-md:h-10 max-md:w-10 max-md:items-center max-md:justify-center"
          aria-label="Go back"
        >
          <ArrowLeft size={26} className="text-gray-600 max-md:w-5 max-md:h-5" />
        </button>
      )}
      <span className="min-w-0 truncate text-[15px] md:text-xl font-semibold text-gray-700">
        {displayText}
      </span>
    </div>
  );
}
