'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import ConfigurableAuthLayout from '@/components/layout/ConfigurableAuthLayout';
import { useToast } from '@/lib/providers/toast-provider';
import { useAuth } from '@/lib/utils/auth';
import {
  resendVerification,
  signup as signupAPI,
  verifyEmail,
} from '@/lib/services/authService';
import { getAuthConfig } from '@/lib/config';

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { showError, hideToast } = useToast();
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const router = useRouter();
  const { login } = useAuth();
  const config = getAuthConfig();
  const formConfig = config.rightColumn.signup;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    hideToast();
    setIsLoading(true);

    try {
      const response = await signupAPI({
        name,
        number,
        email,
        password,
      });

      if (response.requires_verification || !response.token || !response.user) {
        setRequiresVerification(true);
      } else {
        login(response.token, response.user);
        router.push('/dashboard');
      }
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : 'Signup failed. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    hideToast();
    setIsLoading(true);

    try {
      const response = await verifyEmail(email, verificationCode);
      if (response.token && response.user) {
        login(response.token, response.user);
        router.push('/dashboard');
      } else {
        showError('Verification failed. Please try again.');
      }
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : 'Verification failed. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    hideToast();
    try {
      await resendVerification(email);
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : 'Failed to resend verification code.',
      );
    }
  };

  const renderSignupForm = () => (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          {formConfig.nameLabel}
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={formConfig.namePlaceholder}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-shadow bg-white"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          {formConfig.numberLabel}
        </label>
        <input
          type="tel"
          required
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder={formConfig.numberPlaceholder}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-shadow bg-white"
        />
      </div>

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
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-shadow bg-white"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          {formConfig.passwordLabel}
        </label>
        <div className="relative flex items-center">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={formConfig.passwordPlaceholder}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-shadow bg-white"
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
          {formConfig.passwordHint}
        </p>
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

      <p className="text-center text-xs text-gray-400">
        {formConfig.termsText}{' '}
        <span className="font-medium text-gray-500">{formConfig.termsLinkText}</span> and{' '}
        <span className="font-medium text-gray-500">{formConfig.privacyLinkText}</span>.
      </p>
    </form>
  );

  const renderVerificationForm = () => (
    <form className="space-y-6" onSubmit={handleVerifyEmail}>
      <div className="rounded-xl border border-brand-primary/20 bg-brand-pastel-purple px-5 py-4 text-sm text-brand-purpleDark">
        We&apos;ve sent a verification code to{' '}
        <span className="font-semibold">{email}</span>. Enter the code below to
        activate your account.
      </div>

      <div className="space-y-2">
        <input
          type="text"
          required
          maxLength={6}
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          placeholder="Enter 6-digit code"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-lg tracking-[0.5em] text-gray-900 placeholder:text-gray-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 bg-white"
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
            Verifying...
          </span>
        ) : (
          'Verify email'
        )}
      </button>

      <div className="text-center text-sm text-gray-500">
        Didn&apos;t get the code?{' '}
        <button
          type="button"
          className="font-semibold hover:underline"
          style={{ color: config.brand.primaryColor }}
          onClick={handleResendCode}
        >
          Resend code
        </button>
      </div>

      <button
        type="button"
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
        onClick={() => {
          setRequiresVerification(false);
          setVerificationCode('');
        }}
      >
        Back to sign up
      </button>
    </form>
  );

  return (
    <ConfigurableAuthLayout config={config} isSignup={true}>
      {requiresVerification ? renderVerificationForm() : renderSignupForm()}
    </ConfigurableAuthLayout>
  );
}

