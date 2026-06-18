'use client';

import { createContext, useContext, useRef, useState } from 'react';

interface PageHeaderContextType {
  breadcrumb: string | null;
  setBreadcrumb: (value: string | null) => void;
  onBack: (() => void) | null;
  setOnBack: (fn: (() => void) | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextType>({
  breadcrumb: null,
  setBreadcrumb: () => {},
  onBack: null,
  setOnBack: () => {},
});

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [breadcrumb, setBreadcrumb] = useState<string | null>(null);
  const onBackRef = useRef<(() => void) | null>(null);
  const [, forceUpdate] = useState(0);

  const setOnBack = (fn: (() => void) | null) => {
    onBackRef.current = fn;
    forceUpdate((n) => n + 1);
  };

  return (
    <PageHeaderContext.Provider value={{ breadcrumb, setBreadcrumb, onBack: onBackRef.current, setOnBack }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  return useContext(PageHeaderContext);
}
