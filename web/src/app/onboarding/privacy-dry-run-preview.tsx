"use client";

import * as React from "react";

import { planListUnspentShielded } from "@/core/providers/shielded-provider";
import { executePrivacyShieldPlan } from "@/core/privacy/privacy-executor";
import type { PrivacyShieldContext } from "@/core/privacy/privacy-shield";
import { usePrivacyProfile } from "@/contexts/privacy-profile-context";
import { useWatchOnly } from "@/contexts/watch-only-context";
import { useSentinelConfig } from "@/contexts/sentinel-config-context";
import { useGuardedFetch } from "@/hooks/use-guarded-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const DEMO_SCRIPTHASHES: string[] = [
  "demo-scripthash-0",
  "demo-scripthash-1",
  "demo-scripthash-2",
  "demo-scripthash-3",
  "demo-scripthash-4",
  "demo-scripthash-5",
];

export function PrivacyDryRunPreview() {
  const [timestamp] = React.useState(() => Date.now());
  const [summary, setSummary] = React.useState<
    | {
        totalReal: number;
        totalChaff: number;
        batches: {
          index: number;
          sendAtOffsetMs: number;
          realCount: number;
          chaffCount: number;
        }[];
      }
    | null
  >(null);

  const [running, setRunning] = React.useState(false);
  const [executing, setExecuting] = React.useState(false);
  const [executionSummary, setExecutionSummary] = React.useState<
    | {
        realQueries: number;
        okCount: number;
        errorCount: number;
        totalUtxos: number;
        errorMessage?: string;
      }
    | null
  >(null);
  const { profile } = usePrivacyProfile();
  const { scripthashes } = useWatchOnly();
  const { config } = useSentinelConfig();
  const guardedFetch = useGuardedFetch();

  const usingWatchOnly = scripthashes.length > 0;
  const sourceCount = usingWatchOnly
    ? scripthashes.length
    : DEMO_SCRIPTHASHES.length;

  const handlePreview = React.useCallback(() => {
    setRunning(true);
    try {
      const context: PrivacyShieldContext = {
        endpoint: "https://provider.example.com/utxo",
        nowMs: timestamp,
        lookupsUsedLastHour: 0,
      };

      const sources = usingWatchOnly ? scripthashes : DEMO_SCRIPTHASHES;

      const plan = planListUnspentShielded(
        sources,
        context,
        profile.shieldOverrides,
      );

      const batches = plan.batches.map((batch, index) => {
        const realCount = batch.queries.filter((q) => !q.isChaff).length;
        const chaffCount = batch.queries.filter((q) => q.isChaff).length;
        const sendAtOffsetMs = batch.sendAtMs - timestamp;
        return { index, sendAtOffsetMs, realCount, chaffCount };
      });

      setSummary({
        totalReal: plan.totalReal,
        totalChaff: plan.totalChaff,
        batches,
      });
    } finally {
      setRunning(false);
    }
  }, [timestamp, profile.shieldOverrides, usingWatchOnly, scripthashes]);

  const handleLiveTest = React.useCallback(async () => {
    if (!config?.baseUrl) {
      setExecutionSummary({
        realQueries: 0,
        okCount: 0,
        errorCount: 0,
        totalUtxos: 0,
        errorMessage: "Pair a Sentinel in Settings to run a live test.",
      });
      return;
    }

    const sources = usingWatchOnly ? scripthashes : DEMO_SCRIPTHASHES;

    setExecuting(true);
    setExecutionSummary(null);
    try {
      const url = new URL(config.baseUrl);
      url.pathname = "/v1/shielded-query";
      url.search = "";
      url.hash = "";

      const context: PrivacyShieldContext = {
        endpoint: url.toString(),
        nowMs: Date.now(),
        lookupsUsedLastHour: 0,
      };

      const plan = planListUnspentShielded(
        sources,
        context,
        profile.shieldOverrides,
      );

      const result = await executePrivacyShieldPlan(
        plan,
        { fetch: guardedFetch },
        { requestTimeoutMs: 10_000 },
      );

      const allResults = result.batches.flatMap((batch) => batch.results);
      const realProofs = allResults.filter(
        (r) => !r.isChaff && r.kind === "tx-proof",
      );

      let okCount = 0;
      let errorCount = 0;
      let totalUtxos = 0;

      for (const r of realProofs) {
        if (r.ok && r.body && typeof (r.body as any).ok === "boolean") {
          if ((r.body as any).ok) {
            okCount += 1;
            const utxos = (r.body as any).utxos;
            if (Array.isArray(utxos)) {
              totalUtxos += utxos.length;
            }
          } else {
            errorCount += 1;
          }
        } else if (!r.ok) {
          errorCount += 1;
        }
      }

      setExecutionSummary({
        realQueries: realProofs.length,
        okCount,
        errorCount,
        totalUtxos,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExecutionSummary({
        realQueries: 0,
        okCount: 0,
        errorCount: 0,
        totalUtxos: 0,
        errorMessage: message,
      });
    } finally {
      setExecuting(false);
    }
  }, [
    config?.baseUrl,
    usingWatchOnly,
    scripthashes,
    profile.shieldOverrides,
    guardedFetch,
  ]);

  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>
        This dry run uses your current watch-only material when available, or a
        small demo set otherwise, together with your active privacy profile
        settings. The preview below does not perform any network requests; it
        only shows what batches would be scheduled. You can optionally run a
        live test against your paired Sentinel.
      </p>
      <p className="text-xs text-muted-foreground">
        Active profile: <strong>{profile.name}</strong> • Source
        scripthashes: <strong>{sourceCount}</strong>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handlePreview} disabled={running || executing}>
          {running ? "Computing..." : "Run dry-run preview"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleLiveTest}
          disabled={executing}
        >
          {executing ? "Running live test..." : "Run live test against Sentinel"}
        </Button>
      </div>
      {summary && (
        <div className="space-y-2 rounded-md border bg-card/60 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="uppercase tracking-wide">
              Outbound summary
            </Badge>
            <span>
              Real lookups: <strong>{summary.totalReal}</strong> • Chaff:
              <strong> {summary.totalChaff}</strong>
            </span>
          </div>
          <Separator className="my-2" />
          <div className="space-y-1">
            {summary.batches.map((batch) => (
              <div key={batch.index} className="flex items-center justify-between">
                <span>
                  Batch {batch.index + 1}: {batch.realCount} real / {batch.chaffCount} chaff
                </span>
                <span className="text-[0.7rem] text-muted-foreground">
                  +{Math.max(0, Math.round(batch.sendAtOffsetMs / 1000))}s
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {executionSummary && (
        <div className="space-y-2 rounded-md border bg-card/60 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="uppercase tracking-wide">
              Live Sentinel test
            </Badge>
            <span>
              Real tx-proof queries: <strong>{executionSummary.realQueries}</strong>
            </span>
          </div>
          <Separator className="my-2" />
          <div className="space-y-1">
            <p>
              Successful responses: <strong>{executionSummary.okCount}</strong> •
              Errors: <strong>{executionSummary.errorCount}</strong>
            </p>
            <p>
              Total UTXOs returned across successful queries: {" "}
              <strong>{executionSummary.totalUtxos}</strong>
            </p>
            {executionSummary.errorMessage && (
              <p className="text-[0.7rem] text-muted-foreground">
                Note: {executionSummary.errorMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
