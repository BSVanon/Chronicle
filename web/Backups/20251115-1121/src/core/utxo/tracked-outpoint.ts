export type TrackedOutpoint = {
  id: string; // stable local id (e.g. txid:vout or UUID)
  txid: string;
  vout: number;
  bucketId?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export type TrackedOutpointSnapshot = {
  version: 1;
  outpoints: TrackedOutpoint[];
};

export function createTrackedOutpoint(options: {
  id: string;
  txid: string;
  vout: number;
  bucketId?: string;
  notes?: string;
  nowMs?: number;
}): TrackedOutpoint {
  const now = options.nowMs ?? Date.now();
  const txid = options.txid.trim();
  const vout = Number.isFinite(options.vout) && options.vout >= 0 ? Math.floor(options.vout) : 0;

  return {
    id: options.id,
    txid,
    vout,
    bucketId: options.bucketId && options.bucketId.trim().length > 0 ? options.bucketId.trim() : undefined,
    notes: options.notes && options.notes.trim().length > 0 ? options.notes.trim() : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function serializeTrackedOutpoints(outpoints: TrackedOutpoint[]): string {
  const snapshot: TrackedOutpointSnapshot = { version: 1, outpoints };
  return JSON.stringify(snapshot);
}

export function deserializeTrackedOutpoints(raw: string | null | undefined): TrackedOutpoint[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<TrackedOutpointSnapshot>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.outpoints)) {
      return [];
    }
    return parsed.outpoints
      .map((op) => normalizeTrackedOutpoint(op))
      .filter((op): op is TrackedOutpoint => op !== null);
  } catch {
    return [];
  }
}

function normalizeTrackedOutpoint(raw: unknown): TrackedOutpoint | null {
  const op = raw as Partial<TrackedOutpoint>;
  if (!op || typeof op.id !== "string" || typeof op.txid !== "string" || typeof op.vout !== "number") {
    return null;
  }

  const createdAt = typeof op.createdAt === "number" ? op.createdAt : Date.now();
  const updatedAt = typeof op.updatedAt === "number" ? op.updatedAt : createdAt;
  const txid = op.txid.trim();
  const vout = Number.isFinite(op.vout) && op.vout >= 0 ? Math.floor(op.vout) : 0;

  return {
    id: op.id,
    txid,
    vout,
    bucketId:
      typeof op.bucketId === "string" && op.bucketId.trim().length > 0
        ? op.bucketId.trim()
        : undefined,
    notes:
      typeof op.notes === "string" && op.notes.trim().length > 0 ? op.notes.trim() : undefined,
    createdAt,
    updatedAt,
  };
}
