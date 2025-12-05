"use client";

import * as React from "react";

import {
  DEFAULT_PRIVACY_SHIELD_SETTINGS,
  type PrivacyShieldSettings,
} from "@/core/privacy/privacy-shield";
import {
  getPrivacyProfile,
  type PrivacyProfile,
  type PrivacyProfileId,
} from "@/core/privacy/profiles";

export type PrivacyProfileState = {
  profile: PrivacyProfile;
  effectiveShield: PrivacyShieldSettings;
  setProfileId: (id: PrivacyProfileId) => void;
};

const STORAGE_KEY = "chronicle-privacy-profile";

const PrivacyProfileContext = React.createContext<PrivacyProfileState | undefined>(
  undefined,
);

function mergeSettings(
  base: PrivacyShieldSettings,
  overrides: Partial<PrivacyShieldSettings>,
): PrivacyShieldSettings {
  return { ...base, ...overrides };
}

export function PrivacyProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profileId, setProfileIdState] = React.useState<PrivacyProfileId>(
    "cold_monitor",
  );

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as
        | PrivacyProfileId
        | null;
      if (stored === "cold_monitor" || stored === "everyday_monitor") {
        setProfileIdState(stored);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const setProfileId = React.useCallback((id: PrivacyProfileId) => {
    setProfileIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore storage errors
    }
  }, []);

  const value = React.useMemo<PrivacyProfileState>(() => {
    const profile = getPrivacyProfile(profileId);
    const effectiveShield = mergeSettings(
      DEFAULT_PRIVACY_SHIELD_SETTINGS,
      profile.shieldOverrides,
    );
    return { profile, effectiveShield, setProfileId };
  }, [profileId, setProfileId]);

  return (
    <PrivacyProfileContext.Provider value={value}>
      {children}
    </PrivacyProfileContext.Provider>
  );
}

export function usePrivacyProfile(): PrivacyProfileState {
  const ctx = React.useContext(PrivacyProfileContext);
  if (!ctx) {
    throw new Error("usePrivacyProfile must be used within a PrivacyProfileProvider");
  }
  return ctx;
}
