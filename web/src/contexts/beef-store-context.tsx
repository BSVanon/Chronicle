"use client";

import * as React from "react";

import type { ProofArchive, BeefIndex } from "@/core/dossier/types";
import {
  getAllBeef,
  getBeef,
  saveBeef,
  deleteBeef,
  buildBeefIndex,
  verifyBeefIntegrity,
} from "@/core/dossier/beef-store";

export type BeefStoreContextValue = {
  /** All BEEF archives */
  archives: ProofArchive[];
  /** BEEF index (txid → beef_hash) */
  index: BeefIndex;
  /** Loading state */
  loading: boolean;
  /** Get a single BEEF by txid */
  get: (txid: string) => Promise<ProofArchive | null>;
  /** Save a BEEF archive (use force: true to overwrite corrupted BEEF) */
  save: (archive: ProofArchive, options?: { force?: boolean }) => Promise<{ ok: boolean; message?: string }>;
  /** Delete a BEEF by txid */
  remove: (txid: string) => Promise<void>;
  /** Refresh from IndexedDB */
  refresh: () => Promise<void>;
  /** Verify integrity of all BEEF blobs */
  verifyIntegrity: () => Promise<{
    total: number;
    valid: number;
    invalid: string[];
  }>;
};

const BeefStoreContext = React.createContext<BeefStoreContextValue | undefined>(undefined);

export function BeefStoreProvider({ children }: { children: React.ReactNode }) {
  const [archives, setArchives] = React.useState<ProofArchive[]>([]);
  const [index, setIndex] = React.useState<BeefIndex>({});
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllBeef();
      setArchives(all);
      const idx = await buildBeefIndex();
      setIndex(idx);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const get = React.useCallback(async (txid: string) => {
    return getBeef(txid);
  }, []);

  const save = React.useCallback(async (archive: ProofArchive, options?: { force?: boolean }) => {
    const result = await saveBeef(archive, options);
    if (result.ok) {
      await refresh();
    }
    return result;
  }, [refresh]);

  const remove = React.useCallback(async (txid: string) => {
    await deleteBeef(txid);
    await refresh();
  }, [refresh]);

  const verifyIntegrity = React.useCallback(async () => {
    return verifyBeefIntegrity();
  }, []);

  const value = React.useMemo<BeefStoreContextValue>(
    () => ({
      archives,
      index,
      loading,
      get,
      save,
      remove,
      refresh,
      verifyIntegrity,
    }),
    [archives, index, loading, get, save, remove, refresh, verifyIntegrity]
  );

  return (
    <BeefStoreContext.Provider value={value}>{children}</BeefStoreContext.Provider>
  );
}

export function useBeefStore(): BeefStoreContextValue {
  const ctx = React.useContext(BeefStoreContext);
  if (!ctx) {
    throw new Error("useBeefStore must be used within a BeefStoreProvider");
  }
  return ctx;
}
