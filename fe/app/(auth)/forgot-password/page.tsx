'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import ConfigurableAuthLayout from '@/components/layout/ConfigurableAuthLayout';
import { forgotPassword } from '@/lib/services/authService';
import { getAuthConfig } from '@/lib/config';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);
  const router = useRouter();
  const config = getAuthConfig();
  const formConfig = config.rightColumn.forgotPassword;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await forgotPassword(email);
      setIsSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to send reset link. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ConfigurableAuthLayout
      config={config}
      isSignup={false}
      title={formConfig.title}
      showSignUpLink={false}
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {!isSent ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                {formConfig.emailLabel}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={formConfig.emailPlaceholder}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 bg-white"
                style={{
                  '--tw-ring-color': config.brand.primaryColor,
                } as React.CSSProperties & { '--tw-ring-color': string }}
                onFocus={(e) => {
                  e.target.style.borderColor = config.brand.primaryColor;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '';
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: config.brand.primaryColor,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = config.brand.primaryColorDark;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = config.brand.primaryColor;
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  {formConfig.submitButtonLoadingText}
                </span>
              ) : (
                formConfig.submitButtonText
              )}
            </button>

            <p className="text-center text-sm text-gray-500">
              {formConfig.rememberedPasswordText}{' '}
              <button
                type="button"
                className="font-semibold hover:underline"
                style={{ color: config.brand.primaryColor }}
                onClick={() => router.push('/login')}
              >
                {formConfig.backToSignInText}
              </button>
            </p>
          </>
        ) : (
          <>
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
              {formConfig.successMessage.replace('{email}', email)}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setIsSent(false);
                }}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
              >
                {formConfig.useDifferentEmailText}
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:bg-opacity-10"
                style={{
                  borderColor: `${config.brand.primaryColor}66`,
                  color: config.brand.primaryColor,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = config.brand.primaryColor;
                  e.currentTarget.style.backgroundColor = config.brand.primaryColor;
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `${config.brand.primaryColor}66`;
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = config.brand.primaryColor;
                }}
              >
                <RefreshCw size={16} />
                {formConfig.resendLinkText}
              </button>
            </div>

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full rounded-xl px-4 py-3 font-semibold text-white transition"
              style={{
                backgroundColor: config.brand.primaryColor,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = config.brand.primaryColorDark;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = config.brand.primaryColor;
              }}
            >
              {formConfig.returnToSignInText}
            </button>
          </>
        )}
      </form>
    </ConfigurableAuthLayout>
  );
}

