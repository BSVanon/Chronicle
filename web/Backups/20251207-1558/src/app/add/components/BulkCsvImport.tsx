"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { UtxoDossier, Bucket } from "@/core/dossier/types";

type BulkCsvImportProps = {
  buckets: Bucket[];
  saveDossier: (dossier: UtxoDossier) => Promise<void>;
};

export function BulkCsvImport({ buckets, saveDossier }: BulkCsvImportProps) {
  const [csvData, setCsvData] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);

  const handleCsvImport = async () => {
    setStatus(null);

    if (!csvData.trim()) {
      setStatus("Please paste CSV data.");
      return;
    }

    setImporting(true);
    try {
      const lines = csvData.trim().split("\n");
      let imported = 0;
      let skipped = 0;

      for (const line of lines) {
        // Skip header line if present
        if (line.toLowerCase().startsWith("txid") || line.toLowerCase().startsWith("#")) {
          continue;
        }

        // Parse CSV: txid,vout,value,bucket,label (optional fields)
        const parts = line.split(",").map((p) => p.trim());
        if (parts.length < 3) {
          skipped++;
          continue;
        }

        const [txidPart, voutPart, valuePart, bucketPart, labelPart] = parts;
        const txid = txidPart?.toLowerCase();
        const vout = parseInt(voutPart ?? "0", 10);
        const value = parseInt(valuePart ?? "0", 10);

        if (!txid || txid.length !== 64 || isNaN(vout) || isNaN(value)) {
          skipped++;
          continue;
        }

        const outpoint = `${txid}:${vout}`;
        const bucket = bucketPart || buckets[0]?.id || "default";
        const labels = labelPart ? [labelPart] : [];

        const dossier: UtxoDossier = {
          outpoint,
          value_satoshis: value,
          locking_script_hex: null,
          funding_txid: txid,
          funding_tx_raw: null,
          bucket,
          labels,
          derivation_hint: null,
          beef_hash: null,
          verified: null,
          created_at: new Date().toISOString(),
        };

        await saveDossier(dossier);
        imported++;
      }

      setCsvData("");
      setStatus(`Imported ${imported} UTXO(s). ${skipped > 0 ? `Skipped ${skipped} invalid line(s).` : ""}`);
    } catch (e) {
      setStatus(`Import error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk CSV Import</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Import multiple UTXOs from CSV. Format: <code>txid,vout,satoshis,bucket,label</code>
        </p>
        <p className="text-xs text-muted-foreground">
          Note: This creates dossier entries without BEEF proofs. You can fetch BEEF later
          from the BEEF page using the txids.
        </p>

        {status && (
          <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-600 dark:text-blue-400">
            {status}
          </div>
        )}

        <Textarea
          placeholder={`# txid,vout,satoshis,bucket,label
abc123...def,0,100000,cold-a,my savings
xyz789...ghi,1,50000,cold-b,`}
          value={csvData}
          onChange={(e) => setCsvData(e.target.value)}
          rows={8}
          className="font-mono text-xs"
        />

        <Button onClick={handleCsvImport} disabled={importing}>
          {importing ? "Importing..." : "Import CSV"}
        </Button>
      </CardContent>
    </Card>
  );
}
