import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PrivacyDryRunPreview } from "./privacy-dry-run-preview";
import { WatchOnlyPanel } from "./watch-only-panel";
import { OnboardingProfileCard } from "./profile-card";

export const metadata: Metadata = {
  title: "Onboarding",
};

export default function OnboardingPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
        <p className="text-sm text-muted-foreground">
          Start in offline mode. Choose a privacy profile, import watch-only
          material, and preview what would leave your device before Chronicle
          builds your local archive and live monitor in online_shielded mode.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <OnboardingProfileCard />
        <Card>
          <CardHeader>
            <CardTitle>2. Import watch-only view</CardTitle>
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
      </div>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>3. Pre-flight privacy check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Before enabling shielded mode, Chronicle will show a dry-run summary
            of outbound data: 0 secrets, 0 labels, 0 totals, and N
            scripthashes/outpoints.
          </p>
          <PrivacyDryRunPreview />
        </CardContent>
      </Card>
    </div>
  );
}
