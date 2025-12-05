"use client";

import * as React from "react";

import { useNetworkMode } from "@/contexts/network-mode-context";
import { useSentinelConfig } from "@/contexts/sentinel-config-context";
import { Badge } from "@/components/ui/badge";

export function SentinelStatusBadge() {
  const { mode } = useNetworkMode();
  const { config } = useSentinelConfig();

  const label = React.useMemo(() => {
    if (mode === "offline") return "Offline";
    if (!config?.baseUrl) return "Online (no sentinel)";
    return "Online (shielded)";
  }, [mode, config?.baseUrl]);

  return (
    <Badge variant="outline" className="text-[0.7rem] font-normal">
      {label}
    </Badge>
  );
}
