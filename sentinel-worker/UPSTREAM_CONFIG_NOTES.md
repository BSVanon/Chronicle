# Sentinel Worker Upstream Configuration

This worker is the only "backend" Chronicle expects. It fans out from the browser to one or more upstream BSV APIs.

## 1. Current upstream env vars

The Worker reads the following env vars (see `Env` in `src/index.ts`):

- `UPSTREAM_UTXO_URL`
- `UPSTREAM_TX_URL`
- `UPSTREAM_HEADER_URL`

These are **internal to the Worker deployment** and are *not* exposed to the front-end. They control how the Worker talks to your chosen BSV provider(s).

### Expected shapes

The current implementation assumes the following query patterns:

- `UPSTREAM_UTXO_URL?scripthash=<hex>`
  - Returns JSON array of objects: `{ txid, vout, satoshis, scriptHex, height? }[]`.
- `UPSTREAM_TX_URL?txid=<hex>`
  - Returns raw tx hex as plain text.
- `UPSTREAM_HEADER_URL?ref=<height-or-hash>`
  - Returns raw block header hex as plain text.

If a real provider uses different paths or parameter names, either:

- adjust the Worker code to match that provider directly, or
- point these env vars at a thin adapter endpoint you control which reshapes the request/response.

## 2. Provider choices (to decide later)

For production we need to decide:

- Which upstream(s) to trust (e.g. TAAL / WhatsOnChain, GorillaPool, self-hosted node).
- How to authenticate (API key header, query param, etc.).
- Whether to support multiple networks (main/test) via separate Workers or envs.

The front-end only needs a **Sentinel base URL**; all provider details live here on the Worker.

## 3. TAAL / WhatsOnChain integration notes

We already have a `TAAL_API_KEY` env var set on the Worker, but the current code does **not** use it yet. When we wire this up we will need to:

- Extend `Env` to include `TAAL_API_KEY?: string` (or a more generic `UPSTREAM_API_KEY`).
- Attach it as the appropriate header (for example `Authorization: <key>`) on requests to the chosen TAAL/WhatsOnChain endpoints.
- Set `UPSTREAM_UTXO_URL`, `UPSTREAM_TX_URL`, and `UPSTREAM_HEADER_URL` to the concrete TAAL/WOC endpoints we decide to use.

Because upstream API docs may change and often require authentication, Chronicle does **not** hard-code any single provider here. The Worker is intentionally provider-agnostic; env vars + small helpers define how it talks to the upstream.

## 4. Open questions

- Which exact TAAL endpoints should we adopt for:
  - scripthash UTXO snapshot
  - tx raw hex
  - block header hex
- Do we want separate Workers per network (main/test) or a single Worker with a `NETWORK` env var?
- Do we need rate-limiting / backoff logic in the Worker if the upstream is unavailable?
