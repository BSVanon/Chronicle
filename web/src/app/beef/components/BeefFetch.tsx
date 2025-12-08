"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBeefStore } from "@/contexts/beef-store-context";
import { useDossiers } from "@/contexts/dossier-context";
import { useNetworkMode } from "@/contexts/network-mode-context";
import { assembleBeefFromTxid } from "@/core/net/providers";
import { computeBeefHash } from "@/core/dossier/beef-store";
import { 
  applyRequestJitter, 
  applyBatchDelay, 
  createBatches,
  generateDecoyTxids,
  shuffleArray,
  getRateLimitStatus,
} from "@/core/net/privacy-shield";
import type { ProofArchive } from "@/core/dossier/types";

type BeefFetchProps = {
  onStatusChange: (status: string | null) => void;
  initialTxid?: string;
  autoTriggerBatch?: boolean;
  onAutoTriggerComplete?: () => void;
};

export function BeefFetch({ 
  onStatusChange, 
  initialTxid = "",
  autoTriggerBatch,
  onAutoTriggerComplete,
}: BeefFetchProps) {
  const { archives, save, refresh } = useBeefStore();
  const { dossiers, save: saveDossier } = useDossiers();
  const { mode, requestOnline } = useNetworkMode();

  const [fetchTxid, setFetchTxid] = React.useState(initialTxid);
  const [fetching, setFetching] = React.useState(false);
  const [batchFetching, setBatchFetching] = React.useState(false);
  const [batchProgress, setBatchProgress] = React.useState<{
    current: number;
    total: number;
    success: number;
    failed: number;
  } | null>(null);

  const [hasAutoTriggered, setHasAutoTriggered] = React.useState(false);

  // Update txid if prop changes
  React.useEffect(() => {
    if (initialTxid) {
      setFetchTxid(initialTxid);
    }
  }, [initialTxid]);

  // Auto-trigger batch fetch when requested
  React.useEffect(() => {
    const missingBeef = dossiers.filter((d) => !d.beef_hash);
    if (autoTriggerBatch && mode === "online_shielded" && !hasAutoTriggered && missingBeef.length > 0) {
      setHasAutoTriggered(true);
      handleBatchFetch().then(() => {
        onAutoTriggerComplete?.();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTriggerBatch, mode, hasAutoTriggered, dossiers]);

  const handleFetchBeef = async () => {
    onStatusChange(null);

    if (mode !== "online_shielded") {
      const confirmed = await requestOnline();
      if (!confirmed) {
        onStatusChange("Cancelled. Stay in Offline mode.");
        return;
      }
    }

    const txid = fetchTxid.trim().toLowerCase();
    if (!txid || txid.length !== 64) {
      onStatusChange("Please enter a valid 64-character txid.");
      return;
    }

    // Check if we already have this BEEF (allow re-fetch if user confirms)
    const existing = archives.find((a) => a.txid === txid);
    let forceOverwrite = false;
    if (existing) {
      const confirmRefetch = window.confirm(
        "BEEF for this txid already exists. Re-fetch to replace it?"
      );
      if (!confirmRefetch) {
        onStatusChange("Cancelled. Existing BEEF kept.");
        return;
      }
      forceOverwrite = true;
    }

    setFetching(true);
    try {
      const result = await assembleBeefFromTxid(txid);
      if (!result) {
        onStatusChange("Could not fetch BEEF. The transaction may be unconfirmed or the proof unavailable.");
        return;
      }

      // Convert hex to base64 for storage
      const hexToBytes = (hex: string) => {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
          bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
      };
      const beefBytes = hexToBytes(result.beefHex);
      const beefBase64 = btoa(String.fromCharCode(...beefBytes));
      const beefHash = await computeBeefHash(beefBase64);

      const archive: ProofArchive = {
        txid,
        beef: beefBase64,
        beef_hash: beefHash,
        height: result.height,
        header_hash: "",
        utxos: existing?.utxos ?? [],
        labels: existing?.labels ?? [],
        bucket: existing?.bucket ?? "",
        created_at: existing?.created_at ?? new Date().toISOString(),
        integrity: {
          archive_hash: beefHash,
          algo: "sha256",
        },
      };

      const saveResult = await save(archive, { force: forceOverwrite });
      if (!saveResult.ok) {
        onStatusChange(`Save failed: ${saveResult.message}`);
        return;
      }

      // Try to link to existing dossiers
      let linked = 0;
      for (const dossier of dossiers) {
        if (dossier.funding_txid === txid && !dossier.beef_hash) {
          await saveDossier({ ...dossier, beef_hash: beefHash });
          linked++;
        }
      }

      setFetchTxid("");
      await refresh();
      onStatusChange(
        `BEEF fetched and stored for ${txid.slice(0, 8)}... (height ${result.height})${linked > 0 ? `. Linked to ${linked} dossier(s).` : ""}`
      );
    } catch (e) {
      onStatusChange(`Fetch error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setFetching(false);
    }
  };

  const handleBatchFetch = async () => {
    onStatusChange(null);

    if (mode !== "online_shielded") {
      const confirmed = await requestOnline();
      if (!confirmed) {
        onStatusChange("Cancelled. Stay in Offline mode.");
        return;
      }
    }

    // Get all dossiers missing BEEF
    const missingBeef = dossiers.filter((d) => !d.beef_hash);
    if (missingBeef.length === 0) {
      onStatusChange("All dossiers already have BEEF proofs!");
      return;
    }

    // Get unique txids
    const uniqueTxids = [...new Set(missingBeef.map((d) => d.funding_txid))];
    
    // Privacy Shield: Create batches of 3-7 items
    const batches = createBatches(uniqueTxids);
    
    // Add 1-2 decoy txids per batch
    const batchesWithDecoys = batches.map(batch => {
      const decoyCount = Math.floor(Math.random() * 2) + 1; // 1-2 decoys
      const decoys = generateDecoyTxids(decoyCount);
      return {
        items: shuffleArray([...batch, ...decoys]),
        realTxids: new Set(batch),
      };
    });

    setBatchFetching(true);
    setBatchProgress({ current: 0, total: uniqueTxids.length, success: 0, failed: 0 });

    let success = 0;
    let failed = 0;
    let processed = 0;

    for (let batchIndex = 0; batchIndex < batchesWithDecoys.length; batchIndex++) {
      const { items, realTxids } = batchesWithDecoys[batchIndex];
      
      for (let i = 0; i < items.length; i++) {
        const txid = items[i];
        const isDecoy = !realTxids.has(txid);
        
        if (!isDecoy) {
          processed++;
          setBatchProgress({ current: processed, total: uniqueTxids.length, success, failed });
        }

        try {
          const result = await assembleBeefFromTxid(txid);
          
          // Discard decoy results
          if (isDecoy) {
            // Decoy fetched and discarded for privacy
            continue;
          }
          
          if (result) {
            const hexToBytes = (hex: string) => {
              const bytes = new Uint8Array(hex.length / 2);
              for (let j = 0; j < hex.length; j += 2) {
                bytes[j / 2] = parseInt(hex.substr(j, 2), 16);
              }
              return bytes;
            };
            const beefBytes = hexToBytes(result.beefHex);
            const beefBase64 = btoa(String.fromCharCode(...beefBytes));
            const beefHash = await computeBeefHash(beefBase64);

            const archive: ProofArchive = {
              txid,
              beef: beefBase64,
              beef_hash: beefHash,
              height: result.height,
              header_hash: "",
              utxos: [],
              labels: [],
              bucket: "",
              created_at: new Date().toISOString(),
              integrity: {
                archive_hash: beefHash,
                algo: "sha256",
              },
            };

            const saveResult = await save(archive);
            if (saveResult.ok) {
              // Link to dossiers
              for (const dossier of missingBeef.filter((d) => d.funding_txid === txid)) {
                await saveDossier({ ...dossier, beef_hash: beefHash });
              }
              success++;
            } else {
              failed++;
            }
          } else {
            failed++;
          }
        } catch {
          if (!isDecoy) {
            failed++;
          }
        }

        // Privacy Shield: Apply jitter between requests (500-3000ms)
        if (i < items.length - 1) {
          await applyRequestJitter();
        }
      }
      
      // Privacy Shield: Apply batch delay (3-8 seconds) between batches
      if (batchIndex < batchesWithDecoys.length - 1) {
        await applyBatchDelay();
      }
    }

    setBatchProgress({ current: uniqueTxids.length, total: uniqueTxids.length, success, failed });
    await refresh();
    onStatusChange(`Batch fetch complete: ${success} succeeded, ${failed} failed.`);
    setBatchFetching(false);
  };

  const missingBeefCount = dossiers.filter((d) => !d.beef_hash).length;

  return (
    <Card id="fetch-beef-section">
      <CardHeader>
        <CardTitle>Fetch BEEF from Network</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter a txid to fetch its BEEF proof from WhatsOnChain (requires Online mode).
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="Transaction ID (64 hex characters)"
            value={fetchTxid}
            onChange={(e) => setFetchTxid(e.target.value.toLowerCase())}
            className="font-mono text-xs"
          />
          <Button onClick={handleFetchBeef} disabled={fetching}>
            {fetching ? "Fetching..." : "Fetch BEEF"}
          </Button>
        </div>

        {/* Batch fetch */}
        {missingBeefCount > 0 && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                <Badge variant="outline" className="mr-2">
                  {missingBeefCount}
                </Badge>
                dossiers missing BEEF
              </span>
              <Button
                size="sm"
                onClick={handleBatchFetch}
                disabled={batchFetching}
              >
                {batchFetching ? "Fetching..." : "Fetch All Missing"}
              </Button>
            </div>
            {batchProgress && (
              <div className="text-xs text-muted-foreground">
                Progress: {batchProgress.current}/{batchProgress.total} •{" "}
                <span className="text-green-600">{batchProgress.success} ok</span> •{" "}
                <span className="text-red-500">{batchProgress.failed} failed</span>
              </div>
            )}
          </div>
        )}

        {mode !== "online_shielded" && (
          <p className="text-xs text-muted-foreground">
            Currently offline. Clicking fetch will prompt to go online.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
