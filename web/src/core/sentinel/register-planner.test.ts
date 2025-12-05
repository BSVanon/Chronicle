import { describe, expect, test } from "vitest";

import type { Scripthash } from "../providers/types";
import { DEFAULT_SHARD_CONFIG } from "./shard-config";
import { planShardsFromBuckets } from "./shard-planner";
import { buildShardRegisterRequests } from "./register-planner";

const H1 = "hash-1" as Scripthash;
const H2 = "hash-2" as Scripthash;

describe("buildShardRegisterRequests", () => {
  test("builds requests for non-empty shards only", () => {
    const buckets = [
      { id: "cold", scripthashes: [H1] },
      { id: "hot", scripthashes: [H2] },
    ];

    const plan = planShardsFromBuckets(buckets, 2);

    const walletId = "wallet-abc";
    const requests = buildShardRegisterRequests(walletId, DEFAULT_SHARD_CONFIG, plan);

    expect(requests.length).toBeGreaterThan(0);
    for (const req of requests) {
      expect(req.walletId).toBe(walletId);
      expect(req.ttlSec).toBe(DEFAULT_SHARD_CONFIG.ttlSec);
      expect(req.scripthashes.length).toBeGreaterThan(0);
    }

    const shardIds = new Set(requests.map((r) => r.shardId));
    expect(shardIds.size).toBeLessThanOrEqual(plan.shards.length);
  });
});
