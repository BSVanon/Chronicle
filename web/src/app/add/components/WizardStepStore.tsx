"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Bucket } from "@/core/dossier/types";

type ParsedOutput = {
  vout: number;
  satoshis: number;
  script_hex: string;
};

type WizardStepStoreProps = {
  txid: string;
  selectedVout: number;
  outputs: ParsedOutput[];
  beefBase64: string | null;
  height: number | null;
  buckets: Bucket[];
  selectedBucket: string;
  setSelectedBucket: (bucket: string) => void;
  labels: string;
  setLabels: (labels: string) => void;
  onStore: () => void;
  onBack: () => void;
  existingOutpoints: Set<string>;
};

export function WizardStepStore({
  txid,
  selectedVout,
  outputs,
  beefBase64,
  height,
  buckets,
  selectedBucket,
  setSelectedBucket,
  labels,
  setLabels,
  onStore,
  onBack,
  existingOutpoints,
}: WizardStepStoreProps) {
  const output = outputs.find((o) => o.vout === selectedVout);
  const outpoint = `${txid}:${selectedVout}`;
  const isDuplicate = existingOutpoints.has(outpoint);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Store UTXO</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-3 text-sm space-y-1">
          <p>
            <strong>Outpoint:</strong> {txid}:{selectedVout}
          </p>
          {output ? (
            <p>
              <strong>Value:</strong> {(output.satoshis / 1e8).toFixed(8)} BSV
            </p>
          ) : (
            <p className="text-yellow-600 dark:text-yellow-400">
              <strong>Value:</strong> Unknown (offline entry)
            </p>
          )}
          {beefBase64 ? (
            <p style={{ color: "#16a34a" }}>
              <strong>BEEF:</strong> ✓ Available (height {height})
            </p>
          ) : (
            <p className="text-yellow-600 dark:text-yellow-400">
              <strong>BEEF:</strong> Not available (can fetch later)
            </p>
          )}
        </div>
        {!output && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            ⚠ Offline entry: BSV balance shown as 0 until you fetch the transaction online.
          </p>
        )}
        {isDuplicate && (
          <div className="rounded-md border border-orange-500/30 bg-orange-500/10 p-3">
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
              ⚠ Duplicate UTXO Detected
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              This outpoint already exists in your inventory. Storing will update the existing entry.
              If you meant to add a different output from the same transaction, go back and select a different vout.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Bucket</Label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedBucket}
            onChange={(e) => setSelectedBucket(e.target.value)}
          >
            {buckets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
            {buckets.length === 0 && <option value="default">Default</option>}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Labels (comma-separated)</Label>
          <Input
            placeholder="vault, cold-storage"
            value={labels}
            onChange={(e) => setLabels(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={onStore}>Store UTXO</Button>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
