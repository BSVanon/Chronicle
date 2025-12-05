import { describe, expect, test } from "vitest";

import type { BeefParseResult } from "./index";
import {
  DEFAULT_BEEF_ARCHIVE,
  deserializeBeefArchive,
  entryFromBeefResult,
  serializeBeefArchive,
} from "./archive";

const SAMPLE_RESULT: BeefParseResult = {
  meta: {
    id: "bundle-1",
    importedAt: 123,
    utxoCount: 2,
    scripthashCount: 0,
  },
  utxos: [],
};

describe("BEEF archive helpers", () => {
  test("entryFromBeefResult builds archive entry from BeefParseResult", () => {
    const entry = entryFromBeefResult(SAMPLE_RESULT, 5);
    expect(entry.id).toBe("bundle-1");
    expect(entry.importedAt).toBe(123);
    expect(entry.utxoCount).toBe(2);
    expect(entry.scripthashCount).toBe(5);
  });

  test("serialize/deserialize round-trip", () => {
    const entry = entryFromBeefResult(SAMPLE_RESULT, 5);
    const json = serializeBeefArchive([entry]);
    const restored = deserializeBeefArchive(json);
    expect(restored.length).toBe(1);
    expect(restored[0].id).toBe("bundle-1");
  });

  test("deserialize falls back to default on bad input", () => {
    const restored = deserializeBeefArchive("not json");
    expect(restored).toBe(DEFAULT_BEEF_ARCHIVE);
  });
});
