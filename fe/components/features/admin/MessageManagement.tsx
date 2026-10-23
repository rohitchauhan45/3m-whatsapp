'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Eye,
  MessageSquare,
  MessagesSquare,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { AdminTableSkeleton } from '@/components/ui/skeletons';
import { cachedQueryOptions } from '@/lib/query-config';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchConversationTable,
  fetchMessageCards,
  getMessageTimeRangeOptions,
  type ConversationRow,
  type ConversationStatusFilter,
  type MessageTimeRange,
  type PaginationMeta,
} from '@/lib/services/messageService';
import Dropdown from '@/components/ui/Dropdown';
import { ui } from '@/lib/utils/ui-classes';

const TABLE_MIN_HEIGHT = 'min-h-[420px]';
const EMPTY_ROW_HEIGHT = 'h-[380px] max-md:h-48';

const STATUS_FILTER_OPTIONS: { value: ConversationStatusFilter; label: string }[] = [
  { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' },
  { value: 'open', label: 'Open' },
  { value: 'all', label: 'All' },
];

function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 max-md:gap-2 shadow-sm min-w-0">
      <Icon size={38} className={`shrink-0 max-md:size-6 ${iconColor}`} strokeWidth={2} />
      <div className="min-w-0">
        <p className="text-[15px] max-md:text-xs text-gray-500 font-medium truncate">{title}</p>
        <p className="text-[26px] max-md:text-xl font-semibold text-gray-700 tabular-nums leading-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function WindowBadge({ open }: { open: boolean }) {
  return open ? (
    <span className="text-sm font-semibold text-green-600">Open</span>
  ) : (
    <span className="text-sm font-semibold text-amber-600">Expired</span>
  );
}

function getLastType(row: ConversationRow): string {
  const type =
    row.lastDirection === 'incoming' ? row.lastIncomingMessageType : row.lastSentMessageType;
  return type || '—';
}

function DirectionBadge({ direction }: { direction: 'incoming' | 'outgoing' | null }) {
  if (!direction) return <span className="text-gray-400">—</span>;
  if (direction === 'incoming') {
    return <span className="text-sm font-semibold text-sky-600">Incoming</span>;
  }
  return <span className="text-sm font-semibold text-violet-600">Outgoing</span>;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400">—</span>;
  const upper = status.toUpperCase();
  const className =
    upper === 'FAILED'
      ? 'text-red-600'
      : upper === 'READ'
        ? 'text-green-600'
        : upper === 'DELIVERED'
          ? 'text-brand-primary'
          : upper === 'SENT'
            ? 'text-gray-700'
            : 'text-amber-600';
  return <span className={`text-sm font-semibold capitalize ${className}`}>{status.toLowerCase()}</span>;
}

function PaginationBar({
  pagination,
  onPageChange,
  onLimitChange,
}: {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const { page, limit, total, totalPages } = pagination;
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
      <p className="text-sm text-gray-500 max-md:hidden">
        Page {page} of {totalPages || 1} | {total} results
      </p>
      <div className="flex items-center gap-2 max-md:w-full max-md:justify-between">
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          aria-label="Rows per page"
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white max-md:min-h-10"
        >
          {[10, 20, 50].map((n) => (
            <option key={n} value={n}>
              {n} rows
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 max-md:min-h-10 max-md:px-4"
          >
            Prev
          </button>
          <span className="md:hidden text-sm font-medium text-gray-600 tabular-nums">
            {page} / {totalPages || 1}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 max-md:min-h-10 max-md:px-4"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusFilterBar({
  value,
  onChange,
}: {
  value: ConversationStatusFilter;
  onChange: (value: ConversationStatusFilter) => void;
}) {
  return (
    <div className={ui.tabBar}>
      {STATUS_FILTER_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={active ? ui.tabActive : ui.tabInactive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ConversationMobileList({
  rows,
  onOpen,
}: {
  rows: ConversationRow[];
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="md:hidden rounded-xl border border-gray-200 bg-white py-14 text-center text-sm text-gray-400">
        No conversations found
      </div>
    );
  }

  return (
    <div className="md:hidden space-y-3">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => onOpen(row.id)}
          className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{row.userName}</p>
              <p className="text-sm text-gray-500 truncate">{row.userNumber}</p>
            </div>
            <WindowBadge open={row.windowOpen} />
          </div>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Direction</span>
              <DirectionBadge direction={row.lastDirection} />
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Last type</span>
              <span className="font-medium text-gray-800 truncate">{getLastType(row)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Status</span>
              <StatusBadge status={row.lastSentMessageStatus} />
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Messages</span>
              <span className="font-medium text-gray-800 tabular-nums">{row.messageCount}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Last sent</span>
              <span className="font-medium text-gray-800">
                {formatDateTime(row.lastSentMessageAt)}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function MessageManagement() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>('all');
  const [timeRange, setTimeRange] = useState<MessageTimeRange>('today');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, timeRange]);

  const cardsQuery = useQuery({
    queryKey: queryKeys.dashboard.messageCards(timeRange),
    queryFn: () => fetchMessageCards(timeRange),
    ...cachedQueryOptions,
  });

  const tableQuery = useQuery({
    queryKey: queryKeys.dashboard.messageTable({
      status: statusFilter,
      time: timeRange,
      page,
      limit,
      search,
    }),
    queryFn: () =>
      fetchConversationTable({
        status: statusFilter,
        time: timeRange,
        page,
        limit,
        search: search || undefined,
      }),
    ...cachedQueryOptions,
  });

  const isLoading = cardsQuery.isLoading || tableQuery.isLoading;
  const rows = tableQuery.data?.conversations ?? [];

  const openConversation = (id: string) => {
    router.push(`/messages/${id}`);
  };

  return (
    <div className="animate-fade-in min-h-[calc(100dvh-11rem)] max-md:min-h-0 flex flex-col w-full">
      <div className="space-y-12 max-md:space-y-6 flex flex-col flex-1 min-h-0">
        {cardsQuery.data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7 gap-4 max-md:gap-2.5">
            <StatCard
              title="Conversations"
              value={cardsQuery.data.totalConversations}
              icon={MessagesSquare}
              iconColor="text-purple-600"
            />
            <StatCard
              title="Window Open"
              value={cardsQuery.data.windowOpen}
              icon={CheckCircle2}
              iconColor="text-green-600"
            />
            <StatCard
              title="Window Expired"
              value={cardsQuery.data.windowExpired}
              icon={Clock}
              iconColor="text-amber-600"
            />
            <StatCard
              title="Total Messages"
              value={cardsQuery.data.totalMessages}
              icon={MessageSquare}
              iconColor="text-brand-primary"
            />
            <StatCard
              title="Incoming"
              value={cardsQuery.data.incomingMessages}
              icon={ArrowDownLeft}
              iconColor="text-sky-600"
            />
            <StatCard
              title="Outgoing"
              value={cardsQuery.data.outgoingMessages}
              icon={ArrowUpRight}
              iconColor="text-violet-600"
            />
            <StatCard
              title="Failed"
              value={cardsQuery.data.failedMessages}
              icon={AlertTriangle}
              iconColor="text-red-600"
            />
          </div>
        )}

        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
            <div className="max-md:w-full max-md:overflow-x-auto touch-scroll">
              <StatusFilterBar value={statusFilter} onChange={setStatusFilter} />
            </div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-3 max-md:w-full">
              <div className="relative w-full md:w-64">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by name or number..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-primary/20 bg-white max-md:min-h-11"
                />
              </div>
              <Dropdown
                value={timeRange}
                onChange={(v) => setTimeRange(v as MessageTimeRange)}
                options={getMessageTimeRangeOptions(timeRange)}
                align="right"
              />
            </div>
          </div>

          {isLoading ? (
            <AdminTableSkeleton />
          ) : (
            <>
              <div
                className={`hidden md:block overflow-x-auto touch-scroll border border-gray-200 rounded-xl bg-white ${TABLE_MIN_HEIGHT}`}
              >
                <table className="w-full text-base table-fixed">
                  <colgroup>
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '5%' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50 text-left text-sm uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Number</th>
                      <th className="px-4 py-3">Window</th>
                      <th className="px-4 py-3">Direction</th>
                      <th className="px-4 py-3">Last Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last Sent</th>
                      <th className="px-4 py-3">Msgs</th>
                      <th className="px-2 py-3" aria-label="View messages" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-gray-100 hover:bg-gray-50/50 cursor-pointer"
                        onClick={() => openConversation(row.id)}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{row.userName}</span>
                            {row.userRole === 'manager' && (
                              <ShieldAlert size={14} className="shrink-0 text-amber-500" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{row.userNumber}</td>
                        <td className="px-4 py-3">
                          <WindowBadge open={row.windowOpen} />
                        </td>
                        <td className="px-4 py-3">
                          <DirectionBadge direction={row.lastDirection} />
                        </td>
                        <td className="px-4 py-3 text-gray-700 truncate">{getLastType(row)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.lastSentMessageStatus} />
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {formatDateTime(row.lastSentMessageAt)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-gray-700">{row.messageCount}</td>
                        <td className="px-2 py-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openConversation(row.id);
                            }}
                            className="text-brand-primary hover:text-brand-primaryDark transition-colors"
                            aria-label="View messages"
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!rows.length && (
                      <tr>
                        <td
                          colSpan={9}
                          className={`${EMPTY_ROW_HEIGHT} align-middle text-center text-gray-400`}
                        >
                          No conversations found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <ConversationMobileList rows={rows} onOpen={openConversation} />

              {tableQuery.data?.pagination && (
                <PaginationBar
                  pagination={tableQuery.data.pagination}
                  onPageChange={setPage}
                  onLimitChange={(l) => {
                    setLimit(l);
                    setPage(1);
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
