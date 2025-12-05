import type { BeefArchiveEntry } from "../beef/archive";
import type { BeefBundleOrigin } from "../beef";
import type { BeefVerifyOutcome } from "../beef/verify";
import type { HeaderStoreSnapshot } from "../headers/store";
import { verifyBeefSubjectAgainstHeaders } from "../beef/verify";

export type ProofArchiveEntry = {
  id: string;
  label?: string;
  origin?: BeefBundleOrigin;
  importedAt: number;
  utxoCount: number;
  scripthashCount: number;
  subjectTxid?: string;
  rawBeefJson?: string;
  verifyOutcome?: BeefVerifyOutcome;
  verifyHeaderHeight?: number;
  verifyUpdatedAt?: number;
};

export type ProofArchiveSnapshotVersion = "chronicle.proof.v1";

export type ProofArchiveSnapshot = {
  version: ProofArchiveSnapshotVersion;
  generatedAt: number;
  entries: ProofArchiveEntry[];
};

export function buildProofArchiveFromBeefArchive(
  entries: BeefArchiveEntry[],
  generatedAt?: number,
): ProofArchiveSnapshot {
  const timestamp =
    typeof generatedAt === "number" && Number.isFinite(generatedAt)
      ? Math.floor(generatedAt)
      : Date.now();

  const normalizedEntries: ProofArchiveEntry[] = entries.map((e) => ({
    id: e.id,
    label: e.label,
    origin: e.origin,
    importedAt: e.importedAt,
    utxoCount: e.utxoCount,
    scripthashCount: e.scripthashCount,
    subjectTxid: e.subjectTxid,
    rawBeefJson: e.rawBeefJson,
    verifyOutcome: e.verifyOutcome,
    verifyHeaderHeight: e.verifyHeaderHeight,
    verifyUpdatedAt: e.verifyUpdatedAt,
  }));

  return {
    version: "chronicle.proof.v1",
    generatedAt: timestamp,
    entries: normalizedEntries,
  };
}

export async function reverifyProofArchiveEntry(
  entry: ProofArchiveEntry,
  headers: HeaderStoreSnapshot,
): Promise<ProofArchiveEntry> {
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
