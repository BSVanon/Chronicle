import { describe, expect, test } from "vitest";

import {
  createTrackedOutpoint,
  deserializeTrackedOutpoints,
  serializeTrackedOutpoints,
} from "./tracked-outpoint";

describe("TrackedOutpoint model", () => {
  test("createTrackedOutpoint normalizes fields", () => {
    const op = createTrackedOutpoint({
      id: "id-1",
      txid: "  abc123  ",
      vout: 1.9,
      bucketId: "  hot  ",
      notes: "  test note  ",
      nowMs: 123,
    });

    expect(op.id).toBe("id-1");
    expect(op.txid).toBe("abc123");
    expect(op.vout).toBe(1);
    expect(op.bucketId).toBe("hot");
    expect(op.notes).toBe("test note");
    expect(op.createdAt).toBe(123);
    expect(op.updatedAt).toBe(123);
  });

  test("serialize/deserialize round-trip", () => {
    const op = createTrackedOutpoint({
      id: "id-1",
      txid: "abc123",
      vout: 0,
      nowMs: 123,
    });

    const json = serializeTrackedOutpoints([op]);
    const restored = deserializeTrackedOutpoints(json);

    expect(restored.length).toBe(1);
    expect(restored[0].id).toBe("id-1");
    expect(restored[0].txid).toBe("abc123");
  });

  test("deserialize handles bad input", () => {
    const restored = deserializeTrackedOutpoints("not json");
    expect(restored.length).toBe(0);
  });
});
