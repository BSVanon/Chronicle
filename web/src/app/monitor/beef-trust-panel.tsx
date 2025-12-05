"use client";

import * as React from "react";

import { useBeefArchive } from "@/contexts/beef-archive-context";
import { useHeaderStore } from "@/contexts/header-store-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function BeefTrustPanel() {
  const { entries } = useBeefArchive();
  const { snapshot: headers } = useHeaderStore();

  const summary = React.useMemo(() => {
    const totalBundles = entries.length;
    const importedBundles = entries.filter((e) => e.origin === "imported").length;
    const syntheticSnapshots = entries.filter(
      (e) => e.origin === "synthetic_snapshot",
    ).length;

    const totalHeaders = headers.headers.length;
    const bestHeight = headers.bestHeight ?? null;

    return {
      totalBundles,
      importedBundles,
      syntheticSnapshots,
      totalHeaders,
      bestHeight,
    };
  }, [entries, headers]);

  if (summary.totalBundles === 0 && summary.totalHeaders === 0) {
    return null;
  }

  return (
    <Card className="mt-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>BEEF trust (local)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Snapshot of ingredients for offline verification: imported BEEF bundles
            and local block headers. Per-bundle proof checks and re-verification live
            in the Outputs tab; this panel only summarizes local counts.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Trust
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1 text-xs text-muted-foreground">
        <p>
          Archive bundles: <strong>{summary.totalBundles}</strong>
        </p>
        <p>
          Imported bundles: <strong>{summary.importedBundles}</strong> • Synthetic
          snapshots: <strong>{summary.syntheticSnapshots}</strong>
        </p>
        <p>
          Stored headers: <strong>{summary.totalHeaders}</strong>
        </p>
        <p>
          Best header height: <strong>{summary.bestHeight ?? "n/a"}</strong>
        </p>
      </CardContent>
    </Card>
  );
}
