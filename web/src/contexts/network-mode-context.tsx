"use client";

import * as React from "react";

export type NetworkMode = "offline" | "online_shielded";

export type NetworkModeState = {
  mode: NetworkMode;
  setMode: (mode: NetworkMode) => void;
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

  const value = React.useMemo<NetworkModeState>(
    () => ({ mode, setMode }),
    [mode, setMode],
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
