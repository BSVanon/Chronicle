import type { Scripthash, Utxo } from "@/core/providers/types";

export type WalletId = string;
export type ShardId = number;

export type ShardRegisterRequest = {
  walletId: WalletId;
  shardId: ShardId;
  /**
   * Scripthashes to watch for this shard. Sentinel must not persist these
   * beyond the TTL window.
   */
  scripthashes: Scripthash[];
  /** TTL in seconds after which the shard may be evicted if idle. */
  ttlSec: number;
};

export type ShardRegisterResponse = {
  ok: boolean;
  /** Optional diagnostic message (e.g. rate limit or validation failure). */
  message?: string;
};

export type UtxoDeltaEvent = {
  type: "utxo_delta";
  scripthash: Scripthash;
  add: Utxo[];
  remove: Utxo[];
};

export type SentinelEvent = UtxoDeltaEvent;

export type SentinelConfig = {
  /** Base HTTP URL, e.g. https://sentinel.example.com */
  baseUrl: string;
  /**
   * Optional WebSocket URL override; if omitted, a ws(s) URL will be
   * derived from baseUrl.
   */
  wsUrl?: string;
};
