"use client";

import * as React from "react";

import { planShardsFromBuckets } from "@/core/sentinel/shard-planner";
import { useBuckets } from "@/contexts/bucket-context";
import { useShardConfig } from "@/contexts/shard-config-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function ShardPlanningDevPanel() {
  const { buckets } = useBuckets();
  const { config, updateConfig } = useShardConfig();

  const plan = React.useMemo(
    () => planShardsFromBuckets(buckets, config.shardCount),
    [buckets, config.shardCount],
  );

  const handleShardCountChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseInt(e.target.value, 10);
      if (Number.isNaN(value)) {
        updateConfig({ shardCount: 1 });
      } else {
        updateConfig({ shardCount: value });
      }
    },
    [updateConfig],
  );

  return (
    <Card className="mt-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Shard planning (dev)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Local-only planner that shows how current bucket scripthashes would
            be distributed across Sentinel shards. No registrations are sent.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Dev
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2 text-[0.75rem]">
          <span className="whitespace-nowrap">Shard count</span>
          <Input
            type="number"
            min={1}
            max={16}
            value={config.shardCount}
            onChange={handleShardCountChange}
            className="h-7 w-20 px-2 text-[0.75rem]"
          />
          <span className="text-[0.7rem] text-muted-foreground">
            Total scripthashes: <strong>{plan.totalScripthashes}</strong>
          </span>
          <span className="text-[0.7rem] text-muted-foreground">
            TTL: <strong>{config.ttlSec}</strong>s • Seed: <strong>{config.seed}</strong>
          </span>
        </div>
        {plan.shards.length === 0 ? (
          <p>No shards planned yet.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            {plan.shards.map((shard) => {
              const total = shard.scripthashes.length;
              return (
                <div
                  key={shard.shardId}
                  className="space-y-1 rounded-md border bg-card/60 p-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[0.75rem] font-medium">
                      Shard {shard.shardId}
                    </span>
                    <span className="text-[0.7rem] text-muted-foreground">
                      Scripthashes: {total}
                    </span>
                  </div>
                  {total === 0 ? (
                    <p className="text-[0.7rem] text-muted-foreground">
                      Empty shard.
                    </p>
                  ) : (
                    <div className="space-y-1 text-[0.7rem]">
                      <p>Per-bucket counts:</p>
                      <ul className="ml-4 list-disc">
                        {Object.entries(shard.bucketCounts).map(
                          ([bucketId, count]) => (
                            <li key={bucketId}>
                              {bucketId}: {count}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
