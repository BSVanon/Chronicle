# Chronicle – Current Implementation Status

This document describes the Chronicle codebase as it exists now, relative to
`Project_Canvas_Initial.md`. It is written so that a reader can:

- Read the Canvas (mission and target design).
- Read this status document.
- Understand what is currently implemented, what is partially implemented, and
  what is not yet started, without gaps.

Where helpful, this doc refers to concrete modules and files in the repo.

---

## 1. High‑Level Overview

### 1.1 Mission alignment

Canvas mission (summary):

- Live(ish) balance and inflow/outflow awareness across BSV wallets.
- No single third party sees the full wallet map or totals.
- Self‑sovereign local archive of UTXOs and BEEF proofs.
- Private holdings monitor and planning layer (buckets, rotation).

Current implementation:

- Focused on a **prototype of the pure privacy layer and basic monitoring UI**:
  - Local derivation of watch‑only material into scripthashes.
  - Minimal Sentinel Worker that emits `utxo_delta` events.
  - A shared local UTXO engine in the client.
  - A Monitor page that reads from this engine and from local buckets/BEEF
    archive.
- Many Canvas items are not yet started (multi‑egress, real provider adapters,
  headers client, proof engine, exports, labels, analytics). Those are called
  out explicitly below.

The current state roughly corresponds to:

- **M1 (Proto)** in the Canvas roadmap:
  - Single VPS‑style Sentinel proxy, one provider abstraction, WebSocket deltas
    end‑to‑end.
- Plus early slices of **M3 (UX)**:
  - Buckets, basic Inputs, and a Monitor UI.

---

## 2. Core Architecture vs Canvas Step 1

Canvas Step 1 defines a client–Sentinel–provider architecture with sharding and
privacy constraints.

### 2.1 Client responsibilities (implemented)

**Canvas:**

- Derive addresses/scripts from seed/xpub locally.
- Compute scripthashes and track outpoints.
- Split watchlist into K shards.
- Maintain authoritative UTXO set; compute balances locally.

**Current implementation:**

- **Watch‑only derivation**
  - Location: `web/src/core/wallet/watch-only-analyzer.ts`,
    `watch-only-derivation.ts` (referenced via contexts and panels).
  - Inputs:
    - Watch‑only material (currently focused on legacy addresses/xpub‑like
      input) entered on the Inputs/Onboarding page.
  - Outputs:
    - A set of **derived scripthashes** for use in bucket assignment and shard
      planning.

- **UTXO engine**
  - Location: `web/src/core/utxo/engine.ts` and
    `web/src/contexts/utxo-stream-context.tsx`.
  - `createUtxoEngine(initialEvents?)` implements an in‑memory UTXO map:
    - Per‑scripthash map of UTXO key → UTXO.
    - `applyDelta(event)` applies `{add[], remove[]}`.
    - `getTotals()` returns `{confirmed, unconfirmed}` based on height.
  - `UtxoStreamProvider` wraps the engine in React context:
    - Exposes `engine`, `applyEvent`, `applyEvents`, `recentEvents`,
      `streamSource`, `reset`.
    - `recentEvents` holds the last up‑to‑50 `UtxoDeltaEvent`s for UI.

- **Authoritative balances and deltas**
  - Monitor components read from `useUtxoStream()` and compute:
    - Per‑bucket balances (`BucketSummaryPanel`).
    - Recent deltas (`RecentDeltasPanel`).

**Not implemented yet:**

- Full derivation from xpub/descriptor/gap window; current focus is on basic
  watch‑only input.
- Outpoint‑level tracking and split between inbound discovery vs spentness
  providers.

### 2.2 Sentinel responsibilities (implemented)

**Canvas:**

- Stateless (in‑memory) shard registry.
- Interface: `POST /v1/shards/register`, `WS /v1/stream`, optional verify.
- Connect to real providers; emit `utxo_delta` events to client.

**Current implementation:**

- **Sentinel Worker**
  - Location: `sentinel-worker/src/index.ts`.
  - In‑memory state:
    - `shardsByWallet: Map<walletId, Map<shardId, ShardRecord>>` where
      `ShardRecord` includes `scripthashes` and `expiresAt`.
    - `utxoStateByWallet: Map<walletId, Map<scripthash, SentinelUtxo[]>>`.
  - Endpoints:
    - `GET  /v1/health` → `{ ok: true, version, providerStatus: { ... } }`.
    - `POST /v1/shards/register` → validates payload and stores shard
      subscriptions with TTL.
    - `GET  /v1/stream?wallet_id=...` → upgrades to WebSocket and sends
      `utxo_delta` events for scripthashes currently registered for that
      `wallet_id`.
    - `DELETE /v1/wallets/:walletId` → drops shard and UTXO state for that
      wallet.
  - UTXO source logic:
    - Optional upstream snapshot via `UPSTREAM_UTXO_URL`.
    - Otherwise, synthetic UTXO generation and toggling per scripthash.

**Not implemented yet:**

- Multiple providers behind the Worker.
- Multi‑egress routing (VPN/VPS per shard).
- Provider health checks, rate‑limit handling, rotation.
- Privacy Shield policies (batching/jitter/chaff) at the Sentinel level.

### 2.3 Client–Sentinel wiring (implemented)

**Canvas:**

- Per‑shard registration and streaming.

**Current implementation:**

- **Shard planner & register planner**
  - Location: `web/src/core/sentinel/shard-planner.ts` and
    `register-planner.ts`.
  - `planShardsFromBuckets(buckets, shardCount)`:
    - Builds a map of scripthash → bucket IDs from the current bucket
      assignments.
    - Distributes unique scripthashes across shards (round‑robin) for a given
      `shardCount`.
    - Produces a `ShardPlan` with `shards[]` and `totalScripthashes`.
  - `buildShardRegisterRequests(walletId, shardConfig, plan)`:
    - For each shard with non‑empty scripthashes, builds a
      `{walletId, shardId, scripthashes[], ttlSec}` request.

- **Sentinel client + Monitor wiring**
  - The Monitor page includes `SentinelStreamDevPanel`, which:
    - Uses `useBuckets()` and `useShardConfig()` to compute the current
      `ShardPlan` and registration requests.
    - Uses `useSentinelConfig()` (from `NEXT_PUBLIC_SENTINEL_BASE_URL` and the
      Sentinel pairing card) to talk to the Sentinel Worker via
      `useSentinelClient`.
    - On **"Register shards & open stream"**:
      - POSTs each register request to `/v1/shards/register`.
      - Opens a WebSocket per shard at `/v1/stream?wallet_id=...`.
      - On each event, calls `applyEvent` on the UTXO engine.
      - Sets `streamSource` to `"sentinel"`.
    - On **"Drop wallet on Sentinel"**:
      - Calls `DELETE /v1/wallets/:walletId`.
      - Closes streams, resets the engine, sets `streamSource` to `"none"`.

**Not implemented yet:**

- Privacy Shield policies around the Sentinel client (batching/jitter/chaff).
- Spot‑check/verify endpoints and logic (`/v1/shards/verify`).

---

## 3. UI & Data Flows vs Canvas Step 2

Canvas Step 2 describes software setup, data intake, monitoring views, hygiene,
exports.

### 3.1 Modes and network controls

**Canvas:**

- Modes: `offline` (default), `online_shielded`.
- No network calls in offline; Sentinel used only in shielded mode.

**Current implementation:**

- `NetworkModeProvider` in `web/src/contexts/network-mode-context.tsx`:
  - Holds `mode: "offline" | "online_shielded"` and `setMode`.
- `useSentinelClient` and Sentinel calls are guarded by this mode.
- UI reflects the current mode in the Sentinel pairing card and Sentinel stream
  panel.

**Not implemented yet:**

- CI tests to enforce “no network calls in offline mode”.
- Privacy Shield batch/jitter limits based on mode.

### 3.2 Inputs / Onboarding flows

**Canvas:**

- Watch‑only import (xpub/descriptor/addresses).
- Buckets & labels (Cold, Hot, Project‑X, etc.).
- BEEF backfill and coverage.

**Current implementation:**

- **Watch‑only Inputs**
  - On the Onboarding/Inputs page, there is a watch‑only panel that:
    - Accepts user data (currently focused on addresses/xpub‑like strings).
    - Runs `runBasicDerivation(raw, analysis)` to derive scripthashes.
  - These derived scripthashes feed the bucket assignment panel and, through
    buckets, the shard planner.

- **Buckets**
  - Context: `BucketProvider` in `bucket-context.tsx`:
    - Three initial buckets: `cold`, `hot`, `project_x` with labels and
      descriptions.
    - `scripthashes` arrays default to empty.
    - Buckets are persisted in `localStorage` under `chronicle-buckets-v1`.
    - Legacy demo scripthashes are stripped out when loading stored configs.

  - Editor: `DerivedBucketAssignmentPanel` (Monitor page, titled
    "Bucket assignment"):
    - Lists derived scripthashes (from watch‑only input).
    - For each scripthash, shows a dropdown of buckets (Cold/Hot/Project X).
    - Initializes each dropdown from the current bucket membership.
    - On **Apply bucket mappings**:
      - Removes all derived hashes from each bucket.
      - Re‑adds them based on the dropdown selections.
      - Persists back to `BucketProvider` → `localStorage`.

  - Read‑only views:
    - `BucketsSettingsCard` (Settings) shows bucket labels/descriptions.
    - Monitor’s `BucketSummaryPanel` shows per‑bucket balances from the UTXO
      engine.

- **BEEF archive**
  - Context: `BeefArchive` (see components and usage; the context file lives
    under `web/src/contexts`, and is consumed by BEEF cards and Monitor).
  - Inputs:
    - `BeefDevCard` on Inputs/Settings accepts BEEF‑like JSON payloads.
    - Parses bundles, extracts scripthashes, and stores entries locally.
  - Monitor:
    - `BeefCoveragePanel` reads the archive and buckets to compute:
      - `totalBundles`, `totalArchiveUtxos`, `totalArchiveScripthashes`.
      - `totalTrackedScripthashes` from buckets.
      - Approx coverage % and per‑bucket approximations.
    - Hints users to import more BEEF on Inputs when coverage is missing or
      partial.

**Not implemented yet:**

- Labels (per wallet/UTXO/tx) and richer bucket metadata.
- Multiple bucket sets or arbitrary user‑defined bucket names.
- New wallet / exchange account flows as described in Canvas.

### 3.3 Monitor views (ongoing monitoring)

**Canvas:**

- Shard board (0..K‑1 tiles: provider, egress, health, rotation).
- UTXO view: bucket balances, recent deltas, change detection.
- Drift/health: spot‑checks, stalls, rate‑limit alarms, rebinds.

**Current implementation:**

- **Shard board**
  - Component: `ShardBoardSummary` on `Monitor` page.
  - Shows:
    - `Shard plan: N shard(s) covering M tracked scripthash(es) based on current
      buckets and shard config`.
  - Uses `planShardsFromBuckets` and the shard config context.

- **Stream status**
  - Component: `StreamStatusIndicator`.
  - Uses:
    - `useUtxoStream().streamSource` (`none | sentinel | simulation`).
    - `useNetworkMode().mode`.
    - `useSentinelConfig().config` (paired vs not).
  - Shows a badge (`Stream: Sentinel/Simulation/None`) and helper text that
    explains **why** the stream is not live (offline, not paired, or paired +
    shielded but idle).

- **Bucket balances**
  - Component: `BucketSummaryPanel`.
  - Uses:
    - `useBuckets()` and `useUtxoStream().engine`.
  - For each bucket, sums UTXOs from the engine to compute:
    - `confirmed` and `unconfirmed` sats per bucket.
  - Also computes totals across all buckets.
  - If engine has no UTXOs, shows a short hint instead of an empty table.

- **Recent deltas**
  - Component: `RecentDeltasPanel`.
  - Uses `recentEvents` from `useUtxoStream()`.
  - For each event, shows:
    - scripthash, inflow sats, outflow sats, and type (inflow/outflow/both).
  - Includes a badge indicating the stream source (Sentinel/Simulation/None).

- **BEEF coverage**
  - Component: `BeefCoveragePanel`.
  - Computes global and per‑bucket coverage metrics from BEEF archive + buckets.
  - Hides itself if there is no data at all.
  - Shows action hints to use the BEEF archive import card on Inputs.

- **Sentinel live stream panel (dev wiring)**
  - Component: `SentinelStreamDevPanel`.
  - Provides the primary way (today) to:
    - Open the shard streams against the configured Sentinel.
    - See live engine totals and recent sentinel events.
    - Drop a wallet on the Sentinel.
  - Text explicitly describes the required sequence:
    - Pair Sentinel on Inputs, enable `online_shielded`, then register shards
      and open stream.

**Not implemented yet:**

- Health/drift monitoring for shards and providers (stalls, rate‑limits,
  rebinds).
- Threshold alerts, notifications, or change‑detection hints.
- Charts or long‑term histories of balances/deltas.
- A non‑dev “Start monitoring this plan” wrapper around the dev stream panel.

### 3.4 Hygiene, exports, and backups

**Canvas:**

- Hygiene schedules, “scrub” flows, encrypted exports.

**Current implementation:**

- Local persistence:
  - Buckets and Sentinel config are stored in `localStorage`.
  - BEEF archive entries are kept in a local context and can be re‑derived from
    the imported JSON.

**Not implemented yet:**

- Any export mechanism (JSON/CSV/PDF/ZIP) for:
  - Buckets, labels, shard config.
  - UTXO snapshots.
  - BEEF hashes.
- Hygiene workflows (rotate/reseed, decoy refresh, spot‑check UI).

---

## 4. BEEF / Proof Engine vs Canvas

**Canvas:**

- Full BEEF archive schema, headers client, proof verification, pruning,
  integrity checks, acquisition ordering.

**Current implementation:**

- BEEF handling is limited to:
  - Parsing BEEF‑like JSON payloads.
  - Extracting UTXOs and scripthashes.
  - Storing simple archive entries locally.
  - Summarizing archive coverage on Monitor.

**Not implemented yet:**

- Headers client and on‑device proof verification.
- Full BEEF archive schema as described.
- Pruning policies and integrity/hash indexing.
- Export/import of archives with re‑verification.

---

## 5. Privacy Shield & Provider Adapters vs Canvas

**Canvas:**

- Privacy Shield policy package (batching, jitter, chaff, caps, backoff).
- Provider adapters for Electrum, explorer REST/WS, event/DSN.

**Current implementation:**

- None of the full Privacy Shield logic is implemented yet.
- No generalized provider adapter layer has been integrated.
- The Sentinel Worker can optionally call a single `UPSTREAM_UTXO_URL`, but
  this is not a full adapter ecosystem.

**Not implemented yet (entirely):**

- Electrum/REST/WS adapters.
- Event/DSN spentness provider.
- Multi‑source headers client.
- Privacy Shield batching/jitter/chaff and rotation policies.

---

## 6. Packaging, CI, and Tests vs Canvas

**Canvas:**

- Static site + PWA, optional desktop wrapper.
- CI acceptance checks: offline default, no secrets out, proof loop,
  Privacy Shield tests, exports tests.

**Current implementation:**

- The web app is a Next.js 13+/app‑router project under `web/` with typical
  React/Tailwind/shadcn‑style UI.
- PWA packaging, desktop wrappers, and the CI test matrix described in Canvas
  are not present in this repo snapshot.

**Not implemented yet:**

- CI checks for privacy guarantees.
- PWA/packaging decisions realized in code.
- Export round‑trip tests.

---

## 7. Summary: What Exists and What Does Not

### 7.1 Exists (main threads)

- Minimal but functional Sentinel Worker implementing the core interface.
- Client‑side UTXO engine and stream wiring.
- Watch‑only input → derived scripthashes → bucket assignment → shard plan.
- Sentinel pairing UI and live stream dev panel.
- Monitor UI that:
  - Shows shard plan summary.
  - Indicates stream status and why it is/isn\'t live.
  - Displays bucket balances (from engine) and recent deltas.
  - Summarizes BEEF archive coverage vs tracked buckets.
- Basic local persistence for buckets, Sentinel config, and BEEF archive.

### 7.2 Not yet built

- Multi‑provider, multi‑egress Privacy Shield engine.
- Real provider adapters (Electrum/REST/WS/DSN) and headers client.
- Proof engine and full BEEF archive semantics.
- Labels, rich bucket management, profiles (Cold/Everyday) with concrete
  behaviors.
- Alerts, drift/health indicators, and analytics.
- Hygiene flows and encrypted exports/backups.
- CI privacy tests and full packaging story.

This document, together with `Project_Canvas_Initial.md`, should give a
complete picture of the intended system and the current prototype: which
components are live, which are stubs, and which are still only on the Canvas.
