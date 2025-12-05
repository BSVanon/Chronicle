const VERSION = "sentinel-worker-0.1.0";

interface Env {
  UPSTREAM_UTXO_URL?: string;
  UPSTREAM_TX_URL?: string;
  UPSTREAM_HEADER_URL?: string;
  TAAL_API_KEY?: string;
}

let upstreamUtxoUrl = "";
let upstreamTxUrl = "";
let upstreamHeaderUrl = "";
let taalApiKey = "";

declare const WebSocketPair: {
  new (): { 0: WebSocket; 1: WebSocket };
};

type WorkerWebSocket = WebSocket & {
  accept: () => void;
};

type ShardRecord = {
  scripthashes: string[];
  expiresAt: number;
};

type ShardMap = Map<number, ShardRecord>;

type SentinelUtxo = {
  txid: string;
  vout: number;
  satoshis: number;
  scriptHex: string;
  height?: number;
};

const shardsByWallet = new Map<string, ShardMap>();
const utxoStateByWallet = new Map<string, Map<string, SentinelUtxo[]>>();

function corsHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    ...extra,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders({ "Content-Type": "application/json" }),
  });
}

async function handleRegister(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "invalid JSON" }, 400);
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("walletId" in payload) ||
    !("shardId" in payload) ||
    !("scripthashes" in payload) ||
    !("ttlSec" in payload)
  ) {
    return json({ ok: false, message: "invalid shard register payload" }, 400);
  }

  const { walletId, shardId, scripthashes, ttlSec } = payload as {
    walletId: string;
    shardId: number;
    scripthashes: string[];
    ttlSec: number;
  };

  if (
    typeof walletId !== "string" ||
    typeof shardId !== "number" ||
    !Array.isArray(scripthashes) ||
    typeof ttlSec !== "number"
  ) {
    return json({ ok: false, message: "invalid shard register fields" }, 400);
  }

  const cleaned = scripthashes.filter((h) => typeof h === "string" && h.length > 0);

  const now = Date.now();
  const expiresAt = now + ttlSec * 1000;

  let shards = shardsByWallet.get(walletId);
  if (!shards) {
    shards = new Map();
    shardsByWallet.set(walletId, shards);
  }

  shards.set(shardId, { scripthashes: cleaned, expiresAt });

  return json({ ok: true });
}

function collectActiveScripthashes(walletId: string): string[] {
  const now = Date.now();
  const shards = shardsByWallet.get(walletId);
  if (!shards) return [];

  const result: string[] = [];

  for (const [id, record] of shards.entries()) {
    if (record.expiresAt <= now) {
      shards.delete(id);
      continue;
    }
    for (const hash of record.scripthashes) {
      result.push(hash);
    }
  }

  if (shards.size === 0) {
    shardsByWallet.delete(walletId);
    utxoStateByWallet.delete(walletId);
  }

  return result;
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getWalletUtxoMap(walletId: string): Map<string, SentinelUtxo[]> {
  let map = utxoStateByWallet.get(walletId);
  if (!map) {
    map = new Map();
    utxoStateByWallet.set(walletId, map);
  }
  return map;
}

function applyTemplate(urlTemplate: string, replacements: Record<string, string>): string {
  let result = urlTemplate;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(`{${key}}`, encodeURIComponent(value));
  }
  return result;
}

async function fetchSnapshotForScripthash(
  scripthash: string,
): Promise<SentinelUtxo[] | null> {
  if (!upstreamUtxoUrl) return null;
  try {
    const url = new URL(applyTemplate(upstreamUtxoUrl, { scriptHash: scripthash }));
    const headers: HeadersInit = taalApiKey ? { Authorization: taalApiKey } : {};
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return null;
    const result: SentinelUtxo[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const txid = (item as any).txid;
      const vout = (item as any).vout;
      const satoshis = (item as any).satoshis;
      const scriptHex = (item as any).scriptHex;
      const height = (item as any).height;
      if (
        typeof txid === "string" &&
        typeof vout === "number" &&
        typeof satoshis === "number" &&
        typeof scriptHex === "string"
      ) {
        const utxo: SentinelUtxo = { txid, vout, satoshis, scriptHex };
        if (typeof height === "number") {
          utxo.height = height;
        }
        result.push(utxo);
      }
    }
    return result;
  } catch {
    return null;
  }
}

async function fetchRawTxHex(txid: string): Promise<string | null> {
  if (!upstreamTxUrl) return null;
  try {
    const url = new URL(applyTemplate(upstreamTxUrl, { txid }));
    const headers: HeadersInit = taalApiKey ? { Authorization: taalApiKey } : {};
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) return null;
    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed) return null;
    return trimmed;
  } catch {
    return null;
  }
}

async function fetchBlockHeaderHex(ref: string): Promise<string | null> {
  if (!upstreamHeaderUrl) return null;
  try {
    const url = new URL(applyTemplate(upstreamHeaderUrl, { blockhash: ref }));
    const headers: HeadersInit = taalApiKey ? { Authorization: taalApiKey } : {};
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) return null;
    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed) return null;
    return trimmed;
  } catch {
    return null;
  }
}

async function makeDeltaEvent(walletId: string, scripthash: string) {
  const walletMap = getWalletUtxoMap(walletId);
  const existing = walletMap.get(scripthash) ?? [];
  const hasEntry = existing.length > 0;

  let add: SentinelUtxo[] = [];
  let remove: SentinelUtxo[] = [];

  if (!hasEntry) {
    const snapshot = await fetchSnapshotForScripthash(scripthash);
    if (snapshot && snapshot.length > 0) {
      add = snapshot;
      walletMap.set(scripthash, snapshot);
    } else {
      const satoshis = 1_000 + Math.floor(Math.random() * 50_000);
      const created: SentinelUtxo = {
        txid: randomHex(32),
        vout: 0,
        satoshis,
        scriptHex: "76a914" + "00".repeat(20) + "88ac",
      };
      add = [created];
      walletMap.set(scripthash, add);
    }
  } else {
    const current = existing[0];
    remove = [current];

    const withChange = Math.random() < 0.5;
    if (withChange) {
      const satoshis = 1_000 + Math.floor(Math.random() * 50_000);
      const created: SentinelUtxo = {
        txid: randomHex(32),
        vout: 0,
        satoshis,
        scriptHex: "76a914" + "00".repeat(20) + "88ac",
      };
      add = [created];
      walletMap.set(scripthash, add);
    } else {
      walletMap.set(scripthash, []);
    }
  }

  return {
    type: "utxo_delta" as const,
    scripthash,
    add,
    remove,
  };
}

function deleteWalletState(walletId: string) {
  const hadShards = shardsByWallet.delete(walletId);
  const hadUtxoState = utxoStateByWallet.delete(walletId);
  return { hadShards, hadUtxoState };
}

async function handleDeleteWallet(request: Request, url: URL): Promise<Response> {
  const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
  const walletId = segments[segments.length - 1];

  if (!walletId) {
    return json({ ok: false, message: "walletId is required" }, 400);
  }

  const { hadShards, hadUtxoState } = deleteWalletState(walletId);

  return json({
    ok: true,
    deletedShards: hadShards,
    deletedUtxoState: hadUtxoState,
  });
}

async function handleShieldedQuery(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "invalid JSON" }, 400);
  }

  if (!payload || typeof payload !== "object") {
    return json({ ok: false, message: "invalid query payload" }, 400);
  }

  const { kind, target } = payload as { kind?: unknown; target?: unknown };

  if (typeof kind !== "string" || typeof target !== "string") {
    return json({ ok: false, message: "kind and target must be strings" }, 400);
  }

  if (kind === "tx-proof") {
    const utxos = await fetchSnapshotForScripthash(target);
    if (!utxos) {
      return json(
        {
          ok: false,
          kind,
          target,
          message: "upstream UTXO provider unavailable or returned invalid data",
        },
        502,
      );
    }

    return json({ ok: true, kind, target, utxos });
  }

  if (kind === "tx-raw") {
    const txHex = await fetchRawTxHex(target);
    if (!txHex) {
      return json(
        {
          ok: false,
          kind,
          target,
          message:
            "upstream tx provider unavailable or returned invalid data",
        },
        502,
      );
    }

    return json({ ok: true, kind, target, txHex });
  }

  if (kind === "block-header") {
    const headerHex = await fetchBlockHeaderHex(target);
    if (!headerHex) {
      return json(
        {
          ok: false,
          kind,
          target,
          message:
            "upstream header provider unavailable or returned invalid data",
        },
        502,
      );
    }

    return json({ ok: true, kind, target, headerHex });
  }

  return json({ ok: false, message: "unsupported query kind" }, 400);
}

function startStream(socket: WorkerWebSocket, walletId: string) {
  const sendLoop = async () => {
    const anySocket: any = socket;
    if (anySocket.readyState !== anySocket.OPEN) {
      return;
    }

    const hashes = collectActiveScripthashes(walletId);

    if (hashes.length === 0) {
      socket.close(1000, "no active shards");
      return;
    }

    const index = Math.floor(Math.random() * hashes.length);
    const target = hashes[index];
    const event = await makeDeltaEvent(walletId, target);
    socket.send(JSON.stringify(event));

    setTimeout(sendLoop, 2000);
  };

  void sendLoop();
}

function handleStream(request: Request, url: URL): Response {
  const walletId = url.searchParams.get("wallet_id");
  if (!walletId) {
    return json({ ok: false, message: "wallet_id query param is required" }, 400);
  }

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair) as [WorkerWebSocket, WorkerWebSocket];

  server.accept();
  startStream(server, walletId);

  return new Response(null, {
    status: 101,
    // webSocket is a Cloudflare ResponseInit extension; cast to satisfy TS.
    webSocket: client,
  } as unknown as ResponseInit);
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    upstreamUtxoUrl = env.UPSTREAM_UTXO_URL ?? "";
    upstreamTxUrl = env.UPSTREAM_TX_URL ?? "";
    upstreamHeaderUrl = env.UPSTREAM_HEADER_URL ?? "";
    taalApiKey = env.TAAL_API_KEY ?? "";

    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === "/v1/health" && request.method === "GET") {
      return json({ ok: true, version: VERSION, providerStatus: { woc: "ok" } });
    }

    if (url.pathname === "/v1/shards/register" && request.method === "POST") {
      return handleRegister(request);
    }

    if (url.pathname === "/v1/stream" && request.method === "GET") {
      return handleStream(request, url);
    }

    if (url.pathname === "/v1/shielded-query" && request.method === "POST") {
      return handleShieldedQuery(request);
    }

    if (url.pathname.startsWith("/v1/wallets/") && request.method === "DELETE") {
      return handleDeleteWallet(request, url);
    }

    return new Response("Not found", { status: 404, headers: corsHeaders() });
  },
};

export default worker;
