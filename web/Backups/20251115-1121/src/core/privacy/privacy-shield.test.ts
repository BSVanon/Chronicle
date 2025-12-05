import { describe, expect, test } from "vitest";

import {
  DEFAULT_PRIVACY_SHIELD_SETTINGS,
  planPrivacyShieldBatches,
  type PrivacyShieldContext,
  type PrivacyShieldSettings,
  type RealQueryInput,
} from "./privacy-shield";

function makeContext(partial: Partial<PrivacyShieldContext> = {}): PrivacyShieldContext {
  return {
    endpoint: "https://example.com/privacy-shield",
    nowMs: 1_000_000,
    lookupsUsedLastHour: 0,
    ...partial,
  };
}

function makeSettings(partial: Partial<PrivacyShieldSettings> = {}): PrivacyShieldSettings {
  return {
    ...DEFAULT_PRIVACY_SHIELD_SETTINGS,
    ...partial,
  };
}

describe("planPrivacyShieldBatches", () => {
  test("returns empty plan when there are no real queries", () => {
    const plan = planPrivacyShieldBatches([], DEFAULT_PRIVACY_SHIELD_SETTINGS, makeContext());
    expect(plan.batches).toHaveLength(0);
    expect(plan.totalReal).toBe(0);
    expect(plan.totalChaff).toBe(0);
    expect(plan.droppedReal).toBe(0);
  });

  test("limits real queries by hourly capacity", () => {
    const real: RealQueryInput[] = Array.from({ length: 10 }, (_, i) => ({
      kind: "tx-raw",
      target: `real-${i}`,
    }));

    const settings = makeSettings({ maxLookupsPerHour: 5 });
    const context = makeContext({ lookupsUsedLastHour: 3 });

    const plan = planPrivacyShieldBatches(real, settings, context);

    // Capacity is 2, so at most 2 real queries can be scheduled.
    expect(plan.totalReal).toBeLessThanOrEqual(2);
    expect(plan.droppedReal).toBeGreaterThanOrEqual(8);
  });

  test("adds chaff queries per batch without exceeding capacity", () => {
    const real: RealQueryInput[] = Array.from({ length: 6 }, (_, i) => ({
      kind: "tx-raw",
      target: `real-${i}`,
    }));

    const settings = makeSettings({
      maxLookupsPerHour: 100,
      chaffPerBatchMin: 1,
      chaffPerBatchMax: 2,
    });

    const context = makeContext({ lookupsUsedLastHour: 0 });

    const plan = planPrivacyShieldBatches(real, settings, context);
    const totalScheduled = plan.totalReal + plan.totalChaff;

    expect(plan.totalReal).toBeGreaterThan(0);
    expect(plan.totalChaff).toBeGreaterThan(0);
    expect(totalScheduled).toBeLessThanOrEqual(settings.maxLookupsPerHour);
  });

  test("batches respect min and max sizes across real queries", () => {
    const real: RealQueryInput[] = Array.from({ length: 12 }, (_, i) => ({
      kind: "tx-raw",
      target: `real-${i}`,
    }));

    const settings = makeSettings({ batchMin: 3, batchMax: 5 });
    const context = makeContext();

    const plan = planPrivacyShieldBatches(real, settings, context);

    const realCounts = plan.batches.map((batch) =>
      batch.queries.filter((q) => !q.isChaff).length,
    );

    for (const count of realCounts) {
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(5);
    }
  });

  test("sendAtMs is strictly increasing across batches", () => {
    const real: RealQueryInput[] = Array.from({ length: 10 }, (_, i) => ({
      kind: "tx-raw",
      target: `real-${i}`,
    }));

    const settings = makeSettings();
    const context = makeContext();

    const plan = planPrivacyShieldBatches(real, settings, context);

    const times = plan.batches.map((b) => b.sendAtMs);
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });
});
