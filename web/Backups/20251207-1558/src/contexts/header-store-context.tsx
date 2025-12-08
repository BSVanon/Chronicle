"use client";

import * as React from "react";

import {
  getTipHeight,
  getHeaderCount,
  clearAllHeaders,
} from "@/core/headers/store";

export type HeaderStoreContextValue = {
  tipHeight: number | null;
  headerCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  clear: () => Promise<void>;
};

const HeaderStoreContext =
  React.createContext<HeaderStoreContextValue | undefined>(undefined);

export function HeaderStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tipHeight, setTipHeight] = React.useState<number | null>(null);
  const [headerCount, setHeaderCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const tip = await getTipHeight();
      const count = await getHeaderCount();
      setTipHeight(tip);
      setHeaderCount(count);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const clear = React.useCallback(async () => {
    await clearAllHeaders();
    await refresh();
  }, [refresh]);

  const value = React.useMemo(
    () => ({ tipHeight, headerCount, loading, refresh, clear }),
    [tipHeight, headerCount, loading, refresh, clear],
  );

  return (
    <HeaderStoreContext.Provider value={value}>
      {children}
    </HeaderStoreContext.Provider>
  );
}

export function useHeaderStore(): HeaderStoreContextValue {
  const ctx = React.useContext(HeaderStoreContext);
  if (!ctx) {
    throw new Error("useHeaderStore must be used within a HeaderStoreProvider");
  }
  return ctx;
}
