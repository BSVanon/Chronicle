import type {
  PrivacyShieldContext,
  PrivacyShieldPlan,
  PrivacyShieldSettings,
  RealQueryInput,
} from "@/core/privacy/privacy-shield";
import {
  DEFAULT_PRIVACY_SHIELD_SETTINGS,
  planPrivacyShieldBatches,
} from "@/core/privacy/privacy-shield";
import type { Scripthash } from "@/core/providers/types";

function mergeSettings(
  base: PrivacyShieldSettings,
  overrides?: Partial<PrivacyShieldSettings>,
): PrivacyShieldSettings {
  if (!overrides) return base;
  return { ...base, ...overrides };
}

function buildListUnspentQueries(scripthashes: Scripthash[]): RealQueryInput[] {
  return scripthashes.map((hash) => ({
    kind: "tx-proof",
    // We treat the scripthash as the target identifier here; concrete
    // providers will map this to their UTXO endpoint semantics.
    target: hash,
  }));
}

function buildTxQueries(txids: string[]): RealQueryInput[] {
  return txids.map((txid) => ({
    kind: "tx-raw",
    target: txid,
  }));
}

function buildHeaderQueries(refs: string[]): RealQueryInput[] {
  return refs.map((ref) => ({
    kind: "block-header",
    target: ref,
  }));
}

export function planListUnspentShielded(
  scripthashes: Scripthash[],
  context: PrivacyShieldContext,
  settingsOverrides?: Partial<PrivacyShieldSettings>,
): PrivacyShieldPlan {
  const settings = mergeSettings(DEFAULT_PRIVACY_SHIELD_SETTINGS, settingsOverrides);
  const queries = buildListUnspentQueries(scripthashes);
  return planPrivacyShieldBatches(queries, settings, context);
}

export function planGetTxShielded(
  txids: string[],
  context: PrivacyShieldContext,
  settingsOverrides?: Partial<PrivacyShieldSettings>,
): PrivacyShieldPlan {
  const settings = mergeSettings(DEFAULT_PRIVACY_SHIELD_SETTINGS, settingsOverrides);
  const queries = buildTxQueries(txids);
  return planPrivacyShieldBatches(queries, settings, context);
}

export function planGetHeaderShielded(
  refs: string[],
  context: PrivacyShieldContext,
  settingsOverrides?: Partial<PrivacyShieldSettings>,
): PrivacyShieldPlan {
  const settings = mergeSettings(DEFAULT_PRIVACY_SHIELD_SETTINGS, settingsOverrides);
  const queries = buildHeaderQueries(refs);
  return planPrivacyShieldBatches(queries, settings, context);
}
