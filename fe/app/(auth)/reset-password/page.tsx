'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import ConfigurableAuthLayout from '@/components/layout/ConfigurableAuthLayout';
import { resetPassword } from '@/lib/services/authService';
import { getAuthConfig } from '@/lib/config';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const router = useRouter();
  const config = getAuthConfig();
  const formConfig = config.rightColumn.resetPassword;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Reset link is missing or invalid.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(token, password);
      setIsComplete(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reset password. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderMissingToken = () => (
    <div className="space-y-6">
      <div className="rounded-3xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
        {formConfig.missingTokenMessage}
      </div>
      <button
        type="button"
        className="w-full rounded-2xl px-4 py-3 font-semibold text-white transition"
        style={{
          backgroundColor: config.brand.primaryColor,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = config.brand.primaryColorDark;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = config.brand.primaryColor;
        }}
        onClick={() => router.push('/forgot-password')}
      >
        {formConfig.requestNewLinkText}
      </button>
    </div>
  );

  const renderForm = () => (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          {formConfig.passwordLabel}
        </label>
        <div className="relative flex items-center">
          <Lock size={18} className="absolute left-4 text-gray-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={formConfig.passwordPlaceholder}
            className="w-full rounded-2xl border border-gray-200 px-12 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 bg-white"
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
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-4 text-gray-400 hover:text-gray-600"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Minimum 8 characters. Use a mix of letters and numbers for security.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          {formConfig.confirmPasswordLabel}
        </label>
        <div className="relative flex items-center">
          <Lock size={18} className="absolute left-4 text-gray-400" />
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={formConfig.confirmPasswordPlaceholder}
            className="w-full rounded-2xl border border-gray-200 px-12 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 bg-white"
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
          <button
            type="button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            className="absolute right-4 text-gray-400 hover:text-gray-600"
            aria-label={
              showConfirmPassword ? 'Hide password' : 'Show password'
            }
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-2xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
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
    </form>
  );

  const renderSuccess = () => (
    <div className="space-y-6">
      <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
        {formConfig.successMessage}
      </div>

      <button
        type="button"
        onClick={() => router.push('/login')}
        className="w-full rounded-2xl px-4 py-3 font-semibold text-white transition"
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
        {formConfig.backToSignInText}
      </button>
    </div>
  );

  return (
    <ConfigurableAuthLayout
      config={config}
      isSignup={false}
      title={formConfig.title}
      showSignUpLink={false}
    >
      {!token
        ? renderMissingToken()
        : isComplete
          ? renderSuccess()
          : renderForm()}
    </ConfigurableAuthLayout>
  );
}

export default function ResetPasswordPage() {
  const config = getAuthConfig();
  const formConfig = config.rightColumn.resetPassword;

  return (
    <Suspense
      fallback={
        <ConfigurableAuthLayout
          config={config}
          isSignup={false}
          title={formConfig.title}
          showSignUpLink={false}
        >
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-600">
              Loading...
            </div>
          </div>
        </ConfigurableAuthLayout>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

