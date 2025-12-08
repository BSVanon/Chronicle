"use client";

import * as React from "react";

import { Separator } from "@/components/ui/separator";
import { useDossiers } from "@/contexts/dossier-context";

import { UtxoWizard, BulkCsvImport } from "./components";

export default function AddUtxoPage() {
  const { buckets, save: saveDossier } = useDossiers();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Add UTXO</h1>
        <p className="text-sm text-muted-foreground">
          Add a new UTXO to your inventory by providing transaction details.
        </p>
      </div>

      {/* Main Wizard */}
      <UtxoWizard buckets={buckets} />

      <Separator />

      {/* Bulk CSV Import */}
      <BulkCsvImport buckets={buckets} saveDossier={saveDossier} />
    </div>
  );
}
