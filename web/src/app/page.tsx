"use client";

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useDossiers } from "@/contexts/dossier-context";
import { useBeefStore } from "@/contexts/beef-store-context";
import { useHeaderStore } from "@/contexts/header-store-context";
import { useNetworkMode } from "@/contexts/network-mode-context";

// Color map for progress bars (using hex for light mode visibility)
const colorMap: Record<string, string> = {
  "bg-green-600": "#16a34a",
  "bg-green-500": "#22c55e",
  "bg-yellow-500": "#eab308",
  "bg-blue-500": "#3b82f6",
  "bg-blue-600": "#2563eb",
  "bg-red-500": "#ef4444",
  "bg-primary": "hsl(var(--primary))",
};

// Simple progress bar component
function ProgressBar({ 
  value, 
  max = 100, 
  color = "bg-primary" 
}: { 
  value: number; 
  max?: number; 
  color?: string;
}) {
  const percent = max === 0 ? 100 : Math.min(100, Math.round((value / max) * 100));
  const bgColor = colorMap[color] || colorMap["bg-primary"];
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div 
        className="h-2 rounded-full transition-all"
        style={{ width: `${percent}%`, backgroundColor: bgColor }}
      />
    </div>
  );
}

export default function HomePage() {
  const { summaries, buckets, dossiers, loading } = useDossiers();
  const { archives } = useBeefStore();
  const { tipHeight, headerCount } = useHeaderStore();
  const { mode } = useNetworkMode();

  // Compute totals
  const totalSatoshis = summaries.reduce((sum, s) => sum + s.total_satoshis, 0);
  const totalDossiers = dossiers.length;
  const totalWithBeef = dossiers.filter(d => d.beef_hash).length;
  const totalVerified = dossiers.filter(d => d.verified?.ok === true).length;
  const totalFailed = dossiers.filter(d => d.verified?.ok === false).length;
  const totalNotVerified = totalWithBeef - totalVerified; // Has BEEF but not verified yet
  const totalMissingBeef = totalDossiers - totalWithBeef;
  const totalZeroBalance = dossiers.filter(d => d.value_satoshis === 0).length;
  
  const beefCoveragePercent = totalDossiers === 0 ? 100 : Math.round((totalWithBeef / totalDossiers) * 100);
  const verifiedPercent = totalDossiers === 0 ? 100 : Math.round((totalVerified / totalDossiers) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Cold Vault Archive</h1>
          <p className="text-sm text-muted-foreground">
            Your UTXO inventory, BEEF proofs, and headers — all local, all verified.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="sm:size-default">
            <Link href="/add">+ Add UTXO</Link>
          </Button>
          <Badge 
            variant={mode === "offline" ? "outline" : "default"}
            className={mode === "offline" ? "border-orange-500 text-orange-600 dark:text-orange-400" : ""}
          >
            {mode === "offline" ? "🔒 Offline" : "🌐 Online"}
          </Badge>
        </div>
      </div>

      {/* Getting Started - show when no dossiers */}
      {!loading && totalDossiers === 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Chronicle is your offline-first UTXO archive. Here&apos;s how to begin:
            </p>
            <ol className="list-inside list-decimal space-y-2 text-sm">
              <li><strong>Add a UTXO</strong> — Click &quot;+ Add UTXO&quot; and enter a transaction ID</li>
              <li><strong>Fetch the BEEF proof</strong> — The app will download the SPV proof automatically</li>
              <li><strong>Verify locally</strong> — Go to Validation and click &quot;Verify All&quot;</li>
              <li><strong>Export a backup</strong> — Use Export to save an encrypted archive</li>
            </ol>
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/add">+ Add Your First UTXO</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/export">Import Existing Archive</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle 
              className="text-sm font-medium text-muted-foreground cursor-help flex items-center gap-1"
              title="Balance reflects values recorded when UTXOs were added. Offline entries show 0 BSV. This is NOT a live on-chain balance check."
            >
              Total Balance
              <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border border-muted-foreground/50">ⓘ</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold">
              {loading ? "..." : (totalSatoshis / 1e8).toFixed(8)} BSV
            </p>
            <p className="text-xs text-muted-foreground">
              {totalDossiers} UTXO{totalDossiers !== 1 ? "s" : ""} across {buckets.length} bucket{buckets.length !== 1 ? "s" : ""}
            </p>
            {totalZeroBalance > 0 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                {totalZeroBalance} with unknown balance
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle 
              className="text-sm font-medium text-muted-foreground cursor-help flex items-center gap-1"
              title="BEEF (Background Evaluation Extended Format) proofs contain the Merkle path linking your UTXO's transaction to a block header, enabling offline SPV verification."
            >
              BEEF Coverage
              <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border border-muted-foreground/50">ⓘ</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-bold">{loading ? "..." : `${beefCoveragePercent}%`}</p>
              {totalMissingBeef > 0 && (
                <span className="text-xs text-yellow-600 dark:text-yellow-400">
                  {totalMissingBeef} missing
                </span>
              )}
            </div>
            <ProgressBar 
              value={totalWithBeef} 
              max={totalDossiers} 
              color={beefCoveragePercent === 100 ? "bg-green-600" : "bg-yellow-500"}
            />
            <p className="text-xs text-muted-foreground">
              {totalWithBeef} of {totalDossiers} have BEEF proofs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle 
              className="text-sm font-medium text-muted-foreground cursor-help flex items-center gap-1"
              title="Verified proofs have been checked against locally-stored block headers. This confirms the transaction was included in a mined block, but does NOT prove the UTXO is currently unspent."
            >
              Verified Proofs
              <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border border-muted-foreground/50">ⓘ</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-bold">{loading ? "..." : `${verifiedPercent}%`}</p>
              <div className="flex flex-col items-end text-xs">
                {totalFailed > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {totalFailed} proof failed
                  </span>
                )}
                {totalNotVerified > 0 && totalFailed === 0 && (
                  <span className="text-blue-600 dark:text-blue-400">
                    {totalNotVerified} not verified
                  </span>
                )}
              </div>
            </div>
            <ProgressBar 
              value={totalVerified} 
              max={totalDossiers} 
              color={verifiedPercent === 100 ? "bg-green-600" : "bg-blue-500"}
            />
            <p className="text-xs text-muted-foreground">
              {totalVerified} of {totalDossiers} verified against headers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle 
              className="text-sm font-medium text-muted-foreground cursor-help flex items-center gap-1"
              title="Block headers are 80-byte summaries of each block. They contain the Merkle root needed to verify BEEF proofs locally without trusting a third party."
            >
              Headers
              <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border border-muted-foreground/50">ⓘ</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold">{headerCount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              Tip: {tipHeight?.toLocaleString() ?? "none"}
            </p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/validation">Sync Headers</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - show when there's work to do */}
      {(totalMissingBeef > 0 || totalWithBeef > totalVerified) && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Quick Actions:</span>
            {totalMissingBeef > 0 && (
              <Button asChild size="sm">
                <Link href="/validation?action=batch">
                  Fetch All Missing BEEF ({totalMissingBeef})
                </Link>
              </Button>
            )}
            {totalWithBeef > totalVerified && (
              <Button asChild variant="outline" size="sm">
                <Link href="/validation?action=verify">
                  Verify All Proofs ({totalWithBeef - totalVerified})
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/add">Add UTXO</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/export">Export Backup</Link>
            </Button>
          </div>
          <Separator />
        </>
      )}

      {/* Buckets */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Buckets</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : buckets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No buckets defined yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {buckets.map((bucket) => {
              const summary = summaries.find((s) => s.bucket === bucket.id);
              const balance = summary?.total_satoshis ?? 0;
              const count = summary?.dossier_count ?? 0;
              const coverage = summary?.beef_coverage_percent ?? 100;
              const verified = summary?.verified_count ?? 0;
              const pending = summary?.pending_count ?? 0;

              return (
                <Card key={bucket.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{bucket.label}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {coverage}% BEEF
                      </Badge>
                    </div>
                    {bucket.description && (
                      <p className="text-xs text-muted-foreground">{bucket.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>
                      <span className="font-medium">{(balance / 1e8).toFixed(8)}</span> BSV
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {count} UTXO{count !== 1 ? "s" : ""} • {verified} verified • {pending} pending
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* Truth in labeling */}
      <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-yellow-600 dark:text-yellow-400">Truth in labeling</p>
        <p className="mt-1">
          Chronicle shows verified inclusion proofs, not unspentness claims. The balances above
          represent UTXOs you&apos;ve added to your inventory. To confirm they are still unspent,
          you must check current chain state (run a node, query providers, etc.).
        </p>
      </div>
    </div>
  );
}
