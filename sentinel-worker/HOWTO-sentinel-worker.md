# Chronicle Sentinel Worker – Quick Actions

Follow these steps in order.

## 1. Deploy the Worker

1. Open a terminal.
2. Run:

   ```bash
   cd sentinel-worker
   wrangler deploy
   ```

3. Copy the deployed URL shown by `wrangler` (for example
   `https://chronicle-sentinel.your-account.workers.dev`).

   This is your **Sentinel base URL**.

## 2. (Optional) Configure a real UTXO snapshot API

1. Open `sentinel-worker/src/index.ts`.
2. Find:

   ```ts
   const UPSTREAM_UTXO_URL = "";
   ```

3. Replace `""` with your HTTPS endpoint that accepts `?scripthash=...`.
4. Deploy again with `wrangler deploy`.

## 3. Pair Chronicle to the Sentinel

1. Open the Chronicle web app in your browser.
2. Go to the **Inputs** tab.
3. Find the card **"Sentinel pairing (self-deployed)"**.
4. In **Sentinel base URL**, paste your Worker URL from step 1.
5. Click **Test & pair**.
6. Confirm the badge on the card shows **Paired**.

## 4. Start a live stream in Monitor

1. In Chronicle, switch network mode to **online_shielded**.
2. Go to the **Monitor** tab.
3. Scroll to **Dev wiring**.
4. Find the panel **"Sentinel live stream (dev)"**.
5. In **Wallet ID**, keep the default or type your own ID.
6. Click **Register shards & open stream**.
7. At the top of Monitor, confirm stream status shows **Stream: Sentinel**.
8. Watch **Bucket summary**, **Recent deltas**, and **BEEF coverage** update.

## 5. Reset wallet state on the Sentinel

1. Stay on the **Sentinel live stream (dev)** panel in Monitor.
2. Click **Drop wallet on Sentinel**.
3. Wait for the status message to confirm the wallet was dropped.
