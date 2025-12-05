"use client";

import * as React from "react";

import type { SentinelConfig } from "@/core/sentinel/types";
import { createSentinelClient } from "@/core/sentinel/client";
import { useGuardedFetch } from "@/hooks/use-guarded-fetch";

export function useSentinelClient(config: SentinelConfig) {
  const guarded = useGuardedFetch();

  return React.useMemo(
    () =>
      createSentinelClient({
        config,
        http: { fetch: guarded },
        WebSocketCtor:
          typeof WebSocket !== "undefined" ? WebSocket : undefined,
      }),
    [config, guarded],
  );
}
