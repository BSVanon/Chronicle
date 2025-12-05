"use client";

import * as React from "react";

import type { UtxoDeltaEvent } from "@/core/sentinel/types";
import { useUtxoStream } from "@/contexts/utxo-stream-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type EventSummary = {
  index: number;
  scripthash: string;
  type: "inflow" | "outflow" | "both" | "none";
  added: number;
  removed: number;
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
  const { recentEvents } = useUtxoStream();

  const summaries = React.useMemo(
    () => recentEvents.map((event, index) => summarizeEvent(event, index)),
    [recentEvents],
  );

  if (summaries.length === 0) {
    return null;
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
          Stream
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <Separator />
        <div className="space-y-1">
          {summaries.map((summary) => (
            <div
              key={summary.index}
              className="flex items-center justify-between rounded-md border bg-card/60 px-2 py-1.5"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[0.7rem] font-medium">
                    Event {summary.index + 1}
                  </span>
                  <span className="text-[0.65rem] text-muted-foreground">
                    {summary.scripthash}
                  </span>
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
