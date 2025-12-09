/**
 * Chronicle Cold Vault — Shared IndexedDB
 *
 * Single database with all object stores.
 * Includes robust connection handling and error recovery.
 */

const DB_NAME = "chronicle-cold-vault";
const DB_VERSION = 2; // Bump version to trigger upgrade

// Store names
export const DOSSIER_STORE = "dossiers";
export const BEEF_STORE = "beef";
export const HEADER_STORE = "headers";
export const META_STORE = "meta";

let dbPromise: Promise<IDBDatabase> | null = null;
let dbInstance: IDBDatabase | null = null;

// Debug logging for database operations
const DB_DEBUG = typeof window !== "undefined" && localStorage.getItem("chronicle-db-debug") === "true";

function dbLog(...args: unknown[]) {
  if (DB_DEBUG) {
    console.log("[Chronicle DB]", new Date().toISOString(), ...args);
  }
}

function dbError(...args: unknown[]) {
  console.error("[Chronicle DB ERROR]", new Date().toISOString(), ...args);
}

export function openDb(): Promise<IDBDatabase> {
  // Check if existing connection is still valid
  if (dbInstance) {
    try {
      // Test if the connection is still open by checking a property
      // This will throw if the database was closed
      const _ = dbInstance.objectStoreNames;
      if (dbPromise) return dbPromise;
    } catch {
      dbLog("Existing connection invalid, reconnecting...");
      dbInstance = null;
      dbPromise = null;
    }
  }

  if (dbPromise) return dbPromise;

  dbLog("Opening database connection...");

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbError("Failed to open database:", request.error);
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      const db = request.result;
      dbInstance = db;
      dbLog("Database opened successfully, version:", db.version);

      // Handle version change (another tab opened with different version)
      db.onversionchange = () => {
        dbLog("Version change detected, closing connection");
        db.close();
        dbInstance = null;
        dbPromise = null;
        // Alert user if possible
        if (typeof window !== "undefined") {
          console.warn("[Chronicle] Database version changed in another tab. Please refresh.");
        }
      };

      // Handle unexpected close
      db.onclose = () => {
        dbLog("Database connection closed unexpectedly");
        dbInstance = null;
        dbPromise = null;
      };

      // Handle errors on the connection
      db.onerror = (event) => {
        dbError("Database error:", event);
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      dbLog("Database upgrade needed, old version:", event.oldVersion, "new version:", event.newVersion);
      const db = (event.target as IDBOpenDBRequest).result;

      // Dossiers store, keyed by outpoint
      if (!db.objectStoreNames.contains(DOSSIER_STORE)) {
        dbLog("Creating dossiers store");
        const store = db.createObjectStore(DOSSIER_STORE, { keyPath: "outpoint" });
        store.createIndex("bucket", "bucket", { unique: false });
        store.createIndex("funding_txid", "funding_txid", { unique: false });
      }

      // BEEF store, keyed by txid
      if (!db.objectStoreNames.contains(BEEF_STORE)) {
        dbLog("Creating beef store");
        const store = db.createObjectStore(BEEF_STORE, { keyPath: "txid" });
        store.createIndex("beef_hash", "beef_hash", { unique: false });
        store.createIndex("height", "height", { unique: false });
      }

      // Headers store, keyed by height
      if (!db.objectStoreNames.contains(HEADER_STORE)) {
        dbLog("Creating headers store");
        const store = db.createObjectStore(HEADER_STORE, { keyPath: "height" });
        store.createIndex("hash", "hash", { unique: true });
      }

      // Meta store for tip tracking
      if (!db.objectStoreNames.contains(META_STORE)) {
        dbLog("Creating meta store");
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };

    request.onblocked = () => {
      dbError("Database open blocked - close other tabs using this database");
      dbPromise = null;
    };
  });

  return dbPromise;
}

/**
 * Reset the cached DB promise (useful after clearing data).
 */
export function resetDbCache(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
  }
  dbInstance = null;
  dbPromise = null;
  dbLog("Database cache reset");
}
