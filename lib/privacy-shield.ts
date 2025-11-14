import { isNetworkAllowed } from "@/lib/net"

export type QueryKind = "tx-raw" | "tx-proof" | "block-header"

export type Query = {
  id: string
  kind: QueryKind
  target: string
  isChaff: boolean
  meta?: Record<string, unknown>
}

export type Batch = {
  nonce: string
  queries: Query[]
  sendAt: number
  endpoint: string
}

export type PrivacyShieldSettings = {
  enabled: boolean
  chaffRatio: number
  batchMin: number
  batchMax: number
  jitterMinMs: number
  jitterMaxMs: number
  maxChaffPerSession: number
}

export type PrivacyShieldContext = {
  endpoint: string
  endpointTrustLevel: "self" | "external"
  chaffConsumed: number
  now?: number
}

export type PrivacyShieldResult = {
  batches: Batch[]
  totalReal: number
  totalChaff: number
  chaffGenerated: number
}

const HEX_CHARS = "0123456789abcdef"

function randomHex(length: number): string {
  let output = ""
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * HEX_CHARS.length)
    output += HEX_CHARS[idx]
  }
  return output
}

function generateTxid(): string {
  return randomHex(64)
}

function normalizeBounds(min: number, max: number): [number, number] {
  const safeMin = Math.max(1, Math.floor(min))
  const safeMax = Math.max(safeMin, Math.floor(max))
  return [safeMin, safeMax]
}

function pickBatchSize(min: number, max: number): number {
  const [safeMin, safeMax] = normalizeBounds(min, max)
  if (safeMin === safeMax) {
    return safeMin
  }
  return safeMin + Math.floor(Math.random() * (safeMax - safeMin + 1))
}

function pickJitter(min: number, max: number): number {
  const jitterMin = Math.max(0, Math.floor(min))
  const jitterMax = Math.max(jitterMin, Math.floor(max))
  if (jitterMin === jitterMax) {
    return jitterMin
  }
  return jitterMin + Math.floor(Math.random() * (jitterMax - jitterMin + 1))
}

function shuffle<T>(items: T[]): T[] {
  const clone = [...items]
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[clone[i], clone[j]] = [clone[j], clone[i]]
  }
  return clone
}

type RealQueryInput = {
  kind: QueryKind
  target: string
  meta?: Record<string, unknown>
}

function buildQuery(input: RealQueryInput, isChaff: boolean): Query {
  return {
    id: randomHex(24),
    kind: input.kind,
    target: input.target,
    isChaff,
    meta: input.meta,
  }
}

function generateHeaderTargets(realQueries: RealQueryInput[], count: number): string[] {
  const headerTargets = realQueries.filter((q) => q.kind === "block-header").map((q) => q.target)
  const numericTargets = headerTargets
    .map((target) => {
      const parsed = Number.parseInt(target, 10)
      return Number.isNaN(parsed) ? null : parsed
    })
    .filter((value): value is number => value !== null)

  const results: string[] = []
  for (let i = 0; i < count; i += 1) {
    if (numericTargets.length === 0) {
      results.push(generateTxid())
      continue
    }
    const anchor = numericTargets[Math.floor(Math.random() * numericTargets.length)]
    const offset = Math.floor(Math.random() * 10) - 5
    const candidate = Math.max(0, anchor + offset)
    results.push(String(candidate))
  }
  return results
}

function generateChaff(realQueries: RealQueryInput[], chaffCount: number): RealQueryInput[] {
  if (chaffCount <= 0) {
    return []
  }

  const chaffQueries: RealQueryInput[] = []
  const realKinds = realQueries.map((q) => q.kind)
  const hasHeaders = realKinds.includes("block-header")

  for (let i = 0; i < chaffCount; i += 1) {
    const prototype = realQueries[i % realQueries.length]
    if (!prototype) {
      break
    }

    if (prototype.kind === "block-header" && hasHeaders) {
      // Defer precise target generation later
      chaffQueries.push({ kind: "block-header", target: "" })
    } else if (prototype.kind === "tx-proof" || prototype.kind === "tx-raw") {
      chaffQueries.push({ kind: prototype.kind, target: generateTxid() })
    } else {
      chaffQueries.push({ kind: "tx-raw", target: generateTxid() })
    }
  }

  const headerPlaceholders = chaffQueries.filter((q) => q.kind === "block-header")
  if (headerPlaceholders.length > 0) {
    const replacements = generateHeaderTargets(realQueries, headerPlaceholders.length)
    headerPlaceholders.forEach((query, index) => {
      query.target = replacements[index]
    })
  }

  return chaffQueries
}

function clampChaffRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio < 0) {
    return 0
  }
  return Math.min(0.25, ratio)
}

function shouldDisableChaff(trustLevel: PrivacyShieldContext["endpointTrustLevel"]): boolean {
  return trustLevel === "self"
}

export function preparePrivacyShieldBatches(
  realQueries: RealQueryInput[],
  settings: PrivacyShieldSettings,
  context: PrivacyShieldContext
): PrivacyShieldResult {
  const totalReal = realQueries.length
  if (totalReal === 0) {
    return { batches: [], totalReal: 0, totalChaff: 0, chaffGenerated: 0 }
  }

  if (!isNetworkAllowed()) {
    throw new Error("OFFLINE_BLOCK")
  }

  const now = context.now ?? Date.now()

  const effectiveRatio = settings.enabled && !shouldDisableChaff(context.endpointTrustLevel)
    ? clampChaffRatio(settings.chaffRatio)
    : 0

  const desiredChaff = Math.floor(totalReal * effectiveRatio)
  const chaffCapacity = Math.max(0, settings.maxChaffPerSession - context.chaffConsumed)
  const chaffCount = Math.min(desiredChaff, chaffCapacity)

  const chaffQueries = generateChaff(realQueries, chaffCount)
  const combined = shuffle([
    ...realQueries.map((query) => buildQuery(query, false)),
    ...chaffQueries.map((query) => buildQuery(query, true)),
  ])

  if (combined.length === 0) {
    return { batches: [], totalReal, totalChaff: 0, chaffGenerated: 0 }
  }

  const [batchMin, batchMax] = normalizeBounds(settings.batchMin, settings.batchMax)
  const batches: Batch[] = []
  let cursor = 0

  while (cursor < combined.length) {
    const size = Math.min(pickBatchSize(batchMin, batchMax), combined.length - cursor)
    const slice = combined.slice(cursor, cursor + size)
    cursor += size

    const jitter = pickJitter(settings.jitterMinMs, settings.jitterMaxMs)
    batches.push({
      nonce: randomHex(20),
      queries: slice,
      sendAt: now + jitter,
      endpoint: context.endpoint,
    })
  }

  return {
    batches,
    totalReal,
    totalChaff: chaffQueries.length,
    chaffGenerated: chaffQueries.length,
  }
}
