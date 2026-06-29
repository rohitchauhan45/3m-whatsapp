'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import ConfigurableAuthLayout from '@/components/layout/ConfigurableAuthLayout';
import { useAuth } from '@/lib/utils/auth';
import { useToast } from '@/lib/providers/toast-provider';
import { login as loginAPI, resendVerification, forgotPassword, verifyOtp, resetPassword } from '@/lib/services/authService';
import { getAuthConfig } from '@/lib/config';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { showError, showSuccess, hideToast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  
  // Forgot password modal states
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [otp, setOtp] = useState('');
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  const router = useRouter();
  const { login } = useAuth();
  const config = getAuthConfig();
  const formConfig = config.rightColumn.login;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    hideToast();
    setIsLoading(true);
    // Reset email verification state on new login attempt
    setShowEmailVerification(false);
    setEmailVerificationSent(false);

    try {
      const response = await loginAPI({
        identifier,
        password,
      });

      if (response.token && response.user) {
        // Reset email verification state on successful login
        setShowEmailVerification(false);
        setEmailVerificationSent(false);
        login(response.token, response.user);
        router.push('/dashboard');
      } else {
        showError('Unable to sign in. Please try again.');
      }
    } catch (err) {
      console.error("Login failed error is : ", err);
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please try again.';
      
      if (errorMessage.toLowerCase().includes('email not verified')) {
        setShowEmailVerification(true);
        const email = identifier.includes('@') ? identifier : '';
        setUserEmail(email);
        showError('Please verify your email to continue.');
      } else {
        showError(errorMessage);
        setShowEmailVerification(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailVerificationCheckbox = async (checked: boolean) => {
    if (checked && userEmail && !emailVerificationSent) {
      setIsLoading(true);
      hideToast();
      try {
        await resendVerification(userEmail);
        setEmailVerificationSent(true);
      } catch (err) {
        showError(
          err instanceof Error
            ? err.message
            : 'Failed to send verification email. Please try again.',
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const resetForgotPasswordState = () => {
    setForgotEmail('');
    setIsSendingReset(false);
    setForgotStep('request');
    setOtp('');
    setNewPasswordValue('');
    setConfirmPasswordValue('');
    setResetToken('');
    setIsVerifyingOtp(false);
    setIsResettingPassword(false);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    hideToast();

    if (!forgotEmail.trim()) {
      showError('Email is required');
      return;
    }

    if (!validateEmail(forgotEmail.trim())) {
      showError('Please enter a valid email address');
      return;
    }

    setIsSendingReset(true);
    try {
      const response = await forgotPassword(forgotEmail.trim());
      if (response?.success) {
        showSuccess(response.message || 'OTP sent to your email.');
        if (response.token) {
          setResetToken(response.token);
        }
        setForgotStep('verify');
      } else {
        showError(response?.message || 'Unable to send reset instructions.');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Unable to send reset instructions.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    hideToast();

    if (!resetToken) {
      showError('Reset token missing. Please resend OTP.');
      setForgotStep('request');
      return;
    }

    if (!otp.trim()) {
      showError('OTP is required');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const response = await verifyOtp(resetToken, parseInt(otp.trim()));
      if (response?.success) {
        showSuccess(response.message || 'OTP verified. Please set a new password.');
        setForgotStep('reset');
      } else {
        showError(response?.message || 'Unable to verify OTP.');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Unable to verify OTP.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    hideToast();

    if (!newPasswordValue || newPasswordValue.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    if (newPasswordValue !== confirmPasswordValue) {
      showError('Passwords do not match');
      return;
    }

    setIsResettingPassword(true);
    try {
      const response = await resetPassword(resetToken, newPasswordValue);
      if (response?.success) {
        showSuccess(response.message || 'Password reset successfully. Please log in.');
        setTimeout(() => {
          setIsForgotModalOpen(false);
          resetForgotPasswordState();
        }, 2000);
      } else {
        showError(response?.message || 'Unable to reset password.');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Unable to reset password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <ConfigurableAuthLayout config={config} isSignup={false}>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            {formConfig.emailLabel}
          </label>
          <input
            type="text"
            required
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              // Reset email verification state when identifier changes
              if (showEmailVerification) {
                setShowEmailVerification(false);
                setEmailVerificationSent(false);
                setUserEmail('');
              }
            }}
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
        </div>

        {showEmailVerification && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <label className="inline-flex items-start gap-2 text-sm text-amber-800 cursor-pointer">
              <input
                type="checkbox"
                checked={emailVerificationSent}
                onChange={(e) => handleEmailVerificationCheckbox(e.target.checked)}
                disabled={emailVerificationSent || isLoading || !userEmail}
                className="h-4 w-4 rounded border-amber-300 focus:ring-2 mt-0.5"
                
              />
              <span>
                {emailVerificationSent ? (
                  <>
                    check your email.
                  </>
                ) : userEmail ? (
                  <>
                    verify your email to continue.
                  </>
                ) : (
                  <>
                    Your email is not verified. Please use your email address (not username) to login and verify your email.
                  </>
                )}
              </span>
            </label>
          </div>
        )}

        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 focus:ring-2"
              style={{
                accentColor: config.brand.primaryColor,
                '--tw-ring-color': config.brand.primaryColor,
              } as React.CSSProperties & { '--tw-ring-color': string }}
            />
            {formConfig.rememberMeText}
          </label>
          <button
            type="button"
            onClick={() => {
              setIsForgotModalOpen(true);
              resetForgotPasswordState();
            }}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Forgot password?
          </button>
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
      </form>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  {forgotStep === 'request' && 'Reset password'}
                  {forgotStep === 'verify' && 'Verify OTP'}
                  {forgotStep === 'reset' && 'Choose new password'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {forgotStep === 'request' && 'Enter your email to receive a 6-digit OTP.'}
                  {forgotStep === 'verify' && 'Enter the OTP we sent to your email.'}
                  {forgotStep === 'reset' && 'Create a strong password for your account.'}
                </p>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setIsForgotModalOpen(false);
                  resetForgotPasswordState();
                }}
                aria-label="Close password reset"
              >
                ✕
              </button>
            </div>

            {forgotStep === 'request' && (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="forgot-email">
                    Email address
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="name@example.com"
                    disabled={isSendingReset}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    className="w-full sm:w-1/3 py-2.5 rounded-lg border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50"
                    onClick={() => {
                      setIsForgotModalOpen(false);
                      resetForgotPasswordState();
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingReset}
                    className={`w-full sm:flex-1 py-2.5 rounded-lg font-semibold text-white transition-colors ${
                      isSendingReset ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {isSendingReset ? 'Sending...' : 'Send OTP'}
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'verify' && (
              <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="otp-input">
                    Enter OTP
                  </label>
                  <input
                    id="otp-input"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="6-digit code"
                    disabled={isVerifyingOtp}
                    maxLength={6}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    className="w-full sm:w-1/3 py-2.5 rounded-lg border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50"
                    onClick={() => {
                      setForgotStep('request');
                      hideToast();
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingOtp}
                    className={`w-full sm:flex-1 py-2.5 rounded-lg font-semibold text-white transition-colors ${
                      isVerifyingOtp ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'reset' && (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="new-password">
                    New password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter new password"
                    disabled={isResettingPassword}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="confirm-password">
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPasswordValue}
                    onChange={(e) => setConfirmPasswordValue(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Re-enter new password"
                    disabled={isResettingPassword}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    className="w-full sm:w-1/3 py-2.5 rounded-lg border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50"
                    onClick={() => {
                      setForgotStep('verify');
                      hideToast();
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isResettingPassword}
                    className={`w-full sm:flex-1 py-2.5 rounded-lg font-semibold text-white transition-colors ${
                      isResettingPassword ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {isResettingPassword ? 'Saving...' : 'Reset password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </ConfigurableAuthLayout>
  );
}

