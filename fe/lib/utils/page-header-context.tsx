'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

interface PageHeaderContextType {
  breadcrumb: string | null;
  setBreadcrumb: (value: string | null) => void;
  onBack: (() => void) | null;
  setOnBack: (fn: (() => void) | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextType | null>(null);

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [breadcrumb, setBreadcrumbState] = useState<string | null>(null);
  const onBackRef = useRef<(() => void) | null>(null);
  const [onBackVersion, setOnBackVersion] = useState(0);

  const setBreadcrumb = useCallback((value: string | null) => {
    setBreadcrumbState(value);
  }, []);

  const setOnBack = useCallback((fn: (() => void) | null) => {
    if (onBackRef.current === fn) return;
    onBackRef.current = fn;
    setOnBackVersion((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({
      breadcrumb,
      setBreadcrumb,
      onBack: onBackRef.current,
      setOnBack,
    }),
    [breadcrumb, setBreadcrumb, setOnBack, onBackVersion],
  );

  return (
    <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) {
    throw new Error('usePageHeader must be used within PageHeaderProvider');
  }
  return ctx;
}
