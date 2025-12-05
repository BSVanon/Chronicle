"use client";

import * as React from "react";

import { planListUnspentShielded } from "@/core/providers/shielded-provider";
import type { PrivacyShieldContext } from "@/core/privacy/privacy-shield";
import { usePrivacyProfile } from "@/contexts/privacy-profile-context";
import { useWatchOnly } from "@/contexts/watch-only-context";
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
  const { profile } = usePrivacyProfile();
  const { scripthashes } = useWatchOnly();

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

  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>
        This dry run uses your current watch-only material when available, or a
        small demo set otherwise, together with your active privacy profile
        settings. It does not perform any network requests; it only shows what
        batches would be scheduled.
      </p>
      <p className="text-xs text-muted-foreground">
        Active profile: <strong>{profile.name}</strong> • Source
        scripthashes: <strong>{sourceCount}</strong>
      </p>
      <Button size="sm" onClick={handlePreview} disabled={running}>
        {running ? "Computing..." : "Run dry-run preview"}
      </Button>
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
    </div>
  );
}
