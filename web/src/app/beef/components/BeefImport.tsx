"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBeefStore } from "@/contexts/beef-store-context";
import { useDossiers } from "@/contexts/dossier-context";
import type { ProofArchive } from "@/core/dossier/types";

async function computeBeefHash(beefBase64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(beefBase64), (c) => c.charCodeAt(0));
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

type BeefImportProps = {
  onStatusChange: (status: string | null) => void;
};

export function BeefImport({ onStatusChange }: BeefImportProps) {
  const { save, refresh } = useBeefStore();
  const { dossiers, save: saveDossier } = useDossiers();
  
  const [importData, setImportData] = React.useState("");

  const handleImport = async () => {
    onStatusChange(null);
    if (!importData.trim()) {
      onStatusChange("Please paste BEEF data to import.");
      return;
    }

    try {
      // Try to parse as array or single object
      let items: unknown[];
      const parsed = JSON.parse(importData);
      if (Array.isArray(parsed)) {
        items = parsed;
      } else {
        items = [parsed];
      }

      let imported = 0;
      let linked = 0;

      for (const item of items) {
        const obj = item as Record<string, unknown>;
        if (!obj.txid || !obj.beef) {
          continue;
        }

        const beefBase64 = obj.beef as string;
        const beefHash = await computeBeefHash(beefBase64);

        const archive: ProofArchive = {
          txid: obj.txid as string,
          beef: beefBase64,
          beef_hash: beefHash,
          height: (obj.height as number) ?? 0,
          header_hash: (obj.header_hash as string) ?? "",
          utxos: (obj.utxos as ProofArchive["utxos"]) ?? [],
          labels: (obj.labels as string[]) ?? [],
          bucket: (obj.bucket as string) ?? "",
          created_at: new Date().toISOString(),
          integrity: {
            archive_hash: beefHash,
            algo: "sha256",
          },
        };

        const result = await save(archive);
        if (result.ok) {
          imported++;

          // Link to matching dossiers
          for (const dossier of dossiers) {
            if (dossier.funding_txid === archive.txid && !dossier.beef_hash) {
              await saveDossier({ ...dossier, beef_hash: beefHash });
              linked++;
            }
          }
        }
      }

      setImportData("");
      await refresh();
      onStatusChange(
        `Imported ${imported} BEEF archive(s).${linked > 0 ? ` Linked to ${linked} dossier(s).` : ""}`
      );
    } catch (e) {
      onStatusChange(`Import error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import BEEF</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Paste BEEF JSON data (single object or array) to import proof archives.
        </p>
        <Textarea
          placeholder='{"txid": "...", "beef": "base64...", "height": 123456}'
          value={importData}
          onChange={(e) => setImportData(e.target.value)}
          rows={6}
        />
        <Button onClick={handleImport}>Import</Button>
      </CardContent>
    </Card>
  );
}
