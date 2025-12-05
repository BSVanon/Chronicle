import type { ShardRegisterRequest, WalletId } from "./types";
import type { ShardPlan } from "./shard-planner";
import type { ShardConfig } from "./shard-config";

export function buildShardRegisterRequests(
  walletId: WalletId,
  config: ShardConfig,
  plan: ShardPlan,
): ShardRegisterRequest[] {
  const ttlSec = config.ttlSec;

  return plan.shards
    .filter((shard) => shard.scripthashes.length > 0)
    .map((shard) => ({
      walletId,
      shardId: shard.shardId,
      scripthashes: shard.scripthashes,
      ttlSec,
    }));
}
