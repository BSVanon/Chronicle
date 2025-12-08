/**
 * Chronicle Cold Vault — BEEF Verification
 *
 * Uses @bsv/sdk Beef class with a local ChainTracker backed by our headers store.
 */

import { Beef } from "@bsv/sdk";
import type ChainTracker from "@bsv/sdk/transaction/ChainTracker";
import { getHeaderByHeight, getTipHeight } from "../headers/store";

export type VerifyResult = {
  ok: boolean;
  txid: string | null;
  height: number | null;
  merkleRoot: string | null;
  error: string | null;
  /** If true, the error is due to missing headers, not invalid proof */
  missingHeaders?: boolean;
};

/**
 * Create a ChainTracker that validates merkle roots against our local headers store.
 */
export function createLocalChainTracker(): ChainTracker {
  return {
    async isValidRootForHeight(root: string, height: number): Promise<boolean> {
      const header = await getHeaderByHeight(height);
      if (!header) {
        return false;
      }
      // Compare merkle root (header stores it as hex)
      return header.merkle_root.toLowerCase() === root.toLowerCase();
    },

    async currentHeight(): Promise<number> {
      const tip = await getTipHeight();
      return tip ?? 0;
    },
  };
}

/**
 * Parse and verify a BEEF bundle against local headers.
 *
 * @param beefBase64 Base64-encoded BEEF data
 * @returns Verification result
 */
export async function verifyBeef(beefBase64: string): Promise<VerifyResult> {
  try {
    // Parse the BEEF
    const beef = Beef.fromString(beefBase64, "base64");

    // Get valid txids (those with proofs that chain back)
    const validTxids = beef.getValidTxids();

    if (validTxids.length === 0) {
      return {
        ok: false,
        txid: null,
        height: null,
        merkleRoot: null,
        error: "No valid transactions found in BEEF",
      };
    }

    // Get the subject transaction (last one, typically)
    const subjectTxid = validTxids[validTxids.length - 1];

    // Find the merkle path for this txid
    const merklePath = beef.findBump(subjectTxid);
    if (!merklePath) {
      return {
        ok: false,
        txid: subjectTxid,
        height: null,
        merkleRoot: null,
        error: "No merkle path found for subject transaction",
      };
    }

    const height = merklePath.blockHeight;
    const merkleRoot = merklePath.computeRoot(subjectTxid);

    // Verify against local headers
    const tracker = createLocalChainTracker();
    const isValid = await tracker.isValidRootForHeight(merkleRoot, height);

    if (!isValid) {
      // Check if we even have this header
      const header = await getHeaderByHeight(height);
      const tipHeight = await getTipHeight();
      
      if (!header) {
        const needsSync = tipHeight === null || height > tipHeight;
        return {
          ok: false,
          txid: subjectTxid,
          height,
          merkleRoot,
          error: needsSync 
            ? `Missing header at height ${height.toLocaleString()}. Sync headers to height ${height.toLocaleString()} or higher.`
            : `Missing header at height ${height.toLocaleString()} (tip is ${tipHeight?.toLocaleString()}). Headers may have gaps.`,
          missingHeaders: true,
        };
      }

      return {
        ok: false,
        txid: subjectTxid,
        height,
        merkleRoot,
        error: `Merkle root mismatch at height ${height.toLocaleString()}. Proof may be invalid.`,
      };
    }

    return {
      ok: true,
      txid: subjectTxid,
      height,
      merkleRoot,
      error: null,
    };
  } catch (e) {
    return {
      ok: false,
      txid: null,
      height: null,
      merkleRoot: null,
      error: `Parse error: ${e instanceof Error ? e.message : "Unknown error"}`,
    };
  }
}

/**
 * Extract transaction outputs from a BEEF bundle.
 */
export function extractBeefOutputs(
  beefBase64: string
): { txid: string; vout: number; satoshis: number; scriptHex: string }[] {
  try {
    const beef = Beef.fromString(beefBase64, "base64");
    const outputs: { txid: string; vout: number; satoshis: number; scriptHex: string }[] = [];

    for (const beefTx of beef.txs) {
      if (!beefTx.tx) continue;
      const tx = beefTx.tx;
      const txid = tx.id("hex");

      for (let i = 0; i < tx.outputs.length; i++) {
        const out = tx.outputs[i];
        outputs.push({
          txid,
          vout: i,
          satoshis: out.satoshis ?? 0,
          scriptHex: out.lockingScript.toHex(),
        });
      }
    }

    return outputs;
  } catch {
    return [];
  }
}

/**
 * Get the subject txid from a BEEF bundle.
 */
export function getBeefSubjectTxid(beefBase64: string): string | null {
  try {
    const beef = Beef.fromString(beefBase64, "base64");
    const validTxids = beef.getValidTxids();
    return validTxids.length > 0 ? validTxids[validTxids.length - 1] : null;
  } catch {
    return null;
  }
}
