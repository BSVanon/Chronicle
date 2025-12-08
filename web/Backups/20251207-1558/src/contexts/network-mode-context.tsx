"use client";

import * as React from "react";

export type NetworkMode = "offline" | "online_shielded";

export type NetworkModeState = {
  mode: NetworkMode;
  setMode: (mode: NetworkMode) => void;
  /** Request online mode - shows confirmation if currently offline */
  requestOnline: () => Promise<boolean>;
};

const NetworkModeContext = React.createContext<NetworkModeState | undefined>(
  undefined,
);

export function NetworkModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setModeState] = React.useState<NetworkMode>("offline");

  const setMode = React.useCallback((next: NetworkMode) => {
    setModeState(next);
  }, []);

  const requestOnline = React.useCallback(async (): Promise<boolean> => {
    if (mode === "online_shielded") {
      return true; // Already online
    }
    
    const confirmed = window.confirm(
      "You are currently in Offline mode.\n\n" +
      "Switch to Online mode to complete this action?\n\n" +
      "Online mode will connect to WhatsOnChain to fetch blockchain data."
    );
    
    if (confirmed) {
      setModeState("online_shielded");
      return true;
    }
    return false;
  }, [mode]);

  const value = React.useMemo<NetworkModeState>(
    () => ({ mode, setMode, requestOnline }),
    [mode, setMode, requestOnline],
  );

  return (
    <NetworkModeContext.Provider value={value}>
      {children}
    </NetworkModeContext.Provider>
  );
}

export function useNetworkMode(): NetworkModeState {
  const ctx = React.useContext(NetworkModeContext);
  if (!ctx) {
    throw new Error("useNetworkMode must be used within a NetworkModeProvider");
  }
  return ctx;
}
