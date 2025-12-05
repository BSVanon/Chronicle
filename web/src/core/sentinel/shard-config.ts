import type { ShardId } from "./types";

export type ShardConfig = {
  shardCount: number;
  ttlSec: number;
  seed: string;
  egressLabels: string[];
};

export type ShardConfigSnapshot = {
  version: 1;
  config: ShardConfig;
};

export const DEFAULT_SHARD_CONFIG: ShardConfig = {
  shardCount: 3,
  ttlSec: 60 * 60,
  seed: "default-seed",
  egressLabels: ["vpn-a", "vpn-b", "vps-public"],
};

export function normalizeShardCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SHARD_CONFIG.shardCount;
  return Math.max(1, Math.min(16, Math.floor(value)));
}

export function normalizeTtlSec(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SHARD_CONFIG.ttlSec;
  const maxTtl = 24 * 60 * 60;
  return Math.max(60, Math.min(maxTtl, Math.floor(value)));
}

export function normalizeSeed(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_SHARD_CONFIG.seed;
}

export function normalizeEgressLabels(labels: string[]): string[] {
  const cleaned = labels.map((l) => l.trim()).filter((l) => l.length > 0);
  if (cleaned.length === 0) return DEFAULT_SHARD_CONFIG.egressLabels;
  return cleaned;
}

export function serializeShardConfig(config: ShardConfig): string {
  const snapshot: ShardConfigSnapshot = { version: 1, config };
  return JSON.stringify(snapshot);
}

export function deserializeShardConfig(raw: string | null | undefined): ShardConfig {
  if (!raw) return DEFAULT_SHARD_CONFIG;
  try {
    const parsed = JSON.parse(raw) as Partial<ShardConfigSnapshot>;
    if (!parsed || parsed.version !== 1 || !parsed.config) {
      return DEFAULT_SHARD_CONFIG;
    }
    return normalizeShardConfig(parsed.config as ShardConfig);
  } catch {
    return DEFAULT_SHARD_CONFIG;
  }
}

export function normalizeShardConfig(raw: ShardConfig): ShardConfig {
  return {
    shardCount: normalizeShardCount(raw.shardCount),
    ttlSec: normalizeTtlSec(raw.ttlSec),
    seed: normalizeSeed(raw.seed),
    egressLabels: normalizeEgressLabels(raw.egressLabels ?? []),
  };
}
