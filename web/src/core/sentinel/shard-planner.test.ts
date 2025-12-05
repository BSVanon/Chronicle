import { describe, expect, test } from "vitest";

import type { Scripthash } from "../providers/types";
import { planShardsFromBuckets } from "./shard-planner";

describe("planShardsFromBuckets", () => {
  test("distributes unique hashes round-robin across shards", () => {
    const h1 = "hash-1" as Scripthash;
    const h2 = "hash-2" as Scripthash;
    const h3 = "hash-3" as Scripthash;

    const buckets = [
      { id: "cold", scripthashes: [h1, h2] },
      { id: "hot", scripthashes: [h2, h3] },
    ];

    const plan = planShardsFromBuckets(buckets, 2);

    expect(plan.totalScripthashes).toBe(3);
    expect(plan.shards.length).toBe(2);

    const totalAssigned =
      plan.shards[0].scripthashes.length + plan.shards[1].scripthashes.length;
    expect(totalAssigned).toBe(3);

    const shard0 = plan.shards[0];
    const shard1 = plan.shards[1];

    expect(shard0.bucketCounts.cold ?? 0).toBe(1);
    expect(shard0.bucketCounts.hot ?? 0).toBe(1);
    expect(shard1.bucketCounts.cold ?? 0).toBe(1);
    expect(shard1.bucketCounts.hot ?? 0).toBe(1);
  });

  test("clamps shard count and handles empty input", () => {
    const planZero = planShardsFromBuckets([], 0);
    expect(planZero.totalScripthashes).toBe(0);
    expect(planZero.shards.length).toBe(1);
    expect(planZero.shards[0].scripthashes.length).toBe(0);

    const planHigh = planShardsFromBuckets([], 999);
    expect(planHigh.shards.length).toBe(16);
  });
});
