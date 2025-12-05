import type { PrivacyShieldSettings } from "@/core/privacy/privacy-shield";

export type PrivacyProfileId = "cold_monitor" | "everyday_monitor";

export type PrivacyProfile = {
  id: PrivacyProfileId;
  name: string;
  description: string;
  shieldOverrides: Partial<PrivacyShieldSettings>;
};

export const PRIVACY_PROFILES: PrivacyProfile[] = [
  {
    id: "cold_monitor",
    name: "Cold Monitor",
    description:
      "On-demand checks only for cold or high-value holdings. Designed for manual runs with maximum privacy padding and no background schedule.",
    shieldOverrides: {
      maxLookupsPerHour: 6,
      batchMin: 3,
      batchMax: 5,
      chaffPerBatchMin: 2,
      chaffPerBatchMax: 3,
      intraBatchJitterMinMs: 750,
      intraBatchJitterMaxMs: 3000,
      interBatchJitterMinMs: 8 * 60 * 1000,
      interBatchJitterMaxMs: 15 * 60 * 1000,
    },
  },
  {
    id: "everyday_monitor",
    name: "Everyday Monitor",
    description:
      "Low-cadence background monitoring using the strict Cold defaults, tuned for day-to-day spending wallets where a few updates per hour is enough.",
    shieldOverrides: {
      maxLookupsPerHour: 6,
      batchMin: 3,
      batchMax: 5,
      chaffPerBatchMin: 2,
      chaffPerBatchMax: 3,
      intraBatchJitterMinMs: 750,
      intraBatchJitterMaxMs: 3000,
      interBatchJitterMinMs: 8 * 60 * 1000,
      interBatchJitterMaxMs: 15 * 60 * 1000,
    },
  },
];

export function getPrivacyProfile(id: PrivacyProfileId): PrivacyProfile {
  const profile = PRIVACY_PROFILES.find((p) => p.id === id);
  return profile ?? PRIVACY_PROFILES[0];
}
