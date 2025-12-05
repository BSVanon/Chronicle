import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProfileSummaryCard } from "./profile-summary-card";
import { BucketsSettingsCard } from "./buckets-card";
import { SentinelDevCard } from "./sentinel-dev-card";
import { BeefDevCard } from "./beef-dev-card";
import { SentinelPairingCard } from "./sentinel-pairing-card";
import { WalletsSettingsCard } from "./wallets-card";
import { ShardConfigSettingsCard } from "./shard-config-card";
import { TrackedOutpointsSettingsCard } from "./tracked-outpoints-card";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Privacy-first defaults for Chronicle. Profiles and tuning knobs live
          here; no settings will ever cause secrets, labels, or totals to leave
          the device.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ProfileSummaryCard />
        <Card>
          <CardHeader>
            <CardTitle>Egress & hygiene</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Model per-shard egress paths (VPN tunnels, VPS public IP) and
            hygiene behaviours like periodic remaps, decoy refresh, and optional
            Tor usage.
          </CardContent>
        </Card>
      </div>
      <Separator />
      <div className="grid gap-4 md:grid-cols-2">
        <BucketsSettingsCard />
        <WalletsSettingsCard />
      </div>
      <Separator />
      <ShardConfigSettingsCard />
      <Separator />
      <TrackedOutpointsSettingsCard />
      <Separator />
      <p className="text-xs text-muted-foreground">
        Chronicle will later surface a one-click scrub flow here: drop all
        Sentinel subscriptions, regenerate shard maps, and verify decoys.
      </p>
      <Separator />
      <SentinelPairingCard />
      <SentinelDevCard />
      <BeefDevCard />
    </div>
  );
}
