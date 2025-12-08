/**
 * Chronicle Cold Vault — Header Store
 *
 * IndexedDB-backed store for block headers with tip management and reorg handling.
 */

import type { StoredHeader } from "../dossier/types";
import { openDb, HEADER_STORE, META_STORE } from "../db";

// Keep last N headers for reorg handling
const REORG_DEPTH = 6;

// ============================================================================
// Header CRUD
// ============================================================================

/**
 * Get a header by height.
 */
export async function getHeaderByHeight(height: number): Promise<StoredHeader | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HEADER_STORE, "readonly");
    const store = tx.objectStore(HEADER_STORE);
    const request = store.get(height);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a header by hash.
 */
export async function getHeaderByHash(hash: string): Promise<StoredHeader | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HEADER_STORE, "readonly");
    const store = tx.objectStore(HEADER_STORE);
    const index = store.index("hash");
    const request = index.get(hash);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get header by height or hash (for BEEF verification).
 */
export async function headerLookup(ref: number | string): Promise<StoredHeader | null> {
  if (typeof ref === "number") {
    return getHeaderByHeight(ref);
  }
  return getHeaderByHash(ref);
}

/**
 * Get all headers.
 */
export async function getAllHeaders(): Promise<StoredHeader[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HEADER_STORE, "readonly");
    const store = tx.objectStore(HEADER_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a header.
 */
export async function saveHeader(header: StoredHeader): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HEADER_STORE, "readwrite");
    const store = tx.objectStore(HEADER_STORE);
    const request = store.put(header);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save multiple headers.
 */
export async function saveHeaders(headers: StoredHeader[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HEADER_STORE, "readwrite");
    const store = tx.objectStore(HEADER_STORE);
    for (const header of headers) {
      store.put(header);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================================
// Tip Management
// ============================================================================

/**
 * Get the current tip height.
 */
export async function getTipHeight(): Promise<number | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const store = tx.objectStore(META_STORE);
    const request = store.get("tip");
    request.onsuccess = () => {
      const result = request.result as { key: string; height: number } | undefined;
      resolve(result?.height ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Set the current tip height.
 */
export async function setTipHeight(height: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readwrite");
    const store = tx.objectStore(META_STORE);
    const request = store.put({ key: "tip", height });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get the current tip header.
 */
export async function getTipHeader(): Promise<StoredHeader | null> {
  const tipHeight = await getTipHeight();
  if (tipHeight === null) return null;
  return getHeaderByHeight(tipHeight);
}

// ============================================================================
// Reorg Handling
// ============================================================================

/**
 * Append headers, handling potential reorgs up to REORG_DEPTH.
 * Returns the new tip height.
 */
export async function appendHeaders(newHeaders: StoredHeader[]): Promise<{
  ok: boolean;
  newTip: number | null;
  reorgDepth: number;
  message?: string;
}> {
  if (newHeaders.length === 0) {
    const tip = await getTipHeight();
    return { ok: true, newTip: tip, reorgDepth: 0 };
  }

  // Sort by height
  const sorted = [...newHeaders].sort((a, b) => a.height - b.height);
  const currentTip = await getTipHeight();

  // If no existing headers, just save all
  if (currentTip === null) {
    await saveHeaders(sorted);
    const newTip = sorted[sorted.length - 1].height;
    await setTipHeight(newTip);
    return { ok: true, newTip, reorgDepth: 0 };
  }

  // Check for reorg: does the first new header connect to our chain?
  const firstNew = sorted[0];
  const expectedPrevHeight = firstNew.height - 1;

  if (expectedPrevHeight >= 0) {
    const prevHeader = await getHeaderByHeight(expectedPrevHeight);
    if (prevHeader && prevHeader.hash !== firstNew.prev_hash) {
      // Reorg detected
      const reorgDepth = currentTip - expectedPrevHeight + 1;

      if (reorgDepth > REORG_DEPTH) {
        return {
          ok: false,
          newTip: currentTip,
          reorgDepth,
          message: `Reorg depth ${reorgDepth} exceeds max ${REORG_DEPTH}`,
        };
      }

      // Delete headers from reorg point onwards
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(HEADER_STORE, "readwrite");
        const store = tx.objectStore(HEADER_STORE);
        const range = IDBKeyRange.lowerBound(expectedPrevHeight + 1);
        const request = store.delete(range);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Save new headers
      await saveHeaders(sorted);
      const newTip = sorted[sorted.length - 1].height;
      await setTipHeight(newTip);
      return { ok: true, newTip, reorgDepth };
    }
  }

  // No reorg, just append
  await saveHeaders(sorted);
  const newTip = sorted[sorted.length - 1].height;
  if (newTip > currentTip) {
    await setTipHeight(newTip);
  }
  return { ok: true, newTip, reorgDepth: 0 };
}

// ============================================================================
// Import / Export
// ============================================================================

export type HeaderStoreSnapshot = {
  version: 1;
  tipHeight: number | null;
  headers: StoredHeader[];
};

/**
 * Export all headers as a snapshot.
 */
export async function exportHeaderStore(): Promise<HeaderStoreSnapshot> {
  const headers = await getAllHeaders();
  const tipHeight = await getTipHeight();
  return {
    version: 1,
    tipHeight,
    headers,
  };
}

/**
 * Import headers from a snapshot.
 */
export async function importHeaderStore(snapshot: HeaderStoreSnapshot): Promise<{
  ok: boolean;
  imported: number;
  message?: string;
}> {
  if (snapshot.version !== 1) {
    return { ok: false, imported: 0, message: "Unsupported snapshot version" };
  }

  await clearAllHeaders();
  await saveHeaders(snapshot.headers);

  if (snapshot.tipHeight !== null) {
    await setTipHeight(snapshot.tipHeight);
  }

  return { ok: true, imported: snapshot.headers.length };
}

/**
 * Clear all headers (for testing or reset).
 */
export async function clearAllHeaders(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([HEADER_STORE, META_STORE], "readwrite");
    tx.objectStore(HEADER_STORE).clear();
    tx.objectStore(META_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get header count.
 */
export async function getHeaderCount(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HEADER_STORE, "readonly");
    const store = tx.objectStore(HEADER_STORE);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// Legacy compatibility (for existing code that uses these)
// ============================================================================

export type HeaderRecord = {
  height: number;
  headerHex: string;
};

export const DEFAULT_HEADER_STORE: HeaderStoreSnapshot = {
  version: 1,
  tipHeight: null,
  headers: [],
};

export function serializeHeaderStore(snapshot: HeaderStoreSnapshot): string {
  return JSON.stringify(snapshot);
}

export function deserializeHeaderStore(raw: string | null | undefined): HeaderStoreSnapshot {
  if (!raw) return DEFAULT_HEADER_STORE;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as { version?: unknown }).version === 1
    ) {
      return parsed as HeaderStoreSnapshot;
    }
    return DEFAULT_HEADER_STORE;
  } catch {
    return DEFAULT_HEADER_STORE;
  }
}
