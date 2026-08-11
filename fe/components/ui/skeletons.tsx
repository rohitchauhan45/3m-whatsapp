type SkeletonProps = Readonly<{
  className?: string;
}>;

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200/80 ${className}`}
      aria-hidden="true"
    />
  );
}

function EntityCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-4 w-16 shrink-0" />
      </div>
      <div className="space-y-4 border-t border-gray-100 px-7 py-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-5 w-5 shrink-0 rounded" />
          <Skeleton className="h-4 w-full max-w-xs" />
        </div>
        <div className="flex items-start gap-3">
          <Skeleton className="h-5 w-5 shrink-0 rounded" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
      </div>
      <div className="border-t border-gray-100 px-6 py-3">
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

export function EntityCardGridSkeleton({ count = 6 }: Readonly<{ count?: number }>) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <EntityCardSkeleton key={`card-skeleton-${index}`} />
      ))}
    </div>
  );
}

function TaskDayCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 min-h-[140px] flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2">
          <Skeleton className="h-9 w-12" />
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="space-y-2 text-right">
          <Skeleton className="h-5 w-20 ml-auto" />
          <Skeleton className="h-3 w-16 ml-auto" />
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

export function TaskDayCardsSkeleton({ count = 5 }: Readonly<{ count?: number }>) {
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }, (_, index) => (
        <TaskDayCardSkeleton key={`day-card-skeleton-${index}`} />
      ))}
    </div>
  );
}

export function OverviewPanelSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56 max-w-full" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={`overview-field-${index}`} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricsGridSkeleton({ fields = 10 }: Readonly<{ fields?: number }>) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: fields }, (_, index) => (
        <div key={`metric-field-${index}`} className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

function TaskRowSkeleton() {
  return (
    <div className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <Skeleton className="h-4 w-12 shrink-0" />
      <Skeleton className="h-4 flex-1 max-w-md" />
      <Skeleton className="h-4 w-10 shrink-0" />
      <Skeleton className="h-4 w-16 shrink-0" />
      <Skeleton className="h-5 w-5 shrink-0 rounded" />
    </div>
  );
}

export function TaskRowListSkeleton({ count = 5 }: Readonly<{ count?: number }>) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, index) => (
        <TaskRowSkeleton key={`task-row-skeleton-${index}`} />
      ))}
    </div>
  );
}

export function ProjectTaskDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-7 w-full max-w-lg" />
          <Skeleton className="h-4 w-28" />
        </div>
        <MetricsGridSkeleton />
      </div>
      <TaskRowListSkeleton count={6} />
    </div>
  );
}

export function TableFiltersSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={`filter-tab-${index}`} className="h-9 w-20 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Skeleton className="h-10 w-full sm:w-64 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
    </div>
  );
}

export function DataTableSkeleton({
  rows = 8,
  columns = 6,
}: Readonly<{ rows?: number; columns?: number }>) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white min-h-[420px]">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 flex gap-4">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={`table-head-${index}`} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={`table-row-${rowIndex}`} className="px-4 py-3 flex gap-4">
            {Array.from({ length: columns }, (_, colIndex) => (
              <Skeleton
                key={`table-cell-${rowIndex}-${colIndex}`}
                className={`h-4 flex-1 ${colIndex === 0 ? 'max-w-[120px]' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminTableSkeleton() {
  return (
    <div>
      <TableFiltersSkeleton />
      <DataTableSkeleton rows={8} columns={6} />
    </div>
  );
}

export function SiteDetailSkeleton() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-48 max-w-full" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={`site-detail-field-${index}`} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full max-w-xs" />
            </div>
          ))}
        </div>
      </section>
      <div className="space-y-4">
        <div className="flex justify-between px-1 sm:px-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <DataTableSkeleton rows={5} columns={4} />
      </div>
    </div>
  );
}

export function UploadZoneSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <Skeleton className="h-16 w-16 rounded-2xl" />
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-64 max-w-full" />
      <Skeleton className="h-11 w-36 rounded-xl" />
    </div>
  );
}
