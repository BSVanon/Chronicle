export type QueryKind = "tx-raw" | "tx-proof" | "block-header";

export type RealQueryInput = {
  kind: QueryKind;
  target: string;
  meta?: Record<string, unknown>;
};

export type ShieldedQuery = {
  id: string;
  kind: QueryKind;
  target: string;
  isChaff: boolean;
  meta?: Record<string, unknown>;
};

export type PrivacyShieldSettings = {
  batchMin: number;
  batchMax: number;
  intraBatchJitterMinMs: number;
  intraBatchJitterMaxMs: number;
  interBatchJitterMinMs: number;
  interBatchJitterMaxMs: number;
  maxLookupsPerHour: number;
  chaffPerBatchMin: number;
  chaffPerBatchMax: number;
};

export type PrivacyShieldContext = {
  endpoint: string;
  /**
   * Anchor time in milliseconds since epoch. If omitted, Date.now() is used.
   */
  nowMs?: number;
  /**
   * Total lookups emitted in the last rolling hour. Used to enforce caps.
   */
  lookupsUsedLastHour: number;
};

export type PrivacyShieldBatch = {
  endpoint: string;
  sendAtMs: number;
  queries: ShieldedQuery[];
};

export type PrivacyShieldPlan = {
  batches: PrivacyShieldBatch[];
  totalReal: number;
  totalChaff: number;
  droppedReal: number;
  droppedChaff: number;
};

export const DEFAULT_PRIVACY_SHIELD_SETTINGS: PrivacyShieldSettings = {
  batchMin: 3,
  batchMax: 7,
  intraBatchJitterMinMs: 500,
  intraBatchJitterMaxMs: 3000,
  interBatchJitterMinMs: 3000,
  interBatchJitterMaxMs: 8000,
  maxLookupsPerHour: 100,
  chaffPerBatchMin: 1,
  chaffPerBatchMax: 2,
};

const HEX_CHARS = "0123456789abcdef";

function randomInt(min: number, max: number): number {
  const low = Math.floor(min);
  const high = Math.floor(max);
  if (high <= low) return low;
  return low + Math.floor(Math.random() * (high - low + 1));
}

function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function randomHex(length: number): string {
  let output = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * HEX_CHARS.length);
    output += HEX_CHARS[idx];
  }
  return output;
}

function generateTxid(): string {
  return randomHex(64);
}

function shuffle<T>(items: T[]): T[] {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = clone[i];
    clone[i] = clone[j];
    clone[j] = tmp;
  }
  return clone;
}

function buildQuery(input: RealQueryInput, isChaff: boolean): ShieldedQuery {
  return {
    id: randomHex(24),
    kind: input.kind,
    target: input.target,
    isChaff,
    meta: input.meta,
  };
}

function generateHeaderTargets(count: number): string[] {
  const targets: string[] = [];
  for (let i = 0; i < count; i += 1) {
    targets.push(String(randomInt(0, 1_000_000)));
  }
  return targets;
}

function generateChaffInputs(
  realQueries: RealQueryInput[],
  count: number,
): RealQueryInput[] {
  if (count <= 0) return [];
  const results: RealQueryInput[] = [];

  for (let i = 0; i < count; i += 1) {
    const prototype = realQueries.length > 0
      ? realQueries[i % realQueries.length]
      : { kind: "tx-raw" as const, target: generateTxid() };

    if (prototype.kind === "block-header") {
      const [headerTarget] = generateHeaderTargets(1);
      results.push({ kind: "block-header", target: headerTarget });
    } else if (prototype.kind === "tx-proof" || prototype.kind === "tx-raw") {
      results.push({ kind: prototype.kind, target: generateTxid() });
    } else {
      results.push({ kind: "tx-raw", target: generateTxid() });
    }
  }

  return results;
}

export function planPrivacyShieldBatches(
  realQueries: RealQueryInput[],
  settings: PrivacyShieldSettings,
  context: PrivacyShieldContext,
): PrivacyShieldPlan {
  const maxLookups = clampPositiveInt(settings.maxLookupsPerHour, 100);
  const used = Math.max(0, Math.floor(context.lookupsUsedLastHour));
  const capacity = Math.max(0, maxLookups - used);

  if (realQueries.length === 0 || capacity === 0) {
    return {
      batches: [],
      totalReal: 0,
      totalChaff: 0,
      droppedReal: realQueries.length,
      droppedChaff: 0,
    };
  }

  const allowedReal = Math.min(realQueries.length, capacity);
  const droppedReal = realQueries.length - allowedReal;

  const effectiveBatchMin = clampPositiveInt(settings.batchMin, 1);
  const effectiveBatchMax = Math.max(
    effectiveBatchMin,
    clampPositiveInt(settings.batchMax, effectiveBatchMin),
  );

  const chaffMin = Math.max(0, Math.floor(settings.chaffPerBatchMin));
  const chaffMax = Math.max(chaffMin, Math.floor(settings.chaffPerBatchMax));

  const intraMin = Math.max(0, Math.floor(settings.intraBatchJitterMinMs));
  const intraMax = Math.max(intraMin, Math.floor(settings.intraBatchJitterMaxMs));
  const interMin = Math.max(0, Math.floor(settings.interBatchJitterMinMs));
  const interMax = Math.max(interMin, Math.floor(settings.interBatchJitterMaxMs));

  const now = context.nowMs ?? Date.now();

  const realSlice = realQueries.slice(0, allowedReal);
  const preparedReal = realSlice.map((q) => buildQuery(q, false));

  const batches: PrivacyShieldBatch[] = [];
  let cursor = 0;
  let remainingCapacity = capacity - allowedReal;
  let totalChaff = 0;
  let currentTime = now;

  while (cursor < preparedReal.length) {
    const remainingReal = preparedReal.length - cursor;
    const batchSizeReal = Math.min(
      randomInt(effectiveBatchMin, effectiveBatchMax),
      remainingReal,
    );

    const realBatch = preparedReal.slice(cursor, cursor + batchSizeReal);
    cursor += batchSizeReal;

    let chaffCount = 0;
    if (remainingCapacity > 0 && chaffMax > 0) {
      const desired = randomInt(chaffMin, chaffMax);
      chaffCount = Math.min(desired, remainingCapacity);
    }

    const chaffInputs = generateChaffInputs(realSlice, chaffCount);
    const chaffBatch = chaffInputs.map((q) => buildQuery(q, true));
    remainingCapacity -= chaffBatch.length;
    totalChaff += chaffBatch.length;

    const allQueries = shuffle<ShieldedQuery>([...realBatch, ...chaffBatch]);

    const intra = randomInt(intraMin, intraMax);
    const inter = batches.length === 0 ? 0 : randomInt(interMin, interMax);
    currentTime += inter + intra;

    batches.push({
      endpoint: context.endpoint,
      sendAtMs: currentTime,
      queries: allQueries,
    });
  }

  return {
    batches,
    totalReal: allowedReal,
    totalChaff,
    droppedReal,
    droppedChaff: 0,
  };
}
