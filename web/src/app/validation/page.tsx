"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useNetworkMode } from "@/contexts/network-mode-context";
import { useBeefStore } from "@/contexts/beef-store-context";
import { useHeaderStore } from "@/contexts/header-store-context";
import { useDossiers } from "@/contexts/dossier-context";
import { type VerifyResult } from "@/core/dossier/verify";

import { HeadersSection } from "./components";
import { BeefVerify, BeefFetch, BeefImport, BeefArchiveList, BeefConverter } from "../beef/components";

export default function ValidationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ValidationPageContent />
    </Suspense>
  );
}

function ValidationPageContent() {
  const searchParams = useSearchParams();
  const { mode } = useNetworkMode();
  const { archives } = useBeefStore();
  const { headerCount } = useHeaderStore();
  const { dossiers } = useDossiers();

  const [status, setStatus] = React.useState<string | null>(null);
  const [verifyResults, setVerifyResults] = React.useState<Map<string, VerifyResult>>(new Map());
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [refetchTxid, setRefetchTxid] = React.useState<string>("");

  // Get initial txid from URL
  const initialTxid = searchParams.get("txid") ?? "";

  // Queue action from URL params
  React.useEffect(() => {
    const action = searchParams.get("action");
    if (action) {
      setPendingAction(action);
    }
  }, [searchParams]);

  const handleRefetchRequest = (txid: string) => {
    setRefetchTxid(txid);
    document.getElementById("fetch-beef-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleActionComplete = () => {
    setPendingAction(null);
  };

  // Calculate stats
  const missingBeef = dossiers.filter((d) => !d.beef_hash).length;
  const unverified = dossiers.filter((d) => d.beef_hash && !d.verified?.ok).length;
  const verified = dossiers.filter((d) => d.verified?.ok).length;

  // One-click sync & verify
  const handleSyncAndVerify = async () => {
    setStatus("Starting sync & verify...");
    // This will trigger the auto-actions
    setPendingAction("verify");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Validation</h1>
        <p className="text-sm text-muted-foreground">
          Sync headers and verify BEEF proofs for your UTXOs.
        </p>
      </div>

      {/* Quick Status */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-md border p-3 text-center">
          <p className="text-2xl font-bold">{headerCount}</p>
          <p className="text-xs text-muted-foreground">Headers</p>
        </div>
        <div className="rounded-md border p-3 text-center">
          <p className="text-2xl font-bold">{archives.length}</p>
          <p className="text-xs text-muted-foreground">BEEF Archives</p>
        </div>
        <div className="rounded-md border p-3 text-center">
          <p className="text-2xl font-bold" style={{ color: verified > 0 ? "#16a34a" : undefined }}>
            {verified}
          </p>
          <p className="text-xs text-muted-foreground">Verified</p>
        </div>
        <div className="rounded-md border p-3 text-center">
          <p className="text-2xl font-bold" style={{ color: missingBeef > 0 ? "#eab308" : undefined }}>
            {missingBeef + unverified}
          </p>
          <p className="text-xs text-muted-foreground">Need Attention</p>
        </div>
      </div>

      {/* One-click action */}
      {mode === "online_shielded" && (missingBeef > 0 || unverified > 0) && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Quick Actions</p>
              <p className="text-sm text-muted-foreground">
                {missingBeef > 0 && `${missingBeef} UTXOs need BEEF. `}
                {unverified > 0 && `${unverified} proofs need verification.`}
              </p>
            </div>
            <div className="flex gap-2">
              {missingBeef > 0 && (
                <Button size="sm" onClick={() => setPendingAction("batch")}>
                  Fetch All BEEF
                </Button>
              )}
              {unverified > 0 && (
                <Button size="sm" variant="outline" onClick={() => setPendingAction("verify")}>
                  Verify All
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {status && (
        <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-600 dark:text-blue-400">
          {status}
        </div>
      )}

      {/* Headers Section */}
      <HeadersSection onStatusChange={setStatus} />

      <Separator />

      {/* Verify Section */}
      <BeefVerify
        onStatusChange={setStatus}
        verifyResults={verifyResults}
        setVerifyResults={setVerifyResults}
        autoTrigger={pendingAction === "verify"}
        onAutoTriggerComplete={handleActionComplete}
      />

      <Separator />

      {/* Fetch Section */}
      <BeefFetch
        onStatusChange={setStatus}
        initialTxid={refetchTxid || initialTxid}
        autoTriggerBatch={pendingAction === "batch"}
        onAutoTriggerComplete={handleActionComplete}
      />

      <Separator />

      {/* Import Section */}
      <BeefImport onStatusChange={setStatus} />

      <Separator />

      {/* Archive List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Stored BEEF Archives</h2>
        <BeefArchiveList
          verifyResults={verifyResults}
          onRefetchRequest={handleRefetchRequest}
        />
      </div>

      <Separator />

      {/* BEEF Tools (collapsed by default) */}
      <details className="group">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <span className="transition-transform group-open:rotate-90">▶</span>
            <span>BEEF Tools</span>
          </div>
        </summary>
        <div className="mt-4">
          <BeefConverter />
        </div>
      </details>
    </div>
  );
}
