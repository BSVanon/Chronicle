import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProfileSummaryCard } from "./profile-summary-card";
import { BucketsSettingsCard } from "./buckets-card";
import { SentinelDevCard } from "./sentinel-dev-card";
import { BeefDevCard } from "./beef-dev-card";
import { HeadersDevCard } from "./headers-dev-card";
import { SentinelPairingCard } from "./sentinel-pairing-card";
import { WalletsSettingsCard } from "./wallets-card";
import { ShardConfigSettingsCard } from "./shard-config-card";
import { TrackedOutpointsSettingsCard } from "./tracked-outpoints-card";
import { OutputsExportCard } from "./outputs-export-card";
import { SnapshotCaptureCard } from "./snapshot-capture-card";
import { ScrubCard } from "./scrub-card";
import { ProofArchiveDevCard } from "./proof-archive-dev-card";

const DEV_SETTINGS = false;

export const metadata: Metadata = {
  title: "Outputs",
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Outputs</h1>
        <p className="text-sm text-muted-foreground">
          Local-only exports and advanced controls. Profiles, bucket configuration,
          Sentinel pairing, and BEEF archive tools live here; nothing in this view
          will ever cause secrets, labels, or totals to leave the device.
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
        {DEV_SETTINGS && <WalletsSettingsCard />}
      </div>
      {DEV_SETTINGS && (
        <>
          <Separator />
          <ShardConfigSettingsCard />
          <Separator />
          <TrackedOutpointsSettingsCard />
          <Separator />
        </>
      )}
      <ScrubCard />
      <Separator />
      <SentinelPairingCard />
      {DEV_SETTINGS && <SentinelDevCard />} 
      <BeefDevCard />
      <HeadersDevCard />
      <ProofArchiveDevCard />
      <SnapshotCaptureCard />
      <Separator />
      <OutputsExportCard />
    </div>
  );
}
