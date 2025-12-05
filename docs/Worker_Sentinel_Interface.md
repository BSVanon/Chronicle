# Chronicle Worker-Sentinel Interface v1

This document describes the HTTP and WebSocket interface between the Chronicle web app and a self-hosted "Worker-Sentinel" running on Cloudflare Workers, Deno Deploy, or a similar edge platform.

The goal is to give each user a private, zero-cost Sentinel proxy that can talk to HTTP/WS-based indexers on their behalf, without you running any servers.

## Goals & Constraints

- **Host:** Cloudflare Workers or Deno Deploy (no raw TCP; only HTTP/WS).
- **User-owned:** each user deploys their own Worker; Chronicle never hosts it.
- **State:** memory-only watchlists with TTL (no database required for v1).
- **Privacy:**
  - Only `walletId`, `shardId`, and scripthashes ever leave the browser.
  - No xpubs, seeds, labels, or totals are sent to the Sentinel.
- **Downstream providers:** HTTP/WS explorers only (e.g. WhatsOnChain REST, JungleBus-style WS feeds).

Chronicle already models the Sentinel types in `web/src/core/sentinel/types.ts` and provider types in `web/src/core/providers/types.ts`. This interface is designed to match those types exactly.

## Core Types (from Chronicle)

Types in the web app (simplified here):

```ts
// src/core/providers/types.ts
export type Scripthash = string;

export type Utxo = {
  txid: string;
  vout: number;
  satoshis: number;
  scriptHex: string;
  /** Optional block height if known. */
  height?: number;
};
```

```ts
// src/core/sentinel/types.ts
import type { Scripthash, Utxo } from "@/core/providers/types";

export type WalletId = string;
export type ShardId = number;

export type ShardRegisterRequest = {
  walletId: WalletId;
  shardId: ShardId;
  /** Scripthashes to watch for this shard. */
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
  /** Base HTTP URL, e.g. https://your-worker.example.workers.dev */
  baseUrl: string;
  /** Optional WebSocket URL override. */
  wsUrl?: string;
};
```

The Worker-Sentinel implementation should treat these as the canonical shapes when talking to Chronicle.

## HTTP Endpoints

### `GET /v1/health`

**Purpose:** pairing and diagnostics. Chronicle uses this when the user pastes their Worker URL to verify that the Worker is reachable and providers are healthy.

**Request:**

- Method: `GET`
- URL: `https://<worker-base>/v1/health`

**Response 200 JSON (healthy):**

```json
{
  "ok": true,
  "version": "sentinel-worker-0.1.0",
  "providerStatus": {
    "woc": "ok",
    "junglebus": "ok"
  }
}
```

**Response 200 JSON (degraded/unhealthy):**

```json
{
  "ok": false,
  "version": "sentinel-worker-0.1.0",
  "message": "WhatsOnChain unreachable",
  "providerStatus": {
    "woc": "error",
    "junglebus": "ok"
  }
}
```

Chronicle will:

- Call this once during the "Test & Pair" flow.
- Show a simple status badge (paired / unhealthy) in Settings.

### `POST /v1/shards/register`

**Purpose:** register or update shard→scripthash assignments for a wallet.

The existing web client already builds `ShardRegisterRequest` objects and calls `SentinelClient.registerShard`. The Worker-Sentinel should accept the same JSON shape.

#### Option A: single-shard payload (current client API)

**Request:**

- Method: `POST`
- URL: `https://<worker-base>/v1/shards/register`
- Body: `ShardRegisterRequest` JSON

```json
{
  "walletId": "cold-monitor-1",
  "shardId": 0,
  "scripthashes": ["abcd...", "ef01..."],
  "ttlSec": 3600
}
```

**Response 200 JSON:**

```json
{ "ok": true }
```

or

```json
{
  "ok": false,
  "message": "rate limited"
}
```

Worker behavior (conceptual):

- Upsert an in-memory record for this shard:

  ```ts
  {
    walletId,
    shardId,
    scripthashes,
    expiresAt: now + ttlSec
  }
  ```

- Later polling/subscriptions against providers should honor the `ttlSec` and drop shards whose TTL has expired.

#### Option B: multi-shard payload (recommended extension)

For efficiency, an extended endpoint can accept multiple shards at once:

```json
{
  "walletId": "cold-monitor-1",
  "shards": [
    { "shardId": 0, "scripthashes": ["abcd...", "ef01..."], "ttlSec": 3600 },
    { "shardId": 1, "scripthashes": ["1234...", "5678..."], "ttlSec": 3600 }
  ]
}
```

Response:

```json
{
  "ok": true,
  "message": "2 shards registered"
}
```

The current Chronicle client only needs Option A; Option B can be supported by the Worker template and a later client helper that folds `ShardRegisterRequest[]` into a single call.

### Optional: `DELETE /v1/wallets/:walletId`

**Purpose:** allow Chronicle to explicitly drop a wallet's shards (for a future "scrub Sentinel" flow).

**Request:**

- Method: `DELETE`
- URL: `https://<worker-base>/v1/wallets/<walletId>`

**Response:**

```json
{ "ok": true }
```

Worker behavior:

- Remove all shard records for the given `walletId`.
- Close any associated provider subscriptions.

This endpoint is optional; TTL expiry alone is enough for v1.

## WebSocket Stream

### `GET /v1/stream?wallet_id=...`

**Purpose:** stream UTXO deltas to Chronicle in near real-time.

The web app will derive the WS URL from `SentinelConfig`:

- If `wsUrl` is provided: use it directly.
- Else: take `baseUrl`, swap `http`→`ws` / `https`→`wss`, and append `/v1/stream`.

Example:

```text
wss://your-worker.example.workers.dev/v1/stream?wallet_id=cold-monitor-1
```

**Client → Worker:**

- Query param: `wallet_id` = `WalletId` being monitored.
- No messages need to be sent from the browser after connect in v1.

**Worker → Client:**

- Messages are `SentinelEvent` JSON (currently just `UtxoDeltaEvent`).

Example event:

```json
{
  "type": "utxo_delta",
  "scripthash": "abcd...",
  "add": [
    {
      "txid": "...",
      "vout": 0,
      "satoshis": 12345,
      "scriptHex": "76a914...88ac",
      "height": 812345
    }
  ],
  "remove": []
}
```

Worker behavior (conceptual):

- Maintain a mapping of `walletId -> [shardId] -> { scripthashes, expiresAt }`.
- For all shards belonging to `wallet_id`:
  - Use HTTP/WS providers (e.g. WhatsOnChain, JungleBus) to detect changes in UTXO sets.
  - When a change is detected for a given `scripthash`:
    - Emit a `utxo_delta` event with the `add`/`remove` arrays describing the delta.

Chronicle behavior:

- For each `SentinelEvent` received:
  - Feed `UtxoDeltaEvent` into the local UTXO engine in `web/src/core/utxo/engine.ts`.
  - Bucket summaries and dev panels update from the engine; no provider state is stored in the browser.

## Privacy Shield Inside the Worker

Chronicle's Privacy Shield planner is implemented client-side, but the Worker-Sentinel should also adhere to similar principles when talking to providers:

- **Batching:** do not query providers with fewer than 3 or more than 7 scripthashes per batch, where possible.
- **Jitter:** apply 500–3000 ms random jitter around polling intervals.
- **Chaff:** include 1–2 decoy scripthashes per batch from a decoy pool.
- **Rotation:** honor `ttlSec` and implement periodic shard remaps per Chronicle's privacy profiles (Cold Monitor / Everyday Monitor) where practical.
- **No logging:** avoid logging scripthashes or other sensitive details; if logs are used for debugging, scrub or disable them for production.

The exact implementation details can differ between Cloudflare Workers and Deno Deploy, but the external interface to Chronicle should remain stable.

## How Chronicle Uses This Interface

In **Local-only mode** (current Step 1–2 behavior):

- `SentinelConfig` is unset or pointed at a stub; Chronicle does **not** call these endpoints.
- Dev-only panels show shard and registration planning without performing network calls.

When a user opts into a **self-deployed Worker-Sentinel**:

1. They deploy the Worker from a `sentinel-worker/` template (Cloudflare Workers or Deno Deploy).
2. In `/settings`, they paste the Worker base URL into Chronicle.
3. Chronicle:
   - Calls `GET /v1/health` through the offline gate to validate pairing.
   - Once the user enables `online_shielded` mode, Chronicle:
     - Computes a `ShardPlan` from current buckets and shard configuration.
     - Builds `ShardRegisterRequest[]` and calls `POST /v1/shards/register` for each shard (or via a future batch helper).
     - Opens `WS /v1/stream?wallet_id=...` and listens for `SentinelEvent` messages.
4. Incoming `UtxoDeltaEvent`s are applied to the local UTXO engine, which drives UI updates.

This keeps all key material, labels, and balances local to the browser, uses the Worker-Sentinel only as a privacy-preserving proxy to HTTP/WS indexers, and satisfies the constraint of no VPS or ongoing hosting costs for Chronicle itself.
