// Minimal BEEF + header proof verifier for Chronicle Step 1.
// This mirrors the behaviour of the standalone merkle helper in the root lib,
// but is scoped to the web app and uses the local HeaderStoreSnapshot.

import type { HeaderStoreSnapshot } from "../headers/store";

type HashPair = {
  hash: string;
  isLeft: boolean;
};

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/, "").toLowerCase();
  if (clean.length === 0 || clean.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("crypto.subtle not available");
  }
  return crypto.subtle.digest("SHA-256", buffer);
}

async function sha256d(bytes: Uint8Array): Promise<Uint8Array> {
  const first = await sha256(bytes.buffer as ArrayBuffer);
  const second = await sha256(first);
  return new Uint8Array(second);
}

async function mergeHashes(left: string, right: string): Promise<string> {
  const leftBytes = hexToBytes(left);
  const rightBytes = hexToBytes(right);
  const concatenated = new Uint8Array(leftBytes.length + rightBytes.length);
  concatenated.set(leftBytes, 0);
  concatenated.set(rightBytes, leftBytes.length);

  const hashed = await sha256d(concatenated);
  return bytesToHex(hashed);
}

function parseNodes(proofHashes: string[]): HashPair[] {
  return proofHashes.map((hash, index) => ({
    hash,
    isLeft: index % 2 === 0,
  }));
}

function reverseHexByteOrder(hex: string): string {
  const bytes = hex.match(/.{2}/g);
  if (!bytes) return hex;
  return bytes.reverse().join("");
}

export function extractMerkleRootFromHeader(headerHex: string): string | undefined {
  if (!headerHex) return undefined;

  const normalized = headerHex.trim().replace(/^0x/, "");
  if (normalized.length < 160) return undefined;

  const merkleSegment = normalized.slice(72, 136);
  if (merkleSegment.length !== 64) return undefined;

  return reverseHexByteOrder(merkleSegment).toLowerCase();
}

export type BeefProofSpec = {
  txPosition?: number;
  headerHeight?: number;
  headerMerkleRoot?: string;
  proofHashes: string[];
};

export type BeefVerifyOutcome = "ok" | "failed" | "unknown";

export type BeefVerifyResult = {
  outcome: BeefVerifyOutcome;
  headerHeight?: number;
  merkleRoot?: string;
  reason?: string;
};

async function verifyMerkleProof(
  txid: string,
  proof: BeefProofSpec,
  headerMerkleRoot: string,
): Promise<BeefVerifyResult> {
  if (!txid || !Array.isArray(proof.proofHashes) || proof.proofHashes.length === 0) {
    return { outcome: "unknown", reason: "Missing txid or proof hashes" };
  }

  if (!headerMerkleRoot) {
    return { outcome: "unknown", reason: "Missing header merkle root" };
  }

  const nodes = parseNodes(proof.proofHashes);

  let workingHash = txid.toLowerCase();
  let index = typeof proof.txPosition === "number" ? proof.txPosition : 0;

  for (const node of nodes) {
    const isLeft = (index % 2 === 1 && !node.isLeft) || (index % 2 === 0 && node.isLeft);

    if (isLeft) {
      workingHash = await mergeHashes(node.hash, workingHash);
    } else {
      workingHash = await mergeHashes(workingHash, node.hash);
    }

    index = Math.floor(index / 2);
  }

  const normalizedRoot = headerMerkleRoot.toLowerCase();
  if (workingHash.toLowerCase() !== normalizedRoot) {
    return {
      outcome: "failed",
      merkleRoot: workingHash,
      reason: "Merkle root mismatch",
    };
  }

  return { outcome: "ok", merkleRoot: workingHash };
}

export async function verifyBeefSubjectAgainstHeaders(
  rawBundle: unknown,
  headers: HeaderStoreSnapshot,
): Promise<BeefVerifyResult> {
  if (!headers.headers || headers.headers.length === 0) {
    return { outcome: "unknown", reason: "No headers available" };
  }

  if (!rawBundle || typeof rawBundle !== "object" || Array.isArray(rawBundle)) {
    return { outcome: "unknown", reason: "Bundle must be a JSON object" };
  }

  const bundle = rawBundle as {
    subject?: { txid?: string };
    metadata?: { proof?: { subject?: BeefProofSpec } };
  };

  const subject = bundle.subject;
  if (!subject || typeof subject.txid !== "string") {
    return { outcome: "unknown", reason: "Missing subject.txid in bundle" };
  }

  const proof = bundle.metadata?.proof?.subject;
  if (!proof || !Array.isArray(proof.proofHashes) || proof.proofHashes.length === 0) {
    return { outcome: "unknown", reason: "No proof metadata found on bundle" };
  }

  const headerHeight = typeof proof.headerHeight === "number" ? proof.headerHeight : undefined;
  let headerHex: string | undefined;

  if (headerHeight !== undefined) {
    const found = headers.headers.find((h) => h.height === headerHeight);
    if (found) {
      headerHex = found.headerHex;
    } else {
      return {
        outcome: "unknown",
        headerHeight,
        reason: "Referenced header height not present in local header store",
      };
    }
  }

  let headerMerkleRoot = proof.headerMerkleRoot;
  if (!headerMerkleRoot && headerHex) {
    headerMerkleRoot = extractMerkleRootFromHeader(headerHex) ?? undefined;
  }

  if (!headerMerkleRoot) {
    return {
      outcome: "unknown",
      headerHeight,
      reason: "Unable to derive header merkle root",
    };
  }

  try {
    const result = await verifyMerkleProof(subject.txid, proof, headerMerkleRoot);
    return { ...result, headerHeight };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error during verification";
    return {
      outcome: "unknown",
      headerHeight,
      reason: message,
    };
  }
}
