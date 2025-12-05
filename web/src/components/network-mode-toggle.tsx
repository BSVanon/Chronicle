"use client";

import * as React from "react";

import { useNetworkMode } from "@/contexts/network-mode-context";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export function NetworkModeToggle() {
  const { mode, setMode } = useNetworkMode();

  const isOnline = mode === "online_shielded";

  const handleToggle = React.useCallback(
    (checked: boolean) => {
      setMode(checked ? "online_shielded" : "offline");
    },
    [setMode],
  );

  return (
    <div className="flex items-center gap-2 text-xs">
      <Switch checked={isOnline} onCheckedChange={handleToggle} />
      <Badge
        className={
          "rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide " +
          (isOnline
            ? "bg-primary text-black"
            : "bg-zinc-400 text-black dark:bg-zinc-500 dark:text-white")
        }
      >
        {isOnline ? "Shielded" : "Offline"}
      </Badge>
    </div>
  );
}
