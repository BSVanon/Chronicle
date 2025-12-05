"use client";

import * as React from "react";

import { buildSyntheticBeefFromUtxos } from "@/core/beef";
import { entryFromBeefResult } from "@/core/beef/archive";
import { useBeefArchive } from "@/contexts/beef-archive-context";
import { useUtxoStream } from "@/contexts/utxo-stream-context";
import { usePrivacyProfile } from "@/contexts/privacy-profile-context";
import { useNetworkMode } from "@/contexts/network-mode-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function SnapshotCaptureCard() {
  const { engine, eventCount } = useUtxoStream();
  const { entries, addEntry } = useBeefArchive();
  const { profile } = usePrivacyProfile();
  const { mode } = useNetworkMode();

  const [status, setStatus] = React.useState<string | null>(null);

  const syntheticCount = React.useMemo(
    () => entries.filter((e) => e.origin === "synthetic_snapshot").length,
    [entries],
  );

  const handleCapture = React.useCallback(() => {
    const utxos = engine.getAllUtxos();
    if (utxos.length === 0) {
      setStatus("No UTXOs in engine yet; start a stream and wait for events.");
      return;
    }

    const importedAt = Date.now();
    const label = `${profile.name} / ${mode} @ ${new Date(importedAt).toISOString()}`;

    const result = buildSyntheticBeefFromUtxos(utxos, { label, importedAt });
    const entry = entryFromBeefResult(result, result.meta.scripthashCount);

    addEntry(entry);

    setStatus(
      `Captured ${entry.utxoCount} UTXOs across ${entry.scripthashCount} scripthashes.`,
    );
  }, [engine, profile.name, mode, addEntry]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Snapshot capture</CardTitle>
          <p className="text-xs text-muted-foreground">
            Capture the current UTXO engine into a synthetic BEEF-like bundle in the
            local archive. This only uses data already fetched via Sentinel.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Snapshot
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-3 text-[0.75rem]"
            onClick={handleCapture}
            disabled={eventCount === 0}
          >
            {eventCount === 0 ? "No UTXOs yet" : "Capture snapshot"}
          </Button>
          {syntheticCount > 0 && (
            <p className="text-[0.7rem] text-muted-foreground">
              Synthetic snapshots in archive: <strong>{syntheticCount}</strong>
            </p>
          )}
        </div>
        {status && (
          <p className="text-[0.7rem] text-muted-foreground">{status}</p>
        )}
      </CardContent>
    </Card>
  );
}
