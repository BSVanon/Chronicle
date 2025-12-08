/**
 * Chronicle Cold Vault — Core Types
 *
 * These types define the data model for the Cold Vault Archive.
 */

/**
 * A UTXO Dossier represents a single coin you hold long-term.
 * This is your ownership inventory.
 */
export type UtxoDossier = {
  /** Unique identifier: "txid:vout" */
  outpoint: string;

  /** Amount in satoshis */
  value_satoshis: number;

  /** The locking script (scriptPubKey) in hex, or null if funding_tx_raw is stored */
  locking_script_hex: string | null;

  /** The txid of the funding transaction */
  funding_txid: string;

  /** Full funding transaction raw bytes (base64), if stored instead of just the script */
  funding_tx_raw: string | null;

  /** User-defined bucket (e.g., "Cold-A", "Savings-2025") */
  bucket: string;

  /** User-defined labels/tags */
  labels: string[];

  /** Optional derivation hint (path/index) for future spending */
  derivation_hint: string | null;

  /** Hash of the linked BEEF blob (sha256 hex), or null if no BEEF stored */
  beef_hash: string | null;

  /** Verification status against local headers */
  verified: {
    /** Block height at which verification was performed */
    at_height: number;
    /** Whether verification passed */
    ok: boolean;
    /** ISO 8601 timestamp of last verification */
    checked_at: string;
  } | null;

  /** ISO 8601 timestamp when this dossier was created */
  created_at: string;
};

/**
 * A ProofArchive entry represents a BEEF blob with metadata.
 * This is the SPV proof + ancestry for a funding transaction.
 */
export type ProofArchive = {
  /** The txid of the transaction this BEEF proves */
  txid: string;

  /** The BEEF blob (base64 encoded) */
  beef: string;

  /** SHA256 hash of the BEEF blob (hex) */
  beef_hash: string;

  /** Block height where the tx was confirmed */
  height: number;

  /** Block header hash (hex) */
  header_hash: string;

  /** UTXOs created by this transaction */
  utxos: Array<{
    vout: number;
    satoshis: number;
    script_hex: string;
  }>;

  /** Labels (copied from dossier for archive portability) */
  labels: string[];

  /** Bucket (copied from dossier for archive portability) */
  bucket: string;

  /** ISO 8601 timestamp when this archive entry was created */
  created_at: string;

  /** Integrity metadata */
  integrity: {
    archive_hash: string;
    algo: "sha256";
  };
};

/**
 * BEEF index: maps txid to beef_hash for quick lookups.
 */
export type BeefIndex = Record<string, string>;

/**
 * A stored block header (80 bytes hex).
 */
export type StoredHeader = {
  /** Block height */
  height: number;

  /** Block hash (hex) */
  hash: string;

  /** Raw header (80 bytes, hex) */
  header_hex: string;

  /** Previous block hash (hex) */
  prev_hash: string;

  /** Merkle root (hex) */
  merkle_root: string;

  /** Timestamp */
  timestamp: number;
};

/**
 * Bucket definition for the UI.
 */
export type Bucket = {
  id: string;
  label: string;
  description?: string;
};

/**
 * Summary of a bucket's holdings.
 */
export type BucketSummary = {
  bucket: string;
  total_satoshis: number;
  dossier_count: number;
  beef_coverage_percent: number;
  verified_count: number;
  pending_count: number;
};
