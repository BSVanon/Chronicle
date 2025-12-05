import { describe, expect, test } from "vitest";

import {
  scriptHexFromLegacyAddress,
  scripthashFromScriptHex,
  bsvScriptHashFromAddress,
  basicWatchOnlyDeriver,
  DEFAULT_DERIVATION_CONFIG,
  runBasicDerivation,
} from "./watch-only-derivation";
import type { BeefParseResult } from "../beef";
import { parseBeefBundle } from "../beef";
import { analyzeWatchOnlyInput } from "./watch-only-analyzer";

// These addresses are standard Bitcoin/BSV-style legacy addresses.
const SAMPLE_P2PKH = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT";
const SAMPLE_P2SH = "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy";

function isHex(s: string): boolean {
  return /^[0-9a-f]+$/.test(s);
}

describe("watch-only derivation helpers", () => {
  test("scriptHexFromLegacyAddress builds a P2PKH script", () => {
    const scriptHex = scriptHexFromLegacyAddress(SAMPLE_P2PKH);
    expect(scriptHex.length).toBe(25 * 2);
    expect(scriptHex.startsWith("76a914")).toBe(true);
    expect(scriptHex.endsWith("88ac")).toBe(true);
  });

  test("scriptHexFromLegacyAddress builds a P2SH script", () => {
    const scriptHex = scriptHexFromLegacyAddress(SAMPLE_P2SH);
    expect(scriptHex.length).toBe(23 * 2);
    expect(scriptHex.startsWith("a914")).toBe(true);
    expect(scriptHex.endsWith("87")).toBe(true);
  });

  test("scripthashFromScriptHex returns 64-char hex string", () => {
    const scriptHex = scriptHexFromLegacyAddress(SAMPLE_P2PKH);
    const scripthash = scripthashFromScriptHex(scriptHex);
    expect(scripthash.length).toBe(64);
    expect(isHex(scripthash)).toBe(true);
  });

  test("bsvScriptHashFromAddress produces different hashes for different scripts", () => {
    const hash1 = bsvScriptHashFromAddress(SAMPLE_P2PKH);
    const hash2 = bsvScriptHashFromAddress(SAMPLE_P2SH);
    expect(hash1).not.toEqual(hash2);
  });
});

describe("basicWatchOnlyDeriver", () => {
  test("derives entries from address_list inputs", () => {
    const inputs = [
      {
        kind: "address_list" as const,
        addresses: [SAMPLE_P2PKH, SAMPLE_P2SH],
      },
    ];

    const result = basicWatchOnlyDeriver.derive(inputs, DEFAULT_DERIVATION_CONFIG);

    expect(result.entries.length).toBe(2);
    expect(result.truncated).toBe(false);
    expect(result.warnings.length).toBe(0);
    expect(result.entries[0].address).toBe(SAMPLE_P2PKH);
    expect(result.entries[1].address).toBe(SAMPLE_P2SH);
  });

  test("respects maxAddresses limit and sets truncated flag", () => {
    const inputs = [
      {
        kind: "address_list" as const,
        addresses: [SAMPLE_P2PKH, SAMPLE_P2SH],
      },
    ];

    const config = {
      ...DEFAULT_DERIVATION_CONFIG,
      limits: { ...DEFAULT_DERIVATION_CONFIG.limits, maxAddresses: 1 },
    } as const;

    const result = basicWatchOnlyDeriver.derive(inputs, config);

    expect(result.entries.length).toBe(1);
    expect(result.truncated).toBe(true);
    expect(result.warnings.some((w) => w.includes("truncated"))).toBe(true);
  });

  test("handles beef inputs via parseBeefBundle", () => {
    const preParsed: BeefParseResult = {
      meta: {
        id: "beef-test",
        importedAt: 123,
        utxoCount: 1,
        scripthashCount: 0,
      },
      utxos: [
        {
          txid: "00".repeat(32),
          vout: 0,
          scriptPubKey:
            "76a914" +
            "7b28d17a7fb3d49b0a4b5d4798365a793102b66432b6".slice(0, 40) +
            "88ac",
          satoshis: 1000,
        },
      ],
    };

    const beefInput = parseBeefBundle(preParsed);

    const inputs = [
      {
        kind: "beef" as const,
        beefJson: beefInput,
      },
    ];

    const result = basicWatchOnlyDeriver.derive(inputs, DEFAULT_DERIVATION_CONFIG);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].source).toBe("beef");
    expect(result.entries[0].scripthash.length).toBe(64);
  });
});

describe("runBasicDerivation", () => {
  test("returns derived entries for address_list input", () => {
    const raw = `${SAMPLE_P2PKH}\n${SAMPLE_P2SH}`;
    const analysis = analyzeWatchOnlyInput(raw);

    const result = runBasicDerivation(raw, analysis);
    expect(result.entries.length).toBe(2);
    expect(result.truncated).toBe(false);
  });

  test("returns empty result for non-derivable input", () => {
    const raw = "not an address or xpub";
    const analysis = analyzeWatchOnlyInput(raw);

    const result = runBasicDerivation(raw, analysis);
    expect(result.entries.length).toBe(0);
    expect(result.truncated).toBe(false);
  });
});
