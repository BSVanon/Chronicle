"use client";

import * as React from "react";

import type { UtxoDeltaEvent } from "@/core/sentinel/types";
import type { SentinelStreamHandle } from "@/core/sentinel/client";
import { planShardsFromBuckets } from "@/core/sentinel/shard-planner";
import { buildShardRegisterRequests } from "@/core/sentinel/register-planner";
import { useBuckets } from "@/contexts/bucket-context";
import { useShardConfig } from "@/contexts/shard-config-context";
import { useNetworkMode } from "@/contexts/network-mode-context";
import { useSentinelConfig } from "@/contexts/sentinel-config-context";
import { useUtxoStream } from "@/contexts/utxo-stream-context";
import { useSentinelClient } from "@/hooks/use-sentinel-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function SentinelStreamDevPanel() {
  const { buckets } = useBuckets();
  const { config: shardConfig } = useShardConfig();
  const { mode } = useNetworkMode();
  const { config: sentinelConfig } = useSentinelConfig();

  const { engine, recentEvents, applyEvent, reset, setStreamSource } = useUtxoStream();

  const [walletId, setWalletId] = React.useState("local-dev-wallet");
  const [running, setRunning] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const handlesRef = React.useRef<SentinelStreamHandle[]>([]);

  const plan = React.useMemo(
    () => planShardsFromBuckets(buckets, shardConfig.shardCount),
    [buckets, shardConfig.shardCount],
  );

  const requests = React.useMemo(
    () => buildShardRegisterRequests(walletId, shardConfig, plan),
    [walletId, shardConfig, plan],
  );

  const hasRealSentinel = !!sentinelConfig?.baseUrl;
  const effectiveConfig = sentinelConfig ?? { baseUrl: "https://sentinel.example.com" };
  const client = useSentinelClient(effectiveConfig);

  React.useEffect(() => {
    return () => {
      handlesRef.current.forEach((handle) => handle.close());
      handlesRef.current = [];
    };
  }, []);

  const handleStart = React.useCallback(async () => {
    if (!hasRealSentinel) {
      setStatus("Pair a Sentinel in Settings before opening a live stream.");
      return;
    }

    if (mode !== "online_shielded") {
      setStatus("Switch network mode to online_shielded to talk to your Sentinel.");
      return;
    }

    if (requests.length === 0) {
      setStatus("No shard registrations to send yet. Ensure buckets have scripthashes.");
      return;
    }

    setRunning(true);
    setStatus(null);

    handlesRef.current.forEach((handle) => handle.close());
    handlesRef.current = [];
    reset();

    try {
      for (const req of requests) {
        const res = await client.registerShard(req);
        if (!res.ok) {
          setStatus(
            `registerShard failed for shard ${req.shardId}: ${res.message ?? "unknown error"}`,
          );
        }
      }

      const newHandles: SentinelStreamHandle[] = [];

      for (const req of requests) {
        const handle = client.openShardStream(
          req.walletId,
          req.shardId,
          (event) => {
            applyEvent(event);
          },
          (error) => {
            setStatus((prev) => {
              const base = "Stream error from Sentinel. Check browser console for details.";
              if (!prev || prev === base) return base;
              return prev;
            });
            console.error("Sentinel stream error", error);
          },
        );
        newHandles.push(handle);
      }

      handlesRef.current = newHandles;
      setStreamSource("sentinel");
      setStatus(`Registered ${requests.length} shard(s) and opened stream(s).`);
    } catch (error) {
      if (error instanceof Error) {
        setStatus(`Error while registering shards: ${error.message}`);
      } else {
        setStatus("Unknown error while registering shards.");
      }
    } finally {
      setRunning(false);
    }
  }, [client, hasRealSentinel, mode, requests]);

  const totals = engine.getTotals();

  const canRun =
    !running &&
    hasRealSentinel &&
    mode === "online_shielded" &&
    requests.length > 0;

  return (
    <Card className="mt-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Sentinel live stream (dev)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Dev-only wiring that sends the current shard plan to your self-deployed
            Sentinel and opens a /v1/stream WebSocket. Incoming UTXO deltas are
            applied to a local UTXO engine in this panel.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Dev stream
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <div className="space-y-1">
          <p>
            Current network mode: <strong>{mode}</strong>
          </p>
          <p>
            Sentinel: <strong>{hasRealSentinel ? sentinelConfig?.baseUrl : "not paired"}</strong>
          </p>
        </div>
        <Separator />
        <div className="space-y-1">
          <label className="text-[0.75rem] font-medium">Wallet ID</label>
          <Input
            className="h-7 text-[0.8rem]"
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
          />
          <p className="text-[0.7rem] text-muted-foreground">
            This ID is sent to your Sentinel with each shard registration and
            used as the wallet_id on the WebSocket stream.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[0.75rem]">
            Planned registrations from current buckets and shard config:
            <strong> {requests.length}</strong>
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canRun}
          onClick={handleStart}
          className="h-7 px-3 text-[0.75rem]"
        >
          {running ? "Registering & opening stream..." : "Register shards & open stream"}
        </Button>
        {status && <p className="text-[0.7rem] text-muted-foreground">{status}</p>}
        <Separator />
        <div className="space-y-2">
          <p className="text-[0.75rem] font-medium">Live engine totals</p>
          <p>
            Confirmed: <strong>{totals.confirmed}</strong> sats • Unconfirmed:
            <strong> {totals.unconfirmed}</strong> sats
          </p>
        </div>
        {recentEvents.length > 0 && (
          <div className="space-y-2">
            <Separator />
            <p className="text-[0.75rem] font-medium">Recent Sentinel events</p>
            <div className="space-y-1">
              {recentEvents.map((event, index) => {
                const added = event.add.reduce((sum, utxo) => sum + utxo.satoshis, 0);
                const removed = event.remove.reduce((sum, utxo) => sum + utxo.satoshis, 0);
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md border bg-card/60 px-2 py-1.5"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.7rem] font-medium">
                          Event {index + 1}
                        </span>
                        <span className="text-[0.65rem] text-muted-foreground">
                          {event.scripthash}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[0.7rem]">
                        {added > 0 && <span>+{added} sats inflow</span>}
                        {removed > 0 && <span>-{removed} sats outflow</span>}
                        {added === 0 && removed === 0 && (
                          <span className="text-muted-foreground">no net change</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
