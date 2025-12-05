import { describe, expect, test } from "vitest";

import { analyzeWatchOnlyInput } from "./watch-only-analyzer";
import { runBasicDerivation } from "./watch-only-derivation";
import {
  createAddressListWallet,
  deserializeWallets,
  serializeWallets,
} from "./local-wallet";

const SAMPLE_P2PKH = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT";

describe("LocalWallet model", () => {
  test("createAddressListWallet normalizes name and address lines", () => {
    const wallet = createAddressListWallet({
      id: "w1",
      name: "  My Wallet  ",
      addressLines: ["  ", SAMPLE_P2PKH, "  "],
      nowMs: 123,
    });

    expect(wallet.id).toBe("w1");
    expect(wallet.name).toBe("My Wallet");
    expect(wallet.addressLines).toEqual([SAMPLE_P2PKH]);
    expect(wallet.createdAt).toBe(123);
    expect(wallet.updatedAt).toBe(123);
  });

  test("serialize and deserialize wallets round-trip", () => {
    const wallet = createAddressListWallet({
      id: "w1",
      name: "Test",
      addressLines: [SAMPLE_P2PKH],
      nowMs: 123,
    });

    const json = serializeWallets([wallet]);
    const restored = deserializeWallets(json);

    expect(restored.length).toBe(1);
    expect(restored[0].id).toBe("w1");
    expect(restored[0].addressLines).toEqual([SAMPLE_P2PKH]);
  });

  test("wallet feeds into runBasicDerivation for address_list", () => {
    const wallet = createAddressListWallet({
      id: "w1",
      name: "Test",
      addressLines: [SAMPLE_P2PKH],
      nowMs: 123,
    });

    const raw = wallet.addressLines.join("\n");
    const analysis = analyzeWatchOnlyInput(raw);
    const result = runBasicDerivation(raw, analysis);

    expect(result.entries.length).toBe(1);
    expect(result.entries[0].address).toBe(SAMPLE_P2PKH);
  });
});
