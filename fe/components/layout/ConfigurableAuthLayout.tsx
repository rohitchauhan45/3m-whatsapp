'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AuthConfig } from '@/lib/types/auth-config';

interface ConfigurableAuthLayoutProps {
  children: React.ReactNode;
  config: AuthConfig;
  isSignup?: boolean;
  title?: string;
  showSignUpLink?: boolean;
}

export default function ConfigurableAuthLayout({
  children,
  config,
  isSignup = false,
  title,
  showSignUpLink = true,
}: ConfigurableAuthLayoutProps) {
  const router = useRouter();
  const { brand, leftColumn, rightColumn } = config;
  const formConfig = isSignup ? rightColumn.signup : rightColumn.login;
  const displayTitle = title || formConfig.title;
  const [imageError, setImageError] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Left Column - Image with Overlay */}
      <div className="hidden lg:flex lg:w-2/3 relative">
        {/* Background Image */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300">
          {!imageError && (
            leftColumn.image.startsWith('http') || leftColumn.image.startsWith('//') ? (
              <img
                src={leftColumn.image}
                alt="Auth background"
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <Image
                src={leftColumn.image}
                alt="Auth background"
                fill
                className="object-cover"
                priority
                onError={() => setImageError(true)}
              />
            )
          )}
          {imageError && (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-400 to-gray-600">
              <div className="text-white text-center px-8">
                <p className="text-lg font-semibold mb-2">Image not found</p>
                <p className="text-sm opacity-80">
                  Please add an image at: {leftColumn.image}
                </p>
                <p className="text-xs opacity-60 mt-2">
                  Or update the image path in auth-config.json
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Overlay Box */}
        {leftColumn.overlay && (
          <div className="absolute bottom-8 left-8 max-w-md z-10">
            <div
              className="rounded-lg p-6 backdrop-blur-sm"
              style={{
                backgroundColor: leftColumn.overlay.backgroundColor,
                color: leftColumn.overlay.textColor,
              }}
            >
              <h2 className="text-2xl font-bold mb-3">
                {leftColumn.overlay.title}
              </h2>
              <p className="text-sm leading-relaxed mb-4 opacity-90">
                {leftColumn.overlay.description}
              </p>

              {/* Pagination Dots */}
              {leftColumn.overlay.showCarousel &&
                leftColumn.overlay.totalSlides > 1 && (
                  <div className="flex gap-2">
                    {Array.from({ length: leftColumn.overlay.totalSlides }).map(
                      (_, index) => (
                        <div
                          key={index}
                          className={`w-2 h-2 rounded-full transition-all ${
                            index === leftColumn.overlay.currentSlide
                              ? 'bg-white'
                              : 'bg-white/30 border border-white/50'
                          }`}
                        />
                      ),
                    )}
                  </div>
                )}
            </div>
          </div>
        )}
      </div>

      {/* Right Column - Form */}
      <div className="w-full lg:w-1/3 bg-white flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Brand Name */}
          <div className="mb-6">
            <h1
              className="text-3xl font-bold mb-2"
              style={{ color: brand.primaryColor }}
            >
              {brand.name}
            </h1>
            <h2 className="text-2xl font-bold text-gray-900">
              {displayTitle}
            </h2>
          </div>

          {/* Sign Up / Sign In Link */}
          {showSignUpLink && (
            <div className="text-sm text-gray-600 mb-6">
              {isSignup ? (
                <>
                  {rightColumn.signup.existingUserText}{' '}
                  <button
                    onClick={() => router.push('/login')}
                    className="font-medium hover:underline"
                    style={{ color: brand.primaryColor }}
                  >
                    {rightColumn.signup.signInLinkText}
                  </button>
                </>
              ) : (
                <>
                  {rightColumn.login.newUserText}{' '}
                  <button
                    onClick={() => router.push('/signup')}
                    className="font-medium hover:underline"
                    style={{ color: brand.primaryColor }}
                  >
                    {rightColumn.login.signUpLinkText}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Form Content */}
          {children}
        </div>
      </div>
    </div>
  );
}

