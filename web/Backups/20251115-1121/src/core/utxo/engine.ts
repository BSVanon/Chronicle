import type { Scripthash, Utxo } from "@/core/providers/types";
import type { UtxoDeltaEvent } from "@/core/sentinel/types";

type UtxoKey = string; // `${txid}:${vout}`

function makeKey(utxo: Utxo): UtxoKey {
  return `${utxo.txid}:${utxo.vout}`;
}

export type UtxoEngineState = {
  /**
   * Per-scripthash map of UTXO key -> UTXO. This is the authoritative local
   * UTXO set Chronicle uses for balances and bucket views.
   */
  byScripthash: Map<Scripthash, Map<UtxoKey, Utxo>>;
};

export type BalanceTotals = {
  /** Sum of UTXOs with a known height > 0. */
  confirmed: number;
  /** Sum of UTXOs without a height or with height === 0. */
  unconfirmed: number;
};

export interface UtxoEngine {
  /** Apply a single UTXO delta event from Sentinel. */
  applyDelta(event: UtxoDeltaEvent): void;

  /** Get the current UTXO set for a specific scripthash. */
  getUtxosForScripthash(scripthash: Scripthash): Utxo[];

  /** Get a flat list of all tracked UTXOs across all scripthashes. */
  getAllUtxos(): Utxo[];

  /** Compute total confirmed/unconfirmed balances from the current UTXO set. */
  getTotals(): BalanceTotals;

  /** Snapshot the internal state (for debugging or serialization). */
  snapshot(): UtxoEngineState;
}

function createEmptyState(): UtxoEngineState {
  return {
    byScripthash: new Map<Scripthash, Map<UtxoKey, Utxo>>(),
  };
}

export function createUtxoEngine(initialEvents: UtxoDeltaEvent[] = []): UtxoEngine {
  const state = createEmptyState();

  function ensureBucket(scripthash: Scripthash): Map<UtxoKey, Utxo> {
    const existing = state.byScripthash.get(scripthash);
    if (existing) return existing;
    const created = new Map<UtxoKey, Utxo>();
    state.byScripthash.set(scripthash, created);
    return created;
  }

  function applyDelta(event: UtxoDeltaEvent): void {
    const bucket = ensureBucket(event.scripthash);

    for (const utxo of event.add) {
      bucket.set(makeKey(utxo), utxo);
    }

    for (const utxo of event.remove) {
      bucket.delete(makeKey(utxo));
    }

    if (bucket.size === 0) {
      state.byScripthash.delete(event.scripthash);
    }
  }

  function getUtxosForScripthash(scripthash: Scripthash): Utxo[] {
    const bucket = state.byScripthash.get(scripthash);
    if (!bucket) return [];
    return Array.from(bucket.values());
  }

  function getAllUtxos(): Utxo[] {
    const result: Utxo[] = [];
    for (const bucket of state.byScripthash.values()) {
      for (const utxo of bucket.values()) {
        result.push(utxo);
      }
    }
    return result;
  }

  function getTotals(): BalanceTotals {
    let confirmed = 0;
    let unconfirmed = 0;

    for (const utxo of getAllUtxos()) {
      const value = utxo.satoshis;
      if (utxo.height && utxo.height > 0) {
        confirmed += value;
      } else {
        unconfirmed += value;
      }
    }

    return { confirmed, unconfirmed };
  }

  function snapshot(): UtxoEngineState {
    return {
      byScripthash: new Map(
        Array.from(state.byScripthash.entries()).map(([hash, bucket]) => [
          hash,
          new Map(bucket),
        ]),
      ),
    };
  }

  // Apply any initial events to seed the engine.
  for (const event of initialEvents) {
    applyDelta(event);
  }

  return {
    applyDelta,
    getUtxosForScripthash,
    getAllUtxos,
    getTotals,
    snapshot,
  };
}
