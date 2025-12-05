export type WatchOnlyKind =
  | "empty"
  | "address_list"
  | "txid_list"
  | "xpub"
  | "unknown";

export type WatchOnlyAnalysis = {
  kind: WatchOnlyKind;
  isValid: boolean;
  lineCount: number;
  addresses?: string[];
  txids?: string[];
  notes?: string;
};

const ADDRESS_REGEX = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/; // legacy P2PKH/P2SH-style
const TXID_REGEX = /^[0-9a-fA-F]{64}$/;
const XPUB_REGEX = /^(xpub|ypub|zpub|tpub|vpub|upub|Ypub|Zpub)[1-9A-HJ-NP-Za-km-z]{80,120}$/;

export function analyzeWatchOnlyInput(raw: string): WatchOnlyAnalysis {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      kind: "empty",
      isValid: false,
      lineCount: 0,
      notes: "Paste xpubs, address lists, or txids here to build a watch-only view.",
    };
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const lineCount = lines.length;

  if (lineCount === 1 && XPUB_REGEX.test(lines[0])) {
    return {
      kind: "xpub",
      isValid: true,
      lineCount,
      notes: "Detected an extended public key. Chronicle will derive scripthashes locally.",
    };
  }

  const addressLines = lines.filter((line) => ADDRESS_REGEX.test(line));
  const txidLines = lines.filter((line) => TXID_REGEX.test(line));

  if (addressLines.length === lineCount && lineCount > 0) {
    return {
      kind: "address_list",
      isValid: true,
      lineCount,
      addresses: addressLines,
      notes: "Interpreted as a list of legacy addresses. Chronicle will treat these as a watch-only set.",
    };
  }

  if (txidLines.length === lineCount && lineCount > 0) {
    return {
      kind: "txid_list",
      isValid: true,
      lineCount,
      txids: txidLines,
      notes: "Interpreted as a list of transaction IDs for proof lookup or UTXO inspection.",
    };
  }

  return {
    kind: "unknown",
    isValid: false,
    lineCount,
    notes: "Chronicle could not classify this input yet. This analyzer is intentionally minimal and will be replaced by the full Chronicle wallet classifier.",
  };
}
