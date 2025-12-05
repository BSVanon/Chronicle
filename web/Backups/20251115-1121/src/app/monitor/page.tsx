import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SentinelSimulatedPanel } from "./sentinel-simulated-panel";
import { BucketSummaryPanel } from "./bucket-summary-panel";
import { RecentDeltasPanel } from "./recent-deltas-panel";
import { DerivedUtxoDemoPanel } from "./derived-utxo-demo-panel";
import { DerivedBucketAssignmentPanel } from "./derived-bucket-assignment-panel";
import { ShardPlanningDevPanel } from "./shard-planning-dev-panel";
import { RegisterPlannerDevPanel } from "./register-planner-dev-panel";
import { SentinelStreamDevPanel } from "./sentinel-stream-dev-panel";
import { BeefCoveragePanel } from "./beef-coverage-panel";

export const metadata: Metadata = {
  title: "Monitor",
};

export default function MonitorPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Monitor</h1>
        <p className="text-sm text-muted-foreground">
          Chronicle&apos;s live holdings monitor. When paired to a Sentinel (or
          using the built-in simulation), this view shows shard state,
          per-bucket balances, recent inflow/outflow, and BEEF coverage while
          keeping balances and labels local.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Shard board</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Tiles 0..K-1 summarising provider, egress path, and health. This is
            where rotation cadence and stalls/rate-limits will be surfaced.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Bucket balances</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Local-only view of bucket balances (confirmed/unconfirmed) computed
            from Chronicle&apos;s UTXO engine; Sentinels never see bucket labels or
            totals.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent deltas</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Stream of inflow/outflow events derived from UTXO deltas streamed
            by a Sentinel or the built-in simulation.
          </CardContent>
        </Card>
      </div>
      <BucketSummaryPanel />
      <Separator />
      <DerivedUtxoDemoPanel />
      <Separator />
      <DerivedBucketAssignmentPanel />
      <Separator />
      <ShardPlanningDevPanel />
      <Separator />
      <RegisterPlannerDevPanel />
      <Separator />
      <SentinelStreamDevPanel />
      <Separator />
      <BeefCoveragePanel />
      <Separator />
      <p className="text-xs text-muted-foreground">
        Chronicle will keep balances and labels local. Providers only see
        per-scripthash UTXO activity via the Sentinel, never your full wallet
        map or bucket totals.
      </p>
      <RecentDeltasPanel />
      <SentinelSimulatedPanel />
    </div>
  );
}
