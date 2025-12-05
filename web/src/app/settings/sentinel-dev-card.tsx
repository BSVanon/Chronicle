"use client";

import * as React from "react";

import { useNetworkMode } from "@/contexts/network-mode-context";
import { OfflineBlockedError } from "@/core/net/offline-gate";
import type { SentinelConfig } from "@/core/sentinel/types";
import { useSentinelClient } from "@/hooks/use-sentinel-client";
import { useSentinelConfig } from "@/contexts/sentinel-config-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const DEV_SENTINEL_CONFIG: SentinelConfig = {
  baseUrl: "https://sentinel.example.com",
};

export function SentinelDevCard() {
  const { mode } = useNetworkMode();
  const { config } = useSentinelConfig();
  const effectiveConfig: SentinelConfig = config ?? DEV_SENTINEL_CONFIG;
  const client = useSentinelClient(effectiveConfig);
  const [running, setRunning] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const handleTest = React.useCallback(async () => {
    setRunning(true);
    setMessage(null);
    try {
      const result = await client.registerShard({
        walletId: "dev-wallet",
        shardId: 0,
        scripthashes: [],
        ttlSec: 60,
      });
      if (result.ok) {
        setMessage("registerShard succeeded (this would talk to Sentinel in a real setup).");
      } else {
        setMessage(`registerShard returned ok=false: ${result.message ?? "unknown error"}`);
      }
    } catch (error) {
      if (error instanceof OfflineBlockedError) {
        setMessage("Blocked by offline gate (expected in offline mode).");
      } else if (error instanceof Error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage("Unknown error invoking Sentinel stub.");
      }
    } finally {
      setRunning(false);
    }
  }, [client]);

  const hasRealSentinel = !!config?.baseUrl;

  // Offline: always allowed to test the gate (calls will be blocked).
  // online_shielded: only allow calls if a real Sentinel URL has been paired.
  const canRun = mode === "offline" || (mode === "online_shielded" && hasRealSentinel);

  const buttonLabel = running
    ? "Testing..."
    : mode === "offline"
      ? "Test offline gate"
      : !hasRealSentinel
        ? "Pair Sentinel first"
        : "Call Sentinel registerShard";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Sentinel dev-only test</CardTitle>
          <p className="text-xs text-muted-foreground">
            Uses the same Sentinel client that production will, but wired through
            Chronicle&apos;s offline gate. In Step 1 it is safe-guarded; no real
            Sentinel backend is expected.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Dev stub
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <p>
          Current network mode: <strong>{mode}</strong>
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canRun || running}
          onClick={handleTest}
          className="h-7 px-3 text-[0.75rem]"
        >
          {buttonLabel}
        </Button>
        {message && <p className="text-[0.7rem] text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}
