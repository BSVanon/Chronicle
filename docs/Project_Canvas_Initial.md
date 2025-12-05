# Chronicle

*A privacy-first wallet visibility project: real‑time balances without clustering leaks.*

---

## Mission
Give users live(ish) balance and spend/inflow awareness across BSV wallets **without** handing any single third party their full wallet map or network identity.

Chronicle has a dual mission:
- Maintain a self-sovereign local archive of UTXOs and BEEF proofs so the user is not dependent on any single indexer or explorer.
- Provide a private holdings monitor and planning layer on top of that archive (buckets, thresholds, rotation planning).

---

# Step 1 — Pure Privacy Layer (Baseline)

### Threat Model (who learns what)
- **Indexers:** Can cluster any set of scripts you ask them about.
- **Network observers:** Can link large queries to your IP/device.
- **You/Your infra:** Trusted. Avoid persistent logs that would de‑anonymize your own usage.

### Design Goal
No single provider should see the whole wallet’s script set; your home IP should never directly query indexers; keys/xpubs stay local.

### Architecture Overview (No Tor required)
- **Client (local/browser/app)**
  - Derives addresses/scripts from seed/xpub **locally**.
  - Computes **scripthashes** (and tracks **outpoints** once known).
  - Splits watchlist into **K shards** deterministically.
  - Opens one **WebSocket** per shard to our Sentinel.
  - Maintains the **authoritative UTXO set** and computes balances locally.

- **Sentinel (your proxy)**
  - Stateless (in‑memory) registry of shard subscriptions.
  - For each shard, connects to **1–2 third‑party providers** via **distinct egress IPs** (public IP + multiple VPN tunnels; optional second VPS).
  - Holds per‑scripthash subscriptions or polling loops; emits **UTXO deltas** downstream to the client.
  - Never stores xpubs/keys; never persists watchlists to disk.

- **Providers (public indexers/explorers)**
  - See only the shard they service; never the whole wallet.
  - May be rotated/reassigned on health/abuse limits.

### Sharding & Egress
- **Shard function:** `shard_id = H(scripthash) mod K` (stable but re‑seedable).  
- **Egress mapping:** each shard → dedicated egress path (e.g., VPN‑A, VPN‑B, VPS‑2 public).  
- **Rotation:** periodically re‑map shard→egress to reduce long‑term linkage.

### Cover & Hygiene
- Mix in a few **decoy scripthashes** per shard.
- Randomize **batch sizes**, **reconnect jitter**, and **poll intervals**.
- Normalize TLS & HTTP headers (avoid unique fingerprints). No cookies.
- Never send **xpubs/descriptors** to third parties. Only scripthashes/outpoints.

### Real‑Time Mechanics
- Prefer provider **WebSocket** `subscribe(scripthash)`; on status change, fetch **only that script**’s UTXOs/history.
- If REST‑only, poll with ETag/If‑None‑Match and jittered intervals.
- Client applies `add/remove` **UTXO deltas** → recomputes `confirmed`/`unconfirmed` balances.

### Outpoint‑Level Split (Optional Hardening)
- Use one provider set for **inbound discovery** (new UTXOs), and a **different** provider set for **spentness** of known outpoints. This splits observation of receive vs spend flows.

### Minimal Sentinel Interface (concept)
- **Register shard:** `POST /v1/shards/register { wallet_id, shard_id, subs[], ttl_sec }`
- **Stream deltas:** `WS /v1/stream?wallet_id=&shard_id=` → `{ type:"utxo_delta", scripthash, add[], remove[] }`
- **Spot‑check (optional):** `GET /v1/shards/verify?scripthash=...`

### Security & Ops
- In‑memory only; periodic process recycle to drop state.
- Rate‑limit & back‑pressure per client.
- Health checks per provider; auto‑failover and shard rebind.
- Encrypt transport end‑to‑end (TLS); pin certificates where possible.

---

# Step 2 — Privacy‑Preserving Personal Data Collection (Planned)

**Goal:** Collect and maintain only the data needed to back the local UTXO + BEEF archive and keep the holdings monitor current, while avoiding honeypots.

### Information Architecture (UI)
1) **Software Setup**  
   - Profiles: *Cold Monitor* (on-demand) / *Everyday Monitor* (low-cadence background).  
   - Egress: pick & test per‑shard egress (VPN‑A/B, extra VPS); TLS pinning toggle.  
   - Hygiene checks: dedicated browser profile, extensions off, local encryption on.  
   - Config fingerprinting: choose non‑default **K** (shards), jitter ranges, decoy density; per‑install sharding seed.

2) **Data Segregation & Intake** (what to enter vs never enter)  
   - Golden rules (always visible): *Never share seeds/keys. Don’t upload xpubs. Only scripthashes/outpoints leave the device.*  
   - **New Wallet** (cold/hot): collect locally → xpub/descriptor, derivation paths, gap window, labels.  
     → Send: **scripthashes** per shard to Sentinel (memory‑only).  
   - **New Transaction**: collect locally → resulting **outpoints**, notes, expected change policy.  
     → Optional: register outpoints for **spentness** via a different egress.  
   - **Exchange/Service accounts**: local tags (KYC/non‑KYC), bucket membership.  
   - **Hot vs Cold buckets**: hot = shorter cadence/more decoys; cold = longer cadence/stricter rotations.

3) **Ongoing Monitoring & Updating**  
   - **Shard board**: Shard 0..K‑1 tiles (provider, egress, health, next rotation).  
   - **UTXO view** (local‑only): bucket balances (conf/unconf), recent deltas, change detection hints.  
   - **Drift/health**: spot‑checks, alarms on stalls/rate‑limits, auto rebind.

4) **Hygiene Checkups & Export**  
   - Schedules: monthly *Rotate & refresh decoys*; quarterly *Reseed config*; annual *Gap window review*.  
   - One‑click scrub: drop all Sentinel subs; regen shard map; verify decoys.  
   - **Encrypted export** (local): labels, shard config, UTXO snapshot, event hashes.  
   - Red‑team mode: simulate provider compromise; show would‑have‑leaked view + fixups.

### SDK/API Adapters (behind a ProviderAdapter interface)
- **Electrum‑protocol** (scripthash subscribe, listunspent).  
- **Explorer REST/WebSocket** (bulk UTXO; ETag polling).  
- **Event stream** (miner/overlay tx+block events).  
- **Header sources** (multiple lightweight endpoints).  
- **Spentness/DSN** (separate provider for outpoint spent signals).

---

# Step 3 — Ongoing Tracking & Monitoring (Planned)

### Core Loop
- Client maintains live UTXO map from Sentinel deltas; periodic randomized spot‑checks per shard.
- Keep compact header chain from multiple sources for local inclusion verification.

### Alerts & Signals
- Inflow/outflow events, bucket thresholds, provider health, change detection.

### Maintenance & Rotation
- Scheduled shard→egress re‑mapping with jitter; decoy refresh; optional Tor toggle for users who want it.


### Core Loop
- Client keeps live UTXO map from Sentinel deltas.
- Periodic **spot‑checks** per shard; alert on drift/missed updates.
- Optional **header chain** fetch from multiple generic sources for independent inclusion checks of confirmed txs.

### Alerts & Signals
- **Inflow:** new UTXO detected (per bucket).  
- **Outflow:** outpoint spent; show change detection.  
- **Balance thresholds:** bucket/wallet crosses user‑set limits.  
- **Provider health:** shard stalled/rebound events.

### Privacy‑Respecting Analytics (local)
- Local charts for per‑bucket balances over time; never uploaded.  
- Local heuristics for change detection and “dust consolidation opportunities.”

### Maintenance & Rotation
- Scheduled shard→egress **re‑mapping** (e.g., every 7–30 days).  
- Decoy set refresh.  
- Key UI prompt: “Rotate egress now?” for manual control.

---

## Onboarding & Migration (User Flow)

### Triage (no-risk first)
- Import watch-only view (xpub/descriptor or addresses). Derive scripthashes **locally**.
- Bucket & **label** each cluster (Cold‑A, Savings‑2024, Hot, Project‑X). Labels never leave the device.
- Start **BEEF backfill** per funding tx of live UTXOs (newest/highest‑value first). Maintain compact headers DB.

### Decision Tree (rotate or not)
- **KYC link present?** Rotation won’t erase history → prioritize proofs + future coin control.
- **Operational risk?** (address reuse, huge single UTXOs) → plan staged rotation to fresh descriptors.
- **Urgency level** drives pacing (immediate vs slow, randomized windows).

### Rotation Playbook (privacy‑aware)
- Fresh descriptors per bucket; avoid mixing provenances.
- Shape large UTXOs first (exact‑value self‑spends; avoid change) before sending to many fresh addresses over time.
- Randomize amounts/timing; avoid consolidations. Store BEEF on arrival.

### Chronicle Helpers
- **BEEF Coverage**: % of UTXOs with stored BEEF per bucket; “Backfill next 10”.
- **Rotation Planner**: schedules, exact‑value suggestions, change rules (advice only—no signing/broadcast).
- **Coin‑Control Hints**: warns about risky co‑spends/address reuse.
- **Post‑Move Audit**: reconcile plan vs chain, auto‑label new UTXOs, store BEEF.

---

## Labeling & Buckets (Local‑Only Model)
- **Buckets**: user‑defined groups (Cold, Savings, Hot, Project). Each has its own derivation policy, cadence, and hygiene rules.
- **Labels**: free‑form tags per wallet/UTXO/tx (e.g., “salary‑2025‑10”, “gift”, “miner‑A”).
- **Views**: per‑bucket balances, per‑label filters, trend charts—**never** transmitted.
- **Exports**: encrypted local bundle (labels + shard config + UTXO snapshot + BEEF hashes).

---

## BEEF Storage Policy (Standard)
- **Store** one **BEEF** per funding tx of any UTXO you control, plus compact headers DB.
- **Prune** BEEF only for fully spent txs not needed for provenance (user‑configurable).
- **Integrity**: maintain a local hash index of BEEF blobs; verify during Hygiene Checkups.
- **Acquisition**: prefer sender/miner proofs; fallback to assembling via chosen providers; verify locally.

---

## Defaults v1 (sane, overridable)

- **Adapters:** A1 Electrum‑protocol (subscribe + listunspent), A2 Explorer REST/WS (bulk UTXO + ETag polling), A3 Event/DSN stream (outpoint spentness).
- **Privacy Profiles:**
  - **Cold Monitor (on-demand):** no scheduled background polling; used for cold/high‑value holdings when the user occasionally hits "Check now". Favors maximum decoys and wide rotation windows over freshness.
  - **Everyday Monitor (low-cadence):** background monitoring using the former Cold defaults (stricter cadence, higher decoy density). Intended for day‑to‑day wallets where a few shielded updates per hour are enough.
- **Egress:** 2× WireGuard VPN tunnels + VPS public IP; deterministic shard→egress map with periodic remap; header/JA3 normalization; no cookies.
- **Headers:** compact local DB; source from ≥3 endpoints; accept tip only if ≥2 agree; handle reorgs up to depth 6.
- **Sentinel Hardening:** memory‑only watchlists (TTL 24h inactivity); daily process recycle; no logs by default; TLS pinning (opt‑in); per‑egress rate caps & health checks; auto rebind on failure.
- **UX Guardrails:** always‑visible Do/Don’t banners; pre‑flight checks; dry‑run preview of what leaves the device (should show 0 secrets, 0 labels, N scripthashes).
- **Backups:** encrypted local bundle (labels, shard config, headers snapshot, BEEF index/hashes). No seeds/xprv/xpub.
- **Tests:** fixtures for BEEF verify; simulated providers; chaos (rate‑limit, stall, flip‑flop tip) and privacy assertions (no labels/totals in outbound).

---

## Open Decisions (to resolve later)

- **Provider shortlist:** which Electrum‑class server(s), which explorer REST/WS, which event/DSN feed; auth/quotas per adapter.
- **Tuning knobs:** default K by wallet size; rotation cadence reseed policy; decoy density per profile.
- **BEEF acquisition order:** sender/miner → assemble via public data; define assembly fallback and caching.
- **Header sources:** exact endpoints, storage format (SQLite vs flatfile), compaction cadence.
- **Coin‑control planner:** exact‑value heuristics, change‑avoidance rules, user overrides.
- **Spentness provider:** shortlist and criteria (latency, reliability, API semantics).
- **Governance:** license (MIT vs Apache‑2), contribution workflow, telemetry stance (default: none), security disclosure policy.
- **Optional Tor toggle:** supported but off by default; UX copy and routing behavior if enabled.
- **UI tech stack:** finalize React/Tailwind + shadcn/ui + Framer Motion; form library/validation; packaging/electron vs PWA decision.

---

## BEEF Archive JSON Schema v1 (Outline)

- **Schema ID:** `chronicle.proof.v1`
- **Object:** `ProofArchive`
  - `txid` (string, hex)
  - `beef` (bytes base64 or hex) — full BEEF blob
  - `beef_hash` (string, hex SHA256 of `beef`)
  - `height` (int) — confirmed block height (if known)
  - `header_hash` (string, hex) — hash of referenced header
  - `utxos` (array) — entries `{ vout, satoshis, script_hex }`
  - `labels` (array of strings) — local tags
  - `bucket` (string) — local bucket name
  - `created_at` (ISO 8601)
  - `integrity` — `{ archive_hash, algo:"sha256" }` of the canonical JSON (after normalization)
- **Notes:** canonical key ordering; no secrets; forward-compatible via `x_` extension fields.

---

## Privacy Shield v1 (Mechanics)
- **Modes:** `offline` (default), `online_shielded`.
- **Batching:** group proof fetches into batches of 3–7 items.
- **Jitter:** 500–3000 ms random delay between requests within a batch; 3–8 s between batches.
- **Chaff:** add 1–2 decoy lookups per batch (rotate decoys per rotation window).
- **Egress rotation:** shard→egress map; remap every 21–35 days with ±20% jitter.
- **Headers/JA3 normalization:** consistent User‑Agent/Accept‑Language; disable cookies; unify TLS fingerprint.
- **Caps:** max 100 lookups/hour by default; backoff on 429/5xx with exponential delay.

---

## CI Acceptance Checks (Done Criteria)
- **Offline default:** app boots in `offline`; asserts zero network calls until user switches to `online_shielded`.
- **No secrets out:** snapshot test of network client payloads (must never include seeds/xprv/xpub/labels/totals).
- **Proof loop:** import BEEF → verify with local headers → export archive → re-import and re-verify (fully offline).
- **Privacy Shield:** unit tests for batching/jitter/chaff; egress mapping honored; backoff works on rate limits.
- **Exports:** JSON/CSV/PDF and encrypted ZIP produce deterministic hashes; round-trip verify passes.

---

## Decisions (Locked for v1 Planning)
- **No wallet/sign/broadcast**; proof-first.
- **BEEF-first** artifact pipeline (not TXID-only).
- **No BYO node requirement**; public providers via Privacy Shield/Sentinel.
- **No legacy address scans** (users can use external explorers for that).
- **Exports**: JSON, CSV, PDF, encrypted ZIP (AES‑GCM), offline re‑verify.
- **Packaging**: Static build (SSG) + PWA; optional desktop wrapper (Tauri) if trivial.
- **Telemetry**: explicit **NO** (no analytics; tests enforce).

---

## SDKs & Provider Adapters — Shortlist

### Proofs & Headers
- **BEEF / BUMP models & verifiers** (TS/Go/Python) — adopt existing SDK logic; Chronicle supplies a headers client.
- **Headers client** — compact local DB; optional multi‑source header fetcher with 2‑of‑3 tip agreement.

### Data Sources (adapters behind a common interface)
- **Electrum‑protocol** (read‑only): `subscribe`, `listUnspent`, `getTx`, `getHeader`.
- **Explorer REST/WS**: mature REST with UTXO/spentness & bulk endpoints (good for shielded polling).
- **Event/Stream**: high‑efficiency tx/block feeds (second operator for diversity).
- **Spentness/DSN**: separate provider dedicated to outpoint spent signals (split from inbound discovery).

---

## Project Babbage & @bsv SDK — Notes to Incorporate
- Treat **BEEF** as a containerized SPV proof (tx + needed ancestors + one/more BUMPs).
- Verification requires only a **headers client**; Chronicle validates locally and stores BEEF per funding tx.
- Support **Paymail‑BEEF** as an input (if user receives BEEF via paymail or similar).
- Align terminology with ARC/BEEF/BUMP docs; record BRC/BEEF versions in archive metadata.

---

## Actionable Integration Plan (SDK Wiring Map — Outline)
- **proof‑engine**
  - `verifyBEEF(beefBlob, headerLookup)` → `{txid, inputs, outputs, height, ok}`
  - `indexFundingUtxos(tx)` → `[ {txid, vout, satoshis, scriptHex} ]`
  - `exportArchive(proofArchive)` / `importArchive(file)` (JSON/CSV/PDF/ZIP)
- **headers‑client**
  - Local store: `putHeader(height, header)`, `getHeader(height|hash)`
  - Tip policy: accept new tip only if ≥2 sources agree; handle reorgs up to depth 6.
- **providers** (uniform interface)
  - `subscribeScripthash(hash)` → stream status
  - `listUnspent(hash)` → UTXO list
  - `getTx(txid)` → rawtx
  - `getHeader(ref)` → header
- **sentinel** (optional service)
  - In‑memory shard registry; multi‑egress fan‑out; emits `utxo_delta` events to UI.
- **privacy‑shield** (policy package)
  - Batching 3–7; jitter 500–3000 ms; 1–2 decoys/batch; egress rotation every 21–35 days ±20%; caps & backoff.

---

## Packaging & Distribution
- **Primary**: Static site (SSG) + **PWA** (offline‑first); file‑system access via File System Access API for exports.
- **Optional**: **Tauri** wrapper for desktop (native file dialogs, tighter OS isolation) if it doesn’t complicate CI.
- **Offline ZIP**: distributable bundle for air‑gapped installs (no network required to use Core features).

---

## Roadmap Snapshot
- **M0 (Design):** finalize Sentinel contract, shard math, and provider adapters.  
- **M1 (Proto):** single‑VPS proxy, one provider per shard, WebSocket deltas end‑to‑end.  
- **M2 (Privacy):** multi‑egress (WireGuard), decoys, rotation, outpoint‑spentness split.  
- **M3 (UX):** Step‑2 collection flows, labels/buckets, local analytics.  
- **M4 (Hardening):** persistence policies, health/telemetry without PII, chaos tests.

---

## Open Questions / Decisions
- Provider shortlist & API capabilities (WebSocket vs REST; rate limits).
- Shard count **K** vs wallet size vs provider quotas.  
- Rotation cadence defaults; when to auto‑reseed shard function.
- Optional support for Tor as a user‑toggle (even if not default).

---

## Risk Model & Guarantees

### Adversary Model
- **Curious indexers/explorers:** try to cluster addresses by the sets users query and by network fingerprints.
- **Mass observers (ISPs/CDNs):** correlate requests by IP/timing.
- **Opportunistic attackers:** scrape or subpoena cloud logs.
- **Not in scope:** device‑level compromise (malware), coercion, and physical attacks.

### Guarantees (when Chronicle is used as designed)
- **No single third party sees the full wallet map.** Scripthashes are deterministically sharded and sent via distinct egress paths.  
- **Keys/xpubs never leave the user’s device.** Sentinel never receives secrets or labels.  
- **Minimal telemetry.** Sentinel holds shard state in memory only with TTLs; no server logs by default.
- **Local truth.** Balances and labels are computed and stored locally; providers never learn totals or groupings.  
- **Verification path.** Confirmed transactions can be validated via `{tx, merkle path, header}` against a locally maintained header chain.

### Non‑Goals / Limitations
- **On‑chain graph unlinkability is not guaranteed.** Poor coin control, address reuse, or large consolidations can still link activity.  
- **KYC linkage persists.** If coins touched KYC services, identity–address linkage exists off‑chain regardless of Chronicle.  
- **Endpoint compromise defeats privacy.** Malware or browser extensions can exfiltrate local data.  
- **Perfect traffic obfuscation is out of scope.** Chronicle reduces but cannot eliminate timing correlation.

### User Responsibilities
- Maintain a clean host (full‑disk encryption, minimal apps, hardened browser profile).  
- Follow coin‑control hygiene (no address reuse, careful change handling, avoid gratuitous consolidation).  
- Rotate shard→egress mappings on a schedule; refresh decoys.  
- Keep backups of local labels/config in an encrypted vault.

---

## Glossary
- **Scripthash:** Hash of `scriptPubKey`, used by Electrum‑style servers for queries & subscriptions.  
- **Outpoint:** Specific UTXO reference `txid:vout`.  
- **Sentinel:** Our stateless proxy that fans out shards to multiple providers and streams UTXO deltas back.

---

*This canvas is the foundation. Next passes will attach concrete provider adapters, message schemas, and the Step‑2 UI specs.*

