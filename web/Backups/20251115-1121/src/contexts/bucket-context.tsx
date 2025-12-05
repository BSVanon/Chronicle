"use client";

import * as React from "react";

import type { Scripthash } from "@/core/providers/types";

export type BucketId = string;

export type Bucket = {
  id: BucketId;
  label: string;
  description?: string;
  scripthashes: Scripthash[];
};

export type BucketContextValue = {
  buckets: Bucket[];
  setBuckets: (buckets: Bucket[]) => void;
};

const STORAGE_KEY = "chronicle-buckets-v1";

const DEFAULT_BUCKETS: Bucket[] = [
  {
    id: "cold",
    label: "Cold",
    description: "Cold or long-term holdings monitored at a slower cadence.",
    scripthashes: ["shard-1-a"],
  },
  {
    id: "hot",
    label: "Hot",
    description: "Hot or day-to-day spending wallet.",
    scripthashes: ["shard-0-a"],
  },
  {
    id: "project_x",
    label: "Project X",
    description: "Project-specific funds kept separate from personal wallets.",
    scripthashes: ["shard-0-b"],
  },
];

const BucketContext = React.createContext<BucketContextValue | undefined>(
  undefined,
);

export function BucketProvider({ children }: { children: React.ReactNode }) {
  const [buckets, setBuckets] = React.useState<Bucket[]>(DEFAULT_BUCKETS);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Bucket[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      setBuckets(parsed);
    } catch {
      // ignore storage failures
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buckets));
    } catch {
      // ignore storage failures
    }
  }, [buckets]);

  const value = React.useMemo(
    () => ({ buckets, setBuckets }),
    [buckets],
  );

  return (
    <BucketContext.Provider value={value}>{children}</BucketContext.Provider>
  );
}

export function useBuckets(): BucketContextValue {
  const ctx = React.useContext(BucketContext);
  if (!ctx) {
    throw new Error("useBuckets must be used within a BucketProvider");
  }
  return ctx;
}
