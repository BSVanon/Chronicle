"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePrivacyProfile } from "@/contexts/privacy-profile-context";

export function OnboardingProfileCard() {
  const { profile, setProfileId } = usePrivacyProfile();

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Choose privacy profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Pick between an on-demand <strong>Cold Monitor</strong> profile and a
          low-cadence <strong>Everyday Monitor</strong> profile. Profiles tune
          Privacy Shield batch sizes, jitter, caps, and decoy density.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Profile:</span>
          <Button
            type="button"
            size="sm"
            variant={profile.id === "cold_monitor" ? "default" : "outline"}
            className="h-7 px-3 text-[0.7rem]"
            onClick={() => setProfileId("cold_monitor")}
          >
            Cold Monitor
          </Button>
          <Button
            type="button"
            size="sm"
            variant={profile.id === "everyday_monitor" ? "default" : "outline"}
            className="h-7 px-3 text-[0.7rem]"
            onClick={() => setProfileId("everyday_monitor")}
          >
            Everyday Monitor
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Active profile: <strong>{profile.name}</strong>
        </p>
      </CardContent>
    </Card>
  );
}
