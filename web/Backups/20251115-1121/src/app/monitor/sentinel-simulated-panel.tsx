"use client";

import * as React from "react";

import type { UtxoDeltaEvent } from "@/core/sentinel/types";
import type { Scripthash } from "@/core/providers/types";
import { useUtxoStream } from "@/contexts/utxo-stream-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const SHARD_SCRIPTHASHES: Record<number, Scripthash[]> = {
  0: ["shard-0-a", "shard-0-b"],
  1: ["shard-1-a"],
};

const UTXO_A = {
  txid: "a".repeat(64),
  vout: 0,
  satoshis: 10_000,
  scriptHex: "76a914...88ac",
  height: 100,
};

const UTXO_B = {
  txid: "b".repeat(64),
  vout: 1,
  satoshis: 25_000,
  scriptHex: "76a914...88ac",
};

const UTXO_C = {
  txid: "c".repeat(64),
  vout: 0,
  satoshis: 5_000,
  scriptHex: "76a914...88ac",
  height: 101,
};

export const SIMULATED_DELTAS: UtxoDeltaEvent[] = [
  {
    type: "utxo_delta",
    scripthash: "shard-0-a",
    add: [UTXO_A],
    remove: [],
  },
  {
    type: "utxo_delta",
    scripthash: "shard-0-b",
    add: [UTXO_B],
    remove: [],
  },
  {
    type: "utxo_delta",
    scripthash: "shard-1-a",
    add: [UTXO_C],
    remove: [],
  },
  {
    type: "utxo_delta",
    scripthash: "shard-0-a",
    add: [],
    remove: [UTXO_A],
  },
];

export function SentinelSimulatedPanel() {
  const { engine, applyEvent, reset } = useUtxoStream();
  const [step, setStep] = React.useState(0);
  const [runId, setRunId] = React.useState(0);

  React.useEffect(() => {
    reset();
    setStep(0);

    const timeouts: number[] = [];

    SIMULATED_DELTAS.forEach((event, index) => {
      const timeoutId = window.setTimeout(() => {
        applyEvent(event);
        setStep((prev) => prev + 1);
      }, 700 * (index + 1));
      timeouts.push(timeoutId);
    });

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [runId, applyEvent, reset]);

  const totals = engine.getTotals();

  function computeShardSummary(shardId: number) {
    const scripthashes = SHARD_SCRIPTHASHES[shardId] ?? [];
    let confirmed = 0;
    let unconfirmed = 0;
    let utxoCount = 0;

    for (const hash of scripthashes) {
      const utxos = engine.getUtxosForScripthash(hash);
      utxoCount += utxos.length;
      for (const utxo of utxos) {
        const value = utxo.satoshis;
        if (utxo.height && utxo.height > 0) {
          confirmed += value;
        } else {
          unconfirmed += value;
        }
      }
    }

    return { confirmed, unconfirmed, utxoCount };
  }

  return (
    <Card className="mt-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Simulated Sentinel feed</CardTitle>
          <p className="text-xs text-muted-foreground">
            Local-only simulation of UTXO deltas feeding Chronicle&apos;s UTXO
            engine. No network requests are made.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
            Simulation
          </Badge>
          <span className="text-xs text-muted-foreground">
            Applied events: {step} / {SIMULATED_DELTAS.length}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-1 h-6 px-2 text-[0.7rem]"
            onClick={() => setRunId((prev) => prev + 1)}
          >
            Replay
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
              Global totals
            </p>
            <p>
              Confirmed: <strong>{totals.confirmed}</strong> sats • Unconfirmed:
              <strong> {totals.unconfirmed}</strong> sats
            </p>
          </div>
        </div>
        <Separator />
        <div className="grid gap-3 md:grid-cols-2">
          {Object.keys(SHARD_SCRIPTHASHES).map((id) => {
            const shardId = Number(id);
            const summary = computeShardSummary(shardId);
            return (
              <div key={id} className="space-y-1 rounded-md border bg-card/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[0.75rem] font-medium">
                    Shard {shardId}
                  </span>
                  <span className="text-[0.7rem] text-muted-foreground">
                    UTXOs: {summary.utxoCount}
                  </span>
                </div>
                <p>
                  Confirmed: <strong>{summary.confirmed}</strong> sats
                </p>
                <p>
                  Unconfirmed: <strong>{summary.unconfirmed}</strong> sats
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
