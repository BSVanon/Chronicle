# Chronicle — Cold Vault Archive (v1)

**Goal:** A small, offline-first app that helps a user maintain everything needed
to validate and later spend their long-term BSV without asking an indexer what
they own.

---

## The Three Pillars

### 1. UTXO Dossiers (ownership inventory)

For each coin you hold long-term:

| Field | Description |
|-------|-------------|
| `outpoint` | `txid:vout` |
| `value_satoshis` | Amount in satoshis |
| `locking_script_hex` | The scriptPubKey (or null if `funding_tx_raw` is stored) |
| `labels` | User tags; local only |
| `bucket` | Cold-A, Savings-2025, etc.; local only |
| `derivation_hint` | Optional path/index; local only |

**Purpose:** You can construct spends later without asking "what do I own?"

### 2. BEEF Proof Bundles (SPV proofs + ancestry)

For every funding transaction that created one of your UTXOs:

- Store one BEEF blob (tx + necessary ancestors + BUMPs).
- Keep a hash index: `beef_hash = sha256(beef_blob)`.

**Purpose:** You never need third parties to re-serve old parents/proofs.

### 3. Best-chain Block Headers (lightweight chain context)

A compact, append-only headers store:

- Tip management.
- Reorg handling up to depth 6.

**Purpose:** Verify BEEFs locally (Merkle roots at height, etc.) without trust.

---

## Hard Truth

Proving **unspentness** without any third party ultimately requires node-level
state. The app should **not** promise "unspent" offline; it shows:

- Your inventory (what you intend to hold).
- Verified inclusion proofs.

Later, the user may cross-check spentness through their chosen means.

---

## Non-Goals (keep the app small)

- No seed/xprv import; no key storage; no signing/broadcasting; no telemetry.
- No watch-only wallet scanning or xpub uploads by default.
- No dependence on always-on servers (the app is useful fully offline).

---

## UX (plain English)

### Home

- **Buckets list** (Cold-A, Cold-B, Savings-2025):
  - Each shows **Confirmed Balance** (sum of dossiers) and **BEEF coverage %**.
- **Status chip:** Offline (default) or Online (Shielded).

### Add UTXO (Wizard)

1. **Identify funding tx**
   - Paste BEEF file (preferred), raw tx hex, or txid.
   - Txid triggers optional online fetch guarded by Privacy Shield.

2. **Select the output**
   - Show outputs; user selects vout.
   - Enter value only if not derivable.

3. **Store dossier**
   - Choose bucket & labels.
   - App persists: dossier + BEEF (if provided).

4. **Verify (offline)**
   - If headers present: verify immediately, show PASS/FAIL.
   - Else queue until headers are fetched/imported.

### Headers

- **"Update headers" button:**
  - When online: fetch latest headers (multi-source, 2-of-3 agreement) and append.
  - When offline: show current tip.
- **"Import headers file"** (offline path).

### BEEF

- Drop zone to import multiple BEEFs.
- Verify all against local headers.
- Attach to matching dossiers.
- Report coverage.

### Exports & Backups

One-click **Encrypted Archive (ZIP)** containing:

```
/headers/              # compact DB
/beef/<txid>.beef
/index/utxos.json      # local index; no secrets
/index/beef-index.json # txid → beef_hash
```

All exports re-verifiable offline when re-imported.

### Hygiene

- **"BEEF Coverage"** bar per bucket.
- **"Integrity Check":** re-hash BEEF files and compare to index.
- **"No secrets detected"** banner (seed/xprv/xpub watchdog on clipboard/paste inputs).

---

## Data Model

### ProofArchive JSON (`chronicle.proof.v1`)

```json
{
  "txid": "hex",
  "beef": "base64",
  "beef_hash": "hex",
  "height": 123456,
  "header_hash": "hex",
  "utxos": [{ "vout": 1, "satoshis": 12345, "script_hex": "..." }],
  "labels": ["Cold-A"],
  "bucket": "Cold-A",
  "created_at": "2025-12-06T12:00:00Z",
  "integrity": { "archive_hash": "hex", "algo": "sha256" }
}
```

### UTXO Dossier (`utxos.json` entry)

```json
{
  "outpoint": "txid:vout",
  "value_satoshis": 12345,
  "locking_script_hex": "...",
  "funding_txid": "txid",
  "funding_tx_raw": null,
  "bucket": "Cold-A",
  "labels": ["vault"],
  "derivation_hint": null,
  "beef_hash": "hex",
  "verified": { "at_height": 123456, "ok": true, "checked_at": "iso8601" }
}
```

---

## Storage Layout

```
/chronicle/
  headers/                     # compact headers DB
  beef/
    <txid>.beef
  index/
    utxos.json                 # array of dossiers
    beef-index.json            # { "<txid>": "<beef_hash>" }
  exports/
    chronicle-YYYYMMDD.zip     # encrypted backup bundles
```

---

## Networking (strict)

**Default OFFLINE.** No network calls unless user flips to Online (Shielded).

### Privacy Shield rules (when online)

- Batch fetches: 3–7 items.
- Jitter: 500–3000 ms between requests; 3–8 s between batches.
- Add 1–2 decoy requests per batch (discarded locally).
- Cap: ≤100 requests/hour; exponential backoff on rate limits.
- **No secrets, no labels, no totals ever in outbound payloads.**

### Headers updating (optional online)

- Query ≥3 independent header endpoints.
- Accept tip only if 2-of-3 agree.
- Append headers; keep last N for reorg handling (e.g., 6).

### Proof fetch (optional online)

- Prefer BEEF ingestion from the payer/miner.
- If given txid only, fetch raw tx + BUMP/BEEF from user-selected sources with
  Privacy Shield on.

---

## Implementation Notes

### Tech

- React (PWA) or desktop wrapper later.
- IndexedDB for local storage.
- WebCrypto AES-GCM for encrypted ZIP.

### BEEF

- Use an existing BSV SDK BEEF verifier; do not hand-roll format.
- App supplies `headerLookup(height|hash)`.

### Headers

- Small chain-tracker with tip selection, reorg support.
- Import/exportable DB file.

### File I/O

- Implement importers (BEEF, headers, archive ZIP) and exporters (archive ZIP).
- All must work offline.

### Testing

No telemetry. Add unit/e2e tests to assert:

- Offline default → zero network calls.
- No secrets in outbound payloads.
- BEEF verify passes with local headers only.
- Exports re-verify after re-import (offline).

---

## User Stories (acceptance)

### Add UTXO from BEEF (offline)

As a user, I drag-drop a BEEF file; the app verifies it against local headers
and lets me pick which vout I own. It creates a dossier and shows it in my
bucket. No network used.

### Add UTXO from txid (shielded)

I paste a txid. After I toggle Online (Shielded), the app fetches raw tx + proof
with batching/jitter and stores BEEF + dossier. When I flip back offline, it
re-verifies from local cache.

### Headers maintenance

With one click, I fetch/append headers from 3 sources. The app accepts tip only
if 2 agree; it keeps enough for small reorgs. Works offline afterward.

### Coverage & integrity

The app shows "BEEF Coverage 92%" for my Cold-A bucket. I click "Backfill next
5" (shielded), then run an "Integrity Check" that re-hashes BEEF files.

### Encrypted backup & restore

I export an encrypted ZIP. On another machine (air-gapped), I import the ZIP,
and the app lists my buckets/UTXOs and verifies all BEEF against the included
headers—entirely offline.

---

## Edge Cases

- **Duplicate BEEF ingested for the same txid** → keep one; verify hash match.
- **BEEF references a header not in local DB** → mark "pending headers"; verify
  once headers arrive.
- **Partial dossiers** (no `locking_script_hex` but full funding tx present) →
  derive script from tx on verify.
- **Time skew / reorgs up to depth N** → re-run verification and update
  `verified.at_height`.
- **Large archives** → stream verification (don't hang the UI).

---

## Truth in Labeling (what the UI must NOT claim)

- Do **not** claim "this UTXO is unspent" when offline—only "this UTXO was
  created by a transaction proven in block H (verified)."
- Make explicit that unspentness requires current chain state (user's choice
  later: run a node, query multiple providers, etc.).

---

## Summary

If this brief is followed, you get a small, reliable, offline-useful app that:

1. Lets you **own your inventory** (UTXO dossiers).
2. Keeps **portable, verified proofs** (BEEF).
3. Maintains the **headers needed to verify** those proofs.
4. Stays **honest about what cannot be known** without current chain state.
