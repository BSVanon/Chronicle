import { describe, expect, test } from "vitest";

import { analyzeWatchOnlyInput } from "./watch-only-analyzer";

function makeXpubLike(): string {
  // Minimal string that matches the XPUB_REGEX in the analyzer:
  // prefix plus 80 base58 characters.
  return "xpub" + "A".repeat(80);
}

function makeAddressLike(): string {
  // Matches ADDRESS_REGEX: leading 1 or 3, then base58 body.
  return "1" + "A".repeat(25);
}

function makeTxidLike(): string {
  // Matches TXID_REGEX: 64 hex characters.
  return "a".repeat(64);
}

describe("analyzeWatchOnlyInput", () => {
  test("classifies empty input as empty and invalid", () => {
    const result = analyzeWatchOnlyInput("");
    expect(result.kind).toBe("empty");
    expect(result.isValid).toBe(false);
    expect(result.lineCount).toBe(0);
  });

  test("detects a single xpub-like line as xpub", () => {
    const xpub = makeXpubLike();
    const result = analyzeWatchOnlyInput(xpub);
    expect(result.kind).toBe("xpub");
    expect(result.isValid).toBe(true);
    expect(result.lineCount).toBe(1);
  });

  test("classifies a pure address list", () => {
    const a1 = makeAddressLike();
    const a2 = makeAddressLike();
    const result = analyzeWatchOnlyInput(`${a1}\n${a2}`);
    expect(result.kind).toBe("address_list");
    expect(result.isValid).toBe(true);
    expect(result.lineCount).toBe(2);
    expect(result.addresses).toEqual([a1, a2]);
  });

  test("classifies a pure txid list", () => {
    const t1 = makeTxidLike();
    const t2 = makeTxidLike();
    const result = analyzeWatchOnlyInput(`${t1}\n${t2}`);
    expect(result.kind).toBe("txid_list");
    expect(result.isValid).toBe(true);
    expect(result.lineCount).toBe(2);
    expect(result.txids).toEqual([t1, t2]);
  });

  test("falls back to unknown for mixed or unrecognised input", () => {
    const result = analyzeWatchOnlyInput("not-an-address\n1234");
    expect(result.kind).toBe("unknown");
    expect(result.isValid).toBe(false);
    expect(result.lineCount).toBe(2);
  });
});
