/**
 * Chronicle Cold Vault — Shared IndexedDB
 *
 * Single database with all object stores.
 */

const DB_NAME = "chronicle-cold-vault";
const DB_VERSION = 2; // Bump version to trigger upgrade

// Store names
export const DOSSIER_STORE = "dossiers";
export const BEEF_STORE = "beef";
export const HEADER_STORE = "headers";
export const META_STORE = "meta";

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Dossiers store, keyed by outpoint
      if (!db.objectStoreNames.contains(DOSSIER_STORE)) {
        const store = db.createObjectStore(DOSSIER_STORE, { keyPath: "outpoint" });
        store.createIndex("bucket", "bucket", { unique: false });
        store.createIndex("funding_txid", "funding_txid", { unique: false });
      }

      // BEEF store, keyed by txid
      if (!db.objectStoreNames.contains(BEEF_STORE)) {
        const store = db.createObjectStore(BEEF_STORE, { keyPath: "txid" });
        store.createIndex("beef_hash", "beef_hash", { unique: false });
        store.createIndex("height", "height", { unique: false });
      }

      // Headers store, keyed by height
      if (!db.objectStoreNames.contains(HEADER_STORE)) {
        const store = db.createObjectStore(HEADER_STORE, { keyPath: "height" });
        store.createIndex("hash", "hash", { unique: true });
      }

      // Meta store for tip tracking
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
  });

  return dbPromise;
}

/**
 * Reset the cached DB promise (useful after clearing data).
 */
export function resetDbCache(): void {
  dbPromise = null;
}
