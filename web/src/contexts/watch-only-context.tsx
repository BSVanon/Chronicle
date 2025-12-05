"use client";

import * as React from "react";

import { analyzeWatchOnlyInput } from "@/core/wallet/watch-only-analyzer";
import type { WatchOnlyAnalysis } from "@/core/wallet/watch-only-analyzer";
import {
  planDerivationInputs,
  runBasicDerivation,
  type DerivationInput,
} from "@/core/wallet/watch-only-derivation";

export type WatchOnlyState = {
  raw: string;
  analysis: WatchOnlyAnalysis;
  scripthashes: string[];
  sourceCount: number;
  warnings: string[];
  derivationInputs: DerivationInput[];
  setRaw: (value: string) => void;
};

const WatchOnlyContext = React.createContext<WatchOnlyState | undefined>(
  undefined,
);

export function WatchOnlyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [raw, setRaw] = React.useState("");

  const analysis = React.useMemo(
    () => analyzeWatchOnlyInput(raw),
    [raw],
  );

  const derivationInputs = React.useMemo(
    () => planDerivationInputs(raw, analysis),
    [raw, analysis],
  );

  const derivation = React.useMemo(
    () => runBasicDerivation(raw, analysis),
    [raw, analysis],
  );

  const scripthashes = React.useMemo(
    () => {
      const set = new Set<string>();
      for (const entry of derivation.entries) {
        set.add(entry.scripthash);
      }
      return Array.from(set);
    },
    [derivation.entries],
  );

  const value = React.useMemo<WatchOnlyState>(
    () => ({
      raw,
      analysis,
      scripthashes,
      sourceCount: derivation.entries.length,
      warnings: derivation.warnings,
      derivationInputs,
      setRaw,
    }),
    [raw, analysis, scripthashes, derivation, derivationInputs],
  );

  return (
    <WatchOnlyContext.Provider value={value}>
      {children}
    </WatchOnlyContext.Provider>
  );
}

export function useWatchOnly(): WatchOnlyState {
  const ctx = React.useContext(WatchOnlyContext);
  if (!ctx) {
    throw new Error("useWatchOnly must be used within a WatchOnlyProvider");
  }
  return ctx;
}
