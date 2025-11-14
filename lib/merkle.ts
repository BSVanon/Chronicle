type HashPair = {
  hash: string
  isLeft: boolean
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "")
  if (clean.length % 2 !== 0) {
    throw new Error("Invalid hex string length")
  }
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function sha256(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", buffer)
}

async function sha256d(bytes: Uint8Array): Promise<Uint8Array> {
  const first = await sha256(bytes.buffer as ArrayBuffer)
  const second = await sha256(first)
  return new Uint8Array(second)
}

async function mergeHashes(left: string, right: string): Promise<string> {
  const leftBytes = hexToBytes(left)
  const rightBytes = hexToBytes(right)
  const concatenated = new Uint8Array(leftBytes.length + rightBytes.length)
  concatenated.set(leftBytes, 0)
  concatenated.set(rightBytes, leftBytes.length)

  const hashed = await sha256d(concatenated)
  return bytesToHex(hashed)
}

function parseNodes(proofHashes: string[]): HashPair[] {
  return proofHashes.map((hash, index) => ({
    hash,
    isLeft: index % 2 === 0,
  }))
}

export type VerifyTscParams = {
  txid: string
  proofHashes: string[]
  txPosition?: number
  headerMerkleRoot: string
}

export type VerifyTscResult = {
  ok: boolean
  merkleRoot?: string
  reason?: string
}

export async function verifyTsc({
  txid,
  proofHashes,
  txPosition = 0,
  headerMerkleRoot,
}: VerifyTscParams): Promise<VerifyTscResult> {
  if (!txid || !Array.isArray(proofHashes) || proofHashes.length === 0) {
    return { ok: false, reason: "Invalid proof data" }
  }

  if (!headerMerkleRoot) {
    return { ok: false, reason: "Missing header merkle root" }
  }

  let workingHash = txid
  let index = txPosition

  for (const node of parseNodes(proofHashes)) {
    const isLeft = (index % 2 === 1 && !node.isLeft) || (index % 2 === 0 && node.isLeft)

    if (isLeft) {
      workingHash = await mergeHashes(node.hash, workingHash)
    } else {
      workingHash = await mergeHashes(workingHash, node.hash)
    }

    index = Math.floor(index / 2)
  }

  const normalizedRoot = headerMerkleRoot.toLowerCase()
  if (workingHash.toLowerCase() !== normalizedRoot) {
    return { ok: false, reason: "Merkle root mismatch", merkleRoot: workingHash }
  }

  return {
    ok: true,
    merkleRoot: workingHash,
  }
}

function reverseHexByteOrder(hex: string): string {
  const bytes = hex.match(/.{2}/g)
  if (!bytes) {
    return hex
  }
  return bytes.reverse().join("")
}

export function extractMerkleRootFromHeader(headerHex: string): string | undefined {
  if (!headerHex) {
    return undefined
  }

  const normalized = headerHex.trim().replace(/^0x/, "")
  if (normalized.length < 160) {
    return undefined
  }

  const merkleSegment = normalized.slice(72, 136)
  if (merkleSegment.length !== 64) {
    return undefined
  }

  return reverseHexByteOrder(merkleSegment).toLowerCase()
}
