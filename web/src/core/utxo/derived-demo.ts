import type { UtxoDeltaEvent } from "../sentinel/types";
import type { DerivedEntry } from "../wallet/watch-only-derivation";

// Helper to create demo UTXO delta events from derived watch-only entries.
// Step 1: this is purely simulated data; no real UTXOs are fetched.

export function demoDeltasFromDerived(entries: DerivedEntry[]): UtxoDeltaEvent[] {
  const events: UtxoDeltaEvent[] = [];

  entries.forEach((entry, index) => {
    const txid = `${"d".repeat(60)}${(index % 16).toString(16).padStart(4, "0")}`.slice(
      0,
      64,
    );

    events.push({
      type: "utxo_delta",
      scripthash: entry.scripthash,
      add: [
        {
          txid,
          vout: 0,
          satoshis: 1000,
          scriptHex: "76a914...88ac",
          height: 0,
        },
      ],
      remove: [],
    });
  });

  return events;
}
