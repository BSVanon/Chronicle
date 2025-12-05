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
    <div className="flex items-center gap-3">
      <div className="flex flex-col text-xs">
        <span className="font-medium">Network mode</span>
        <span className="text-muted-foreground">
          {isOnline
            ? "Online (shielded). Requests go through Privacy Shield policies."
            : "Offline. Chronicle will not perform any network requests."}
        </span>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 text-xs">
          <span className={"text-muted-foreground"}>Offline</span>
          <Switch checked={isOnline} onCheckedChange={handleToggle} />
          <span className={"text-muted-foreground"}>Shielded</span>
        </div>
        <Badge
          variant={isOnline ? "default" : "outline"}
          className="text-[0.7rem] uppercase tracking-wide"
        >
          {isOnline ? "online_shielded" : "offline"}
        </Badge>
      </div>
    </div>
  );
}
