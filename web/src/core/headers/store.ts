// Minimal local header store for Chronicle Step 1.
// This is intentionally simple: we only track a map of height -> headerHex
// plus a bestHeight marker. Real chain verification will be added later.

export type HeaderRecord = {
  height: number;
  headerHex: string;
};

export type HeaderStoreSnapshot = {
  version: 1;
  bestHeight: number | null;
  headers: HeaderRecord[];
};

export const DEFAULT_HEADER_STORE: HeaderStoreSnapshot = {
  version: 1,
  bestHeight: null,
  headers: [],
};

export function normalizeHeaderStore(raw: unknown): HeaderStoreSnapshot {
  const snapshot = raw as Partial<HeaderStoreSnapshot>;
  if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.headers)) {
    return DEFAULT_HEADER_STORE;
  }

  const headers: HeaderRecord[] = [];
  let bestHeight: number | null = null;

  for (const h of snapshot.headers) {
    if (!h) continue;
    const height = typeof h.height === "number" ? Math.floor(h.height) : NaN;
    const headerHex = typeof h.headerHex === "string" ? h.headerHex.trim() : "";
    if (!Number.isFinite(height) || height < 0) continue;
    if (!headerHex || headerHex.length === 0) continue;
    headers.push({ height, headerHex });
    if (bestHeight === null || height > bestHeight) {
      bestHeight = height;
    }
  }

  if (typeof snapshot.bestHeight === "number") {
    const candidate = Math.floor(snapshot.bestHeight);
    if (candidate >= 0) {
      bestHeight = candidate;
    }
  }

  return {
    version: 1,
    bestHeight,
    headers,
  };
}

export function serializeHeaderStore(snapshot: HeaderStoreSnapshot): string {
  return JSON.stringify(snapshot);
}

export function deserializeHeaderStore(raw: string | null | undefined): HeaderStoreSnapshot {
  if (!raw) return DEFAULT_HEADER_STORE;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeHeaderStore(parsed);
  } catch {
    return DEFAULT_HEADER_STORE;
  }
}
