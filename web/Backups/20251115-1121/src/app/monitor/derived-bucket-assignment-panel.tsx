"use client";

import * as React from "react";

import { runBasicDerivation } from "@/core/wallet/watch-only-derivation";
import { useWatchOnly } from "@/contexts/watch-only-context";
import { useBuckets } from "@/contexts/bucket-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DerivedBucketAssignmentPanel() {
  const { raw, analysis } = useWatchOnly();
  const { buckets, setBuckets } = useBuckets();

  const derivation = React.useMemo(
    () => runBasicDerivation(raw, analysis),
    [raw, analysis],
  );

  const derivedHashes = React.useMemo(() => {
    const set = new Set<string>();
    for (const entry of derivation.entries) {
      set.add(entry.scripthash);
    }
    return Array.from(set);
  }, [derivation.entries]);

  const [selection, setSelection] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    setSelection((prev) => {
      const next: Record<string, string> = {};
      for (const hash of derivedHashes) {
        next[hash] = prev[hash] ?? "";
      }
      return next;
    });
  }, [derivedHashes]);

  const handleChange = React.useCallback(
    (hash: string, bucketId: string) => {
      setSelection((prev) => ({ ...prev, [hash]: bucketId }));
    },
    [],
  );

  const handleApply = React.useCallback(() => {
    const updated = buckets.map((bucket) => {
      const existing = new Set(bucket.scripthashes);
      for (const [hash, bucketId] of Object.entries(selection)) {
        if (bucketId === bucket.id) {
          existing.add(hash);
        }
      }
      return { ...bucket, scripthashes: Array.from(existing) };
    });
    setBuckets(updated);
  }, [buckets, selection, setBuckets]);

  const hasDerived = derivedHashes.length > 0;

  return (
    <Card className="mt-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Derived bucket assignment (dev)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Map derived watch-only scripthashes into your current buckets. This
            only updates local bucket metadata and never leaves the device.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Dev
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        {!hasDerived ? (
          <p>
            No derived scripthashes yet. Paste a few legacy addresses into the
            onboarding watch-only panel to enable assignment.
          </p>
        ) : (
          <>
            <p>
              Derived scripthashes: <strong>{derivedHashes.length}</strong>
            </p>
            <div className="space-y-2 max-h-48 overflow-auto rounded border bg-card/60 p-2">
              {derivedHashes.map((hash) => (
                <div
                  key={hash}
                  className="flex items-center justify-between gap-2 text-[0.7rem]"
                >
                  <span className="font-mono">
                    {hash.slice(0, 10)}...{hash.slice(-6)}
                  </span>
                  <select
                    className="h-7 rounded border bg-background px-2 text-[0.7rem]"
                    value={selection[hash] ?? ""}
                    onChange={(e) => handleChange(hash, e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {buckets.map((bucket) => (
                      <option key={bucket.id} value={bucket.id}>
                        {bucket.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-3 text-[0.75rem]"
              disabled={!hasDerived}
              onClick={handleApply}
            >
              Apply bucket mappings
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
