"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useWatchOnly } from "@/contexts/watch-only-context";
import { useBuckets } from "@/contexts/bucket-context";

export function WatchOnlyPanel() {
  const { raw, setRaw, analysis, scripthashes, warnings } = useWatchOnly();
  const { buckets } = useBuckets();

  const overlapCount = React.useMemo(() => {
    if (scripthashes.length === 0 || buckets.length === 0) return 0;
    const bucketHashes = new Set<string>();
    for (const bucket of buckets) {
      for (const hash of bucket.scripthashes) {
        bucketHashes.add(hash);
      }
    }
    return scripthashes.filter((sh) => bucketHashes.has(sh)).length;
  }, [scripthashes, buckets]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watch-only input</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="space-y-2">
          <Label htmlFor="watch-only">Paste watch-only material</Label>
          <Textarea
            id="watch-only"
            value={raw}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
              setRaw(event.target.value)
            }
            rows={6}
            placeholder="One item per line: xpub, addresses, or txids. Chronicle will classify this locally and derive scripthashes for bucket assignment."
            className="resize-y text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={analysis.isValid ? "default" : "outline"}>
            {analysis.kind.toUpperCase()} • {analysis.lineCount} lines
          </Badge>
          {analysis.addresses && analysis.addresses.length > 0 && (
            <span>{analysis.addresses.length} addresses detected</span>
          )}
          {analysis.txids && analysis.txids.length > 0 && (
            <span>{analysis.txids.length} txids detected</span>
          )}
        </div>
        {analysis.notes && <p className="text-xs text-muted-foreground">{analysis.notes}</p>}
        {warnings.length > 0 && (
          <ul className="text-[0.65rem] text-muted-foreground space-y-0.5">
            {warnings.map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
          </ul>
        )}
        <p className="text-[0.65rem] text-muted-foreground">
          Debug (local only): {scripthashes.length} derived scripthashes • {buckets.length} buckets •
          {" "}
          {overlapCount} overlaps with current bucket scripthashes.
        </p>
      </CardContent>
    </Card>
  );
}
