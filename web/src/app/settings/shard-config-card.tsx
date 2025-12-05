"use client";

import * as React from "react";

import { useShardConfig } from "@/contexts/shard-config-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ShardConfigSettingsCard() {
  const { config, updateConfig } = useShardConfig();

  const handleShardCountChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseInt(e.target.value, 10);
      updateConfig({ shardCount: Number.isNaN(value) ? 1 : value });
    },
    [updateConfig],
  );

  const handleTtlChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseInt(e.target.value, 10);
      updateConfig({ ttlSec: Number.isNaN(value) ? 60 * 60 : value });
    },
    [updateConfig],
  );

  const handleSeedChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateConfig({ seed: e.target.value });
    },
    [updateConfig],
  );

  const handleEgressLabelsChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const labels = e.target.value
        .split(",")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      updateConfig({ egressLabels: labels });
    },
    [updateConfig],
  );

  const egressLabelsText = config.egressLabels.join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shard configuration (dev-only)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <p className="text-[0.75rem]">
          Configure shard count, TTL, seed, and egress labels locally. This does
          not contact any Sentinel; it only informs local planning and dev
          panels.
        </p>
        <div className="space-y-1">
          <label className="text-[0.75rem] font-medium">Shard count</label>
          <Input
            type="number"
            min={1}
            max={16}
            value={config.shardCount}
            onChange={handleShardCountChange}
            className="h-7 text-[0.8rem]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[0.75rem] font-medium">Shard TTL (seconds)</label>
          <Input
            type="number"
            min={60}
            max={86400}
            value={config.ttlSec}
            onChange={handleTtlChange}
            className="h-7 text-[0.8rem]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[0.75rem] font-medium">Sharding seed</label>
          <Input
            type="text"
            value={config.seed}
            onChange={handleSeedChange}
            className="h-7 text-[0.8rem]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[0.75rem] font-medium">Egress labels (comma-separated)</label>
          <Input
            type="text"
            value={egressLabelsText}
            onChange={handleEgressLabelsChange}
            className="h-7 text-[0.8rem]"
          />
        </div>
      </CardContent>
    </Card>
  );
}
