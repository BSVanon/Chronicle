"use client";

import * as React from "react";

import type { HeaderStoreSnapshot } from "@/core/headers/store";
import { deserializeHeaderStore, serializeHeaderStore } from "@/core/headers/store";

export type HeaderStoreContextValue = {
  snapshot: HeaderStoreSnapshot;
  setSnapshot: (next: HeaderStoreSnapshot) => void;
  clear: () => void;
};

const STORAGE_KEY = "chronicle-headers-v1";

const HeaderStoreContext =
  React.createContext<HeaderStoreContextValue | undefined>(undefined);

export function HeaderStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [snapshot, setSnapshotState] = React.useState<HeaderStoreSnapshot>(() => {
    if (typeof window === "undefined") return { version: 1, bestHeight: null, headers: [] };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return deserializeHeaderStore(raw);
    } catch {
      return { version: 1, bestHeight: null, headers: [] };
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeHeaderStore(snapshot));
    } catch {
      // ignore storage failures
    }
  }, [snapshot]);

  const setSnapshot = React.useCallback((next: HeaderStoreSnapshot) => {
    setSnapshotState(next);
  }, []);

  const clear = React.useCallback(() => {
    setSnapshotState({ version: 1, bestHeight: null, headers: [] });
  }, []);

  const value = React.useMemo(
    () => ({ snapshot, setSnapshot, clear }),
    [snapshot, setSnapshot, clear],
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
