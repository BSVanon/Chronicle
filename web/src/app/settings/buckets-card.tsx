"use client";

import * as React from "react";

import { useBuckets } from "@/contexts/bucket-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BucketsSettingsCard() {
  const { buckets, setBuckets } = useBuckets();

  const [isEditing, setIsEditing] = React.useState(false);

  const handleUpdateBucket = (
    id: string,
    patch: { label?: string; description?: string },
  ) => {
    setBuckets(
      buckets.map((bucket) =>
        bucket.id === id
          ? {
              ...bucket,
              ...patch,
            }
          : bucket,
      ),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buckets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Buckets are local-only labels that group scripthashes into simple
          views for your holdings. Providers never see bucket names or totals.
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Bucket labels and descriptions are local-only. Use edit mode to
            adjust them.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsEditing((value) => !value)}
          >
            {isEditing ? "Done" : "Edit labels & descriptions"}
          </Button>
        </div>
        {buckets.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No buckets defined yet. Chronicle will fall back to a simple
            three-bucket default if needed.
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
                    {isEditing ? (
                      <Input
                        className="h-7 max-w-[10rem] text-[0.75rem]"
                        value={bucket.label}
                        onChange={(e) =>
                          handleUpdateBucket(bucket.id, { label: e.target.value })
                        }
                        aria-label="Bucket label"
                      />
                    ) : (
                      <span className="text-[0.75rem] font-medium">
                        {bucket.label}
                      </span>
                    )}
                  </div>
                  {isEditing ? (
                    <Textarea
                      className="mt-1 h-12 w-full text-[0.7rem]"
                      placeholder="Optional description"
                      value={bucket.description ?? ""}
                      onChange={(e) =>
                        handleUpdateBucket(bucket.id, {
                          description: e.target.value,
                        })
                      }
                      aria-label="Bucket description"
                    />
                  ) : (
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                      {bucket.description || "No description set."}
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
          Bucket set (Cold / Hot-Alpha / Hot-Beta) is currently fixed. Label and
          description edits are live and local-only; adding, removing, and
          reordering buckets remains stubbed for now.
        </p>
      </CardContent>
    </Card>
  );
}
