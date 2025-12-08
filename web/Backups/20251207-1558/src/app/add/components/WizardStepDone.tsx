"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type WizardStepDoneProps = {
  resultOutpoint: string;
  txid: string;
  beefBase64: string | null;
  height: number | null;
  onReset: () => void;
};

export function WizardStepDone({
  resultOutpoint,
  txid,
  beefBase64,
  height,
  onReset,
}: WizardStepDoneProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle style={{ color: "#16a34a" }} className="dark:text-green-400">
          ✓ UTXO Added
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Successfully added <code className="text-xs">{resultOutpoint}</code> to your inventory.
        </p>

        {/* Status checklist */}
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">Archive Status:</p>
          <ul className="space-y-1 text-sm">
            <li className="flex items-center gap-2">
              <span style={{ color: "#16a34a" }}>✓</span> Dossier created
            </li>
            <li className="flex items-center gap-2">
              {beefBase64 ? (
                <>
                  <span style={{ color: "#16a34a" }}>✓</span> BEEF proof stored (height {height})
                </>
              ) : (
                <>
                  <span className="text-yellow-500">○</span>
                  <span className="text-yellow-600 dark:text-yellow-400">
                    No BEEF proof — go to <a href="/validation" className="underline">Validation page</a> to fetch
                  </span>
                </>
              )}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-muted-foreground">○</span>
              <span className="text-muted-foreground">
                Headers — go to <a href="/validation" className="underline">Validation page</a> to sync
              </span>
            </li>
          </ul>
        </div>

        {!beefBase64 && (
          <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-600 dark:text-yellow-400">
            <p className="font-medium">BEEF proof not available</p>
            <p className="mt-1">
              This can happen if the transaction is unconfirmed or the proof service is unavailable.
              You can manually fetch BEEF later from the Validation page using the txid.
            </p>
          </div>
        )}

        <Separator />

        <p className="text-sm font-medium">Next Steps:</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onReset}>Add Another UTXO</Button>
          {!beefBase64 && (
            <Button variant="outline" asChild>
              <a href={`/beef?txid=${txid}`}>Fetch BEEF</a>
            </Button>
          )}
          {beefBase64 && (
            <Button variant="outline" asChild>
              <a href="/validation?action=verify">Verify Proof</a>
            </Button>
          )}
          <Button variant="outline" asChild>
            <a href="/dossiers">View Dossiers</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/export">Export Backup</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
