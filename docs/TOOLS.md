# TOOLS.md — NukeNote (Invite/Guest Mode Focus)

> One-page toolkit for **invite → guest accept → chat (no wallet)** and core MVP. Keep this alongside the Build Plan.

---

## 1) Chain & Wallet
- **@bsv/sdk** — single SDK for keys, transactions, PushDrop (BRC‑48) payloads.
  - NPM: https://www.npmjs.com/package/@bsv/sdk
- **Metanet (BSV) Desktop** — initiator’s wallet substrate (BRC‑6 host). Use `createAction()` and XDM/JSON‑API flows.
  - Site: https://metanetapps.com/
  - Docs: https://docs.projectbabbage.com/

**Install**
```bash
npm i @bsv/sdk
```

---

## 2) Guest Identity & Crypto (no wallet)
- **noble‑secp256k1** — ephemeral guest keypair, signatures for overlay envelopes.
- **@noble/hashes (sha256)** — compact hashing utilities.
- **Web Crypto (SubtleCrypto)** — AES‑GCM for per‑recipient key wrap/unwrap and vault encryption.

**Install**
```bash
npm i noble-secp256k1 @noble/hashes
```

**Guest keypair (TS)**
```ts
import * as secp from 'noble-secp256k1';
const guestPriv = secp.utils.randomPrivateKey();
const guestPub  = secp.getPublicKey(guestPriv, true); // compressed
```

---

## 3) Overlay (pointers/acks/presence/join)
- **ws** — minimal WebSocket relay (Overlay v0). SSE fallback optional (`express-sse` or native EventSource).
- **express** — tiny HTTP endpoints (health, SSE fallback, helper cache proxy).

**Install**
```bash
npm i ws express
```

**Overlay WS sketch (TS)**
```ts
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ port: 8787 });
wss.on('connection', ws => {
  ws.on('message', raw => {
    // raw is an envelope: { t: 'ptr'|'ack'|'pres'|'join', ... }
    // TODO: verify signature from envelope before relay
    for (const client of wss.clients) if (client !== ws && client.readyState === 1) client.send(raw);
  });
});
```

---

## 4) P2P Transport (message delivery)
- **WebRTC DataChannel** — built-in in browsers. Use **simple‑peer** to simplify offer/answer.
- **coturn** — TURN/STUN server for NAT traversal; prefer **TURN‑over‑TLS**.
- **wrtc** — Node WebRTC shim (for e2e tests only).

**Install**
```bash
npm i simple-peer
# test env only
npm i -D wrtc
```

**simple‑peer sketch (TS)**
```ts
import Peer from 'simple-peer';
const peer = new Peer({ initiator: isInitiator, trickle: true, config: { iceServers: [{ urls: 'turns:turn.example.com:5349', username: process.env.TURN_USER, credential: process.env.TURN_PASS }] }});
peer.on('signal', sig => overlayPublish({ t: 'webrtc', sig }));
// when remote signal arrives:
peer.signal(remoteSig);
peer.on('connect', () => {/* ready */});
peer.on('data', (buf) => {/* ciphertext message bytes */});
```

**coturn**
- Project: https://github.com/coturn/coturn
- Minimal config: `realm`, `lt-cred-mech`, TLS certs; rate‑limit and auth required.

---

## 5) Vault Storage (ciphertext at rest)
- **localforage** or **idb‑keyval** — IndexedDB wrappers.

**Install**
```bash
npm i localforage
# or
npm i idb-keyval
```

**Vault sketch (TS)**
```ts
import localforage from 'localforage';
await localforage.setItem(`vault:${threadId}:${msgId}`, ciphertextBytes);
```

---

## 6) Invite/QR & IDs
- **uuid** — message/thread IDs.
- **qrcode** — render invite QR (link/URL with compact blob).
- **base64url** — compact, URL‑safe encoding of invite payload.

**Install**
```bash
npm i uuid qrcode base64url
```

**Invite sketch (TS)**
```ts
import { v4 as uuid } from 'uuid';
import base64url from 'base64url';
const invite = { t: 'invite', threadId, inviter: hexPub, policy: 'initiator', wrap: perRecipientWrap, exp: Math.floor(Date.now()/1000)+86400 };
const blob = base64url.encode(JSON.stringify(invite));
const url  = `${location.origin}/invite/${blob}`;
```

---

## 7) Burn Detection (guest without wallet)
- **WhatsOnChain (REST)** — check if Thread CT UTXO is spent.
  - Docs: https://developers.whatsonchain.com/
- **JungleBus (GorillaPool)** — streaming/indexing alternative.
  - Site: https://junglebus.gorillapool.io/

**Client check (TS)**
```ts
const spent = await fetch(`${WOC}/bsv/main/tx/${ctTxid}/out/${ctVout}`).then(r=>r.json());
if (spent?.spent) purgeThread(threadId);
```

---

## 8) UI Stack (polished + fast)
- **shadcn/ui** — headless components + templates.
  - https://shadcn.io/
- **TailwindCSS** — utility CSS; tokens for brand/danger/success.
  - https://tailwindcss.com/
- **Framer Motion** — motion for delivery pills/confirmations.
  - https://www.framer.com/motion/
- **react‑hook‑form** + **zod** — consent modal + settings forms.
  - https://react-hook-form.com/ • https://zod.dev/
- **lucide‑react** — icons.
  - https://lucide.dev/

**Install (common)**
```bash
npm i framer-motion react-hook-form zod lucide-react
```

---

## 9) Helper Cache (optional fallback)
- **Express** + simple disk store or S3‑compatible bucket; store **encrypted** blobs only; TTL purge (48h default).

**Headers**
- `X-Thread-Id`, `X-Msg-Id`, `X-Blob-Hash` (to verify AEAD). No plaintext.

---

## 10) Env Vars (suggested)
```bash
OVERLAY_ENDPOINT=wss://overlay.example.com
TURN_HOST=turn.example.com
TURN_USER=nu…
TURN_PASS=•••
WOC_BASE_URL=https://api.whatsonchain.com
APP_FEE_ADDRESS=1…  # post-MVP: APP_FEE_XPUB=xpub6…
HELPER_CACHE_URL=https://cache.example.com
BSV_NETWORK=main
```

---

## 11) Quick Install Roll‑up
```bash
npm i @bsv/sdk noble-secp256k1 @noble/hashes uuid qrcode base64url localforage simple-peer ws express framer-motion react-hook-form zod lucide-react
# (dev/test)
npm i -D wrtc
```

---

## 12) Minimal Wiring Order (for CodexAI)
1) **Thread CT mint** (initiator) with @bsv/sdk → produce invite blob + QR.
2) **Guest accept** → generate ephemeral keypair → receive per‑recipient wrapped thread key → save Join Receipt → publish JoinAck.
3) **Overlay v0** (ws): pointer/ack/presence/join.
4) **WebRTC DC**: send ciphertext; retry; fallback to **Helper Cache**.
5) **Burn detection** (guest): overlay burn notice + **WOC** check → purge.
6) **UI**: consent modal (guest badge & initiator‑only burn), spend caps meter, delivery pills, leave/burn flows.

---

## 13) Supply‑Chain Hygiene (must‑do)
- Pin versions and commit a lockfile; avoid auto‑updates in CI.
- No analytics/ads SDKs; no remote code eval.
- For desktop (Tauri): CSP/SRI, code signing, reproducible builds.

---

**That’s it.** This file is intentionally focused on invite/guest‑mode MVP. Extensions (ratchets, sealed‑sender, xpub rotation, PQC) live in the Build Plan’s Post‑MVP section.

