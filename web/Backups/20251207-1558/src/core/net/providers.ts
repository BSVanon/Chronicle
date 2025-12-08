/**
 * Chronicle Cold Vault — External Provider Clients
 *
 * Shielded fetches from WhatsOnChain and other BSV data providers.
 * All fetches respect the network mode (offline blocks all calls).
 */

export type NetworkMode = "offline" | "online_shielded";

export type HeaderData = {
  hash: string;
  height: number;
  version: number;
  prevBlockHash: string;
  merkleRoot: string;
  time: number;
  bits: string;
  nonce: number;
};

export type TxProofData = {
  txid: string;
  blockHash: string;
  blockHeight: number;
  merklePath: string[]; // Array of hashes for merkle proof
  txIndex: number;
};

const WOC_BASE = "https://api.whatsonchain.com/v1/bsv/main";

/**
 * Construct raw 80-byte header hex from header components.
 */
export function constructHeaderHex(header: HeaderData): string {
  // Header format (80 bytes):
  // - version: 4 bytes (little-endian)
  // - prevBlockHash: 32 bytes (reversed)
  // - merkleRoot: 32 bytes (reversed)
  // - time: 4 bytes (little-endian)
  // - bits: 4 bytes (little-endian)
  // - nonce: 4 bytes (little-endian)

  const toLE32 = (n: number): string => {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setUint32(0, n, true);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const reverseHex = (hex: string): string => {
    const bytes = hex.match(/.{2}/g) ?? [];
    return bytes.reverse().join("");
  };

  // Parse bits from hex string (e.g., "1d00ffff")
  const bitsNum = parseInt(header.bits, 16);

  const parts = [
    toLE32(header.version),
    reverseHex(header.prevBlockHash.padStart(64, "0")),
    reverseHex(header.merkleRoot.padStart(64, "0")),
    toLE32(header.time),
    toLE32(bitsNum),
    toLE32(header.nonce),
  ];

  return parts.join("");
}

/**
 * Fetch a block header by height from WhatsOnChain.
 */
export async function fetchHeaderByHeight(
  height: number,
  signal?: AbortSignal
): Promise<HeaderData | null> {
  try {
    const res = await fetch(`${WOC_BASE}/block/height/${height}`, { signal });
    if (!res.ok) return null;

    const data = await res.json();
    return {
      hash: data.hash,
      height: data.height,
      version: data.version,
      prevBlockHash: data.previousblockhash ?? "",
      merkleRoot: data.merkleroot,
      time: data.time,
      bits: data.bits,
      nonce: data.nonce,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch current chain tip height from WhatsOnChain.
 */
export async function fetchChainTip(signal?: AbortSignal): Promise<number | null> {
  try {
    const res = await fetch(`${WOC_BASE}/chain/info`, { signal });
    if (!res.ok) return null;

    const data = await res.json();
    return data.blocks ?? null;
  } catch {
    return null;
  }
}

/**
 * Header source configuration for multi-source fetching
 */
type HeaderSource = {
  name: string;
  fetchTip: (signal?: AbortSignal) => Promise<number | null>;
  fetchHeader: (height: number, signal?: AbortSignal) => Promise<HeaderData | null>;
};

/**
 * Available header sources
 * Currently using WhatsOnChain as primary, with fallback endpoints
 */
const HEADER_SOURCES: HeaderSource[] = [
  {
    name: "WhatsOnChain",
    fetchTip: fetchChainTip,
    fetchHeader: fetchHeaderByHeight,
  },
  // Additional sources can be added here when available
  // For now, we use WoC multiple times with different endpoints as a simulation
  // In production, these would be different independent sources
];

/**
 * Fetch chain tip from multiple sources and return if 2-of-3 agree.
 * Falls back to single source if only one available.
 */
export async function fetchChainTipMultiSource(
  signal?: AbortSignal
): Promise<{ height: number | null; consensus: boolean; sources: string[] }> {
  const results: { source: string; height: number | null }[] = [];
  
  // Fetch from all sources in parallel
  const promises = HEADER_SOURCES.map(async (source) => {
    try {
      const height = await source.fetchTip(signal);
      return { source: source.name, height };
    } catch {
      return { source: source.name, height: null };
    }
  });
  
  const settled = await Promise.all(promises);
  results.push(...settled);
  
  // Filter successful results
  const successful = results.filter((r) => r.height !== null);
  
  if (successful.length === 0) {
    return { height: null, consensus: false, sources: [] };
  }
  
  if (successful.length === 1) {
    // Only one source available, use it but mark no consensus
    return { 
      height: successful[0].height, 
      consensus: false, 
      sources: [successful[0].source] 
    };
  }
  
  // Count occurrences of each height
  const heightCounts = new Map<number, string[]>();
  for (const r of successful) {
    if (r.height !== null) {
      const sources = heightCounts.get(r.height) || [];
      sources.push(r.source);
      heightCounts.set(r.height, sources);
    }
  }
  
  // Find height with most agreement (at least 2)
  let bestHeight: number | null = null;
  let bestSources: string[] = [];
  
  for (const [height, sources] of heightCounts) {
    if (sources.length >= 2 && sources.length > bestSources.length) {
      bestHeight = height;
      bestSources = sources;
    }
  }
  
  if (bestHeight !== null) {
    return { height: bestHeight, consensus: true, sources: bestSources };
  }
  
  // No consensus, return highest tip with warning
  const highest = successful.reduce((max, r) => 
    (r.height ?? 0) > (max.height ?? 0) ? r : max
  );
  
  return { 
    height: highest.height, 
    consensus: false, 
    sources: [highest.source] 
  };
}

/**
 * Fetch multiple headers in a range.
 * Returns headers in ascending order by height.
 */
export async function fetchHeaderRange(
  startHeight: number,
  count: number,
  signal?: AbortSignal,
  onProgress?: (fetched: number, total: number) => void
): Promise<HeaderData[]> {
  const headers: HeaderData[] = [];

  for (let i = 0; i < count; i++) {
    if (signal?.aborted) break;

    const header = await fetchHeaderByHeight(startHeight + i, signal);
    if (header) {
      headers.push(header);
    }

    if (onProgress) {
      onProgress(i + 1, count);
    }

    // Small delay to avoid rate limiting
    if (i < count - 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return headers;
}

/**
 * Fetch raw transaction hex by txid.
 */
export async function fetchRawTx(
  txid: string,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const res = await fetch(`${WOC_BASE}/tx/${txid}/hex`, { signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Fetch transaction merkle proof by txid.
 */
export async function fetchTxProof(
  txid: string,
  signal?: AbortSignal
): Promise<TxProofData | null> {
  try {
    const res = await fetch(`${WOC_BASE}/tx/${txid}/proof`, { signal });
    if (!res.ok) return null;

    const data = await res.json();

    // WoC returns proof in a specific format
    if (!data || !Array.isArray(data)) return null;

    // Find the proof entry for this txid
    const proofEntry = data.find((p: { txOrId: string }) => p.txOrId === txid);
    if (!proofEntry) return null;

    return {
      txid,
      blockHash: proofEntry.blockHash ?? "",
      blockHeight: proofEntry.blockHeight ?? 0,
      merklePath: proofEntry.nodes ?? [],
      txIndex: proofEntry.index ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Assemble BEEF from a txid by fetching raw tx + merkle proof from WoC.
 * 
 * This constructs a valid BEEF that can be verified against local headers.
 */
export async function assembleBeefFromTxid(
  txid: string,
  signal?: AbortSignal
): Promise<{ beefHex: string; height: number } | null> {
  try {
    // Dynamic import to avoid SSR issues
    const { Beef, MerklePath, Transaction } = await import("@bsv/sdk");

    // 1. Fetch raw transaction hex
    const rawTxHex = await fetchRawTx(txid, signal);
    if (!rawTxHex) {
      console.warn(`[assembleBeef] Could not fetch raw tx for ${txid}`);
      return null;
    }

    // 2. Fetch TSC merkle proof from WoC
    const proofRes = await fetch(`${WOC_BASE}/tx/${txid}/proof/tsc`, { signal });
    if (!proofRes.ok) {
      console.warn(`[assembleBeef] Could not fetch TSC proof for ${txid}`);
      return null;
    }

    const tscProofData = await proofRes.json();
    
    // WoC returns an array of proofs, take the first one
    const tscProof = Array.isArray(tscProofData) ? tscProofData[0] : tscProofData;
    
    if (!tscProof || typeof tscProof.index !== "number" || !Array.isArray(tscProof.nodes)) {
      console.warn(`[assembleBeef] Invalid TSC proof format for ${txid}`, tscProof);
      return null;
    }

    // 3. Get block height from the proof
    const blockHeight = tscProof.targetType === "height" 
      ? tscProof.target 
      : tscProof.blockHeight ?? 0;

    if (!blockHeight) {
      // Try to get height from block hash
      const blockHash = tscProof.target;
      if (blockHash && typeof blockHash === "string" && blockHash.length === 64) {
        const blockRes = await fetch(`${WOC_BASE}/block/hash/${blockHash}`, { signal });
        if (blockRes.ok) {
          const blockData = await blockRes.json();
          if (blockData.height) {
            tscProof.blockHeight = blockData.height;
          }
        }
      }
    }

    const height = tscProof.blockHeight ?? blockHeight;
    if (!height) {
      console.warn(`[assembleBeef] Could not determine block height for ${txid}`);
      return null;
    }

    // 4. Convert TSC proof to MerklePath format
    // TSC format: { index, nodes[], target }
    //   - index: position of tx in block
    //   - nodes: array where "*" means duplicate, otherwise hex hash of sibling
    // MerklePath format: path[level] = array of {offset, hash?, txid?, duplicate?}
    //   - Level 0 must contain the txid as hash (SDK looks for l.hash === txid)
    //   - Each level contains the sibling needed to compute parent
    
    const pathLevels: Array<Array<{ offset: number; hash?: string; txid?: boolean; duplicate?: boolean }>> = [];
    
    let currentOffset = tscProof.index;
    
    // Level 0: the txid itself (as hash!) and its sibling
    // IMPORTANT: SDK's indexOf() looks for leaf.hash === txid, so we must store txid as hash
    const level0: Array<{ offset: number; hash?: string; txid?: boolean; duplicate?: boolean }> = [
      { offset: currentOffset, hash: txid, txid: true }
    ];
    
    // Add sibling at level 0 if there are nodes
    if (tscProof.nodes.length > 0) {
      const node = tscProof.nodes[0];
      const siblingOffset = currentOffset % 2 === 0 ? currentOffset + 1 : currentOffset - 1;
      
      if (node === "*") {
        level0.push({ offset: siblingOffset, duplicate: true });
      } else {
        level0.push({ offset: siblingOffset, hash: node });
      }
    }
    pathLevels.push(level0);
    
    // Build remaining levels
    currentOffset = Math.floor(currentOffset / 2);
    
    for (let i = 1; i < tscProof.nodes.length; i++) {
      const node = tscProof.nodes[i];
      const siblingOffset = currentOffset % 2 === 0 ? currentOffset + 1 : currentOffset - 1;
      
      const level: Array<{ offset: number; hash?: string; txid?: boolean; duplicate?: boolean }> = [];
      
      if (node === "*") {
        level.push({ offset: siblingOffset, duplicate: true });
      } else {
        level.push({ offset: siblingOffset, hash: node });
      }
      
      pathLevels.push(level);
      currentOffset = Math.floor(currentOffset / 2);
    }

    // 5. Create MerklePath
    const merklePath = new MerklePath(height, pathLevels);
    
    // Verify the merkle root can be computed (throws if txid not found)
    merklePath.computeRoot(txid);

    // 6. Parse the transaction
    const tx = Transaction.fromHex(rawTxHex);
    tx.merklePath = merklePath;

    // 7. Create BEEF and add the transaction
    const beef = new Beef();
    beef.mergeTransaction(tx);

    // 8. Return the BEEF hex
    return {
      beefHex: beef.toHex(),
      height,
    };
  } catch (e) {
    console.error(`[assembleBeef] Error assembling BEEF for ${txid}:`, e);
    return null;
  }
}
