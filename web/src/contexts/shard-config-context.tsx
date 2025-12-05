"use client";

import * as React from "react";

import {
  DEFAULT_SHARD_CONFIG,
  deserializeShardConfig,
  serializeShardConfig,
  type ShardConfig,
  normalizeShardConfig,
} from "@/core/sentinel/shard-config";

export type ShardConfigContextValue = {
  config: ShardConfig;
  updateConfig: (partial: Partial<ShardConfig>) => void;
};

const STORAGE_KEY = "chronicle-shard-config-v1";

const ShardConfigContext = React.createContext<ShardConfigContextValue | undefined>(
  undefined,
);

export function ShardConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<ShardConfig>(DEFAULT_SHARD_CONFIG);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const loaded = deserializeShardConfig(raw);
      setConfig(loaded);
    } catch {
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeShardConfig(config));
    } catch {
      // ignore storage failures
    }
  }, [config]);

  const updateConfig = React.useCallback((partial: Partial<ShardConfig>) => {
    setConfig((prev) => normalizeShardConfig({ ...prev, ...partial }));
  }, []);

  const value = React.useMemo(
    () => ({ config, updateConfig }),
    [config, updateConfig],
  );

  return (
    <ShardConfigContext.Provider value={value}>{children}</ShardConfigContext.Provider>
  );
}

export function useShardConfig(): ShardConfigContextValue {
  const ctx = React.useContext(ShardConfigContext);
  if (!ctx) {
    throw new Error("useShardConfig must be used within a ShardConfigProvider");
  }
  return ctx;
}
