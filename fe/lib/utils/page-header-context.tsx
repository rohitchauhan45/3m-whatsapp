'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type DashboardTab = 'task' | 'user' | 'time';

interface PageHeaderContextType {
  breadcrumb: string | null;
  setBreadcrumb: (value: string | null) => void;
  onBack: (() => void) | null;
  setOnBack: (fn: (() => void) | null) => void;
  showDashboardTabs: boolean;
  setShowDashboardTabs: (show: boolean) => void;
  dashboardTab: DashboardTab;
  setDashboardTab: (tab: DashboardTab) => void;
}

const PageHeaderContext = createContext<PageHeaderContextType | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [breadcrumb, setBreadcrumbState] = useState<string | null>(null);
  const [showDashboardTabs, setShowDashboardTabsState] = useState(false);
  const [dashboardTab, setDashboardTabState] = useState<DashboardTab>('task');
  const onBackRef = useRef<(() => void) | null>(null);
  const [onBackVersion, setOnBackVersion] = useState(0);

  const setBreadcrumb = useCallback((value: string | null) => {
    setBreadcrumbState(value);
  }, []);

  const setShowDashboardTabs = useCallback((show: boolean) => {
    setShowDashboardTabsState(show);
  }, []);

  const setDashboardTab = useCallback((tab: DashboardTab) => {
    setDashboardTabState(tab);
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
      showDashboardTabs,
      setShowDashboardTabs,
      dashboardTab,
      setDashboardTab,
    }),
    [
      breadcrumb,
      setBreadcrumb,
      setOnBack,
      showDashboardTabs,
      setShowDashboardTabs,
      dashboardTab,
      setDashboardTab,
      onBackVersion,
    ],
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
