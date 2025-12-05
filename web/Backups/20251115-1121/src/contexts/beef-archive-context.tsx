"use client";

import * as React from "react";

import type { BeefArchiveEntry } from "@/core/beef/archive";
import {
  deserializeBeefArchive,
  serializeBeefArchive,
} from "@/core/beef/archive";

export type BeefArchiveContextValue = {
  entries: BeefArchiveEntry[];
  addEntry: (entry: BeefArchiveEntry) => void;
  clear: () => void;
};

const STORAGE_KEY = "chronicle-beef-archive-v1";

const BeefArchiveContext =
  React.createContext<BeefArchiveContextValue | undefined>(undefined);

export function BeefArchiveProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [entries, setEntries] = React.useState<BeefArchiveEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return deserializeBeefArchive(raw);
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeBeefArchive(entries));
    } catch {
      // ignore storage failures
    }
  }, [entries]);

  const addEntry = React.useCallback((entry: BeefArchiveEntry) => {
    setEntries((prev) => {
      const filtered = prev.filter((e) => e.id !== entry.id);
      return [...filtered, entry];
    });
  }, []);

  const clear = React.useCallback(() => {
    setEntries([]);
  }, []);

  const value = React.useMemo(
    () => ({ entries, addEntry, clear }),
    [entries, addEntry, clear],
  );

  return (
    <BeefArchiveContext.Provider value={value}>
      {children}
    </BeefArchiveContext.Provider>
  );
}

export function useBeefArchive(): BeefArchiveContextValue {
  const ctx = React.useContext(BeefArchiveContext);
  if (!ctx) {
    throw new Error("useBeefArchive must be used within a BeefArchiveProvider");
  }
  return ctx;
}
