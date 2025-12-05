import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import bs58check from "bs58check";

import type { BeefParseResult } from "../beef";
import { parseBeefBundle, scripthashesFromBeefResult } from "../beef";
import type { Scripthash } from "@/core/providers/types";
import type {
  WatchOnlyAnalysis,
  WatchOnlyKind,
} from "./watch-only-analyzer";

export type WatchOnlyDerivationResult = {
  kind: WatchOnlyKind;
  scripthashes: Scripthash[];
  sourceCount: number;
  warnings: string[];
};

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = hex.slice(i * 2, i * 2 + 2);
    out[i] = Number.parseInt(byte, 16);
  }
  return out;
}

export function scripthashFromScriptHex(scriptHex: string): Scripthash {
  const scriptBytes = hexToBytes(scriptHex);
  const digest = sha256(scriptBytes);
  const reversed = Uint8Array.from(digest).reverse();
  return bytesToHex(reversed) as Scripthash;
}

export function scriptHexFromLegacyAddress(address: string): string {
  const payload = bs58check.decode(address);
  if (payload.length !== 21) {
    throw new Error("Invalid BSV address payload length");
  }
  const version = payload[0];
  const hash160 = payload.subarray(1);

  // BSV mainnet P2PKH and P2SH share version bytes with Bitcoin:
  // 0x00 -> P2PKH (addresses starting with '1')
  // 0x05 -> P2SH  (addresses starting with '3')
  if (version === 0x00) {
    const script = new Uint8Array(25);
    script[0] = 0x76; // OP_DUP
    script[1] = 0xa9; // OP_HASH160
    script[2] = 0x14; // push 20 bytes
    script.set(hash160, 3);
    script[23] = 0x88; // OP_EQUALVERIFY
    script[24] = 0xac; // OP_CHECKSIG
    return bytesToHex(script);
  }

  if (version === 0x05) {
    const script = new Uint8Array(23);
    script[0] = 0xa9; // OP_HASH160
    script[1] = 0x14; // push 20 bytes
    script.set(hash160, 2);
    script[22] = 0x87; // OP_EQUAL
    return bytesToHex(script);
  }

  throw new Error("Unsupported BSV legacy address version");
}

export function bsvScriptHashFromAddress(address: string): Scripthash {
  const scriptHex = scriptHexFromLegacyAddress(address);
  return scripthashFromScriptHex(scriptHex);
}

export function deriveWatchOnlyScripthashes(
  analysis: WatchOnlyAnalysis,
): WatchOnlyDerivationResult {
  const warnings: string[] = [];

  if (analysis.kind === "empty") {
    warnings.push("No watch-only material provided yet.");
    return {
      kind: analysis.kind,
      scripthashes: [],
      sourceCount: 0,
      warnings,
    };
  }

  if (analysis.kind === "unknown" || analysis.kind === "txid_list") {
    warnings.push("Current watch-only input cannot be mapped to scripthashes.");
    return {
      kind: analysis.kind,
      scripthashes: [],
      sourceCount: analysis.lineCount,
      warnings,
    };
  }

  if (analysis.kind === "address_list") {
    const addresses = analysis.addresses ?? [];
    const scripthashes = addresses.map((addr) => bsvScriptHashFromAddress(addr));
    warnings.push(
      "Address-to-scripthash derivation is stubbed; real BSV script hashing will replace this.",
    );
    return {
      kind: analysis.kind,
      scripthashes,
      sourceCount: addresses.length,
      warnings,
    };
  }

  if (analysis.kind === "xpub") {
    const count = Math.max(1, Math.min(8, analysis.lineCount || 1));
    const base = "xpub-demo";
    const scripthashes: Scripthash[] = [];
    for (let i = 0; i < count; i += 1) {
      scripthashes.push(bsvScriptHashFromAddress(`${base}-${i}`));
    }
    warnings.push(
      "xpub derivation is stubbed; real path templates and BSV derivation will replace this.",
    );
    return {
      kind: analysis.kind,
      scripthashes,
      sourceCount: analysis.lineCount,
      warnings,
    };
  }

  return {
    kind: analysis.kind,
    scripthashes: [],
    sourceCount: analysis.lineCount,
    warnings,
  };
}

export type WatchMaterialKind =
  | "xpub"
  | "descriptor"
  | "address_list"
  | "beef";

export type Network = "bsv_mainnet" | "bsv_testnet";

export type DerivationPresetId =
  | "bip44_bsv"
  | "bip49_bsv"
  | "bip84_bsv"
  | "custom";

export type DerivationInput =
  | { kind: "xpub"; xpub: string; preset: DerivationPresetId }
  | { kind: "descriptor"; descriptor: string }
  | { kind: "address_list"; addresses: string[] }
  | { kind: "beef"; beefJson: unknown };

export type DerivationLimits = {
  maxAddresses: number;
  gapLimit: number;
  changeGapLimit: number;
};

export type DerivationConfig = {
  network: Network;
  limits: DerivationLimits;
};

export type DerivedEntry = {
  scripthash: Scripthash;
  address: string;
  path?: string;
  index?: number;
  isChange?: boolean;
  source: WatchMaterialKind;
};

export type DerivationEngineResult = {
  entries: DerivedEntry[];
  truncated: boolean;
  warnings: string[];
};

export interface WatchOnlyDeriver {
  derive(
    inputs: DerivationInput[],
    config: DerivationConfig,
  ): DerivationEngineResult;
}

export const DEFAULT_DERIVATION_LIMITS: DerivationLimits = {
  maxAddresses: 5000,
  gapLimit: 20,
  changeGapLimit: 10,
};

export const DEFAULT_DERIVATION_CONFIG: DerivationConfig = {
  network: "bsv_mainnet",
  limits: DEFAULT_DERIVATION_LIMITS,
};

export const basicWatchOnlyDeriver: WatchOnlyDeriver = {
  derive(inputs, config): DerivationEngineResult {
    const entries: DerivedEntry[] = [];
    const warnings: string[] = [];
    const { maxAddresses } = config.limits;

    let truncated = false;

    for (const input of inputs) {
      if (input.kind === "address_list") {
        const remainingCapacity = maxAddresses - entries.length;
        if (remainingCapacity <= 0) {
          truncated = true;
          warnings.push(
            "Address derivation truncated: maxAddresses limit reached.",
          );
          break;
        }

        const slice = input.addresses.slice(0, remainingCapacity);
        slice.forEach((address, idx) => {
          try {
            const scripthash = bsvScriptHashFromAddress(address);
            entries.push({
              scripthash,
              address,
              index: idx,
              isChange: false,
              source: "address_list",
            });
          } catch (error) {
            warnings.push(
              error instanceof Error
                ? `Failed to derive scripthash for address: ${error.message}`
                : "Failed to derive scripthash for address.",
            );
          }
        });

        if (input.addresses.length > slice.length) {
          truncated = true;
          warnings.push(
            "Address derivation truncated: some addresses were skipped due to maxAddresses limit.",
          );
        }
      } else if (input.kind === "beef") {
        let parsed: BeefParseResult;
        try {
          parsed = parseBeefBundle(input.beefJson);
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `Failed to parse BEEF bundle: ${error.message}`
              : "Failed to parse BEEF bundle.",
          );
          continue;
        }

        const hashes = scripthashesFromBeefResult(parsed);
        if (hashes.length === 0) {
          continue;
        }

        const remainingCapacity = maxAddresses - entries.length;
        if (remainingCapacity <= 0) {
          truncated = true;
          warnings.push(
            "BEEF derivation truncated: maxAddresses limit reached.",
          );
          break;
        }

        const slice = hashes.slice(0, remainingCapacity);
        slice.forEach((scripthash, idx) => {
          entries.push({
            scripthash,
            // BEEF is script-first; we do not have a canonical address string yet.
            address: "",
            index: idx,
            isChange: false,
            source: "beef",
          });
        });

        if (hashes.length > slice.length) {
          truncated = true;
          warnings.push(
            "BEEF derivation truncated: some entries were skipped due to maxAddresses limit.",
          );
        }
      } else {
        warnings.push(`Derivation for ${input.kind} is not implemented yet.`);
      }
    }

    return {
      entries,
      truncated,
      warnings,
    };
  },
};

export function planDerivationInputs(
  raw: string,
  analysis: WatchOnlyAnalysis,
): DerivationInput[] {
  const inputs: DerivationInput[] = [];

  if (analysis.kind === "address_list" && analysis.addresses?.length) {
    inputs.push({ kind: "address_list", addresses: analysis.addresses });
  }

  if (analysis.kind === "xpub" && analysis.lineCount === 1) {
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      inputs.push({ kind: "xpub", xpub: trimmed, preset: "bip44_bsv" });
    }
  }

  // Other kinds (txid_list, unknown, empty) do not currently produce
  // derivation inputs. BEEF inputs will be wired via a separate flow that
  // constructs DerivationInput entries directly from parsed bundles.

  return inputs;
}

export function runBasicDerivation(
  raw: string,
  analysis: WatchOnlyAnalysis,
): DerivationEngineResult {
  const inputs = planDerivationInputs(raw, analysis);

  if (inputs.length === 0) {
    return {
      entries: [],
      truncated: false,
      warnings: [],
    };
  }

  return basicWatchOnlyDeriver.derive(inputs, DEFAULT_DERIVATION_CONFIG);
}
