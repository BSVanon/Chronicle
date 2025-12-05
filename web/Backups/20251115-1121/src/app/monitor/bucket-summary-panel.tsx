"use client";

import * as React from "react";

import { useBuckets } from "@/contexts/bucket-context";
import { useUtxoStream } from "@/contexts/utxo-stream-context";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function BucketSummaryPanel() {
  const { buckets } = useBuckets();
  const { engine } = useUtxoStream();

  const summaries = React.useMemo(() => {
    return buckets.map((bucket) => {
      let confirmed = 0;
      let unconfirmed = 0;

      for (const hash of bucket.scripthashes) {
        const utxos = engine.getUtxosForScripthash(hash);
        for (const utxo of utxos) {
          const value = utxo.satoshis;
          if (utxo.height && utxo.height > 0) {
            confirmed += value;
          } else {
            unconfirmed += value;
          }
        }
      }

      return {
        bucketId: bucket.id,
        label: bucket.label,
        confirmed,
        unconfirmed,
      };
    });
  }, [engine, buckets]);

  const showEmpty = summaries.every((s) => s.confirmed === 0 && s.unconfirmed === 0);

  if (showEmpty) {
    return (
      <p className="text-xs text-muted-foreground">
        No UTXOs in the local engine yet. Connect to a Sentinel or run the
        simulation below to see balances change.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Bucket summary
        </Badge>
        <span>
          Aggregated from the local UTXO engine using current bucket assignments.
        </span>
      </div>
      <Separator className="my-2" />
      <div className="grid gap-2 md:grid-cols-2">
        {summaries.map((summary) => (
          <div key={summary.bucketId} className="space-y-1 rounded-md border bg-card/60 p-2">
            <p className="text-[0.75rem] font-medium">{summary.label}</p>
            <p>
              Confirmed: <strong>{summary.confirmed}</strong> sats
            </p>
            <p>
              Unconfirmed: <strong>{summary.unconfirmed}</strong> sats
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
