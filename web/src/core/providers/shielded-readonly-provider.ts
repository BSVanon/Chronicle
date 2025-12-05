import type { ReadOnlyProvider, Scripthash, Utxo } from "@/core/providers/types";
import type {
  PrivacyShieldContext,
  PrivacyShieldSettings,
} from "@/core/privacy/privacy-shield";
import {
  DEFAULT_PRIVACY_SHIELD_SETTINGS,
} from "@/core/privacy/privacy-shield";
import {
  planGetHeaderShielded,
  planGetTxShielded,
  planListUnspentShielded,
} from "@/core/providers/shielded-provider";
import type {
  ShieldedExecutorHttpClient,
  ShieldedExecutionResult,
} from "@/core/privacy/privacy-executor";
import { executePrivacyShieldPlan } from "@/core/privacy/privacy-executor";

export type ShieldedProviderDeps = {
  /** Base HTTP URL for the Sentinel, e.g. https://sentinel.example.com */
  sentinelBaseUrl: string;
  /** HTTP client, typically backed by guardedFetch on the web side. */
  http: ShieldedExecutorHttpClient;
  /** Optional overrides for privacy shield behaviour. */
  settingsOverrides?: Partial<PrivacyShieldSettings>;
  /** Optional rolling lookup usage for cap enforcement. */
  getLookupsUsedLastHour?: () => number;
};

function buildShieldedEndpoint(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = "/v1/shielded-query";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function buildContext(endpoint: string, deps: ShieldedProviderDeps): PrivacyShieldContext {
  const lookupsUsedLastHour = deps.getLookupsUsedLastHour
    ? deps.getLookupsUsedLastHour()
    : 0;

  return {
    endpoint,
    nowMs: Date.now(),
    lookupsUsedLastHour,
  };
}

function mergeSettings(
  overrides?: Partial<PrivacyShieldSettings>,
): PrivacyShieldSettings {
  if (!overrides) return DEFAULT_PRIVACY_SHIELD_SETTINGS;
  return { ...DEFAULT_PRIVACY_SHIELD_SETTINGS, ...overrides };
}

function ensureSingle<T>(items: T[], what: string): T {
  if (items.length === 0) {
    throw new Error(`No successful ${what} result returned from Sentinel`);
  }
  return items[0];
}

function extractListUnspentFromResult(
  result: ShieldedExecutionResult,
  target: Scripthash,
): Utxo[] {
  const all = result.batches.flatMap((b) => b.results);
  const realProofs = all.filter(
    (r) => !r.isChaff && r.kind === "tx-proof" && r.target === target,
  );

  if (realProofs.length === 0) {
    return [];
  }

  const utxos: Utxo[] = [];

  for (const r of realProofs) {
    if (!r.ok) continue;
    const body = r.body as
      | { ok?: unknown; utxos?: unknown }
      | null
      | undefined;
    if (!body || body.ok !== true) continue;
    const raw = body.utxos;
    if (!Array.isArray(raw)) continue;

    for (const item of raw) {
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
        const utxo: Utxo = { txid, vout, satoshis, scriptHex };
        if (typeof height === "number") {
          utxo.height = height;
        }
        utxos.push(utxo);
      }
    }
  }

  return utxos;
}

function extractTxHexFromResult(
  result: ShieldedExecutionResult,
  target: string,
): string {
  const all = result.batches.flatMap((b) => b.results);
  const matches = all.filter(
    (r) => !r.isChaff && r.kind === "tx-raw" && r.target === target,
  );

  const chosen = ensureSingle(matches, "tx-raw");
  if (!chosen.ok) {
    throw new Error(chosen.error || "Sentinel tx-raw query failed");
  }

  const body = chosen.body as { ok?: unknown; txHex?: unknown } | null | undefined;
  if (!body || body.ok !== true || typeof body.txHex !== "string") {
    throw new Error("Sentinel tx-raw response had unexpected shape");
  }

  return body.txHex;
}

function extractHeaderHexFromResult(
  result: ShieldedExecutionResult,
  target: string,
): string {
  const all = result.batches.flatMap((b) => b.results);
  const matches = all.filter(
    (r) => !r.isChaff && r.kind === "block-header" && r.target === target,
  );

  const chosen = ensureSingle(matches, "block-header");
  if (!chosen.ok) {
    throw new Error(chosen.error || "Sentinel block-header query failed");
  }

  const body = chosen.body as { ok?: unknown; headerHex?: unknown } | null | undefined;
  if (!body || body.ok !== true || typeof body.headerHex !== "string") {
    throw new Error("Sentinel block-header response had unexpected shape");
  }

  return body.headerHex;
}

export function createShieldedReadOnlyProvider(
  deps: ShieldedProviderDeps,
): ReadOnlyProvider {
  const endpoint = buildShieldedEndpoint(deps.sentinelBaseUrl);
  const settings = mergeSettings(deps.settingsOverrides);

  return {
    async listUnspent(scripthash: Scripthash): Promise<Utxo[]> {
      const context = buildContext(endpoint, deps);
      const plan = planListUnspentShielded([scripthash], context, settings);
      const result = await executePrivacyShieldPlan(plan, deps.http);
      return extractListUnspentFromResult(result, scripthash);
    },

    async getTx(txid: string): Promise<string> {
      const context = buildContext(endpoint, deps);
      const plan = planGetTxShielded([txid], context, settings);
      const result = await executePrivacyShieldPlan(plan, deps.http);
      return extractTxHexFromResult(result, txid);
    },

    async getHeader(ref: string): Promise<string> {
      const context = buildContext(endpoint, deps);
      const plan = planGetHeaderShielded([ref], context, settings);
      const result = await executePrivacyShieldPlan(plan, deps.http);
      return extractHeaderHexFromResult(result, ref);
    },
  };
}
