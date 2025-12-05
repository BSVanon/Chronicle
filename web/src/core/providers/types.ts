export type Scripthash = string;

export type Utxo = {
  txid: string;
  vout: number;
  satoshis: number;
  scriptHex: string;
  /** Optional block height if known. */
  height?: number;
};

/**
 * Minimal read-only provider interface used by Chronicle.
 * Concrete implementations may speak Electrum, explorer REST, or a Sentinel.
 */
export interface ReadOnlyProvider {
  listUnspent(scripthash: Scripthash): Promise<Utxo[]>;
  getTx(txid: string): Promise<string>; // raw tx hex
  getHeader(ref: string): Promise<string>; // header hex by height or hash
}
