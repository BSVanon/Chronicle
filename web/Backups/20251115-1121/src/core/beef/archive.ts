import type { BeefParseResult } from "./index";

export type BeefArchiveEntry = {
  id: string;
  label?: string;
  importedAt: number;
  utxoCount: number;
  scripthashCount: number;
};

export type BeefArchiveSnapshot = {
  version: 1;
  entries: BeefArchiveEntry[];
};

export const DEFAULT_BEEF_ARCHIVE: BeefArchiveEntry[] = [];

export function entryFromBeefResult(
  result: BeefParseResult,
  derivedScripthashCount: number,
): BeefArchiveEntry {
  return {
    id: result.meta.id,
    label: result.meta.label,
    importedAt: result.meta.importedAt,
    utxoCount: result.meta.utxoCount,
    scripthashCount: derivedScripthashCount,
  };
}

export function serializeBeefArchive(entries: BeefArchiveEntry[]): string {
  const snapshot: BeefArchiveSnapshot = { version: 1, entries };
  return JSON.stringify(snapshot);
}

export function deserializeBeefArchive(
  raw: string | null | undefined,
): BeefArchiveEntry[] {
  if (!raw) return DEFAULT_BEEF_ARCHIVE;
  try {
    const parsed = JSON.parse(raw) as Partial<BeefArchiveSnapshot>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return DEFAULT_BEEF_ARCHIVE;
    }
    return parsed.entries
      .map((e) => normalizeBeefArchiveEntry(e))
      .filter((e): e is BeefArchiveEntry => e !== null);
  } catch {
    return DEFAULT_BEEF_ARCHIVE;
  }
}

function normalizeBeefArchiveEntry(raw: unknown): BeefArchiveEntry | null {
  const e = raw as Partial<BeefArchiveEntry>;
  if (!e || typeof e.id !== "string") return null;

  const importedAt =
    typeof e.importedAt === "number" ? e.importedAt : Date.now();
  const utxoCount =
    typeof e.utxoCount === "number" && e.utxoCount >= 0
      ? Math.floor(e.utxoCount)
      : 0;
  const scripthashCount =
    typeof e.scripthashCount === "number" && e.scripthashCount >= 0
      ? Math.floor(e.scripthashCount)
      : 0;

  const label =
    typeof e.label === "string" && e.label.trim().length > 0
      ? e.label.trim()
      : undefined;

  return {
    id: e.id,
    label,
    importedAt,
    utxoCount,
    scripthashCount,
  };
}
