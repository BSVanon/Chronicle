"use client";

import * as React from "react";

import { useHeaderStore } from "@/contexts/header-store-context";
import { useUtxoStream } from "@/contexts/utxo-stream-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function HeaderCoveragePanel() {
  const { snapshot } = useHeaderStore();
  const { engine } = useUtxoStream();

  const summary = React.useMemo(() => {
    const headerHeights = new Set(snapshot.headers.map((h) => h.height));
    const allUtxos = engine.getAllUtxos();

    let withHeight = 0;
    let covered = 0;

    for (const utxo of allUtxos) {
      if (typeof utxo.height === "number" && utxo.height > 0) {
        withHeight += 1;
        if (headerHeights.has(utxo.height)) {
          covered += 1;
        }
      }
    }

    const coveragePercent =
      withHeight === 0 ? null : Math.round((covered / withHeight) * 100);

    const bestHeight = snapshot.bestHeight;

    return {
      totalHeaders: snapshot.headers.length,
      bestHeight,
      utxosWithHeight: withHeight,
      utxosCovered: covered,
      coveragePercent,
    };
  }, [snapshot, engine]);

  if (summary.totalHeaders === 0 && summary.utxosWithHeight === 0) {
    return null;
  }

  return (
    <Card className="mt-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Header coverage</CardTitle>
          <p className="text-xs text-muted-foreground">
            Local-only view of stored headers compared to UTXOs with known block
            heights in the current engine snapshot.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Headers
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        <p>
          Stored headers: <strong>{summary.totalHeaders}</strong>
        </p>
        <p>
          Best height: <strong>{summary.bestHeight ?? "n/a"}</strong>
        </p>
        <p>
          UTXOs with height: <strong>{summary.utxosWithHeight}</strong>
        </p>
        <p>
          UTXOs covered by headers: <strong>{summary.utxosCovered}</strong>
        </p>
        {summary.coveragePercent !== null && (
          <p>
            Approx header coverage for current UTXOs: <strong>{summary.coveragePercent}</strong>%
          </p>
        )}
      </CardContent>
    </Card>
  );
}
