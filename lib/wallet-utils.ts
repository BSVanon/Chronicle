import * as bip39 from "bip39"

import { parseBeefBundle } from "@/lib/beef/parse"

const BIP39_WORD_COUNTS = new Set([12, 15, 18, 21, 24])
const WORDLIST = new Set(bip39.wordlists.english)
const XPUB_REGEX = /^(xpub|ypub|zpub|tpub|vpub|upub|Ypub|Zpub|ypub|zpub)[1-9A-HJ-NP-Za-km-z]{80,120}$/
const XPRV_REGEX = /^(xprv|yprv|zprv|tprv|vprv|uprv|Yprv|Zprv|yprv|zprv)[1-9A-HJ-NP-Za-km-z]{80,120}$/
const WIF_REGEX = /^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/
const ADDRESS_REGEX = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/
const TXID_REGEX = /^[0-9a-fA-F]{64}$/

export type WalletInputType =
  | "empty"
  | "bip39"
  | "electrum"
  | "xprv"
  | "xpub"
  | "wif"
  | "address_list"
  | "txid_list"
  | "beef_bundle"
  | "unknown"

export type WalletInputAnalysis = {
  type: WalletInputType
  isValid: boolean
  errors: string[]
  notes?: string
  entries?: string[]
  txids?: string[]
  addresses?: string[]
  beef?: {
    version: string
    subjectTxid: string
    ancestorCount: number
  }
}

function normalizeWhitespace(value: string) {
  return value
    .trim()
    .replace(/[\u3000\s]+/g, " ")
    .replace(/\s+/g, " ")
}

function analyzeMnemonic(value: string): WalletInputAnalysis | undefined {
  const normalized = normalizeWhitespace(value).toLowerCase()
  const words = normalized.split(" ")
  if (words.length < 12) {
    return undefined
  }
  const wordsAlphabetic = words.every((word) => /^[a-z]+$/.test(word))
  if (!wordsAlphabetic) {
    return undefined
  }
  const allInWordlist = words.every((word) => WORDLIST.has(word))
  if (BIP39_WORD_COUNTS.has(words.length) && allInWordlist) {
    const isValid = bip39.validateMnemonic(normalized)
    if (isValid) {
      return {
        type: "bip39",
        isValid: true,
        errors: [],
      }
    }
    if (looksLikeElectrumSeed(words)) {
      return {
        type: "electrum",
        isValid: true,
        errors: [],
        notes:
          "Checksum mismatch for BIP39 format. Treated as an Electrum-style seed — double-check derivation templates before scanning.",
      }
    }
    return {
      type: "bip39",
      isValid: false,
      errors: ["Mnemonic checksum is invalid."],
    }
  }
  if (words.length >= 12) {
    return {
      type: "electrum",
      isValid: true,
      errors: [],
      notes: "Detected Electrum-style seed. Chronicle will confirm derivation parameters before scanning.",
    }
  }
  return undefined
}

function looksLikeElectrumSeed(words: string[]): boolean {
  if (words.length !== 12 && words.length !== 24) {
    return false
  }

  const uniqueWords = new Set(words)
  if (uniqueWords.size < words.length - 2) {
    return false
  }

  const stemHasElectrumHints = words.some((word) => word.includes("-"))

  return !stemHasElectrumHints
}

function analyzeSingleLine(value: string): WalletInputAnalysis | undefined {
  if (XPUB_REGEX.test(value)) {
    return {
      type: "xpub",
      isValid: true,
      errors: [],
    }
  }
  if (XPRV_REGEX.test(value)) {
    return {
      type: "xprv",
      isValid: true,
      errors: [],
    }
  }
  if (WIF_REGEX.test(value)) {
    return {
      type: "wif",
      isValid: true,
      errors: [],
    }
  }
  return undefined
}

function analyzeList(entries: string[]): WalletInputAnalysis | undefined {
  if (entries.length === 0) {
    return undefined
  }
  if (entries.every((item) => ADDRESS_REGEX.test(item))) {
    return {
      type: "address_list",
      isValid: true,
      errors: [],
      entries,
      addresses: entries,
    }
  }
  if (entries.every((item) => TXID_REGEX.test(item))) {
    return {
      type: "txid_list",
      isValid: true,
      errors: [],
      entries,
      txids: entries,
    }
  }
  return undefined
}

function analyzeBeef(raw: string): WalletInputAnalysis | undefined {
  const candidate = raw.trim()
  if (!candidate.startsWith("{") && !candidate.startsWith("[")) {
    return undefined
  }

  const result = parseBeefBundle(candidate)

  if (!result.bundle && result.validation.issues.length === 0) {
    return undefined
  }

  const errors = result.validation.issues.map((issue) =>
    issue.path ? `${issue.path}: ${issue.message}` : issue.message
  )

  if (!result.bundle) {
    return {
      type: "beef_bundle",
      isValid: false,
      errors,
      notes: "Chronicle could not parse this bundle. Review the structure and try again.",
    }
  }

  const uniqueTxids = Array.from(new Set(result.transactions.map((tx) => tx.txid)))

  return {
    type: "beef_bundle",
    isValid: result.validation.ok,
    errors,
    txids: uniqueTxids,
    beef: {
      version: result.bundle.version,
      subjectTxid: result.bundle.subject.txid,
      ancestorCount: result.bundle.ancestors.length,
    },
    notes:
      errors.length > 0
        ? "Bundle parsed with issues — address flagged entries before proceeding."
        : "Chronicle detected a BEEF bundle. Proceed to Step 3 to verify proofs.",
  }
}

export function analyzeWalletInput(raw: string): WalletInputAnalysis {
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      type: "empty",
      isValid: false,
      errors: [],
    }
  }

  const normalized = normalizeWhitespace(trimmed)
  const listEntries = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const listResult = analyzeList(listEntries)
  if (listResult) {
    return listResult
  }

  const beefResult = analyzeBeef(trimmed)
  if (beefResult) {
    return beefResult
  }

  const mnemonicResult = analyzeMnemonic(normalized)
  if (mnemonicResult) {
    return mnemonicResult
  }

  const singleLineResult = analyzeSingleLine(normalized)
  if (singleLineResult) {
    return singleLineResult
  }

  return {
    type: "unknown",
    isValid: false,
    errors: ["Chronicle could not classify the input."],
  }
}
