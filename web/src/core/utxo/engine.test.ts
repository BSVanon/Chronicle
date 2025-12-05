import { describe, expect, test } from "vitest";

import type { UtxoDeltaEvent } from "@/core/sentinel/types";
import { createUtxoEngine } from "./engine";

describe("UtxoEngine", () => {
  test("applies add/remove deltas and computes totals", () => {
    const scripthash = "demo-scripthash";

    const events: UtxoDeltaEvent[] = [
      {
        type: "utxo_delta",
        scripthash,
        add: [
          {
            txid: "a".repeat(64),
            vout: 0,
            satoshis: 1_000,
            scriptHex: "76a914...88ac",
            height: 100,
          },
          {
            txid: "b".repeat(64),
            vout: 1,
            satoshis: 2_000,
            scriptHex: "76a914...88ac",
          },
        ],
        remove: [],
      },
      {
        type: "utxo_delta",
        scripthash,
        add: [],
        remove: [
          {
            txid: "a".repeat(64),
            vout: 0,
            satoshis: 1_000,
            scriptHex: "76a914...88ac",
            height: 100,
          },
        ],
      },
    ];

    const engine = createUtxoEngine(events);

    const utxos = engine.getUtxosForScripthash(scripthash);
    expect(utxos).toHaveLength(1);
    expect(utxos[0].txid).toBe("b".repeat(64));

    const totals = engine.getTotals();
    expect(totals.confirmed).toBe(0);
    expect(totals.unconfirmed).toBe(2_000);
  });
});
