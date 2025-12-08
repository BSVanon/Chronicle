# Chronicle Cold Vault — Code Audit & Implementation Plan

This document audits the existing codebase against the Cold Vault Archive v1
brief and proposes a minimal implementation plan.

---

## 1. Code Audit: What to Keep, Adapt, or Remove

### ✅ KEEP (directly useful)

| Module | Location | Notes |
|--------|----------|-------|
| **Offline gate** | `core/net/offline-gate.ts` | Enforces offline-by-default; wrap all network calls. Keep as-is. |
| **BEEF parser** | `core/beef/index.ts` | Parses BEEF-like JSON, extracts UTXOs/scripthashes. Adapt to return `UtxoDossier` shape. |
| **BEEF verifier** | `core/beef/verify.ts` | Merkle proof verification against headers. Keep; wire to headers store. |
| **BEEF archive** | `core/beef/archive.ts` | Entry types, serialization. Adapt to new `ProofArchive` schema. |
| **Headers store** | `core/headers/store.ts` | Basic header storage. Extend for tip management, reorg handling, import/export. |
| **Privacy Shield planner** | `core/privacy/privacy-shield.ts` | Batching, jitter, chaff logic. Keep for online fetches. |
| **Privacy Shield executor** | `core/privacy/privacy-executor.ts` | HTTP execution with timeout. Keep for shielded fetches. |
| **Bucket context** | `contexts/bucket-context.tsx` | Local bucket storage. Simplify; remove scripthash arrays (dossiers own bucket). |
| **Network mode context** | `contexts/network-mode-context.tsx` | Offline/online_shielded toggle. Keep as-is. |
| **Theme context** | `contexts/theme-mode-context.tsx` | Dark/light toggle. Keep. |
| **BEEF archive context** | `contexts/beef-archive-context.tsx` | Local BEEF storage. Adapt to new schema. |
| **Header store context** | `contexts/header-store-context.tsx` | React wrapper for headers. Keep. |

### 🔧 ADAPT (partial rewrite)

| Module | Location | Changes Needed |
|--------|----------|----------------|
| **Tracked outpoints** | `core/utxo/tracked-outpoint.ts`, `contexts/tracked-outpoints-context.tsx` | Rename to "UTXO Dossier"; add all dossier fields; wire to bucket + BEEF hash. |
| **UTXO engine** | `core/utxo/engine.ts` | Simplify to a dossier store (no streaming deltas); compute bucket balances from dossiers. |
| **Shielded provider** | `core/providers/shielded-provider.ts`, `shielded-readonly-provider.ts` | Keep for optional online tx/header fetches; remove scripthash-centric logic. |

### ❌ REMOVE (not needed for Cold Vault)

| Module | Location | Reason |
|--------|----------|--------|
| **Sentinel client** | `core/sentinel/client.ts` | No Sentinel Worker in Cold Vault; optional online fetches go through Privacy Shield directly. |
| **Sentinel types** | `core/sentinel/types.ts` | Sentinel-specific types not needed. |
| **Shard planner** | `core/sentinel/shard-planner.ts`, `register-planner.ts`, `shard-config.ts` | Sharding was for Sentinel streaming; not applicable. |
| **Shard config context** | `contexts/shard-config-context.tsx` | Not needed. |
| **Sentinel config context** | `contexts/sentinel-config-context.tsx` | Not needed. |
| **UTXO stream context** | `contexts/utxo-stream-context.tsx` | Streaming was for Sentinel; dossiers are static. |
| **Watch-only analyzer** | `core/wallet/watch-only-analyzer.ts` | No xpub/address scanning by default. |
| **Watch-only derivation** | `core/wallet/watch-only-derivation.ts` | No derivation; user adds UTXOs manually. |
| **Watch-only context** | `contexts/watch-only-context.tsx` | Not needed. |
| **Wallets context** | `contexts/wallets-context.tsx` | No wallet management. |
| **Privacy profiles** | `core/privacy/profiles.ts`, `contexts/privacy-profile-context.tsx` | Simplify to single "Shielded" mode; no Cold/Everyday profiles. |
| **Local wallet** | `core/wallet/local-wallet.ts` | No key storage. |
| **Derived demo** | `core/utxo/derived-demo.ts` | Dev artifact. |
| **Snapshot provider** | `core/providers/snapshot-provider.ts` | Stub; not needed. |

### UI Pages: Rebuild from Scratch

The current `/monitor`, `/onboarding`, `/settings` pages are built around the
Sentinel/streaming model. For Cold Vault:

- **Delete** all existing page components.
- **Rebuild** with the Cold Vault UX:
  - `/` (Home): Buckets list, balances, coverage, status chip.
  - `/add` (Add UTXO Wizard): BEEF/txid input → output selection → dossier creation.
  - `/headers`: Header tip display, update/import buttons.
  - `/beef`: BEEF drop zone, verification, coverage report.
  - `/export`: Encrypted archive export/import.
  - `/settings`: Theme, hygiene checks.

---

## 2. Implementation Plan (Minimal Path)

### Phase 1: Core Data Layer (offline-only)

**Goal:** Store and retrieve UTXO dossiers, BEEF blobs, and headers locally.

1. **Define types** (`core/dossier/types.ts`):
   - `UtxoDossier` (matches brief).
   - `ProofArchive` (matches brief).
   - `BeefIndex` (txid → beef_hash).

2. **Dossier store** (`core/dossier/store.ts`):
   - IndexedDB-backed store for dossiers.
   - CRUD operations.
   - Bucket filtering.
   - Balance computation (sum of `value_satoshis` per bucket).

3. **BEEF store** (`core/beef/store.ts`):
   - IndexedDB-backed store for BEEF blobs.
   - Keyed by txid.
   - Hash index maintenance.

4. **Headers store** (extend `core/headers/store.ts`):
   - IndexedDB-backed.
   - Append-only with tip tracking.
   - Reorg handling (keep last 6).
   - Import/export as file.

5. **React contexts**:
   - `DossierContext`: wraps dossier store.
   - `BeefStoreContext`: wraps BEEF store.
   - `HeaderStoreContext`: already exists; extend.

### Phase 2: BEEF Verification (offline)

**Goal:** Verify BEEF blobs against local headers.

1. **Wire verifier** (`core/beef/verify.ts`):
   - Already exists.
   - Connect to header store's `headerLookup(height|hash)`.

2. **Verification status on dossiers**:
   - `verified: { at_height, ok, checked_at }`.
   - Re-verify on header updates.

3. **Pending headers queue**:
   - If BEEF references unknown header, mark dossier as "pending".
   - Re-verify when headers arrive.

### Phase 3: Add UTXO Wizard (offline)

**Goal:** User can add a UTXO from BEEF file (offline).

1. **BEEF import**:
   - Drag-drop or file picker.
   - Parse BEEF → extract outputs.
   - User selects vout.
   - Create dossier + store BEEF.
   - Verify immediately if headers present.

2. **Raw tx hex import** (fallback):
   - Parse tx → extract outputs.
   - User selects vout.
   - Create dossier (no BEEF yet; coverage = 0%).

3. **Txid input** (placeholder for Phase 5):
   - Show "requires online fetch" message.
   - Disabled until Phase 5.

### Phase 4: Home UI (offline)

**Goal:** Display buckets, balances, coverage.

1. **Home page** (`/`):
   - List buckets.
   - Per-bucket: balance (sum of dossiers), BEEF coverage %.
   - Status chip: Offline / Online (Shielded).

2. **Bucket management**:
   - Create/rename/delete buckets.
   - Assign dossiers to buckets.

3. **Dossier list per bucket**:
   - Show outpoint, value, verified status.
   - Click to view details.

### Phase 5: Online Fetches (shielded)

**Goal:** Fetch headers and proofs when user opts in.

1. **Headers update**:
   - Query 3 endpoints (configurable).
   - 2-of-3 agreement on tip.
   - Append to local store.
   - Re-verify pending dossiers.

2. **Proof fetch from txid**:
   - User pastes txid.
   - Privacy Shield batches request.
   - Fetch raw tx + BUMP/BEEF.
   - Store BEEF + create dossier.

3. **Backfill coverage**:
   - For dossiers without BEEF, offer "Backfill" button.
   - Fetch BEEF via Privacy Shield.

### Phase 6: Export & Backup

**Goal:** Encrypted archive export/import.

1. **Export**:
   - Collect headers, BEEF blobs, dossier index, BEEF index.
   - Package as ZIP.
   - Encrypt with user passphrase (AES-GCM via WebCrypto).

2. **Import**:
   - Decrypt ZIP.
   - Load headers, BEEF, dossiers.
   - Re-verify all BEEF against included headers.

3. **Integrity check**:
   - Re-hash all BEEF blobs.
   - Compare to stored `beef_hash`.
   - Report mismatches.

### Phase 7: Polish & Tests

1. **Hygiene UI**:
   - BEEF coverage bar per bucket.
   - Integrity check button.
   - "No secrets detected" watchdog on paste inputs.

2. **Tests**:
   - Offline default → zero network calls.
   - No secrets in outbound payloads.
   - BEEF verify passes with local headers only.
   - Export → re-import → re-verify (offline).

3. **PWA packaging**:
   - Service worker for offline use.
   - Installable.

---

## 3. Immediate Next Steps

### ✅ COMPLETED (Phase 1)

1. ~~**Delete dead code** (Sentinel, shard, watch-only, streaming modules).~~
2. ~~**Define core types** (`UtxoDossier`, `ProofArchive`, `BeefIndex`).~~
3. ~~**Implement dossier store** (IndexedDB).~~
4. ~~**Implement BEEF store** (IndexedDB).~~
5. ~~**Extend headers store** (tip, reorg, import/export).~~
6. ~~**Build Add UTXO Wizard** (BEEF import path only).~~
7. ~~**Build Home page** (buckets, balances, coverage).~~
8. ~~**Build Headers page** (import/export).~~
9. ~~**Build BEEF page** (import, integrity check).~~
10. ~~**Build Export page** (plain + encrypted archive export).~~

### ✅ COMPLETED (Phase 2-6)

11. ~~**Wire BEEF verifier** using @bsv/sdk with local ChainTracker.~~
12. ~~**Online header fetches** from WhatsOnChain.~~
13. ~~**Archive import** (plain JSON + AES-256-GCM encrypted).~~
14. ~~**Dead code cleanup** (removed Sentinel, privacy-shield, old providers).~~

### ✅ COMPLETED (Phase 7)

15. ~~**Dossiers page** — view/delete individual UTXOs.~~
16. ~~**Settings page** — network mode, bucket CRUD, clear data.~~
17. ~~**Fetch BEEF from txid** — assemble BEEF from WoC TSC proofs.~~
18. ~~**Bulk CSV import** — quick UTXO entry without BEEF.~~

### Remaining Work

- **Future:** PWA packaging, service worker, installable app.
- **Future:** Multi-provider header consensus (2-of-3).
- **Future:** xPub derivation helper (offline address generation).

---

## 4. Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Core Data Layer | 1 day |
| Phase 2: BEEF Verification | 0.5 day |
| Phase 3: Add UTXO Wizard | 1 day |
| Phase 4: Home UI | 1 day |
| Phase 5: Online Fetches | 1 day |
| Phase 6: Export & Backup | 1 day |
| Phase 7: Polish & Tests | 1 day |
| **Total** | **~6-7 days** |

This is a realistic estimate for a focused build with no scope creep.
