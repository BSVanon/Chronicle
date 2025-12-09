# Chronicle Cold Vault Archive

Chronicle is a client-side "cold vault" for your Bitcoin SV (BSV) UTXOs.

It helps you:

- Track long-term UTXO holdings in buckets (e.g. cold A, cold B).
- Store and verify BEEF proofs for those UTXOs.
- Maintain a local archive of headers so you can independently verify inclusion.
- Export/import your inventory and proofs for offline storage.

Chronicle is **offline-first**:

- All state is stored locally in your browser (IndexedDB).
- There is no server-side account or backend.
- You can run it completely offline after the initial load.

## Live site

The latest build of Chronicle is published via GitHub Pages at:

- https://chronicle.nullify.onl

You can also run it on your own domain via a CNAME pointing at `bsvanon.github.io`.

## Repository

This repository contains:

- `web/` – Next.js 16 app (App Router, static export)
- `lib/` and other folders – shared logic and tooling
- `docs/` – local-only notes (ignored from the public repo history)
- `sentinel-worker/` – experimental Cloudflare Worker integration (ignored from public repo)

Only the `web/` app and core libraries are required to run Chronicle.

## Development

Requirements:

- Node.js 20+
- npm 10+

### Install dependencies

From the repo root:

```bash
cd web
npm ci
```

### Run dev server

```bash
npm run dev
```

This starts Next.js at http://localhost:3000.

### Build static site

```bash
npm run build:export
```

The static export is written to `web/out/`.

## Deployment (GitHub Pages)

Deployment is automated via GitHub Actions.

- Workflow: `.github/workflows/deploy-pages.yml`
- On every push to `main`:
  - Install dependencies in `web/`
  - Run `npm run build:export`
  - Upload `web/out/` as the Pages artifact
  - Deploy to GitHub Pages using `actions/deploy-pages`

The site is built with:

- `NEXT_PUBLIC_BASE_PATH=/Chronicle`

so that assets and routes resolve correctly under `https://<user>.github.io/Chronicle/`.

## Security & privacy

Chronicle is designed so that sensitive information (keys, seeds) **never** leaves your machine:

- Chronicle does **not** store private keys or seeds.
- All UTXO/proof data is stored locally.
- When online mode is enabled, network access is limited to fetching headers and proof data.
- Requests are batched with jitter and decoys to reduce correlation.

Always verify the build and host Chronicle somewhere you control if you have a high security requirement.

## License

Open BSV
