import type { Scripthash } from "../providers/types";
import type { ShardId } from "./types";

export type BucketLike = {
  id: string;
  scripthashes: Scripthash[];
};

export type ShardBucketCounts = Record<string, number>;

export type ShardPlanShard = {
  shardId: ShardId;
  scripthashes: Scripthash[];
  bucketCounts: ShardBucketCounts;
};

export type ShardPlan = {
  shards: ShardPlanShard[];
  totalScripthashes: number;
};

export function planShardsFromBuckets(
  buckets: BucketLike[],
  shardCountInput: number,
): ShardPlan {
  const shardCount = Number.isFinite(shardCountInput) && shardCountInput > 0
    ? Math.floor(shardCountInput)
    : 1;

  const shardCountClamped = Math.max(1, Math.min(shardCount, 16));

  const hashToBuckets = new Map<Scripthash, Set<string>>();

  for (const bucket of buckets) {
    for (const hash of bucket.scripthashes) {
      let set = hashToBuckets.get(hash);
      if (!set) {
        set = new Set<string>();
        hashToBuckets.set(hash, set);
      }
      set.add(bucket.id);
    }
  }

  const uniqueHashes = Array.from(hashToBuckets.keys());

  const shards: ShardPlanShard[] = [];
  for (let i = 0; i < shardCountClamped; i += 1) {
    shards.push({ shardId: i as ShardId, scripthashes: [], bucketCounts: {} });
  }

  uniqueHashes.forEach((hash, index) => {
    const shardIndex = index % shardCountClamped;
    const shard = shards[shardIndex];
    shard.scripthashes.push(hash);

    const bucketIds = hashToBuckets.get(hash);
    if (bucketIds) {
      for (const bucketId of bucketIds) {
        shard.bucketCounts[bucketId] = (shard.bucketCounts[bucketId] ?? 0) + 1;
      }
    }
  });

  return {
    shards,
    totalScripthashes: uniqueHashes.length,
  };
}
