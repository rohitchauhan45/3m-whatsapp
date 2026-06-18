'use client';

import { usePathname, useRouter } from 'next/navigation';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function AuthLayout({
  children,
  title,
  subtitle,
}: AuthLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';
  const isSignup = pathname === '/signup';

  return (
    <div className="min-h-dvh flex items-center justify-center auth-bg-pattern px-6 py-12">
      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Logo at top */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-3">
            <span className="text-2xl font-bold text-gray-900">Admin Dashboard</span>
          </div>
        </div>

        {/* Tab Navigation */}
        {(isLogin || isSignup) && (
          <div className="flex justify-center gap-2 mb-6">
            <button
              onClick={() => router.push('/signup')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isSignup
                  ? 'bg-white border border-gray-200 shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign up
            </button>
            <button
              onClick={() => router.push('/login')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isLogin
                  ? 'bg-white border border-gray-200 shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Log in
            </button>
          </div>
        )}

        {/* Main Card */}
        <div className="glass-card-soft rounded-3xl px-8 py-10 shadow-purple-lg">
          <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-base text-gray-500 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

