"use client";

import * as React from "react";

import { useBuckets } from "@/contexts/bucket-context";
import { useShardConfig } from "@/contexts/shard-config-context";
import { planShardsFromBuckets } from "@/core/sentinel/shard-planner";

export function ShardBoardSummary() {
  const { buckets } = useBuckets();
  const { config } = useShardConfig();

  const plan = React.useMemo(
    () => planShardsFromBuckets(buckets, config.shardCount),
    [buckets, config.shardCount],
  );

  if (plan.totalScripthashes === 0) {
    return (
      <p className="text-[0.7rem] text-muted-foreground">
        No tracked scripthashes assigned to buckets yet. Once you import watch-only
        inputs and/or BEEF archives and map them to buckets, Chronicle will derive a
        shard plan here.
      </p>
    );
  }

  return (
    <p className="text-[0.7rem] text-muted-foreground">
      Shard plan: <strong>{plan.shards.length}</strong> shard(s) covering
      {" "}
      <strong>{plan.totalScripthashes}</strong> tracked scripthash(es) based on
      current buckets and shard config.
    </p>
  );
}
