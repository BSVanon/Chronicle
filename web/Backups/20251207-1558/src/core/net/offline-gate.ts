import type { NetworkMode } from "@/contexts/network-mode-context";

export const OFFLINE_BLOCK_ERROR = "OFFLINE_BLOCK" as const;

export class OfflineBlockedError extends Error {
  constructor() {
    super(OFFLINE_BLOCK_ERROR);
    this.name = "OfflineBlockedError";
  }
}

export function ensureNetworkAllowed(mode: NetworkMode): void {
  if (mode === "offline") {
    throw new OfflineBlockedError();
  }
}

export async function guardedFetch(
  mode: NetworkMode,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  ensureNetworkAllowed(mode);
  return fetch(input, init);
}
