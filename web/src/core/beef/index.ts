/**
 * Chronicle Cold Vault — BEEF Parsing Helpers
 *
 * Minimal BEEF parsing for the Cold Vault Archive.
 * This module handles JSON-based BEEF representations.
 */

import { sha256 } from "@noble/hashes/sha256";

export type BeefUtxoRecord = {
  txid: string;
  vout: number;
  scriptPubKey: string;
  satoshis: number;
  height?: number;
};

export type BeefParseResult = {
  txid: string;
  utxos: BeefUtxoRecord[];
  beefBase64: string | null;
  height: number | null;
  headerHash: string | null;
};

/**
 * Parse a BEEF JSON object.
 * Expected shape: { txid, utxos: [...], beef?, height?, header_hash? }
 */
export function parseBeefJson(raw: unknown): BeefParseResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.txid !== "string") {
    return null;
  }

  const utxos: BeefUtxoRecord[] = [];

  if (Array.isArray(obj.utxos)) {
    for (const u of obj.utxos) {
      if (!u || typeof u !== "object") continue;
      const uObj = u as Record<string, unknown>;
      if (typeof uObj.vout !== "number") continue;
      if (typeof uObj.satoshis !== "number" && typeof uObj.value !== "number") continue;

      utxos.push({
        txid: obj.txid as string,
        vout: uObj.vout as number,
        scriptPubKey: (uObj.script_hex as string) ?? (uObj.scriptPubKey as string) ?? "",
        satoshis: (uObj.satoshis as number) ?? (uObj.value as number) ?? 0,
        height: typeof uObj.height === "number" ? uObj.height : undefined,
      });
    }
  }

  return {
    txid: obj.txid as string,
    utxos,
    beefBase64: typeof obj.beef === "string" ? obj.beef : null,
    height: typeof obj.height === "number" ? obj.height : null,
    headerHash: typeof obj.header_hash === "string" ? obj.header_hash : null,
  };
}

/**
 * Compute SHA256 hash of a script hex to get a scripthash.
 * Returns the hash as a hex string (reversed, Electrum-style).
 */
export async function scripthashFromScriptHex(scriptHex: string): Promise<string> {
  const bytes = new Uint8Array(scriptHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(scriptHex.substr(i * 2, 2), 16);
  }

  // Prefer WebCrypto when available.
  if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Reverse for Electrum-style scripthash
    return hashArray.reverse().map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback when WebCrypto is unavailable (e.g. HTTP origin).
  const hash = sha256(bytes);
  const hashArray = Array.from(hash);
  return hashArray.reverse().map((b) => b.toString(16).padStart(2, "0")).join("");
}
