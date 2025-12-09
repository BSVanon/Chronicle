/**
 * Chronicle Cold Vault — Dossier Store
 *
 * IndexedDB-backed store for UTXO dossiers.
 */

import type { UtxoDossier, BucketSummary } from "./types";
import { openDb, DOSSIER_STORE } from "../db";

// Debug logging
const STORE_DEBUG = typeof window !== "undefined" && localStorage.getItem("chronicle-db-debug") === "true";

function storeLog(...args: unknown[]) {
  if (STORE_DEBUG) {
    console.log("[Chronicle Dossier Store]", new Date().toISOString(), ...args);
  }
}

/**
 * Get all dossiers.
 */
export async function getAllDossiers(): Promise<UtxoDossier[]> {
  storeLog("getAllDossiers: starting");
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOSSIER_STORE, "readonly");
    const store = tx.objectStore(DOSSIER_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      storeLog("getAllDossiers: found", request.result.length, "dossiers");
      resolve(request.result);
    };
    request.onerror = () => {
      console.error("[Chronicle Dossier Store] getAllDossiers error:", request.error);
      reject(request.error);
    };
    tx.onerror = () => {
      console.error("[Chronicle Dossier Store] getAllDossiers transaction error:", tx.error);
    };
  });
}

/**
 * Get dossiers by bucket.
 */
export async function getDossiersByBucket(bucket: string): Promise<UtxoDossier[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOSSIER_STORE, "readonly");
    const store = tx.objectStore(DOSSIER_STORE);
    const index = store.index("bucket");
    const request = index.getAll(bucket);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a single dossier by outpoint.
 */
export async function getDossier(outpoint: string): Promise<UtxoDossier | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOSSIER_STORE, "readonly");
    const store = tx.objectStore(DOSSIER_STORE);
    const request = store.get(outpoint);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a dossier (insert or update).
 */
export async function saveDossier(dossier: UtxoDossier): Promise<void> {
  storeLog("saveDossier: saving", dossier.outpoint);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOSSIER_STORE, "readwrite");
    const store = tx.objectStore(DOSSIER_STORE);
    const request = store.put(dossier);
    request.onsuccess = () => {
      storeLog("saveDossier: saved", dossier.outpoint);
      resolve();
    };
    request.onerror = () => {
      console.error("[Chronicle Dossier Store] saveDossier error:", request.error, "outpoint:", dossier.outpoint);
      reject(request.error);
    };
    tx.onerror = () => {
      console.error("[Chronicle Dossier Store] saveDossier transaction error:", tx.error);
    };
    tx.oncomplete = () => {
      storeLog("saveDossier: transaction complete for", dossier.outpoint);
    };
  });
}

/**
 * Delete a dossier by outpoint.
 */
export async function deleteDossier(outpoint: string): Promise<void> {
  storeLog("deleteDossier: deleting", outpoint);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOSSIER_STORE, "readwrite");
    const store = tx.objectStore(DOSSIER_STORE);
    const request = store.delete(outpoint);
    request.onsuccess = () => {
      storeLog("deleteDossier: deleted", outpoint);
      resolve();
    };
    request.onerror = () => {
      console.error("[Chronicle Dossier Store] deleteDossier error:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Get dossiers by funding txid.
 */
export async function getDossiersByFundingTxid(txid: string): Promise<UtxoDossier[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOSSIER_STORE, "readonly");
    const store = tx.objectStore(DOSSIER_STORE);
    const index = store.index("funding_txid");
    const request = index.getAll(txid);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Compute bucket summaries from all dossiers.
 */
export async function computeBucketSummaries(): Promise<BucketSummary[]> {
  const dossiers = await getAllDossiers();

  const bucketMap = new Map<string, {
    total_satoshis: number;
    dossier_count: number;
    with_beef: number;
    verified_count: number;
    pending_count: number;
  }>();

  for (const d of dossiers) {
    let entry = bucketMap.get(d.bucket);
    if (!entry) {
      entry = {
        total_satoshis: 0,
        dossier_count: 0,
        with_beef: 0,
        verified_count: 0,
        pending_count: 0,
      };
      bucketMap.set(d.bucket, entry);
    }

    entry.total_satoshis += d.value_satoshis;
    entry.dossier_count += 1;

    if (d.beef_hash) {
      entry.with_beef += 1;
    }

    if (d.verified) {
      if (d.verified.ok) {
        entry.verified_count += 1;
      } else {
        entry.pending_count += 1;
      }
    } else {
      entry.pending_count += 1;
    }
  }

  const summaries: BucketSummary[] = [];
  for (const [bucket, entry] of bucketMap.entries()) {
    summaries.push({
      bucket,
      total_satoshis: entry.total_satoshis,
      dossier_count: entry.dossier_count,
      beef_coverage_percent:
        entry.dossier_count === 0
          ? 100
          : Math.round((entry.with_beef / entry.dossier_count) * 100),
      verified_count: entry.verified_count,
      pending_count: entry.pending_count,
    });
  }

  return summaries;
}

/**
 * Clear all dossiers (for testing or reset).
 */
export async function clearAllDossiers(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOSSIER_STORE, "readwrite");
    const store = tx.objectStore(DOSSIER_STORE);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
