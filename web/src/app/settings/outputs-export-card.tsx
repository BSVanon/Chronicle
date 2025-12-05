"use client";

import * as React from "react";

import { useBuckets } from "@/contexts/bucket-context";
import { useBeefArchive } from "@/contexts/beef-archive-context";
import { buildProofArchiveFromBeefArchive } from "@/core/proof/archive";
import { usePrivacyProfile } from "@/contexts/privacy-profile-context";
import { useNetworkMode } from "@/contexts/network-mode-context";
import { useShardConfig } from "@/contexts/shard-config-context";
import { useTrackedOutpoints } from "@/contexts/tracked-outpoints-context";
import { useSentinelConfig } from "@/contexts/sentinel-config-context";
import { useHeaderStore } from "@/contexts/header-store-context";
import { useUtxoStream } from "@/contexts/utxo-stream-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function OutputsExportCard() {
  const { buckets } = useBuckets();
  const { entries } = useBeefArchive();
  const { profile, effectiveShield } = usePrivacyProfile();
  const { mode } = useNetworkMode();
  const { config: shardConfig } = useShardConfig();
  const { outpoints } = useTrackedOutpoints();
  const { config: sentinelConfig } = useSentinelConfig();
  const { snapshot: headerSnapshot } = useHeaderStore();
  const { engine, streamSource, lastEventAt, eventCount } = useUtxoStream();

  const [snapshot, setSnapshot] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const handleGenerate = React.useCallback(() => {
    const engineTotals = engine.getTotals();
    const engineState = engine.snapshot();
    const byScripthash = Array.from(engineState.byScripthash.entries()).map(
      ([scripthash, bucket]) => ({
        scripthash,
        utxos: Array.from(bucket.values()),
      }),
    );

    const proofArchive = buildProofArchiveFromBeefArchive(entries);

    const payload = {
      version: 1 as const,
      generatedAt: Date.now(),
      profile: {
        id: profile.id,
        name: profile.name,
        description: profile.description,
      },
      effectiveShield,
      networkMode: mode,
      shardConfig,
      sentinel: sentinelConfig,
      buckets,
      beefArchive: entries,
      proofArchive,
      headers: headerSnapshot,
      trackedOutpoints: outpoints,
      utxoEngine: {
        totals: engineTotals,
        byScripthash,
        stream: {
          source: streamSource,
          eventCount,
          lastEventAt,
        },
      },
    };
    setSnapshot(JSON.stringify(payload, null, 2));
    setCopied(false);
  }, [
    buckets,
    entries,
    profile,
    effectiveShield,
    mode,
    shardConfig,
    sentinelConfig,
    headerSnapshot,
    outpoints,
    engine,
    streamSource,
    lastEventAt,
    eventCount,
  ]);

  const handleCopy = React.useCallback(async () => {
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(snapshot);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [snapshot]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Outputs export (JSON)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Generate a local-only JSON snapshot of your current profile,
            network mode, Sentinel URL, shard config, buckets, tracked
            outpoints, BEEF archive, header store, proof archive, and UTXO
            engine state. You can copy this snapshot and store it offline;
            nothing is sent anywhere.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-3 text-[0.75rem]"
            onClick={handleGenerate}
          >
            Generate snapshot
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-3 text-[0.75rem]"
            disabled={!snapshot}
            onClick={handleCopy}
          >
            {copied ? "Copied" : "Copy to clipboard"}
          </Button>
        </div>
        <textarea
          className="mt-2 h-48 w-full rounded-md border bg-background p-2 font-mono text-[0.7rem]"
          value={snapshot}
          onChange={(e) => setSnapshot(e.target.value)}
          spellCheck={false}
        />
      </CardContent>
    </Card>
  );
}
