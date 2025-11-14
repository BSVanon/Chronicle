export type BeefTransaction = {
  txid: string
  rawTxHex: string
}

export type BeefAncestor = BeefTransaction & {
  height?: number
}

export type BeefBundle = {
  version: string
  subject: BeefTransaction & {
    height?: number
  }
  ancestors: BeefAncestor[]
  metadata?: Record<string, unknown>
}

export type BeefValidationIssue = {
  path: string
  message: string
}

export type BeefValidationResult = {
  ok: boolean
  issues: BeefValidationIssue[]
}
