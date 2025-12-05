// Core BEEF types and stub parser for Chronicle Step 1.
// This module is intentionally minimal and local-only; real parsing and
// verification will be added in a later milestone.

import type { Scripthash } from "../providers/types";
import { scripthashFromScriptHex } from "../wallet/watch-only-derivation";

export type BeefBundleId = string;

export type BeefUtxoRecord = {
  txid: string;
  vout: number;
  scriptPubKey: string;
  satoshis: number;
  height?: number;
};

export type BeefBundleMeta = {
  id: BeefBundleId;
  label?: string;
  importedAt: number;
  utxoCount: number;
  scripthashCount: number;
};

export type BeefParseResult = {
  meta: BeefBundleMeta;
  utxos: BeefUtxoRecord[];
};

export function parseBeefBundle(raw: unknown): BeefParseResult {
  const now = Date.now();

  if (raw && typeof raw === "object") {
    const maybe = raw as Partial<BeefParseResult> & {
      meta?: Partial<BeefBundleMeta>;
    };

    if (maybe.meta && Array.isArray(maybe.utxos)) {
      const utxos = (maybe.utxos as BeefUtxoRecord[]) ?? [];
      const meta = maybe.meta;

      return {
        meta: {
          id: typeof meta.id === "string" ? meta.id : "unknown-bundle",
          label: typeof meta.label === "string" ? meta.label : undefined,
          importedAt:
            typeof meta.importedAt === "number" ? meta.importedAt : now,
          utxoCount:
            typeof meta.utxoCount === "number" ? meta.utxoCount : utxos.length,
          scripthashCount:
            typeof meta.scripthashCount === "number"
              ? meta.scripthashCount
              : 0,
        },
        utxos,
      };
    }
  }

  // Step 1 stub: we do not attempt to parse real BEEF yet. This function
  // returns an empty bundle with placeholder metadata so the rest of the code
  // can rely on the shape without performing any real work.
  return {
    meta: {
      id: "stub-bundle",
      importedAt: now,
      utxoCount: 0,
      scripthashCount: 0,
    },
    utxos: [],
  };
}

export function scripthashesFromBeefResult(result: BeefParseResult): Scripthash[] {
  const hashes: Scripthash[] = [];
  for (const utxo of result.utxos) {
    if (!utxo.scriptPubKey) continue;
    try {
      const hash = scripthashFromScriptHex(utxo.scriptPubKey);
      hashes.push(hash);
    } catch {
      // Ignore scripts we cannot parse for now; a later milestone will
      // surface diagnostics for problematic BEEF entries.
    }
  }
  return hashes;
}
