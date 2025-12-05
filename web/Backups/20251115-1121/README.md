## Chronicle (web)

Chronicle is a privacy-first Bitcoin SV wallet visibility tool. The goal is to
give users balance and inflow/outflow awareness without handing any single
third party their full wallet map or network identity.

This `web/` app implements **Step 1: Pure Privacy Layer** of the Chronicle
canvas.

---

## Step 1: Pure Privacy Layer

High-level guarantees for Step 1:

- Keys and xpubs stay local; only scripthashes/outpoints are ever candidates to
  leave the device.
- The app boots in **offline** mode and must make zero network calls until the
  user explicitly switches to `online_shielded`.
- When online, outbound requests are planned through a **Privacy Shield** that
  batches, jitters, and mixes decoy lookups.

For this milestone, Chronicle is wired to local simulations and stubs only.
All real provider/Sentinel integration is deferred and tracked in
`docs/STUBS_AND_TODOS.md`.

### Key pieces

- **Network offline gate**
  - `src/core/net/offline-gate.ts`
  - `src/hooks/use-guarded-fetch.ts`
  - Enforces `offline` vs `online_shielded` modes and wraps `fetch` so nothing
    leaks when offline.

- **Privacy Shield planner**
  - `src/core/privacy/privacy-shield.ts`
  - `src/core/privacy/privacy-shield.test.ts`
  - Plans batched, jittered, chaff-mixed queries under per-hour capacity
    limits. Execution is stubbed; we only plan.

- **Shielded provider planner**
  - `src/core/providers/shielded-provider.ts`
  - Converts high-level needs (e.g. list UTXOs for scripthashes) into
    `PrivacyShieldPlan`s.

- **Sentinel + UTXO engine (stubs/simulations)**
  - Types + stub client: `src/core/sentinel/*`
  - In-memory UTXO engine: `src/core/utxo/engine.ts` (+ tests)
  - Simulated feed UI: `src/app/monitor/sentinel-simulated-panel.tsx`
  - Bucket summary UI: `src/app/monitor/bucket-summary-panel.tsx`
  - Recent deltas UI: `src/app/monitor/recent-deltas-panel.tsx`
  - Shard planner (core + dev UI):
    - Core: `src/core/sentinel/shard-planner.ts` (+ tests)
    - Dev panel: `src/app/monitor/shard-planning-dev-panel.tsx`

- **Watch-only input + context (stub)**
  - Analyzer: `src/core/wallet/watch-only-analyzer.ts` (+ tests)
  - Derivation engine: `src/core/wallet/watch-only-derivation.ts` (+ tests)
  - Context: `src/contexts/watch-only-context.tsx`
  - UI: `src/app/onboarding/watch-only-panel.tsx`
  - Dev monitor panels:
    - Derived UTXO demo: `src/app/monitor/derived-utxo-demo-panel.tsx`
    - Derived bucket assignment: `src/app/monitor/derived-bucket-assignment-panel.tsx`

- **Privacy profiles**
  - Profiles: `src/core/privacy/profiles.ts`
  - Context: `src/contexts/privacy-profile-context.tsx`
  - Onboarding selector: `src/app/onboarding/profile-card.tsx`
  - Settings summary: `src/app/settings/profile-summary-card.tsx`

- **Buckets (stub)**
  - Context: `src/contexts/bucket-context.tsx`
  - Monitor summary: `src/app/monitor/bucket-summary-panel.tsx`
  - Settings view: `src/app/settings/buckets-card.tsx`
  - Dev monitor assignment: `src/app/monitor/derived-bucket-assignment-panel.tsx`

- **BEEF core + dev import (stub)**
  - Core: `src/core/beef/index.ts` (+ tests)
  - Dev import card: `src/app/settings/beef-dev-card.tsx`

See `docs/STUBS_AND_TODOS.md` for a complete list of stubs and what must be
replaced before calling Step 1 done.

---

## Running the app

From the `web/` directory:

```bash
npm install

# Start the Next.js dev server (http://localhost:3000)
npm run dev
```

Key routes:

- `/` – Landing shell and navigation.
- `/onboarding` – Privacy profile selection, watch-only input, and Privacy
  Shield dry-run preview.
- `/monitor` – Shard board copy, bucket balances (simulated), recent deltas
  (simulated), Sentinel feed simulation, and dev-only panels for derived UTXO,
  bucket assignment, and shard planning.
- `/settings` – Privacy profiles summary, buckets view, BEEF dev import card,
  and future scrub/egress controls.

---

## Tests

Chronicle uses [Vitest](https://vitest.dev/) for unit tests.

From `web/`:

```bash
npm test
```

Current test coverage:

- `src/core/net/offline-gate.test.ts` – offline gate behaviour.
- `src/core/privacy/privacy-shield.test.ts` – Privacy Shield planning.
- `src/core/utxo/engine.test.ts` – in-memory UTXO engine.
- `src/core/wallet/watch-only-analyzer.test.ts` – watch-only input
  classification.
- `src/core/wallet/watch-only-derivation.test.ts` – derivation helpers and
  basic watch-only derivation engine.
- `src/core/beef/index.test.ts` – BEEF core helpers.
- `src/core/sentinel/shard-planner.test.ts` – shard planning from buckets.

---

## Notes

- There is **no telemetry or analytics** in this app.
- All networked components are either disabled by the offline gate or wired to
  simulations only for Step 1.
