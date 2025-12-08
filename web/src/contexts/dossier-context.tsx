"use client";

import * as React from "react";

import type { UtxoDossier, BucketSummary, Bucket } from "@/core/dossier/types";
import {
  getAllDossiers,
  getDossiersByBucket,
  saveDossier,
  deleteDossier,
  computeBucketSummaries,
} from "@/core/dossier/store";

export type DossierContextValue = {
  /** All dossiers */
  dossiers: UtxoDossier[];
  /** Bucket summaries (computed from dossiers) */
  summaries: BucketSummary[];
  /** User-defined buckets */
  buckets: Bucket[];
  /** Loading state */
  loading: boolean;
  /** Add or update a dossier */
  save: (dossier: UtxoDossier) => Promise<void>;
  /** Delete a dossier by outpoint */
  remove: (outpoint: string) => Promise<void>;
  /** Refresh from IndexedDB */
  refresh: () => Promise<void>;
  /** Add a new bucket */
  addBucket: (bucket: Bucket) => void;
  /** Update a bucket */
  updateBucket: (id: string, patch: Partial<Bucket>) => void;
  /** Delete a bucket */
  deleteBucket: (id: string) => void;
  /** Replace all buckets (for import) */
  replaceBuckets: (newBuckets: Bucket[]) => void;
};

const BUCKETS_STORAGE_KEY = "chronicle-buckets-v2";

const DEFAULT_BUCKETS: Bucket[] = [
  { id: "cold-a", label: "Cold-A", description: "Primary cold storage" },
  { id: "cold-b", label: "Cold-B", description: "Secondary cold storage" },
  { id: "savings", label: "Savings", description: "Long-term savings" },
];

const DossierContext = React.createContext<DossierContextValue | undefined>(undefined);

export function DossierProvider({ children }: { children: React.ReactNode }) {
  const [dossiers, setDossiers] = React.useState<UtxoDossier[]>([]);
  const [summaries, setSummaries] = React.useState<BucketSummary[]>([]);
  const [buckets, setBuckets] = React.useState<Bucket[]>(DEFAULT_BUCKETS);
  const [loading, setLoading] = React.useState(true);

  // Load buckets from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(BUCKETS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Bucket[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBuckets(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist buckets to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem(BUCKETS_STORAGE_KEY, JSON.stringify(buckets));
    } catch {
      // ignore
    }
  }, [buckets]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllDossiers();
      setDossiers(all);
      const sums = await computeBucketSummaries();
      setSummaries(sums);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const save = React.useCallback(async (dossier: UtxoDossier) => {
    await saveDossier(dossier);
    await refresh();
  }, [refresh]);

  const remove = React.useCallback(async (outpoint: string) => {
    await deleteDossier(outpoint);
    await refresh();
  }, [refresh]);

  const addBucket = React.useCallback((bucket: Bucket) => {
    setBuckets((prev) => [...prev, bucket]);
  }, []);

  const updateBucket = React.useCallback((id: string, patch: Partial<Bucket>) => {
    setBuckets((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );
  }, []);

  const deleteBucket = React.useCallback((id: string) => {
    setBuckets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const replaceBuckets = React.useCallback((newBuckets: Bucket[]) => {
    setBuckets(newBuckets);
  }, []);

  const value = React.useMemo<DossierContextValue>(
    () => ({
      dossiers,
      summaries,
      buckets,
      loading,
      save,
      remove,
      refresh,
      addBucket,
      updateBucket,
      deleteBucket,
      replaceBuckets,
    }),
    [dossiers, summaries, buckets, loading, save, remove, refresh, addBucket, updateBucket, deleteBucket, replaceBuckets]
  );

  return (
    <DossierContext.Provider value={value}>{children}</DossierContext.Provider>
  );
}

export function useDossiers(): DossierContextValue {
  const ctx = React.useContext(DossierContext);
  if (!ctx) {
    throw new Error("useDossiers must be used within a DossierProvider");
  }
  return ctx;
}
