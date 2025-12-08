"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { type VerifyResult } from "@/core/dossier/verify";

import { BeefImport, BeefFetch, BeefVerify, BeefArchiveList, BeefConverter } from "./components";

export default function BeefPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BeefPageContent />
    </Suspense>
  );
}

function BeefPageContent() {
  const searchParams = useSearchParams();

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

  // Handle refetch request from archive list
  const handleRefetchRequest = (txid: string) => {
    setRefetchTxid(txid);
    document.getElementById("fetch-beef-section")?.scrollIntoView({ behavior: "smooth" });
  };

  // Clear pending action after it's handled
  const handleActionComplete = () => {
    setPendingAction(null);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">BEEF Proofs</h1>
        <p className="text-sm text-muted-foreground">
          Manage BEEF (Background Evaluation Extended Format) proof archives for your UTXOs.
        </p>
      </div>

      {status && (
        <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-600 dark:text-blue-400">
          {status}
        </div>
      )}

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

      {/* Format Converter */}
      <BeefConverter />

      <Separator />

      {/* Archive List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Stored Archives</h2>
        <BeefArchiveList
          verifyResults={verifyResults}
          onRefetchRequest={handleRefetchRequest}
        />
      </div>
    </div>
  );
}
