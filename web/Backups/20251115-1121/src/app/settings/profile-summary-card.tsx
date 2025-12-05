"use client";

import { PRIVACY_PROFILES } from "@/core/privacy/profiles";
import { usePrivacyProfile } from "@/contexts/privacy-profile-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ProfileSummaryCard() {
  const { profile } = usePrivacyProfile();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Privacy profiles</CardTitle>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Active: {profile.name}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Profiles tune Chronicle&apos;s Privacy Shield and Sentinel cadence:
          batch sizes, jitter, hourly caps, and decoy density. Cold is
          on-demand; Everyday is a low-cadence background monitor.
        </p>
        <div className="space-y-2 text-xs">
          {PRIVACY_PROFILES.map((p) => (
            <div
              key={p.id}
              className="rounded-md border bg-card/60 px-2 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.75rem] font-medium">{p.name}</span>
                {p.id === profile.id && (
                  <span className="text-[0.7rem] text-emerald-500">
                    selected
                  </span>
                )}
              </div>
              <p className="text-[0.7rem] text-muted-foreground">
                {p.description}
              </p>
              <div className="mt-1 grid gap-1 md:grid-cols-2">
                <p>
                  Max lookups/hour: <strong>{p.shieldOverrides.maxLookupsPerHour}</strong>
                </p>
                <p>
                  Batch size: <strong>{p.shieldOverrides.batchMin}</strong>
                  &ndash;<strong>{p.shieldOverrides.batchMax}</strong>
                </p>
                <p>
                  Chaff/batch: <strong>{p.shieldOverrides.chaffPerBatchMin}</strong>
                  &ndash;<strong>{p.shieldOverrides.chaffPerBatchMax}</strong>
                </p>
                <p>
                  Jitter (intra): <strong>{p.shieldOverrides.intraBatchJitterMinMs}</strong>
                  &ndash;<strong>{p.shieldOverrides.intraBatchJitterMaxMs}</strong> ms
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
