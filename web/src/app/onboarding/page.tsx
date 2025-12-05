"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BucketsSettingsCard } from "../settings/buckets-card";
import { SentinelPairingCard } from "../settings/sentinel-pairing-card";
import { BeefDevCard } from "../settings/beef-dev-card";
import { PrivacyDryRunPreview } from "./privacy-dry-run-preview";
import { WatchOnlyPanel } from "./watch-only-panel";
import { OnboardingProfileCard } from "./profile-card";
import { DerivedBucketAssignmentPanel } from "../monitor/derived-bucket-assignment-panel";

export default function OnboardingPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Inputs</h1>
        <p className="text-sm text-muted-foreground">
          Start in offline mode. Choose a privacy profile, import watch-only
          material, map derived scripthashes into buckets, pair a Sentinel, and
          import any BEEF archives before running a privacy dry-run and using
          Monitor/BEEF coverage.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Watch-only inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Provide xpubs, descriptors, or address sets locally. Chronicle
              derives scripthashes in-browser; no keys or xpubs leave your
              device.
            </p>
            <WatchOnlyPanel />
          </CardContent>
        </Card>
        <BeefDevCard />
      </div>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>Buckets overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Chronicle groups derived scripthashes into three local-only buckets
            tuned for your day-to-day holdings. Review your current bucket
            descriptions and assignments below before turning on Monitor.
          </p>
          <BucketsSettingsCard />
        </CardContent>
      </Card>
      <Separator />
      <DerivedBucketAssignmentPanel />
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>3. Pre-flight privacy check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Before you turn on shielded mode, Chronicle shows a dry-run summary
            of outbound data: 0 secrets, 0 labels, 0 totals, and only
            scripthashes/outpoints to your Sentinel.
          </p>
          <PrivacyDryRunPreview />
        </CardContent>
      </Card>
      <Separator />
      <details className="rounded-md border bg-card/60 p-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Advanced setup (profile &amp; Sentinel pairing)
        </summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <OnboardingProfileCard />
          <SentinelPairingCard />
        </div>
      </details>
    </div>
  );
}
