# Chronicle Stubbed Behaviours & TODO Replacements

This document tracks all stubs, mockups, fallbacks, and work-arounds in the
current Chronicle v1 codebase. Each entry should be replaced or hardened before
calling Step 1 "done".

## Sentinel & Networking

- **Sentinel client (HTTP + WS)**
  - File: `web/src/core/sentinel/client.ts`
  - Status: **partially implemented**
  - Notes:
    - HTTP calls are injected via `SentinelHttpClient` and, in the app, wired
      through `useGuardedFetch` and the offline/online_shielded gate.
    - WebSocket usage now connects to the real Sentinel Worker (`/v1/stream`)
      using the configured base URL and `wallet_id`/`shard_id` query params.
    - There is still no retry, backoff, or health checks, and WebSocket
      integration with the offline gate is minimal.
  - TODO:
    - Integrate Privacy Shield policies into shard registration once a real
      Sentinel backend exists.
    - Implement authenticated / hardened WebSocket connection management.
    - Add tests for reconnect, shard rebinding, and failure modes.

- **Privacy Shield provider planner only (no execution)**
  - File: `web/src/core/providers/shielded-provider.ts`
  - Status: **planner only**
  - Notes:
    - Exposes `planListUnspentShielded`, `planGetTxShielded`, and
      `planGetHeaderShielded` but never executes the resulting batches.
  - TODO:
    - Introduce an execution layer that consumes `PrivacyShieldPlan` and uses
      `guardedFetch` to perform real network requests.
    - Add snapshot tests to assert that outbound payloads never include
      secrets/xpubs/labels/totals.

## UI / Simulations

- **Onboarding Privacy Shield dry-run preview**
  - File: `web/src/app/onboarding/privacy-dry-run-preview.tsx`
  - Status: **demo-only**; uses real watch-only scripthashes when available.
  - Notes:
    - Pulls derived scripthashes from `WatchOnlyContext` when the user has
      provided watch-only material, otherwise falls back to a small demo set.
    - Uses the active privacy profile's shield overrides but still runs the
      Privacy Shield planner only; no network execution layer exists yet.
  - TODO:
    - Snapshot UI for CI to ensure outbound summaries always report
      `0 secrets`, `0 labels`, `0 totals`.

- **Monitor simulated Sentinel feed**
  - File: `web/src/app/monitor/sentinel-simulated-panel.tsx`
  - Status: **local simulation**; no network.
  - Notes:
    - Uses scripted `UtxoDeltaEvent`s and synthetic scripthashes to exercise the
      UTXO engine.
  - TODO:
    - Replace with a real connection to Sentinel once the backend exists.
    - Keep a dev-only simulation mode for demos and regression tests.

- **Monitor recent deltas panel (live)**
  - File: `web/src/app/monitor/recent-deltas-panel.tsx`
  - Status: **implemented; wired to shared UTXO engine**.
  - Notes:
    - Renders a read-only list of the last few `UtxoDeltaEvent`s that have
      been applied to the shared UTXO engine via `useUtxoStream()`.
    - The engine can be fed by either the real Sentinel stream or the local
      Sentinel simulation panel; this component itself is no longer a stub.
  - TODO:
    - Add tests and fixtures once the Sentinel client and Privacy Shield paths
      are finalized.

## Core Logic

- **UTXO engine core map only (no labels)**
  - File: `web/src/core/utxo/engine.ts`
  - Status: **core map only**.
  - Notes:
    - Tracks per-scripthash UTXOs and global totals.
    - Bucket-level balances and recent deltas are implemented at the Monitor
      layer using `useBuckets()` + the shared UTXO engine, but the engine
      itself remains label/bucket-agnostic.
  - TODO:
    - (Optional) Add a higher-level bucket engine if deeper analytics are
      required at the core layer; not strictly required for Step 1.

- **Bucket metadata & storage (stub)**
  - Files:
    - `web/src/contexts/bucket-context.tsx`
    - `web/src/app/monitor/bucket-summary-panel.tsx`
    - `web/src/app/monitor/derived-bucket-assignment-panel.tsx`
  - Status: **stub**.
  - Notes:
    - Defines three initial buckets (Cold, Hot, Project X) and persists
      `scripthashes` per bucket in `localStorage`.
    - Legacy demo scripthashes (`shard-1-a`, `shard-0-a`, `shard-0-b`) are now
      stripped from defaults and stored configs so only real user data is
      tracked.
    - `derived-bucket-assignment-panel` now acts as a minimal bucket editor for
      derived scripthashes: it initializes from current bucket state and
      replaces assignments on apply.
    - There is still no full bucket editor (create/rename/reorder/delete
      buckets) and no persistence beyond the current browser.
  - TODO:
    - Extend bucket management to support create/rename/reorder/delete and
      multi-profile configurations.
    - Surface bucket configuration in a dedicated UI (for example, Inputs /
      Settings → Buckets) beyond the current placement.

- **Watch-only analyzer & derivation (minimal)**
  - Files:
    - `web/src/core/wallet/watch-only-analyzer.ts`
    - `web/src/core/wallet/watch-only-derivation.ts`
    - `web/src/app/onboarding/watch-only-panel.tsx`
    - `web/src/contexts/watch-only-context.tsx`
    - `web/src/app/monitor/derived-utxo-demo-panel.tsx`
    - `web/src/app/monitor/derived-bucket-assignment-panel.tsx`
  - Status: **partially implemented stub**.
  - Notes:
    - Classifier still uses simple regexes for xpub, address lists, and txid
      lists and does not yet handle mnemonics, descriptors, or full BEEF
      bundles.
    - A basic derivation engine exists: legacy P2PKH/P2SH addresses are turned
      into real BSV-style scripthashes (via `@noble/hashes` + `bs58check`), and
      BEEF-shaped inputs can be converted into scripthashes via
      `web/src/core/beef/index.ts`.
    - `basicWatchOnlyDeriver` and `runBasicDerivation` provide a core
      `DerivationInput` → `DerivedEntry` pipeline with gap/`maxAddresses`
      limits, but xpub/descriptor/mnemonic derivation remains stubbed.
    - Dev-only panels on `/monitor` use this pipeline to seed a simulated UTXO
      engine and to map derived scripthashes into buckets, all local-only.
  - TODO:
    - Replace the classifier with the full Chronicle wallet input classifier
      that supports mnemonics, Electrum seeds, descriptors, and richer
      validation.
    - Implement full BIP32/BIP39-based derivation for xpubs and (optionally)
      mnemonics, including realistic path templates for BSV and hardened gap
      limits suitable for browser use.
    - Extend the derivation engine to consume real BEEF bundles once the BEEF
      parser is implemented, emitting `DerivedEntry` records that feed both the
      UTXO engine and bucket assignments.
    - Harden the watch-only → bucket assignment flow (beyond the current dev
      panel) and connect its outputs into Sentinel shard registration in a
      privacy-preserving way.

- **BEEF core & index/export (stub)**
  - Files:
    - `web/src/core/beef/index.ts`
    - `web/src/core/beef/index.test.ts`
    - `web/src/app/settings/beef-dev-card.tsx`
  - Status: **core helpers implemented; index/export not yet implemented**.
  - Notes:
    - `parseBeefBundle` accepts pre-parsed BEEF-shaped objects and otherwise
      returns an empty stub bundle for Step 1.
    - `scripthashesFromBeefResult` converts BEEF UTXO scripts into scripthashes
      for use by the derivation engine and UTXO demos.
    - There is no persistent BEEF index or encrypted export format yet.
  - TODO:
    - Implement a real BEEF parser according to the BEEF spec and normalize
      bundles into UTXO/scripthash records that can feed the UTXO engine.
    - Maintain a local index of imported BEEF bundles (metadata + hashes) and
      expose it to the UI.
    - Implement an export flow that writes an encrypted BEEF archive suitable
      for offline/secondary backup (no seeds/xprv/xpub).

- **Theme & layout**
  - Files:
    - `web/src/contexts/theme-mode-context.tsx`
    - `web/src/components/theme-mode-toggle.tsx`
  - Status: **good enough** but minimal.
  - Notes:
    - No system-preference detection; defaults to dark.
  - TODO (optional):
    - Consider a `system` theme option driven by `prefers-color-scheme` while
      keeping dark as the explicit privacy-conscious default.

## General TODOs

- Implement a real watch-only import flow (xpub/descriptor/address list/BEEF)
  and connect it to the Privacy Shield planner and Sentinel sharding.
- Define and persist privacy profiles (Cold Monitor = on-demand, Everyday Monitor = low-cadence) and
  feed those into the Privacy Shield and Sentinel layers.
- Integrate the network offline gate into all outbound HTTP/WS code paths.
