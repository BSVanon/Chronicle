"use client";

import * as React from "react";

import { useBeefArchive } from "@/contexts/beef-archive-context";
import { useBuckets } from "@/contexts/bucket-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function BeefCoveragePanel() {
  const { entries } = useBeefArchive();
  const { buckets } = useBuckets();

  const summary = React.useMemo(() => {
    const totalBundles = entries.length;
    const totalArchiveUtxos = entries.reduce((sum, e) => sum + e.utxoCount, 0);
    const totalArchiveScripthashes = entries.reduce(
      (sum, e) => sum + e.scripthashCount,
      0,
    );

    const trackedSet = new Set<string>();
    for (const bucket of buckets) {
      for (const hash of bucket.scripthashes) {
        trackedSet.add(hash);
      }
    }
    const totalTrackedScripthashes = trackedSet.size;

    const approxCovered = Math.min(
      totalArchiveScripthashes,
      totalTrackedScripthashes,
    );

    const coveragePercent =
      totalTrackedScripthashes === 0
        ? null
        : Math.round((approxCovered / totalTrackedScripthashes) * 100);

    const perBucket = buckets.map((bucket) => {
      const tracked = bucket.scripthashes.length;
      const share =
        totalTrackedScripthashes === 0
          ? 0
          : approxCovered * (tracked / totalTrackedScripthashes);
      const approxBucketCovered = Math.round(share);
      return {
        id: bucket.id,
        label: bucket.label,
        tracked,
        approxCovered: approxBucketCovered,
      };
    });

    return {
      totalBundles,
      totalArchiveUtxos,
      totalArchiveScripthashes,
      totalTrackedScripthashes,
      approxCovered,
      coveragePercent,
      perBucket,
    };
  }, [entries, buckets]);

  if (
    summary.totalBundles === 0 &&
    summary.totalTrackedScripthashes === 0
  ) {
    return null;
  }

  return (
    <Card className="mt-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>BEEF coverage</CardTitle>
          <p className="text-xs text-muted-foreground">
            Local-only summary of imported BEEF bundles compared to tracked
            scripthashes.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Archive
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <div className="space-y-1">
          <p>
            Bundles: <strong>{summary.totalBundles}</strong>
          </p>
          <p>
            Archived UTXOs: <strong>{summary.totalArchiveUtxos}</strong>
          </p>
          <p>
            Archived scripthashes: <strong>{summary.totalArchiveScripthashes}</strong>
          </p>
          <p>
            Tracked scripthashes: <strong>{summary.totalTrackedScripthashes}</strong>
          </p>
          {summary.coveragePercent !== null && (
            <p>
              Approx coverage: <strong>{summary.coveragePercent}</strong>%
            </p>
          )}
        </div>
        {summary.totalTrackedScripthashes > 0 && summary.totalBundles === 0 && (
          <p className="text-[0.7rem] text-muted-foreground">
            No BEEF archives imported yet. Use the BEEF archive import card on the
            Inputs tab to add bundles for your tracked buckets.
          </p>
        )}
        {summary.totalBundles > 0 &&
          summary.totalTrackedScripthashes > 0 &&
          summary.coveragePercent !== null &&
          summary.coveragePercent < 100 && (
            <p className="text-[0.7rem] text-muted-foreground">
              Coverage is partial. Import additional BEEF archives on Inputs to
              fill in more of your tracked buckets.
            </p>
          )}
        {summary.perBucket.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="space-y-2">
              <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                Buckets (approximate)
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {summary.perBucket.map((bucket) => (
                  <div
                    key={bucket.id}
                    className="space-y-1 rounded-md border bg-card/60 p-2"
                  >
                    <p className="text-[0.75rem] font-medium">
                      {bucket.label}
                    </p>
                    <p>
                      Tracked scripthashes: <strong>{bucket.tracked}</strong>
                    </p>
                    <p>
                      Approx covered scripthashes: <strong>{bucket.approxCovered}</strong>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
