"use client";

import * as React from "react";

import type { SentinelConfig } from "@/core/sentinel/types";

export type SentinelConfigContextValue = {
  config: SentinelConfig | null;
  setConfig: (config: SentinelConfig | null) => void;
};

const STORAGE_KEY = "chronicle-sentinel-config-v1";

const SentinelConfigContext = React.createContext<
  SentinelConfigContextValue | undefined
>(undefined);

export function SentinelConfigProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [config, setConfigState] = React.useState<SentinelConfig | null>(null);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SentinelConfig;
      if (!parsed || typeof parsed.baseUrl !== "string") return;
      setConfigState(parsed);
    } catch {
      // ignore storage failures
    }
  }, []);

  React.useEffect(() => {
    try {
      if (!config) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // ignore storage failures
    }
  }, [config]);

  const setConfig = React.useCallback((next: SentinelConfig | null) => {
    setConfigState(next);
  }, []);

  const value = React.useMemo(
    () => ({ config, setConfig }),
    [config, setConfig],
  );

  return (
    <SentinelConfigContext.Provider value={value}>
      {children}
    </SentinelConfigContext.Provider>
  );
}

export function useSentinelConfig(): SentinelConfigContextValue {
  const ctx = React.useContext(SentinelConfigContext);
  if (!ctx) {
    throw new Error("useSentinelConfig must be used within a SentinelConfigProvider");
  }
  return ctx;
}
