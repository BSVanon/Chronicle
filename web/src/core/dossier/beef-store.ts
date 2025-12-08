/**
 * Chronicle Cold Vault — BEEF Store
 *
 * IndexedDB-backed store for BEEF proof bundles.
 */

import type { ProofArchive, BeefIndex } from "./types";
import { openDb, BEEF_STORE } from "../db";
import { sha256 } from "@noble/hashes/sha256";

/**
 * Get all BEEF archives.
 */
export async function getAllBeef(): Promise<ProofArchive[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BEEF_STORE, "readonly");
    const store = tx.objectStore(BEEF_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a single BEEF archive by txid.
 */
export async function getBeef(txid: string): Promise<ProofArchive | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BEEF_STORE, "readonly");
    const store = tx.objectStore(BEEF_STORE);
    const request = store.get(txid);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a BEEF archive (insert or update).
 * If a BEEF with the same txid exists, verify hash matches before overwriting.
 * Set force=true to overwrite even if hash differs (for re-fetching corrupted BEEF).
 */
export async function saveBeef(
  archive: ProofArchive,
  options?: { force?: boolean }
): Promise<{ ok: boolean; message?: string }> {
  const existing = await getBeef(archive.txid);

  if (existing && existing.beef_hash !== archive.beef_hash && !options?.force) {
    return {
      ok: false,
      message: `BEEF hash mismatch for txid ${archive.txid}: existing ${existing.beef_hash} vs new ${archive.beef_hash}. Use force option to overwrite.`,
    };
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BEEF_STORE, "readwrite");
    const store = tx.objectStore(BEEF_STORE);
    const request = store.put(archive);
    request.onsuccess = () => resolve({ ok: true, message: existing ? "Replaced existing BEEF" : undefined });
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a BEEF archive by txid.
 */
export async function deleteBeef(txid: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BEEF_STORE, "readwrite");
    const store = tx.objectStore(BEEF_STORE);
    const request = store.delete(txid);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Build the BEEF index (txid → beef_hash).
 */
export async function buildBeefIndex(): Promise<BeefIndex> {
  const all = await getAllBeef();
  const index: BeefIndex = {};
  for (const archive of all) {
    index[archive.txid] = archive.beef_hash;
  }
  return index;
}

/**
 * Verify integrity of all BEEF blobs by re-hashing.
 * Returns list of txids with mismatched hashes.
 */
export async function verifyBeefIntegrity(): Promise<{
  total: number;
  valid: number;
  invalid: string[];
}> {
  const all = await getAllBeef();
  const invalid: string[] = [];

  for (const archive of all) {
    const computed = await computeBeefHash(archive.beef);
    if (computed !== archive.beef_hash) {
      invalid.push(archive.txid);
    }
  }

  return {
    total: all.length,
    valid: all.length - invalid.length,
    invalid,
  };
}

/**
 * Compute SHA256 hash of a BEEF blob (base64 input, hex output).
 */
export async function computeBeefHash(beefBase64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(beefBase64), (c) => c.charCodeAt(0));

  // Prefer WebCrypto when available in a secure context.
  if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback for non-secure contexts (e.g. HTTP) or older browsers.
  const hash = sha256(bytes);
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Clear all BEEF archives (for testing or reset).
 */
export async function clearAllBeef(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BEEF_STORE, "readwrite");
    const store = tx.objectStore(BEEF_STORE);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
