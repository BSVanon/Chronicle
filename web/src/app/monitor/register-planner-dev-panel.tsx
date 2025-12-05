"use client";

import * as React from "react";

import { buildShardRegisterRequests } from "@/core/sentinel/register-planner";
import { planShardsFromBuckets } from "@/core/sentinel/shard-planner";
import { useBuckets } from "@/contexts/bucket-context";
import { useShardConfig } from "@/contexts/shard-config-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function RegisterPlannerDevPanel() {
  const { buckets } = useBuckets();
  const { config } = useShardConfig();

  const [walletId, setWalletId] = React.useState("local-dev-wallet");

  const plan = React.useMemo(
    () => planShardsFromBuckets(buckets, config.shardCount),
    [buckets, config.shardCount],
  );

  const requests = React.useMemo(
    () => buildShardRegisterRequests(walletId, config, plan),
    [walletId, config, plan],
  );

  const jsonPreview = React.useMemo(
    () => JSON.stringify(requests, null, 2),
    [requests],
  );

  return (
    <Card className="mt-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Sentinel registration planner (dev)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Shows the ShardRegisterRequest payloads that would be sent to a
            Sentinel for the current shard config and bucketed scripthashes.
            This panel does not perform any network calls.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Dev
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <div className="space-y-1">
          <label className="text-[0.75rem] font-medium">Wallet ID</label>
          <Input
            className="h-7 text-[0.8rem]"
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
          />
        </div>
        {requests.length === 0 ? (
          <p className="text-[0.75rem] text-muted-foreground">
            No shard registrations would be generated yet. Ensure buckets have
            scripthashes assigned and shard count is &gt; 0.
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-[0.75rem]">
              Planned registrations: <strong>{requests.length}</strong>
            </p>
            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 text-[0.7rem]">
{jsonPreview}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
