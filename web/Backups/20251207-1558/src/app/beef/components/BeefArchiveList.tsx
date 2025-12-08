"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBeefStore } from "@/contexts/beef-store-context";
import { useDossiers } from "@/contexts/dossier-context";
import { useNetworkMode } from "@/contexts/network-mode-context";
import type { VerifyResult } from "@/core/dossier/verify";

type BeefArchiveListProps = {
  verifyResults: Map<string, VerifyResult>;
  onRefetchRequest: (txid: string) => void;
};

export function BeefArchiveList({ verifyResults, onRefetchRequest }: BeefArchiveListProps) {
  const { archives, loading } = useBeefStore();
  const { dossiers } = useDossiers();
  const { mode } = useNetworkMode();

  // Count linked dossiers for each archive
  const getLinkedDossierCount = (txid: string) => {
    return dossiers.filter((d) => d.funding_txid === txid).length;
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (archives.length === 0) {
    return <p className="text-sm text-muted-foreground">No BEEF archives stored yet.</p>;
  }

  return (
    <div className="space-y-2">
      {archives.slice(0, 20).map((archive) => {
        const vr = verifyResults.get(archive.txid);
        const linkedCount = getLinkedDossierCount(archive.txid);
        const borderStyle = vr?.ok
          ? { borderColor: "rgba(22, 163, 74, 0.3)", backgroundColor: "rgba(22, 163, 74, 0.1)" }
          : vr && !vr.ok
          ? { borderColor: "rgba(239, 68, 68, 0.3)", backgroundColor: "rgba(239, 68, 68, 0.05)" }
          : {};

        return (
          <div
            key={archive.txid}
            className="rounded-md border p-3 text-sm bg-card/60"
            style={borderStyle}
          >
            <div className="flex items-center justify-between gap-2">
              <code className="truncate text-xs">{archive.txid}</code>
              <div className="flex items-center gap-2">
                {vr && (
                  <Badge variant={vr.ok ? "default" : "destructive"} className="text-xs">
                    {vr.ok ? "✓ Verified" : "✗ Failed"}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  Height {archive.height}
                </Badge>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {linkedCount > 0 ? (
                <span className="text-blue-600 dark:text-blue-400">
                  Proves {linkedCount} UTXO{linkedCount !== 1 ? "s" : ""}
                </span>
              ) : (
                <span>No linked UTXOs</span>
              )}
              {archive.bucket && <span> • Bucket: {archive.bucket}</span>}
              {vr && !vr.ok && vr.error && (
                <span className="ml-2 text-red-500">— {vr.error}</span>
              )}
            </p>
            {vr && !vr.ok && vr.error?.includes("Parse error") && mode === "online_shielded" && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => onRefetchRequest(archive.txid)}
              >
                Re-fetch BEEF (corrupted)
              </Button>
            )}
          </div>
        );
      })}
      {archives.length > 20 && (
        <p className="text-xs text-muted-foreground">...and {archives.length - 20} more</p>
      )}
    </div>
  );
}
