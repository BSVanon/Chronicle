import type { BeefBundleOrigin, BeefParseResult } from "./index";
import type { BeefVerifyOutcome } from "./verify";
import type { HeaderStoreSnapshot } from "../headers/store";
import { verifyBeefSubjectAgainstHeaders } from "./verify";

export type BeefArchiveEntry = {
  id: string;
  label?: string;
  importedAt: number;
  utxoCount: number;
  scripthashCount: number;
  origin?: BeefBundleOrigin;
  subjectTxid?: string;
  rawBeefJson?: string;
  verifyOutcome?: BeefVerifyOutcome;
  verifyHeaderHeight?: number;
  verifyUpdatedAt?: number;
};

export type BeefArchiveSnapshot = {
  version: 1;
  entries: BeefArchiveEntry[];
};

export const DEFAULT_BEEF_ARCHIVE: BeefArchiveEntry[] = [];

export function entryFromBeefResult(
  result: BeefParseResult,
  derivedScripthashCount: number,
  extras?: { subjectTxid?: string; rawBeefJson?: string },
): BeefArchiveEntry {
  return {
    id: result.meta.id,
    label: result.meta.label,
    importedAt: result.meta.importedAt,
    utxoCount: result.meta.utxoCount,
    scripthashCount: derivedScripthashCount,
    origin: result.meta.origin,
    subjectTxid: extras?.subjectTxid,
    rawBeefJson: extras?.rawBeefJson,
    verifyOutcome: undefined,
    verifyHeaderHeight: undefined,
    verifyUpdatedAt: undefined,
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

  const origin: BeefBundleOrigin | undefined =
    e.origin === "imported" || e.origin === "synthetic_snapshot"
      ? e.origin
      : undefined;

  const subjectTxid =
    typeof e.subjectTxid === "string" && e.subjectTxid.trim().length > 0
      ? e.subjectTxid.trim().toLowerCase()
      : undefined;

  const rawBeefJson =
    typeof e.rawBeefJson === "string" && e.rawBeefJson.trim().length > 0
      ? e.rawBeefJson
      : undefined;

  const verifyOutcome: BeefVerifyOutcome | undefined =
    e.verifyOutcome === "ok" ||
    e.verifyOutcome === "failed" ||
    e.verifyOutcome === "unknown"
      ? e.verifyOutcome
      : undefined;

  const verifyHeaderHeight =
    typeof e.verifyHeaderHeight === "number" && e.verifyHeaderHeight >= 0
      ? Math.floor(e.verifyHeaderHeight)
      : undefined;

  const verifyUpdatedAt =
    typeof e.verifyUpdatedAt === "number" && e.verifyUpdatedAt >= 0
      ? Math.floor(e.verifyUpdatedAt)
      : undefined;

  return {
    id: e.id,
    label,
    importedAt,
    utxoCount,
    scripthashCount,
    origin,
    subjectTxid,
    rawBeefJson,
    verifyOutcome,
    verifyHeaderHeight,
    verifyUpdatedAt,
  };
}

export async function reverifyBeefArchiveEntry(
  entry: BeefArchiveEntry,
  headers: HeaderStoreSnapshot,
): Promise<BeefArchiveEntry> {
  if (!entry.rawBeefJson || entry.rawBeefJson.trim().length === 0) {
    return entry;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(entry.rawBeefJson) as unknown;
  } catch {
    return {
      ...entry,
      verifyOutcome: "unknown",
      verifyUpdatedAt: Date.now(),
    };
  }

  const result = await verifyBeefSubjectAgainstHeaders(parsed, headers);

  return {
    ...entry,
    verifyOutcome: result.outcome,
    verifyHeaderHeight:
      typeof result.headerHeight === "number"
        ? result.headerHeight
        : entry.verifyHeaderHeight,
    verifyUpdatedAt: Date.now(),
  };
}
