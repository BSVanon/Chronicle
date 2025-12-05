import type {
  SentinelConfig,
  SentinelEvent,
  ShardRegisterRequest,
  ShardRegisterResponse,
  WalletId,
  ShardId,
} from "@/core/sentinel/types";

export type SentinelStreamHandle = {
  close: () => void;
};

export interface SentinelClient {
  registerShard(input: ShardRegisterRequest): Promise<ShardRegisterResponse>;
  openShardStream(
    walletId: WalletId,
    shardId: ShardId,
    onEvent: (event: SentinelEvent) => void,
    onError?: (error: unknown) => void,
    onClose?: (event: unknown) => void,
  ): SentinelStreamHandle;
  deleteWallet(walletId: WalletId): Promise<{ ok: boolean; message?: string }>;
}

export interface SentinelHttpClient {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export type SentinelClientDeps = {
  config: SentinelConfig;
  http: SentinelHttpClient;
  WebSocketCtor?: typeof WebSocket;
};

export function createSentinelClient(deps: SentinelClientDeps): SentinelClient {
  const { config, http, WebSocketCtor } = deps;
  const baseUrl = config.baseUrl.replace(/\/$/, "");

  function getWsUrl(): string {
    if (config.wsUrl) return config.wsUrl;
    const url = new URL(baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/v1/stream";
    return url.toString();
  }

  async function registerShard(
    input: ShardRegisterRequest,
  ): Promise<ShardRegisterResponse> {
    const url = `${baseUrl}/v1/shards/register`;
    const response = await http.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as ShardRegisterResponse;
    return data;
  }

  async function deleteWallet(walletId: WalletId): Promise<{ ok: boolean; message?: string }> {
    const url = `${baseUrl}/v1/wallets/${encodeURIComponent(walletId)}`;
    const response = await http.fetch(url, {
      method: "DELETE",
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json().catch(() => null)) as
      | { ok?: unknown; message?: unknown }
      | null;

    if (data && typeof data.ok === "boolean") {
      return {
        ok: data.ok,
        message: typeof data.message === "string" ? data.message : undefined,
      };
    }

    return { ok: true };
  }

  function openShardStream(
    walletId: WalletId,
    shardId: ShardId,
    onEvent: (event: SentinelEvent) => void,
    onError?: (error: unknown) => void,
    onClose?: (event: unknown) => void,
  ): SentinelStreamHandle {
    // NOTE: This is a stub implementation. The actual WebSocket wiring and
    // integration with Chronicle's offline gate will be added later.
    const wsUrl = new URL(getWsUrl());
    wsUrl.searchParams.set("wallet_id", walletId);
    wsUrl.searchParams.set("shard_id", String(shardId));

    let closed = false;

    const WS = WebSocketCtor ?? (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket;
    if (!WS) {
      onError?.(new Error("WebSocket is not available in this environment"));
      return {
        close: () => {
          /* no-op */
        },
      };
    }

    try {
      const ws = new WS(wsUrl.toString());

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as SentinelEvent;
          onEvent(data);
        } catch (error) {
          onError?.(error);
        }
      };

      ws.onerror = (event) => {
        onError?.(event);
      };

      ws.onclose = (event) => {
        closed = true;
        onClose?.(event);
      };

      return {
        close: () => {
          if (closed) return;
          closed = true;
          ws.close();
        },
      };
    } catch (error) {
      onError?.(error);
      return {
        close: () => {
          /* no-op */
        },
      };
    }
  }

  return {
    registerShard,
    openShardStream,
    deleteWallet,
  };
}
