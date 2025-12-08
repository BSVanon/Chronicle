/**
 * Chronicle Cold Vault — Privacy Shield
 *
 * Implements privacy-preserving network request patterns:
 * - Jitter: 500–3000 ms between requests; 3–8 s between batches
 * - Decoys: 1–2 decoy requests per batch (discarded locally)
 * - Rate limiting: ≤100 requests/hour; exponential backoff
 */

// Rate limiting state
let requestCount = 0;
let hourStart = Date.now();
let backoffMs = 0;
const MAX_REQUESTS_PER_HOUR = 100;

/**
 * Random delay between min and max milliseconds
 */
function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Apply jitter delay between requests (500-3000ms)
 */
export async function applyRequestJitter(): Promise<void> {
  const jitter = randomDelay(500, 3000);
  await sleep(jitter);
}

/**
 * Apply batch delay between batches (3-8 seconds)
 */
export async function applyBatchDelay(): Promise<void> {
  const delay = randomDelay(3000, 8000);
  await sleep(delay);
}

/**
 * Check and update rate limiting. Returns true if request is allowed.
 */
export function checkRateLimit(): boolean {
  const now = Date.now();
  
  // Reset counter every hour
  if (now - hourStart > 3600000) {
    hourStart = now;
    requestCount = 0;
    backoffMs = 0;
  }
  
  // Check if we're in backoff
  if (backoffMs > 0) {
    return false;
  }
  
  // Check rate limit
  if (requestCount >= MAX_REQUESTS_PER_HOUR) {
    return false;
  }
  
  requestCount++;
  return true;
}

/**
 * Apply exponential backoff after rate limit hit
 */
export function applyBackoff(): void {
  if (backoffMs === 0) {
    backoffMs = 5000; // Start at 5 seconds
  } else {
    backoffMs = Math.min(backoffMs * 2, 60000); // Max 1 minute
  }
  
  setTimeout(() => {
    backoffMs = 0;
  }, backoffMs);
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(): {
  requestsThisHour: number;
  maxRequests: number;
  inBackoff: boolean;
  backoffMs: number;
} {
  return {
    requestsThisHour: requestCount,
    maxRequests: MAX_REQUESTS_PER_HOUR,
    inBackoff: backoffMs > 0,
    backoffMs,
  };
}

/**
 * Generate decoy txids (random 64-char hex strings)
 * These will be fetched but discarded to mask real requests
 */
export function generateDecoyTxids(count: number = 1): string[] {
  const decoys: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    decoys.push(hex);
  }
  return decoys;
}

/**
 * Shuffle an array (Fisher-Yates)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Create a batch with decoys mixed in
 * Returns: { items: shuffled array with decoys, decoyIndices: Set of decoy positions }
 */
export function createBatchWithDecoys<T>(
  realItems: T[],
  createDecoy: () => T,
  decoyCount: number = randomDelay(1, 2)
): { items: T[]; decoyIndices: Set<number> } {
  const decoys: T[] = [];
  for (let i = 0; i < decoyCount; i++) {
    decoys.push(createDecoy());
  }
  
  const combined = [...realItems, ...decoys];
  const shuffled = shuffleArray(combined);
  
  // Track which indices are decoys
  const decoyIndices = new Set<number>();
  shuffled.forEach((item, index) => {
    if (decoys.includes(item)) {
      decoyIndices.add(index);
    }
  });
  
  return { items: shuffled, decoyIndices };
}

/**
 * Split items into batches of 3-7 items each
 */
export function createBatches<T>(items: T[]): T[][] {
  const batches: T[][] = [];
  let remaining = [...items];
  
  while (remaining.length > 0) {
    const batchSize = Math.min(randomDelay(3, 7), remaining.length);
    batches.push(remaining.slice(0, batchSize));
    remaining = remaining.slice(batchSize);
  }
  
  return batches;
}

/**
 * Execute a shielded batch fetch with jitter and decoys
 */
export async function shieldedBatchFetch<T, R>(
  items: T[],
  fetchFn: (item: T) => Promise<R | null>,
  options?: {
    onProgress?: (current: number, total: number) => void;
    onDecoyFetched?: () => void;
    includeDecoys?: boolean;
    createDecoy?: () => T;
  }
): Promise<Map<T, R | null>> {
  const results = new Map<T, R | null>();
  const batches = createBatches(items);
  
  let processed = 0;
  const total = items.length;
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    // Add decoys if enabled
    let itemsToFetch = batch;
    let decoyIndices = new Set<number>();
    
    if (options?.includeDecoys && options?.createDecoy) {
      const withDecoys = createBatchWithDecoys(batch, options.createDecoy);
      itemsToFetch = withDecoys.items;
      decoyIndices = withDecoys.decoyIndices;
    }
    
    // Process each item in batch with jitter
    for (let i = 0; i < itemsToFetch.length; i++) {
      const item = itemsToFetch[i];
      const isDecoy = decoyIndices.has(i);
      
      // Check rate limit
      if (!checkRateLimit()) {
        applyBackoff();
        // Wait for backoff to clear
        await sleep(backoffMs + 1000);
      }
      
      try {
        const result = await fetchFn(item);
        
        if (isDecoy) {
          // Discard decoy result
          options?.onDecoyFetched?.();
        } else {
          results.set(item, result);
          processed++;
          options?.onProgress?.(processed, total);
        }
      } catch {
        if (!isDecoy) {
          results.set(item, null);
          processed++;
          options?.onProgress?.(processed, total);
        }
      }
      
      // Apply jitter between requests (except last in batch)
      if (i < itemsToFetch.length - 1) {
        await applyRequestJitter();
      }
    }
    
    // Apply batch delay (except after last batch)
    if (batchIndex < batches.length - 1) {
      await applyBatchDelay();
    }
  }
  
  return results;
}
