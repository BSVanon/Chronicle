import type { Scripthash } from "../providers/types";

export type LocalWalletKind = "address_list" | "xpub" | "descriptor" | "beef";

export type AddressListWallet = {
  id: string;
  name: string;
  kind: "address_list";
  addressLines: string[];
  defaultBucketId?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export type LocalWallet = AddressListWallet; // Future kinds will extend this union.

export type LocalWalletSnapshot = {
  version: 1;
  wallets: LocalWallet[];
};

export function createAddressListWallet(options: {
  id: string;
  name: string;
  addressLines: string[];
  defaultBucketId?: string;
  notes?: string;
  nowMs?: number;
}): AddressListWallet {
  const now = options.nowMs ?? Date.now();
  const lines = options.addressLines.map((line) => line.trim()).filter((line) => line.length > 0);

  return {
    id: options.id,
    name: options.name.trim() || "Untitled wallet",
    kind: "address_list",
    addressLines: lines,
    defaultBucketId: options.defaultBucketId,
    notes: options.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function serializeWallets(wallets: LocalWallet[]): string {
  const snapshot: LocalWalletSnapshot = { version: 1, wallets };
  return JSON.stringify(snapshot);
}

export function deserializeWallets(raw: string | null | undefined): LocalWallet[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<LocalWalletSnapshot>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.wallets)) {
      return [];
    }
    return parsed.wallets.map((wallet) => normalizeWallet(wallet)).filter((w): w is LocalWallet => w !== null);
  } catch {
    return [];
  }
}

function normalizeWallet(raw: unknown): LocalWallet | null {
  const w = raw as Partial<LocalWallet>;
  if (!w || w.kind !== "address_list" || !Array.isArray(w.addressLines) || typeof w.id !== "string") {
    return null;
  }

  const createdAt = typeof w.createdAt === "number" ? w.createdAt : Date.now();
  const updatedAt = typeof w.updatedAt === "number" ? w.updatedAt : createdAt;
  const name = typeof w.name === "string" && w.name.trim().length > 0 ? w.name.trim() : "Untitled wallet";

  return {
    id: w.id,
    name,
    kind: "address_list",
    addressLines: w.addressLines.map((line) => String(line).trim()).filter((line) => line.length > 0),
    defaultBucketId: typeof w.defaultBucketId === "string" ? w.defaultBucketId : undefined,
    notes: typeof w.notes === "string" && w.notes.trim().length > 0 ? w.notes.trim() : undefined,
    createdAt,
    updatedAt,
  };
}
