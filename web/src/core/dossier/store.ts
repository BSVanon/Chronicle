/**
 * Chronicle Cold Vault — Dossier Store
 *
 * IndexedDB-backed store for UTXO dossiers.
 * Includes localStorage backup for redundancy against browser storage eviction.
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

// localStorage backup keys
const BACKUP_KEY = "chronicle-dossiers-backup";
const BACKUP_META_KEY = "chronicle-dossiers-backup-meta";
const EXPORT_REMINDER_KEY = "chronicle-export-reminder";

/**
 * Backup dossiers to localStorage as redundancy against IndexedDB eviction.
 * This is a lightweight backup - full exports are still recommended.
 */
async function backupToLocalStorage(dossiers: UtxoDossier[]): Promise<void> {
  if (typeof window === "undefined") return;
  
  try {
    // Store compressed backup (just essential fields)
    const backup = dossiers.map(d => ({
      o: d.outpoint,
      v: d.value_satoshis,
      b: d.bucket,
      l: d.labels,
      t: d.funding_txid,
      h: d.beef_hash,
      c: d.created_at,
    }));
    
    const backupJson = JSON.stringify(backup);
    localStorage.setItem(BACKUP_KEY, backupJson);
    localStorage.setItem(BACKUP_META_KEY, JSON.stringify({
      count: dossiers.length,
      timestamp: new Date().toISOString(),
      size: backupJson.length,
    }));
    storeLog("Backup to localStorage:", dossiers.length, "dossiers,", backupJson.length, "bytes");
  } catch (e) {
    // localStorage might be full - don't fail the main operation
    console.warn("[Chronicle] localStorage backup failed:", e);
  }
}

/**
 * Get backup metadata from localStorage.
 */
export function getBackupMeta(): { count: number; timestamp: string; size: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const meta = localStorage.getItem(BACKUP_META_KEY);
    return meta ? JSON.parse(meta) : null;
  } catch {
    return null;
  }
}

/**
 * Restore dossiers from localStorage backup.
 * Returns the restored dossiers or null if no backup exists.
 */
export function restoreFromLocalStorage(): UtxoDossier[] | null {
  if (typeof window === "undefined") return null;
  
  try {
    const backup = localStorage.getItem(BACKUP_KEY);
    if (!backup) return null;
    
    const parsed = JSON.parse(backup) as Array<{
      o: string;
      v: number;
      b: string;
      l: string[];
      t: string;
      h: string | null;
      c: string;
    }>;
    
    // Reconstruct full dossier objects
    return parsed.map(d => ({
      outpoint: d.o,
      value_satoshis: d.v,
      locking_script_hex: null, // Not stored in backup
      funding_txid: d.t,
      funding_tx_raw: null,
      bucket: d.b,
      labels: d.l || [],
      derivation_hint: null,
      beef_hash: d.h,
      verified: null,
      created_at: d.c,
    }));
  } catch (e) {
    console.error("[Chronicle] Failed to restore from localStorage:", e);
    return null;
  }
}

/**
 * Check and update export reminder state.
 * Returns true if user should be reminded to export.
 */
export function checkExportReminder(currentCount: number): { shouldRemind: boolean; lastExportCount: number; addedSince: number } {
  if (typeof window === "undefined") return { shouldRemind: false, lastExportCount: 0, addedSince: 0 };
  
  try {
    const reminder = localStorage.getItem(EXPORT_REMINDER_KEY);
    const state = reminder ? JSON.parse(reminder) : { lastExportCount: 0, lastExportTime: null };
    const addedSince = currentCount - state.lastExportCount;
    
    // Remind after 10 new UTXOs
    const shouldRemind = addedSince >= 10;
    
    return { shouldRemind, lastExportCount: state.lastExportCount, addedSince };
  } catch {
    return { shouldRemind: false, lastExportCount: 0, addedSince: 0 };
  }
}

/**
 * Mark that an export was performed.
 */
export function markExportPerformed(count: number): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(EXPORT_REMINDER_KEY, JSON.stringify({
      lastExportCount: count,
      lastExportTime: new Date().toISOString(),
    }));
  } catch {
    // ignore
  }
}

/**
 * Get storage quota information.
 */
export async function getStorageQuota(): Promise<{ used: number; quota: number; percent: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  
  try {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    const percent = quota > 0 ? (used / quota) * 100 : 0;
    return { used, quota, percent };
  } catch {
    return null;
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
 * Also triggers a localStorage backup for redundancy.
 */
export async function saveDossier(dossier: UtxoDossier): Promise<void> {
  storeLog("saveDossier: saving", dossier.outpoint);
  const db = await openDb();
  
  // First, save the dossier
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DOSSIER_STORE, "readwrite");
    const store = tx.objectStore(DOSSIER_STORE);
    const request = store.put(dossier);
    request.onsuccess = () => {
      storeLog("saveDossier: saved", dossier.outpoint);
    };
    request.onerror = () => {
      console.error("[Chronicle Dossier Store] saveDossier error:", request.error, "outpoint:", dossier.outpoint);
      reject(request.error);
    };
    tx.oncomplete = () => {
      storeLog("saveDossier: transaction complete for", dossier.outpoint);
      resolve();
    };
    tx.onerror = () => {
      console.error("[Chronicle Dossier Store] saveDossier transaction error:", tx.error);
      reject(tx.error);
    };
  });
  
  // Then, trigger backup in a separate operation (non-blocking)
  // Use setTimeout to ensure we're fully out of the transaction context
  setTimeout(async () => {
    try {
      const allDossiers = await getAllDossiers();
      await backupToLocalStorage(allDossiers);
    } catch (e) {
      console.warn("[Chronicle] Post-save backup failed:", e);
    }
  }, 0);
}

/**
 * Save multiple dossiers in batch (for imports).
 * Only triggers backup once at the end.
 */
export async function saveDossiersBatch(dossiers: UtxoDossier[]): Promise<void> {
  if (dossiers.length === 0) return;
  
  storeLog("saveDossiersBatch: saving", dossiers.length, "dossiers");
  const db = await openDb();
  
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DOSSIER_STORE, "readwrite");
    const store = tx.objectStore(DOSSIER_STORE);
    
    let completed = 0;
    let hasError = false;
    
    for (const dossier of dossiers) {
      const request = store.put(dossier);
      request.onsuccess = () => {
        completed++;
      };
      request.onerror = () => {
        if (!hasError) {
          hasError = true;
          console.error("[Chronicle Dossier Store] saveDossiersBatch error:", request.error);
        }
      };
    }
    
    tx.oncomplete = () => {
      storeLog("saveDossiersBatch: saved", completed, "of", dossiers.length, "dossiers");
      resolve();
    };
    tx.onerror = () => {
      console.error("[Chronicle Dossier Store] saveDossiersBatch transaction error:", tx.error);
      reject(tx.error);
    };
  });
  
  // Trigger backup once at the end
  setTimeout(async () => {
    try {
      const allDossiers = await getAllDossiers();
      await backupToLocalStorage(allDossiers);
    } catch (e) {
      console.warn("[Chronicle] Post-batch backup failed:", e);
    }
  }, 0);
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
