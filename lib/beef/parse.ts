import type { BeefAncestor, BeefBundle, BeefTransaction, BeefValidationIssue, BeefValidationResult } from "./types"

export type BeefParseResult = {
  bundle?: BeefBundle
  transactions: BeefTransaction[]
  validation: BeefValidationResult
}

type AnyRecord = Record<string, unknown>

type DraftAncestor = BeefAncestor & {
  height?: number
}

type DraftSubject = BeefTransaction & {
  height?: number
}

function isHex(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-fA-F]+$/.test(value)
}

function normalizeTxid(txid: string): string {
  return txid.trim().toLowerCase()
}

export function parseBeefBundle(raw: string): BeefParseResult {
  const issues: BeefValidationIssue[] = []
  let parsed: AnyRecord | null = null

  try {
    parsed = JSON.parse(raw) as AnyRecord
  } catch (error) {
    issues.push({ path: "root", message: `Invalid JSON: ${(error as Error).message}` })
    return {
      bundle: undefined,
      transactions: [],
      validation: { ok: false, issues },
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    issues.push({ path: "root", message: "BEEF bundle must be a JSON object." })
    return {
      bundle: undefined,
      transactions: [],
      validation: { ok: false, issues },
    }
  }

  const version = typeof parsed.version === "string" ? parsed.version : ""
  if (!version || !version.toLowerCase().startsWith("beef")) {
    issues.push({ path: "version", message: "BEEF version missing or invalid." })
  }

  const subjectDraft = extractTransaction(parsed.subject, "subject", issues)
  const ancestorDrafts: DraftAncestor[] = Array.isArray(parsed.ancestors)
    ? parsed.ancestors
        .map((ancestor, index) => extractTransaction(ancestor, `ancestors[${index}]`, issues))
        .filter((ancestor): ancestor is DraftAncestor => Boolean(ancestor))
    : []

  if (!Array.isArray(parsed.ancestors)) {
    issues.push({ path: "ancestors", message: "Ancestors must be an array." })
  }

  const metadata = isPlainObject(parsed.metadata) ? (parsed.metadata as Record<string, unknown>) : undefined

  if (!subjectDraft) {
    return {
      bundle: undefined,
      transactions: ancestorDrafts,
      validation: { ok: false, issues },
    }
  }

  const bundle: BeefBundle = {
    version,
    subject: subjectDraft,
    ancestors: ancestorDrafts,
    metadata,
  }

  const transactions: BeefTransaction[] = [bundle.subject, ...bundle.ancestors]
  const ok = issues.length === 0

  return {
    bundle,
    transactions,
    validation: { ok, issues },
  }
}

function extractTransaction(value: unknown, path: string, issues: BeefValidationIssue[]): DraftSubject | undefined {
  if (!isPlainObject(value)) {
    issues.push({ path, message: "Expected object with txid and rawTxHex." })
    return undefined
  }

  const txidValue = value.txid
  const rawTxValue = value.rawTxHex

  if (typeof txidValue !== "string" || !isHex(txidValue) || txidValue.length !== 64) {
    issues.push({ path: `${path}.txid`, message: "Invalid txid format." })
    return undefined
  }

  if (typeof rawTxValue !== "string" || !isHex(rawTxValue)) {
    issues.push({ path: `${path}.rawTxHex`, message: "Invalid rawTxHex format." })
  }

  const heightValue = (value as AnyRecord).height
  const height = typeof heightValue === "number" ? heightValue : undefined

  return {
    txid: normalizeTxid(txidValue),
    rawTxHex: typeof rawTxValue === "string" ? rawTxValue : "",
    height,
  }
}

function isPlainObject(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
