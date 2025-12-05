"use client";

import * as React from "react";

import { useNetworkMode } from "@/contexts/network-mode-context";
import { guardedFetch } from "@/core/net/offline-gate";

export function useGuardedFetch() {
  const { mode } = useNetworkMode();

  return React.useCallback(
    (input: RequestInfo | URL, init?: RequestInit) => {
      return guardedFetch(mode, input, init);
    },
    [mode],
  );
}
