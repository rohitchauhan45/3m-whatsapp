'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { AdminTableSkeleton } from '@/components/ui/skeletons';
import Modal, { ModalDetailGrid, ModalDetailRow } from '@/components/ui/Modal';
import { cachedQueryOptions } from '@/lib/query-config';
import { invalidateDashboardQueries, queryKeys } from '@/lib/query-keys';
import { getApiErrorMessage } from '@/lib/api/client';
import { useToast } from '@/lib/providers/toast-provider';
import { resendFailedAssign } from '@/lib/services/dashboardService';
import {
  fetchConversationMessages,
  type ConversationMessage,
  type MessageDirectionFilter,
  type PaginationMeta,
} from '@/lib/services/messageService';
import { usePageHeader } from '@/lib/utils/page-header-context';
import { ui } from '@/lib/utils/ui-classes';

const TABLE_MIN_HEIGHT = 'min-h-[420px]';
const EMPTY_ROW_HEIGHT = 'h-[380px] max-md:h-48';

const DIRECTION_FILTER_OPTIONS: { value: MessageDirectionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'incoming', label: 'Incoming' },
  { value: 'outgoing', label: 'Outgoing' },
];

function isIncoming(msg: ConversationMessage): boolean {
  return msg.direction === 'INCOMING';
}

/** Incoming → when user sent it; outgoing → when we sent it. */
function getMessageTime(msg: ConversationMessage): string | null {
  return isIncoming(msg) ? msg.recievedAt || msg.createdAt : msg.sendAt || msg.createdAt;
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

function getMessageStatusClassName(status: string | null | undefined): string {
  const upper = (status ?? '').toUpperCase();
  if (upper === 'FAILED') return 'text-red-600';
  if (upper === 'READ') return 'text-green-600';
  if (upper === 'DELIVERED') return 'text-brand-primary';
  if (upper === 'SENT') return 'text-gray-700';
  if (upper === 'PENDING') return 'text-amber-600';
  return 'text-gray-600';
}

function getMessageStyleClassName(style: string | null | undefined): string {
  const upper = (style ?? '').toUpperCase();
  if (upper === 'TEMPLATE') return 'text-violet-600';
  if (upper === 'INTERACTIVE') return 'text-brand-primary';
  if (upper === 'TEXT') return 'text-sky-600';
  return 'text-gray-700';
}

function getStatusBannerClass(status: string): string {
  const upper = status.toUpperCase();
  if (upper === 'FAILED') return 'border-red-200 bg-red-50';
  if (upper === 'READ') return 'border-green-200 bg-green-50';
  if (upper === 'DELIVERED') return 'border-blue-200 bg-blue-50';
  if (upper === 'SENT') return 'border-gray-200 bg-gray-50';
  return 'border-amber-200 bg-amber-50';
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-sm font-semibold capitalize ${getMessageStatusClassName(status)}`}>
      {status.toLowerCase()}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: ConversationMessage['direction'] }) {
  if (direction === 'INCOMING') {
    return <span className="text-sm font-semibold text-sky-600">Incoming</span>;
  }
  return <span className="text-sm font-semibold text-violet-600">Outgoing</span>;
}

function DirectionFilterBar({
  value,
  onChange,
}: {
  value: MessageDirectionFilter;
  onChange: (value: MessageDirectionFilter) => void;
}) {
  return (
    <div className={ui.tabBar}>
      {DIRECTION_FILTER_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={value === option.value ? ui.tabActive : ui.tabInactive}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Re-send failed assignTask message — only while the user's 24h window is open. */
function ResendAssignButton({
  msg,
  sendingId,
  onResend,
}: {
  msg: ConversationMessage;
  sendingId: string | null;
  onResend: (dailyTaskId: string) => void;
}) {
  const retry = msg.assignRetry;
  if (!retry) return null;

  if (!retry.windowOpen) {
    return (
      <span
        className="text-xs font-medium text-gray-400"
        title="User's WhatsApp window is closed — re-send available after the user messages"
      >
        Window closed
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onResend(retry.dailyTaskId);
      }}
      disabled={sendingId !== null}
      title="Re-send assign task message"
      className="inline-flex items-center gap-1 rounded-full border border-brand-primary/30 px-2.5 py-1 text-xs font-semibold text-brand-primary hover:bg-brand-primary/5 disabled:opacity-50"
    >
      {sendingId === retry.dailyTaskId && <Loader2 size={12} className="animate-spin" />}
      Send
    </button>
  );
}

function WindowBadge({ open }: { open: boolean }) {
  return open ? (
    <span className="text-sm font-semibold text-green-600">Open</span>
  ) : (
    <span className="text-sm font-semibold text-amber-600">Expired</span>
  );
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

function truncateBody(text: string, max = 80): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean || '—';
  return `${clean.slice(0, max)}…`;
}

export default function ConversationMessages({
  conversationId,
}: {
  conversationId: string;
}) {
  const router = useRouter();
  const { setBreadcrumb, setOnBack } = usePageHeader();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<MessageDirectionFilter>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [detail, setDetail] = useState<ConversationMessage | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, direction]);

  const query = useQuery({
    queryKey: queryKeys.dashboard.conversationMessages(conversationId, {
      page,
      limit,
      search,
      direction,
    }),
    queryFn: () =>
      fetchConversationMessages(conversationId, {
        page,
        limit,
        search: search || undefined,
        direction,
      }),
    ...cachedQueryOptions,
  });

  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();
  const resendMutation = useMutation({
    mutationFn: (dailyTaskId: string) => resendFailedAssign(dailyTaskId),
    onSuccess: (res) => {
      invalidateDashboardQueries(queryClient);
      if (!res.success) {
        showError(res.message || 'Failed to re-send message');
        return;
      }
      setDetail(null);
      showToast(res.message || 'Message sent', 'success');
    },
    onError: (err) => {
      invalidateDashboardQueries(queryClient);
      showError(getApiErrorMessage(err, 'Failed to re-send message'));
    },
  });
  const resendingId = resendMutation.isPending ? (resendMutation.variables ?? null) : null;
  const handleResend = (dailyTaskId: string) => {
    if (resendMutation.isPending) return;
    resendMutation.mutate(dailyTaskId);
  };

  useEffect(() => {
    const name = query.data?.conversation.userName;
    setBreadcrumb(name ? `Message / ${name}` : 'Message');
    setOnBack(() => {
      router.push('/messages');
    });
    return () => {
      setBreadcrumb(null);
      setOnBack(null);
    };
  }, [query.data?.conversation.userName, router, setBreadcrumb, setOnBack]);

  const messages = query.data?.messages ?? [];
  const conversation = query.data?.conversation;

  return (
    <div className="animate-fade-in min-h-[calc(100dvh-11rem)] max-md:min-h-0 flex flex-col w-full">
      <div className="space-y-6 max-md:space-y-4 flex flex-col flex-1 min-h-0">
        {conversation && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">User</p>
              <p className="mt-1 text-base font-semibold text-gray-900 truncate">
                {conversation.userName}
              </p>
              <p className="text-sm text-gray-500">{conversation.userNumber}</p>
            </div>
            <div
              className={`rounded-xl border p-4 shadow-sm ${
                conversation.windowOpen
                  ? 'border-green-200 bg-green-50/40'
                  : 'border-amber-200 bg-amber-50/40'
              }`}
            >
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Window</p>
              <div className="mt-2">
                <WindowBadge open={conversation.windowOpen} />
              </div>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last sent</p>
              <p className="mt-1 text-base font-semibold text-violet-700 truncate">
                {conversation.lastSentMessageType || '—'}
              </p>
              <p className="text-sm text-gray-500">{formatDateTime(conversation.lastSentMessageAt)}</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50/30 p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Last incoming
              </p>
              <p className="mt-1 text-base font-semibold text-sky-700 truncate">
                {conversation.lastIncomingMessageType || '—'}
              </p>
              <p className="text-sm text-gray-500">
                {formatDateTime(conversation.lastIncomingMessageAt)}
              </p>
            </div>
            <div
              className={`rounded-xl border p-4 shadow-sm ${getStatusBannerClass(
                conversation.lastSentMessageStatus || 'PENDING',
              )}`}
            >
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last status</p>
              <div className="mt-2">
                <StatusBadge status={conversation.lastSentMessageStatus || 'PENDING'} />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="max-md:w-full max-md:overflow-x-auto touch-scroll">
              <DirectionFilterBar value={direction} onChange={setDirection} />
            </div>
            <div className="relative w-full md:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by type or body..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-primary/20 bg-white max-md:min-h-11"
              />
            </div>
          </div>

          {query.isLoading ? (
            <AdminTableSkeleton />
          ) : (
            <>
              <div
                className={`hidden md:block overflow-x-auto touch-scroll border border-gray-200 rounded-xl bg-white ${TABLE_MIN_HEIGHT}`}
              >
                <table className="w-full text-base table-fixed">
                  <colgroup>
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '8%' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50 text-left text-sm uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Direction</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Style</th>
                      <th className="px-4 py-3">Body</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-2 py-3" aria-label="View details" />
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((msg) => (
                      <tr
                        key={msg.id}
                        className={`border-t border-gray-100 hover:bg-gray-50/50 ${
                          isIncoming(msg) ? 'bg-sky-50/30' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <DirectionBadge direction={msg.direction} />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 truncate">{msg.type}</td>
                        <td className="px-4 py-3 text-gray-600 capitalize">
                          {msg.style.toLowerCase()}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{truncateBody(msg.body)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={msg.status} />
                            <ResendAssignButton
                              msg={msg}
                              sendingId={resendingId}
                              onResend={handleResend}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {formatDateTime(getMessageTime(msg))}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setDetail(msg)}
                            className={ui.linkPrimary}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!messages.length && (
                      <tr>
                        <td
                          colSpan={7}
                          className={`${EMPTY_ROW_HEIGHT} align-middle text-center text-gray-400`}
                        >
                          No messages in this conversation
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {messages.length === 0 ? (
                  <div className="rounded-xl border border-gray-200 bg-white py-14 text-center text-sm text-gray-400">
                    No messages in this conversation
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setDetail(msg)}
                      className={`w-full rounded-xl border p-4 text-left shadow-sm ${
                        isIncoming(msg) ? 'border-sky-100 bg-sky-50/40' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <DirectionBadge direction={msg.direction} />
                          <p className="font-semibold text-gray-900 truncate">{msg.type}</p>
                        </div>
                        <StatusBadge status={msg.status} />
                      </div>
                      <p className="mt-2 text-sm text-gray-600 line-clamp-3 whitespace-pre-line">
                        {msg.body || '—'}
                      </p>
                      <p className="mt-2 text-xs text-gray-400">
                        {formatDateTime(getMessageTime(msg))} · {msg.style.toLowerCase()}
                      </p>
                    </button>
                    {msg.assignRetry && (
                      <div className="flex justify-end px-1">
                        <ResendAssignButton
                          msg={msg}
                          sendingId={resendingId}
                          onResend={handleResend}
                        />
                      </div>
                    )}
                    </div>
                  ))
                )}
              </div>

              {query.data?.pagination && (
                <PaginationBar
                  pagination={query.data.pagination}
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

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Message Details" size="xl">
        {detail && (
          <div className="space-y-3">
            <div
              className={`rounded-xl border px-4 py-3.5 ${getStatusBannerClass(detail.status)}`}
            >
              <p className="mb-1 text-sm font-medium text-gray-500">Status</p>
              <p
                className={`text-lg font-semibold capitalize ${getMessageStatusClassName(detail.status)}`}
              >
                {detail.status.toLowerCase()}
              </p>
              {detail.status.toUpperCase() === 'FAILED' && detail.errorTitle && (
                <p className="mt-1 text-sm font-medium text-red-600">{detail.errorTitle}</p>
              )}
              {detail.assignRetry && (
                <div className="mt-3">
                  <ResendAssignButton
                    msg={detail}
                    sendingId={resendingId}
                    onResend={handleResend}
                  />
                </div>
              )}
            </div>

            <ModalDetailGrid>
              <ModalDetailRow
                label="Direction"
                value={isIncoming(detail) ? 'Incoming' : 'Outgoing'}
                valueClassName={isIncoming(detail) ? 'text-sky-600' : 'text-violet-600'}
              />
              <ModalDetailRow
                label="Type"
                value={detail.type}
                valueClassName="text-violet-700"
              />
              <ModalDetailRow
                label="Style"
                value={detail.style}
                valueClassName={getMessageStyleClassName(detail.style)}
              />
              <ModalDetailRow
                label="Length"
                value={String(detail.length)}
                valueClassName="text-gray-700 tabular-nums"
              />
              <ModalDetailRow
                label="WhatsApp ID"
                value={detail.whatsappMessageId || '—'}
                fullWidth
                valueClassName="text-gray-600 font-mono text-sm normal-case"
              />
              <ModalDetailRow label="Created At" value={formatDateTime(detail.createdAt)} />
              {isIncoming(detail) ? (
                <>
                  <ModalDetailRow
                    label="Received At"
                    value={formatDateTime(detail.recievedAt)}
                    valueClassName="text-sky-600"
                  />
                  <ModalDetailRow
                    label="Read At"
                    value={formatDateTime(detail.readAt)}
                    valueClassName="text-green-600"
                  />
                </>
              ) : (
                <>
                  <ModalDetailRow
                    label="Sent At"
                    value={formatDateTime(detail.sendAt)}
                    valueClassName="text-brand-primary"
                  />
                  <ModalDetailRow
                    label="Delivered At"
                    value={formatDateTime(detail.deliveredAt)}
                    valueClassName="text-brand-primary"
                  />
                  <ModalDetailRow
                    label="Read At"
                    value={formatDateTime(detail.readAt)}
                    valueClassName="text-green-600"
                  />
                  <ModalDetailRow
                    label="Failed At"
                    value={formatDateTime(detail.failedAt)}
                    valueClassName="text-red-600"
                  />
                  <ModalDetailRow
                    label="Error Code"
                    value={detail.errorCode || '—'}
                    valueClassName="text-red-600"
                  />
                  <ModalDetailRow
                    label="Error Title"
                    value={detail.errorTitle || '—'}
                    valueClassName="text-red-600"
                    fullWidth
                  />
                  <ModalDetailRow
                    label="Error Details"
                    value={detail.errorDetails || '—'}
                    fullWidth
                    valueClassName="text-red-600"
                  />
                </>
              )}
              <ModalDetailRow
                label="Body"
                value={detail.body || '—'}
                fullWidth
                valueClassName="text-gray-800 normal-case whitespace-pre-line"
              />
            </ModalDetailGrid>
          </div>
        )}
      </Modal>
    </div>
  );
}