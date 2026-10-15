'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, isAdmin } from '@/lib/utils/auth';
import ConversationMessages from '@/components/features/admin/ConversationMessages';

export default function ConversationMessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;

  useEffect(() => {
    if (!loading && !isAdmin(user)) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  if (loading || !isAdmin(user) || !conversationId) {
    return null;
  }

  return <ConversationMessages conversationId={conversationId} />;
}
