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

// Legacy demo scripthashes that should not appear in real bucket plans.
const DEMO_HASHES = new Set<Scripthash>(["shard-1-a", "shard-0-a", "shard-0-b"]);

function stripDemoScripthashes(buckets: Bucket[]): Bucket[] {
  return buckets.map((bucket) => ({
    ...bucket,
    scripthashes: bucket.scripthashes.filter((hash) => !DEMO_HASHES.has(hash)),
  }));
}

const DEFAULT_BUCKETS: Bucket[] = [
  {
    id: "cold",
    label: "Cold",
    description: "Cold or long-term holdings monitored at a slower cadence.",
    scripthashes: [],
  },
  {
    id: "hot",
    label: "Hot-Alpha",
    description: "Primary hot or day-to-day spending wallet.",
    scripthashes: [],
  },
  {
    id: "project_x",
    label: "Hot-Beta",
    description: "Primary hot or day-to-day spending wallet.",
    scripthashes: [],
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
      setBuckets(stripDemoScripthashes(parsed));
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
