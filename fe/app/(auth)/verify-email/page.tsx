'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import AuthLayout from '@/components/layout/AuthLayout';
import { verifyToken } from '@/lib/services/authService';

type Status = 'loading' | 'success' | 'error';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState(
    'We are confirming your email. This will only take a moment.',
  );
  const router = useRouter();

  useEffect(() => {
    const runVerification = async () => {
      if (!token) {
        setStatus('error');
        setMessage('No verification token found in the link.');
        return;
      }

      try {
        await verifyToken(token);
        setStatus('success');
        setMessage('Your email is verified. You can now sign in to Admin Dashboard.');
      } catch (err) {
        setStatus('error');
        setMessage(
          err instanceof Error
            ? err.message
            : 'This verification link has expired or is invalid.',
        );
      }
    };

    runVerification();
  }, [token]);

  const renderIcon = () => {
    if (status === 'success') {
      return (
        <CheckCircle2 className="h-14 w-14 text-emerald-500" aria-hidden />
      );
    }

    if (status === 'error') {
      return <ShieldAlert className="h-14 w-14 text-red-500" aria-hidden />;
    }

    return <Loader2 className="h-14 w-14 animate-spin text-[#F97316]" />;
  };

  const renderAction = () => {
    if (status === 'loading') {
      return null;
    }

    return (
      <button
        type="button"
        onClick={() => router.push(status === 'success' ? '/login' : '/signup')}
        className="w-full rounded-2xl bg-[#F97316] px-4 py-3 font-semibold text-white shadow-lg shadow-[#F97316]/30 transition hover:bg-[#ea5c00]"
      >
        {status === 'success' ? 'Go to sign in' : 'Back to sign up'}
      </button>
    );
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="We&apos;re making sure this link is safe and belongs to you."
    >
      <div className="space-y-6 text-center">
        <div className="flex justify-center">{renderIcon()}</div>
        <h2 className="text-lg font-semibold text-gray-900">
          {status === 'success'
            ? 'Email verified'
            : status === 'error'
              ? 'Verification failed'
              : 'Hang tight'}
        </h2>
        <p className="text-sm text-gray-500">{message}</p>
        {renderAction()}
      </div>
    </AuthLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout
          title="Verify your email"
          subtitle="We&apos;re making sure this link is safe and belongs to you."
        >
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <Loader2 className="h-14 w-14 animate-spin text-[#F97316]" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Hang tight</h2>
            <p className="text-sm text-gray-500">
              We are confirming your email. This will only take a moment.
            </p>
          </div>
        </AuthLayout>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

