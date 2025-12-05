"use client";

import * as React from "react";

import type { TrackedOutpoint } from "@/core/utxo/tracked-outpoint";
import {
  deserializeTrackedOutpoints,
  serializeTrackedOutpoints,
} from "@/core/utxo/tracked-outpoint";

export type TrackedOutpointsContextValue = {
  outpoints: TrackedOutpoint[];
  addOutpoint: (op: TrackedOutpoint) => void;
  deleteOutpoint: (id: string) => void;
  clearOutpoints: () => void;
};

const STORAGE_KEY = "chronicle-tracked-outpoints-v1";

const TrackedOutpointsContext =
  React.createContext<TrackedOutpointsContextValue | undefined>(undefined);

export function TrackedOutpointsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [outpoints, setOutpoints] = React.useState<TrackedOutpoint[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return deserializeTrackedOutpoints(raw);
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        serializeTrackedOutpoints(outpoints),
      );
    } catch {
      // ignore storage failures
    }
  }, [outpoints]);

  const addOutpoint = React.useCallback((op: TrackedOutpoint) => {
    setOutpoints((prev) => [...prev, op]);
  }, []);

  const deleteOutpoint = React.useCallback((id: string) => {
    setOutpoints((prev) => prev.filter((op) => op.id !== id));
  }, []);

  const clearOutpoints = React.useCallback(() => {
    setOutpoints([]);
  }, []);

  const value = React.useMemo(
    () => ({ outpoints, addOutpoint, deleteOutpoint, clearOutpoints }),
    [outpoints, addOutpoint, deleteOutpoint, clearOutpoints],
  );

  return (
    <TrackedOutpointsContext.Provider value={value}>
      {children}
    </TrackedOutpointsContext.Provider>
  );
}

export function useTrackedOutpoints(): TrackedOutpointsContextValue {
  const ctx = React.useContext(TrackedOutpointsContext);
  if (!ctx) {
    throw new Error(
      "useTrackedOutpoints must be used within a TrackedOutpointsProvider",
    );
  }
  return ctx;
}
