import { describe, expect, test } from "vitest";

import {
  DEFAULT_SHARD_CONFIG,
  deserializeShardConfig,
  normalizeShardConfig,
  serializeShardConfig,
  type ShardConfig,
} from "./shard-config";

describe("ShardConfig helpers", () => {
  test("normalizeShardConfig clamps shardCount and ttlSec and normalizes seed/labels", () => {
    const raw: ShardConfig = {
      shardCount: 999,
      ttlSec: 5,
      seed: "  ",
      egressLabels: ["  vpn-a  ", "", "vps-public"],
    };

    const normalized = normalizeShardConfig(raw);

    expect(normalized.shardCount).toBeLessThanOrEqual(16);
    expect(normalized.shardCount).toBeGreaterThanOrEqual(1);
    expect(normalized.ttlSec).toBeGreaterThanOrEqual(60);
    expect(normalized.seed).toBe(DEFAULT_SHARD_CONFIG.seed);
    expect(normalized.egressLabels).toEqual(["vpn-a", "vps-public"]);
  });

  test("serialize/deserialize round-trip", () => {
    const json = serializeShardConfig(DEFAULT_SHARD_CONFIG);
    const restored = deserializeShardConfig(json);
    expect(restored.shardCount).toBe(DEFAULT_SHARD_CONFIG.shardCount);
    expect(restored.ttlSec).toBe(DEFAULT_SHARD_CONFIG.ttlSec);
    expect(restored.seed).toBe(DEFAULT_SHARD_CONFIG.seed);
  });

  test("deserialize falls back to default on bad input", () => {
    const restored = deserializeShardConfig("not json");
    expect(restored.shardCount).toBe(DEFAULT_SHARD_CONFIG.shardCount);
  });
});
