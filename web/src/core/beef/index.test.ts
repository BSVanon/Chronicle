import { describe, expect, test } from "vitest";

import type { BeefParseResult } from "./index";
import { parseBeefBundle, scripthashesFromBeefResult } from "./index";

function isHex(s: string): boolean {
  return /^[0-9a-f]+$/.test(s);
}

describe("BEEF core helpers", () => {
  test("parseBeefBundle returns structured empty stub for arbitrary input", () => {
    const result = parseBeefBundle({ any: "value" });
    expect(result.meta.id).toBe("stub-bundle");
    expect(typeof result.meta.importedAt).toBe("number");
    expect(result.meta.utxoCount).toBe(0);
    expect(result.meta.scripthashCount).toBe(0);
    expect(result.utxos).toEqual([]);
  });

  test("parseBeefBundle returns normalized pre-parsed result when shape matches", () => {
    const preParsed: BeefParseResult = {
      meta: {
        id: "preparsed",
        importedAt: 123,
        utxoCount: 1,
        scripthashCount: 0,
      },
      utxos: [
        {
          txid: "00".repeat(32),
          vout: 0,
          scriptPubKey: "76a914" + "00".repeat(20) + "88ac",
          satoshis: 1000,
        },
      ],
    };

    const result = parseBeefBundle(preParsed);
    expect(result.meta.id).toBe("preparsed");
    expect(result.meta.utxoCount).toBe(1);
    expect(result.utxos.length).toBe(1);
  });

  test("scripthashesFromBeefResult derives scripthashes from scriptPubKey", () => {
    // scriptPubKey for SAMPLE_P2PKH = 1BoatSLRHtKNngkdXEeobR76b53LETtpyT
    const scriptPubKey =
      "76a914" +
      "7b28d17a7fb3d49b0a4b5d4798365a793102b66432b6".slice(0, 40) +
      "88ac";

    const fake: BeefParseResult = {
      meta: {
        id: "test-bundle",
        importedAt: Date.now(),
        utxoCount: 1,
        scripthashCount: 0,
      },
      utxos: [
        {
          txid: "00".repeat(32),
          vout: 0,
          scriptPubKey,
          satoshis: 1000,
        },
      ],
    };

    const hashes = scripthashesFromBeefResult(fake);
    expect(hashes.length).toBe(1);
    expect(hashes[0].length).toBe(64);
    expect(isHex(hashes[0])).toBe(true);
  });
});
