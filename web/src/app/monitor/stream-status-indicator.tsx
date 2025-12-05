"use client";

import * as React from "react";

import { useUtxoStream } from "@/contexts/utxo-stream-context";
import { useNetworkMode } from "@/contexts/network-mode-context";
import { useSentinelConfig } from "@/contexts/sentinel-config-context";
import { Badge } from "@/components/ui/badge";

export function StreamStatusIndicator() {
  const { streamSource, lastEventAt, eventCount } = useUtxoStream();
  const { mode } = useNetworkMode();
  const { config } = useSentinelConfig();

  const { label, helper } = React.useMemo(() => {
    if (streamSource === "sentinel") {
      return {
        label: "Stream: Sentinel",
        helper: "Live from your paired Sentinel via /v1/stream.",
      } as const;
    }

    if (streamSource === "simulation") {
      return {
        label: "Stream: Simulation",
        helper: "Using the built-in local simulation (no network calls).",
      } as const;
    }

    // No active stream; explain why based on network mode and pairing state.
    if (mode === "offline") {
      return {
        label: "Stream: None",
        helper: "Offline mode: Chronicle is not talking to any Sentinel yet.",
      } as const;
    }

    const hasSentinel = !!config?.baseUrl;
    if (!hasSentinel) {
      return {
        label: "Stream: None",
        helper: "Online shielded, but no Sentinel is paired yet (set one up on Inputs).",
      } as const;
    }

    return {
      label: "Stream: None",
      helper: "Online shielded with a paired Sentinel; open a stream using the dev panel below.",
    } as const;
  }, [streamSource, mode, config]);

  const activity = React.useMemo(() => {
    if (!lastEventAt || eventCount === 0) return null;
    const last = new Date(lastEventAt);
    const timeLabel = last.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return `Events: ${eventCount}, last at ${timeLabel}.`;
  }, [lastEventAt, eventCount]);

  return (
    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          {label}
        </Badge>
        <span>{helper}</span>
      </div>
      {activity && <span className="pl-1 text-[0.7rem]">{activity}</span>}
    </div>
  );
}
