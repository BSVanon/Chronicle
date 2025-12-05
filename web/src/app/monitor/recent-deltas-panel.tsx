"use client";

import * as React from "react";

import type { UtxoDeltaEvent } from "@/core/sentinel/types";
import { useUtxoStream } from "@/contexts/utxo-stream-context";
import { useBuckets } from "@/contexts/bucket-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type EventSummary = {
  index: number;
  scripthash: string;
  type: "inflow" | "outflow" | "both" | "none";
  added: number;
  removed: number;
  bucketLabels?: string[];
};

function summarizeEvent(event: UtxoDeltaEvent, index: number): EventSummary {
  const added = event.add.reduce((sum, utxo) => sum + utxo.satoshis, 0);
  const removed = event.remove.reduce((sum, utxo) => sum + utxo.satoshis, 0);

  let type: EventSummary["type"] = "none";
  if (added > 0 && removed > 0) type = "both";
  else if (added > 0) type = "inflow";
  else if (removed > 0) type = "outflow";

  return {
    index,
    scripthash: event.scripthash,
    type,
    added,
    removed,
  };
}

export function RecentDeltasPanel() {
  const { recentEvents, streamSource } = useUtxoStream();
  const { buckets } = useBuckets();

  const summaries = React.useMemo(
    () => recentEvents.map((event, index) => summarizeEvent(event, index)),
    [recentEvents],
  );

  const orderedSummaries = React.useMemo(
    () => [...summaries].reverse(),
    [summaries],
  );

  const summariesWithLabels = React.useMemo(
    () =>
      orderedSummaries.map((summary) => ({
        ...summary,
        bucketLabels: buckets
          .filter((bucket) => bucket.scripthashes.includes(summary.scripthash))
          .map((bucket) => bucket.label),
      })),
    [orderedSummaries, buckets],
  );

  if (summaries.length === 0) {
    const helperText =
      streamSource === "sentinel"
        ? "Stream is connected to your Sentinel, but no UTXO events have arrived yet. If this persists, confirm that your watch-only input produced scripthashes, they are assigned to buckets, and your Sentinel backend is returning UTXOs."
        : streamSource === "simulation"
          ? "Simulation stream is selected, but no events have been generated yet. Use the simulation controls to produce local-only deltas."
          : "No active stream. Open a Sentinel stream or start the simulation panel below to see recent UTXO deltas here.";

    return (
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle>Recent deltas</CardTitle>
            <p className="text-xs text-muted-foreground">
              Local-only view of the last few UTXO delta events that have been
              applied to Chronicle&apos;s UTXO engine.
            </p>
          </div>
          <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
            {streamSource === "sentinel"
              ? "Stream: Sentinel"
              : streamSource === "simulation"
                ? "Stream: Simulation"
                : "Stream: None"}
          </Badge>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          <p>{helperText}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Recent deltas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Local-only view of the last few UTXO delta events that have been
            applied to Chronicle&apos;s UTXO engine.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          {streamSource === "sentinel"
            ? "Stream: Sentinel"
            : streamSource === "simulation"
              ? "Stream: Simulation"
              : "Stream: None"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <Separator />
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {summariesWithLabels.map((summary) => (
            <div
              key={summary.index}
              className="flex items-center justify-between rounded-md border bg-card/60 px-2 py-1.5"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[0.7rem] font-medium">
                    {summary.scripthash}
                  </span>
                  {summary.bucketLabels && summary.bucketLabels.length > 0 && (
                    <span className="text-[0.65rem] text-muted-foreground">
                      Buckets: {summary.bucketLabels.join(", ")}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-[0.7rem]">
                  {summary.added > 0 && (
                    <span>
                      +{summary.added} sats inflow
                    </span>
                  )}
                  {summary.removed > 0 && (
                    <span>
                      -{summary.removed} sats outflow
                    </span>
                  )}
                  {summary.added === 0 && summary.removed === 0 && (
                    <span className="text-muted-foreground">no net change</span>
                  )}
                </div>
              </div>
              <div className="text-right text-[0.65rem]">
                <span className="uppercase tracking-wide text-muted-foreground">
                  {summary.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
