"use client";

import * as React from "react";

import { useBuckets } from "@/contexts/bucket-context";
import { useTrackedOutpoints } from "@/contexts/tracked-outpoints-context";
import { useUtxoStream } from "@/contexts/utxo-stream-context";
import { useNetworkMode } from "@/contexts/network-mode-context";
import { useSentinelConfig } from "@/contexts/sentinel-config-context";
import { useSentinelClient } from "@/hooks/use-sentinel-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ScrubCard() {
  const { buckets, setBuckets } = useBuckets();
  const { outpoints, clearOutpoints } = useTrackedOutpoints();
  const { reset, setStreamSource } = useUtxoStream();
  const { mode } = useNetworkMode();
  const { config: sentinelConfig } = useSentinelConfig();

  const [walletId, setWalletId] = React.useState("local-dev-wallet");
  const [running, setRunning] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const hasRealSentinel = !!sentinelConfig?.baseUrl;
  const effectiveConfig = sentinelConfig ?? { baseUrl: "https://sentinel.example.com" };
  const client = useSentinelClient(effectiveConfig);

  const handleLocalScrub = React.useCallback(() => {
    // Clear local UTXO engine state and tracked outpoints.
    reset();
    setStreamSource("none");
    clearOutpoints();

    // Clear bucket scripthash assignments but keep labels/descriptions.
    setBuckets(
      buckets.map((bucket) => ({
        ...bucket,
        scripthashes: [],
      })),
    );

    setStatus("Local state cleared: engine, tracked outpoints, and bucket assignments.");
  }, [reset, setStreamSource, clearOutpoints, setBuckets, buckets]);

  const handleFullScrub = React.useCallback(async () => {
    setRunning(true);
    setStatus(null);

    try {
      if (hasRealSentinel && mode === "online_shielded" && walletId.trim().length) {
        try {
          const result = await client.deleteWallet(walletId.trim());
          if (result.ok) {
            setStatus(
              "Sentinel wallet drop requested and local state cleared for this wallet.",
            );
          } else {
            setStatus(`Sentinel wallet drop failed: ${result.message ?? "unknown error"}`);
          }
        } catch (error) {
          if (error instanceof Error) {
            setStatus(`Sentinel wallet drop error: ${error.message}`);
          } else {
            setStatus("Unknown error during Sentinel wallet drop.");
          }
        }
      } else {
        setStatus(
          "Skipped Sentinel wallet drop (either offline, not paired, or no wallet id). Local state will still be cleared.",
        );
      }

      handleLocalScrub();
    } finally {
      setRunning(false);
    }
  }, [client, sentinelConfig, mode, walletId, handleLocalScrub]);

  const canScrub = !running;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Scrub &amp; reset (local)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Clear Chronicle&apos;s local monitoring state (UTXO engine, tracked
            outpoints, and bucket assignments). Optionally drop Sentinel wallet
            state when online_shielded and paired.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <div className="space-y-1">
          <p>
            Current mode: <strong>{mode}</strong>
          </p>
          <p>
            Sentinel: <strong>{sentinelConfig?.baseUrl ?? "not paired"}</strong>
          </p>
          <p>
            Tracked outpoints: <strong>{outpoints.length}</strong>
          </p>
          <p>
            Buckets with assignments: <strong>{buckets.filter((b) => b.scripthashes.length > 0).length}</strong>
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-[0.75rem] font-medium">Sentinel wallet id (optional)</label>
          <input
            className="h-7 w-full rounded-md border bg-background px-2 text-[0.8rem]"
            type="text"
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
          />
          <p className="text-[0.7rem] text-muted-foreground">
            If set, Chronicle will request a wallet drop on your Sentinel before
            clearing local state when you run a full scrub.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-3 text-[0.75rem]"
            onClick={handleLocalScrub}
            disabled={!canScrub}
          >
            Clear local only
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-3 text-[0.75rem]"
            onClick={handleFullScrub}
            disabled={!canScrub}
          >
            Full scrub (Sentinel + local)
          </Button>
        </div>
        {status && <p className="text-[0.7rem] text-muted-foreground">{status}</p>}
      </CardContent>
    </Card>
  );
}
