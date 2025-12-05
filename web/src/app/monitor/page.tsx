import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SentinelSimulatedPanel } from "./sentinel-simulated-panel";
import { BucketSummaryPanel } from "./bucket-summary-panel";
import { RecentDeltasPanel } from "./recent-deltas-panel";
import { DerivedUtxoDemoPanel } from "./derived-utxo-demo-panel";
import { ShardPlanningDevPanel } from "./shard-planning-dev-panel";
import { RegisterPlannerDevPanel } from "./register-planner-dev-panel";
import { SentinelStreamDevPanel } from "./sentinel-stream-dev-panel";
import { BeefCoveragePanel } from "./beef-coverage-panel";
import { HeaderCoveragePanel } from "./header-coverage-panel";
import { BeefTrustPanel } from "./beef-trust-panel";
import { StreamStatusIndicator } from "./stream-status-indicator";
import { ShardBoardSummary } from "./shard-board-summary";

const DEV_MONITOR = false;

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
          per-bucket balances, recent inflow/outflow, and BEEF + header coverage
          and trust summaries while keeping balances and labels local.
        </p>
      </div>
      <StreamStatusIndicator />
      <p className="text-xs text-muted-foreground">
        Shard board shows how many shards and tracked scripthashes are in plan,
        stream status indicates whether Sentinel or simulation is live, bucket
        balances and recent deltas come from the local UTXO engine, BEEF
        coverage compares imported archives to your tracked scripthashes, and
        header coverage and trust panels show how much proof material you have
        locally.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Shard board</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <ShardBoardSummary />
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
      <BeefCoveragePanel />
      <HeaderCoveragePanel />
      <BeefTrustPanel />
      <Separator />
      <BucketSummaryPanel />
      <Separator />
      <RecentDeltasPanel />
      <Separator />
      <p className="text-xs text-muted-foreground">
        Chronicle will keep balances and labels local. Providers only see
        per-scripthash UTXO activity via the Sentinel, never your full wallet
        map or bucket totals.
      </p>
      <Separator />
      <div className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Dev wiring
        </h2>
        <Separator />
      </div>
      <SentinelStreamDevPanel />
      {DEV_MONITOR && (
        <>
          <Separator />
          <DerivedUtxoDemoPanel />
          <Separator />
          <ShardPlanningDevPanel />
          <Separator />
          <RegisterPlannerDevPanel />
          <Separator />
          <SentinelSimulatedPanel />
        </>
      )}
    </div>
  );
}
