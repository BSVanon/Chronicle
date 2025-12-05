import type { ReadOnlyProvider, Scripthash, Utxo } from "./types";

export interface SnapshotProvider {
  listUnspentForScripthash(scripthash: Scripthash): Promise<Utxo[]>;
}

export function snapshotProviderFromReadOnly(
  provider: ReadOnlyProvider,
): SnapshotProvider {
  return {
    listUnspentForScripthash: (scripthash) => provider.listUnspent(scripthash),
  };
}
