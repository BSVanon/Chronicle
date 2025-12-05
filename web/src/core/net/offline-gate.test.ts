import { describe, expect, test } from "vitest";

import { OFFLINE_BLOCK_ERROR, OfflineBlockedError, guardedFetch } from "./offline-gate";

// NOTE: These tests exercise only the synchronous guard behaviour.
// We rely on the browser/Node fetch implementation for actual network calls.

describe("offline-gate", () => {
  test("throws OfflineBlockedError in offline mode", async () => {
    await expect(guardedFetch("offline", "https://example.com"))
      .rejects.toBeInstanceOf(OfflineBlockedError);
  });

  test("error message matches OFFLINE_BLOCK_ERROR constant", async () => {
    await expect(guardedFetch("offline", "https://example.com"))
      .rejects.toMatchObject({ message: OFFLINE_BLOCK_ERROR });
  });

  test("does not throw synchronously in online_shielded mode (network not executed here)", () => {
    // We only assert that calling guardedFetch does not throw synchronously;
    // the returned Promise will still depend on the global fetch implementation.
    expect(() => {
      void guardedFetch("online_shielded", "https://example.com");
    }).not.toThrow();
  });
});
