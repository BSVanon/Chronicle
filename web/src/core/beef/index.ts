// Core BEEF types and stub parser for Chronicle Step 1.
// This module is intentionally minimal and local-only; real parsing and
// verification will be added in a later milestone.

import type { Scripthash, Utxo } from "../providers/types";
import { decodeTxOutputs } from "../tx/decode";
import { scripthashFromScriptHex } from "../wallet/watch-only-derivation";

export type BeefBundleId = string;

export type BeefBundleOrigin = "imported" | "synthetic_snapshot";

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
  origin?: BeefBundleOrigin;
};

export type BeefParseResult = {
  meta: BeefBundleMeta;
  utxos: BeefUtxoRecord[];
};
type RealBeefTransaction = {
  txid: string;
  rawTxHex: string;
  height?: number;
};

type RealBeefBundleShape = {
  version?: string;
  subject?: RealBeefTransaction;
  ancestors?: RealBeefTransaction[];
  metadata?: Record<string, unknown>;
};

function isHexString(value: unknown, length?: number): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!/^[0-9a-fA-F]+$/.test(v)) return false;
  if (length !== undefined && v.length !== length) return false;
  return true;
}

function normalizeTxid(txid: string): string {
  return txid.trim().toLowerCase();
}

function extractRealBeefTransaction(value: unknown): RealBeefTransaction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const anyValue = value as { [key: string]: unknown };
  const txidValue = anyValue.txid;
  const rawTxValue = anyValue.rawTxHex;
  if (!isHexString(txidValue, 64)) return null;
  if (!isHexString(rawTxValue)) return null;
  const heightValue = anyValue.height;
  const height = typeof heightValue === "number" ? heightValue : undefined;
  return {
    txid: normalizeTxid(txidValue as string),
    rawTxHex: (rawTxValue as string).trim(),
    height,
  };
}

function utxosFromRealBundle(
  subject: RealBeefTransaction | null,
  ancestors: RealBeefTransaction[],
): BeefUtxoRecord[] {
  const records: BeefUtxoRecord[] = [];

  const addFromTx = (tx: RealBeefTransaction) => {
    const outputs = decodeTxOutputs(tx.rawTxHex);
    for (const output of outputs) {
      records.push({
        txid: tx.txid,
        vout: output.vout,
        scriptPubKey: output.scriptHex,
        satoshis: output.satoshis,
        height: tx.height,
      });
    }
  };

  if (subject) addFromTx(subject);
  for (const ancestor of ancestors) {
    addFromTx(ancestor);
  }

  return records;
}

export function parseBeefBundle(raw: unknown): BeefParseResult {
  const now = Date.now();

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
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
          origin:
            meta.origin === "imported" || meta.origin === "synthetic_snapshot"
              ? meta.origin
              : undefined,
        },
        utxos,
      };
    }
  }

  let candidate: unknown = raw;

  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw) as RealBeefBundleShape;
    } catch {
      candidate = null;
    }
  }

  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    const bundle = candidate as RealBeefBundleShape;
    const subject = extractRealBeefTransaction(bundle.subject);
    const ancestorValues = Array.isArray(bundle.ancestors)
      ? bundle.ancestors
      : [];
    const ancestors: RealBeefTransaction[] = ancestorValues
      .map((a) => extractRealBeefTransaction(a))
      .filter((a): a is RealBeefTransaction => a !== null);

    const hasAnyTx = Boolean(subject) || ancestors.length > 0;

    if (hasAnyTx) {
      const utxos = utxosFromRealBundle(subject, ancestors);
      const metadata =
        bundle.metadata && typeof bundle.metadata === "object"
          ? (bundle.metadata as { [key: string]: unknown })
          : undefined;
      const metaId =
        metadata && typeof metadata.id === "string" && metadata.id.trim().length > 0
          ? metadata.id.trim()
          : subject
            ? subject.txid
            : "beef-bundle";
      const metaLabel =
        metadata && typeof metadata.label === "string" && metadata.label.trim().length > 0
          ? metadata.label.trim()
          : undefined;

      return {
        meta: {
          id: metaId,
          label: metaLabel,
          importedAt: now,
          utxoCount: utxos.length,
          scripthashCount: 0,
          origin: "imported",
        },
        utxos,
      };
    }
  }

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

export function buildSyntheticBeefFromUtxos(
  utxos: Utxo[],
  options?: { id?: string; label?: string; importedAt?: number },
): BeefParseResult {
  const importedAt = options?.importedAt ?? Date.now();
  const id = options?.id ?? `snapshot-${importedAt}`;
  const label = options?.label;

  const beefUtxos: BeefUtxoRecord[] = utxos.map((u) => ({
    txid: u.txid,
    vout: u.vout,
    scriptPubKey: u.scriptHex,
    satoshis: u.satoshis,
    height: u.height,
  }));

  const base: BeefParseResult = {
    meta: {
      id,
      label,
      importedAt,
      utxoCount: beefUtxos.length,
      scripthashCount: 0,
      origin: "synthetic_snapshot",
    },
    utxos: beefUtxos,
  };

  const hashes = scripthashesFromBeefResult(base);
  base.meta.scripthashCount = hashes.length;

  return base;
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
