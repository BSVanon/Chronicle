"use client";

import { useBuckets } from "@/contexts/bucket-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function BucketsSettingsCard() {
  const { buckets } = useBuckets();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buckets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Buckets are local-only labels that group scripthashes into views like
          <strong> Cold</strong>, <strong> Hot</strong>, or project-specific
          wallets. Providers never see bucket names or totals.
        </p>
        {buckets.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No buckets defined yet. Chronicle currently uses a small demo
            configuration; a full bucket editor will land here later.
          </p>
        ) : (
          <div className="space-y-2 text-xs">
            {buckets.map((bucket) => (
              <div
                key={bucket.id}
                className="flex items-center justify-between rounded-md border bg-card/60 px-2 py-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.75rem] font-medium">
                      {bucket.label}
                    </span>
                    <Badge variant="outline" className="text-[0.65rem]">
                      {bucket.id}
                    </Badge>
                  </div>
                  {bucket.description && (
                    <p className="text-[0.7rem] text-muted-foreground">
                      {bucket.description}
                    </p>
                  )}
                </div>
                <div className="text-right text-[0.7rem] text-muted-foreground">
                  <p>Scripthashes: {bucket.scripthashes.length}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[0.7rem] text-muted-foreground">
          Editing, adding, and removing buckets is stubbed for now; this view is
          a read-only window into Chronicle&apos;s local bucket metadata.
        </p>
      </CardContent>
    </Card>
  );
}
