"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBeefStore } from "@/contexts/beef-store-context";
import { useDossiers } from "@/contexts/dossier-context";
import { useHeaderStore } from "@/contexts/header-store-context";
import { useNetworkMode } from "@/contexts/network-mode-context";
import { verifyBeef, type VerifyResult } from "@/core/dossier/verify";
import { fetchHeaderByHeight, constructHeaderHex } from "@/core/net/providers";
import { saveHeader, getHeaderByHeight } from "@/core/headers/store";
import { applyRequestJitter } from "@/core/net/privacy-shield";
import { Beef } from "@bsv/sdk";

type BeefVerifyProps = {
  onStatusChange: (status: string | null) => void;
  verifyResults: Map<string, VerifyResult>;
  setVerifyResults: React.Dispatch<React.SetStateAction<Map<string, VerifyResult>>>;
  autoTrigger?: boolean;
  onAutoTriggerComplete?: () => void;
};

export function BeefVerify({ 
  onStatusChange, 
  verifyResults, 
  setVerifyResults,
  autoTrigger,
  onAutoTriggerComplete,
}: BeefVerifyProps) {
  const { archives, loading, verifyIntegrity } = useBeefStore();
  const { dossiers, save: saveDossier } = useDossiers();
  const { tipHeight, headerCount } = useHeaderStore();
  const { mode, requestOnline } = useNetworkMode();

  const [verifying, setVerifying] = React.useState(false);
  const [fetchingHeaders, setFetchingHeaders] = React.useState(false);
  const [hasAutoTriggered, setHasAutoTriggered] = React.useState(false);
  const [integrityResult, setIntegrityResult] = React.useState<{
    total: number;
    valid: number;
    invalid: string[];
  } | null>(null);

  const handleIntegrityCheck = async () => {
    onStatusChange(null);
    setIntegrityResult(null);
    try {
      const result = await verifyIntegrity();
      setIntegrityResult(result);
      if (result.invalid.length === 0) {
        onStatusChange(`Integrity check passed: ${result.valid} of ${result.total} BEEF archives valid.`);
      } else {
        onStatusChange(`Integrity check found ${result.invalid.length} invalid BEEF archive(s).`);
      }
    } catch (e) {
      onStatusChange(`Integrity check error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  // Auto-trigger verification when requested
  React.useEffect(() => {
    if (autoTrigger && !loading && !hasAutoTriggered && archives.length > 0) {
      setHasAutoTriggered(true);
      handleVerifyProofs().then(() => {
        onAutoTriggerComplete?.();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTrigger, loading, hasAutoTriggered, archives.length]);

  /**
   * Core verification logic - verifies all archives and updates UI
   * Returns results map for caller to inspect
   */
  const runVerification = async (): Promise<Map<string, VerifyResult>> => {
    const localResults = new Map<string, VerifyResult>();

    for (const archive of archives) {
      if (!archive.beef) continue;
      const result = await verifyBeef(archive.beef);
      localResults.set(archive.txid, result);
      
      // Update results immediately so UI reflects progress
      setVerifyResults(prev => {
        const updated = new Map(prev);
        updated.set(archive.txid, result);
        return updated;
      });

      // Update verification status on linked dossiers
      const linkedDossiers = dossiers.filter((d) => d.funding_txid === archive.txid);
      for (const dossier of linkedDossiers) {
        await saveDossier({
          ...dossier,
          verified: {
            at_height: tipHeight ?? 0,
            ok: result.ok,
            checked_at: new Date().toISOString(),
          },
        });
      }
    }

    return localResults;
  };

  /**
   * Smart verify - automatically fetches missing headers and re-verifies
   */
  const handleVerifyProofs = async () => {
    onStatusChange(null);
    setVerifying(true);

    try {
      // First pass: verify what we can
      onStatusChange("Verifying proofs...");
      let results = await runVerification();

      // Check if any failed due to missing headers
      const missingHeaderResults = Array.from(results.entries())
        .filter(([_, r]) => !r.ok && r.missingHeaders);

      if (missingHeaderResults.length > 0) {
        // Prompt to go online and fetch missing headers
        if (mode !== "online_shielded") {
          const confirmed = await requestOnline();
          if (!confirmed) {
            // User declined, show partial results
            const verified = Array.from(results.values()).filter((r) => r.ok).length;
            onStatusChange(`Verified: ${verified} of ${archives.length}. ${missingHeaderResults.length} need headers (stayed offline).`);
            return;
          }
        }

        // Fetch missing headers automatically
        onStatusChange(`Fetching ${missingHeaderResults.length} missing headers...`);
        setFetchingHeaders(true);

        // Collect needed heights from failed verifications
        const neededHeights = new Set<number>();
        for (const archive of archives) {
          if (!archive.beef) continue;
          if (archive.height && archive.height > 0) {
            const existing = await getHeaderByHeight(archive.height);
            if (!existing) neededHeights.add(archive.height);
          }
          try {
            const beefBytes = Uint8Array.from(atob(archive.beef), (c) => c.charCodeAt(0));
            const beef = Beef.fromBinary(Array.from(beefBytes));
            for (const bump of beef.bumps) {
              const existing = await getHeaderByHeight(bump.blockHeight);
              if (!existing) neededHeights.add(bump.blockHeight);
            }
          } catch {
            // Ignore parse errors
          }
        }

        // Fetch missing headers
        const missingHeights = Array.from(neededHeights).sort((a, b) => a - b);
        let fetched = 0;
        for (const height of missingHeights) {
          try {
            const headerData = await fetchHeaderByHeight(height);
            if (headerData) {
              await saveHeader({
                height: headerData.height,
                hash: headerData.hash,
                prev_hash: headerData.prevBlockHash,
                merkle_root: headerData.merkleRoot,
                timestamp: headerData.time,
                header_hex: constructHeaderHex(headerData),
              });
              fetched++;
            }
          } catch (e) {
            console.warn(`Failed to fetch header ${height}:`, e);
          }
          await applyRequestJitter();
          if (fetched % 3 === 0) {
            onStatusChange(`Fetched ${fetched} of ${missingHeights.length} headers...`);
          }
        }

        setFetchingHeaders(false);

        // Second pass: re-verify with new headers
        onStatusChange("Re-verifying with new headers...");
        results = await runVerification();
      }

      // Final status
      const verified = Array.from(results.values()).filter((r) => r.ok).length;
      const stillMissing = Array.from(results.values()).filter((r) => !r.ok && r.missingHeaders).length;
      const failed = Array.from(results.values()).filter((r) => !r.ok && !r.missingHeaders).length;

      let statusMsg = `✓ Verified: ${verified} of ${archives.length}.`;
      if (stillMissing > 0) {
        statusMsg += ` ${stillMissing} still need headers.`;
      }
      if (failed > 0) {
        statusMsg += ` ${failed} failed verification.`;
      }
      onStatusChange(statusMsg);
    } catch (e) {
      onStatusChange(`Verification error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setVerifying(false);
      setFetchingHeaders(false);
    }
  };

  const handleFetchMissingHeaders = async () => {
    if (mode !== "online_shielded") {
      const confirmed = await requestOnline();
      if (!confirmed) {
        onStatusChange("Cancelled. Stay in Offline mode.");
        return;
      }
    }

    setFetchingHeaders(true);
    onStatusChange("Scanning BEEF archives for required block heights...");

    try {
      // Collect all unique block heights from BEEF archives
      const neededHeights = new Set<number>();

      for (const archive of archives) {
        if (!archive.beef) continue;

        // First, use the stored height if available
        if (archive.height && archive.height > 0) {
          neededHeights.add(archive.height);
        }

        // Also try to parse BEEF for additional heights (in case of multi-tx BEEF)
        try {
          const beefBytes = Uint8Array.from(atob(archive.beef), (c) => c.charCodeAt(0));
          const beef = Beef.fromBinary(Array.from(beefBytes));

          // Get heights from all bumps (MerklePaths)
          for (const bump of beef.bumps) {
            neededHeights.add(bump.blockHeight);
          }
        } catch (e) {
          // BEEF parsing failed, but we already have the height from archive.height
          console.warn(`Could not parse BEEF for ${archive.txid} (using stored height ${archive.height}):`, e);
        }
      }

      if (neededHeights.size === 0) {
        onStatusChange("No BEEF archives found or no block heights detected.");
        return;
      }

      // Check which headers we're missing
      const missingHeights: number[] = [];
      for (const height of neededHeights) {
        const existing = await getHeaderByHeight(height);
        if (!existing) {
          missingHeights.push(height);
        }
      }

      if (missingHeights.length === 0) {
        onStatusChange(`All ${neededHeights.size} required headers are already stored. Try Verify Proofs.`);
        return;
      }

      onStatusChange(`Fetching ${missingHeights.length} missing headers...`);

      let fetched = 0;
      let failed = 0;

      // Sort heights and fetch with rate limiting
      missingHeights.sort((a, b) => a - b);

      for (const height of missingHeights) {
        try {
          const headerData = await fetchHeaderByHeight(height);
          if (headerData) {
            await saveHeader({
              height: headerData.height,
              hash: headerData.hash,
              prev_hash: headerData.prevBlockHash,
              merkle_root: headerData.merkleRoot,
              timestamp: headerData.time,
              header_hex: constructHeaderHex(headerData),
            });
            fetched++;
          } else {
            failed++;
          }
        } catch (e) {
          console.warn(`Failed to fetch header ${height}:`, e);
          failed++;
        }

        // Privacy Shield: Apply jitter between requests
        await applyRequestJitter();

        if ((fetched + failed) % 5 === 0) {
          onStatusChange(`Fetching headers: ${fetched + failed} of ${missingHeights.length}...`);
        }
      }

      onStatusChange(
        `Fetched ${fetched} headers. ${failed > 0 ? `${failed} failed.` : ""} Now try Verify Proofs.`
      );
    } catch (e) {
      onStatusChange(`Error fetching headers: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setFetchingHeaders(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify Proofs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm">
          <Badge variant="outline">
            {headerCount} headers stored
          </Badge>
          <Badge variant="outline">
            Tip: {tipHeight ?? "none"}
          </Badge>
          <Badge variant="outline">
            {archives.length} BEEF archives
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleIntegrityCheck} variant="outline" disabled={archives.length === 0}>
            Integrity Check
          </Button>
          <Button onClick={handleVerifyProofs} disabled={verifying || fetchingHeaders || archives.length === 0}>
            {verifying ? "Verifying..." : fetchingHeaders ? "Fetching Headers..." : "Verify All"}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground">
          "Verify All" will automatically fetch any missing headers needed for verification.
        </p>

        {integrityResult && (
          <div
            className={`rounded-md border p-3 text-sm ${
              integrityResult.invalid.length === 0
                ? "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400"
                : "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400"
            }`}
          >
            {integrityResult.invalid.length === 0 ? (
              <p>✓ All {integrityResult.valid} BEEF archives passed integrity check.</p>
            ) : (
              <>
                <p>✗ {integrityResult.invalid.length} invalid archive(s):</p>
                <ul className="mt-1 list-inside list-disc text-xs">
                  {integrityResult.invalid.slice(0, 5).map((txid) => (
                    <li key={txid} className="truncate">
                      {txid}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
