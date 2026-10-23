import { apiClient } from '@/lib/api/client';
import {
  getTimeRangeOptions,
  type PaginationMeta,
  type TimeRange,
} from '@/lib/services/dashboardService';

export type ConversationStatusFilter = 'all' | 'open' | 'expired' | 'failed';

/** Same presets as task/user tabs, plus "all" (no date filter). */
export type MessageTimeRange = TimeRange | 'all';

export function getMessageTimeRangeOptions(
  current?: MessageTimeRange,
): { value: MessageTimeRange; label: string }[] {
  return [
    ...getTimeRangeOptions(current === 'all' ? undefined : current),
    { value: 'all', label: 'All' },
  ];
}

export type MessageCardData = {
  totalConversations: number;
  windowOpen: number;
  windowExpired: number;
  totalMessages: number;
  failedMessages: number;
  incomingMessages: number;
  outgoingMessages: number;
};

export type ConversationDirection = 'incoming' | 'outgoing';
export type MessageDirection = 'INCOMING' | 'OUTGOING';
export type MessageDirectionFilter = 'all' | ConversationDirection;

export type ConversationRow = {
  id: string;
  number: string;
  userId: string;
  userName: string;
  userNumber: string;
  userRole: string | null;
  windowExpiresAt: string | null;
  windowOpen: boolean;
  /** Derived from lastIncoming vs lastSent timestamps. */
  lastDirection: ConversationDirection | null;
  lastIncomingMessageAt: string | null;
  lastIncomingMessageType: string | null;
  lastSentMessageAt: string | null;
  lastSentMessageType: string | null;
  lastSentMessageStyle: string | null;
  lastSentMessageStatus: string | null;
  messageCount: number;
  updatedAt: string;
};

export type ConversationMessage = {
  id: string;
  direction: MessageDirection;
  style: string;
  type: string;
  body: string;
  length: number;
  whatsappMessageId: string | null;
  status: string;
  createdAt: string;
  sendAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  recievedAt: string | null;
  errorCode: string | null;
  errorTitle: string | null;
  errorDetails: string | null;
};

export type ConversationDetail = {
  id: string;
  number: string;
  userId: string;
  userName: string;
  userNumber: string;
  userRole: string | null;
  windowExpiresAt: string | null;
  windowOpen: boolean;
  lastIncomingMessageAt: string | null;
  lastIncomingMessageType: string | null;
  lastSentMessageAt: string | null;
  lastSentMessageType: string | null;
  lastSentMessageStatus: string | null;
};

export type ConversationTableQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: ConversationStatusFilter;
  time?: MessageTimeRange;
};

export type ConversationMessagesQuery = {
  page?: number;
  limit?: number;
  search?: string;
  direction?: MessageDirectionFilter;
};

export type { PaginationMeta };

export async function fetchMessageCards(time: MessageTimeRange) {
  const { data } = await apiClient.get<{ data: MessageCardData }>(
    '/admin/dashboard/message-cards',
    { params: { time } },
  );
  return data.data;
}

export async function fetchConversationTable(query: ConversationTableQuery) {
  const { data } = await apiClient.get<{
    conversations: ConversationRow[];
    pagination: PaginationMeta;
  }>('/admin/dashboard/message-table', { params: query });
  return data;
}

export async function fetchConversationMessages(
  conversationId: string,
  query: ConversationMessagesQuery = {},
) {
  const { data } = await apiClient.get<{
    conversation: ConversationDetail;
    messages: ConversationMessage[];
    pagination: PaginationMeta;
  }>(`/admin/dashboard/conversations/${conversationId}/messages`, { params: query });
  return data;
}
