# Chronicle — Cold Vault Archive

A privacy-focused, offline-first app for managing your long-term BSV holdings. Chronicle stores everything needed to validate and spend your UTXOs without relying on third-party indexers.

## Quick Start

1. **Add your first UTXO** — Click "+ Add UTXO" on the dashboard
2. **Enter a transaction ID** — The app will fetch the BEEF proof automatically
3. **Verify your proofs** — Go to Validation and click "Verify All"
4. **Export a backup** — Use Export to save an encrypted archive

---

## What Chronicle Does

Chronicle is a **proof archive**, not a wallet. It stores:

| Component | Purpose |
|-----------|---------|
| **UTXO Dossiers** | Your ownership inventory (outpoint, value, script, labels) |
| **BEEF Proofs** | SPV proofs that cryptographically prove your UTXOs exist |
| **Block Headers** | Local header chain for offline Merkle verification |

---

## Key Features

### 🔒 Offline by Default
No network calls unless you explicitly go online. Your UTXO inventory stays private.

### 🛡️ Privacy Shield
When online, requests are protected with:
- **Batching** — Requests grouped in batches of 3-7
- **Jitter** — Random 0.5-3 second delays
- **Decoys** — Fake txids mixed in and discarded locally
- **Rate limiting** — Max 100 requests/hour

### ✓ Local Verification
BEEF proofs are verified against locally-stored block headers using the BSV SDK. No trust required.

### 🔐 Encrypted Export
Export your entire archive with AES-256-GCM encryption for secure backups.

---

## Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Overview of balances, BEEF coverage, verification status |
| **Add** | Add UTXOs by txid, BEEF JSON, or CSV import |
| **Dossiers** | View and manage your UTXO inventory |
| **Validation** | Verify BEEF proofs and sync headers |
| **Export** | Full archive or selective UTXO export |
| **Settings** | Network mode, bucket management, data reset |

---

## Running Locally

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Building for Production

```bash
npm run build
npm start
```

---

## Data Storage

All data is stored locally in your browser using IndexedDB:
- `chronicle-cold-vault` — Main database
- No server, no cloud, no accounts

To reset all data: Settings → Danger Zone → Clear All Data

---

## Privacy Notes

- **No telemetry or analytics**
- **No API keys required** — Uses WhatsOnChain public API
- **Offline by default** — Network only when you choose
- **Decoy protection** — Even when online, your queries are obfuscated

---

## Technical Details

- **Framework:** Next.js 16 with App Router
- **UI:** Tailwind CSS + shadcn/ui components
- **Crypto:** @bsv/sdk for BEEF parsing and verification
- **Storage:** IndexedDB via native browser APIs

---

## License

MIT
