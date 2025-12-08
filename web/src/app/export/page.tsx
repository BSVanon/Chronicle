"use client";

import * as React from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useDossiers } from "@/contexts/dossier-context";
import { useBeefStore } from "@/contexts/beef-store-context";
import { useHeaderStore } from "@/contexts/header-store-context";
import { exportHeaderStore, importHeaderStore } from "@/core/headers/store";
import type { UtxoDossier, ProofArchive, Bucket } from "@/core/dossier/types";

type ArchiveData = {
  version: number;
  exported_at: string;
  headers: { version: number; tipHeight: number | null; headers: unknown[] };
  beef: ProofArchive[];
  beef_index: Record<string, string>;
  dossiers: UtxoDossier[];
  buckets: Bucket[];
};

export default function ExportPage() {
  const { dossiers, buckets, save: saveDossier, replaceBuckets, refresh: refreshDossiers } = useDossiers();
  const { archives, index, save: saveBeef, refresh: refreshBeef } = useBeefStore();
  const { refresh: refreshHeaders } = useHeaderStore();

  const [status, setStatus] = React.useState<string | null>(null);
  const [passphrase, setPassphrase] = React.useState("");
  const [importPassphrase, setImportPassphrase] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Summary stats
  const totalDossiers = dossiers.length;
  const totalBeef = archives.length;
  const totalBuckets = buckets.length;

  const handleExportPlain = async () => {
    setStatus(null);
    try {
      const headers = await exportHeaderStore();

      const archive = {
        version: 1,
        exported_at: new Date().toISOString(),
        headers,
        beef: archives,
        beef_index: index,
        dossiers,
        buckets,
      };

      const json = JSON.stringify(archive, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chronicle-archive-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus("Archive exported successfully (unencrypted).");
    } catch (e) {
      setStatus(`Export error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  const handleExportEncrypted = async () => {
    setStatus(null);

    if (!passphrase || passphrase.length < 8) {
      setStatus("Please enter a passphrase of at least 8 characters.");
      return;
    }

    try {
      const headers = await exportHeaderStore();

      const archive = {
        version: 1,
        exported_at: new Date().toISOString(),
        headers,
        beef: archives,
        beef_index: index,
        dossiers,
        buckets,
      };

      const json = JSON.stringify(archive);
      const encoder = new TextEncoder();
      const data = encoder.encode(json);

      // Derive key from passphrase
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(passphrase),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
      );

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt,
          iterations: 100000,
          hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
      );

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        data
      );

      // Package: salt (16) + iv (12) + ciphertext
      const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
      result.set(salt, 0);
      result.set(iv, salt.length);
      result.set(new Uint8Array(encrypted), salt.length + iv.length);

      const blob = new Blob([result], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chronicle-archive-${new Date().toISOString().slice(0, 10)}.enc`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus("Encrypted archive exported successfully.");
      setPassphrase("");
    } catch (e) {
      setStatus(`Encryption error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setStatus(null);

    try {
      const isEncrypted = file.name.endsWith(".enc");

      if (isEncrypted) {
        if (!importPassphrase || importPassphrase.length < 8) {
          setStatus("Please enter the passphrase used to encrypt this archive.");
          setImporting(false);
          return;
        }

        // Read encrypted file
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        // Extract salt (16), iv (12), ciphertext
        const salt = data.slice(0, 16);
        const iv = data.slice(16, 28);
        const ciphertext = data.slice(28);

        // Derive key
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
          "raw",
          encoder.encode(importPassphrase),
          "PBKDF2",
          false,
          ["deriveBits", "deriveKey"]
        );

        const key = await crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt,
            iterations: 100000,
            hash: "SHA-256",
          },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"]
        );

        // Decrypt
        const decrypted = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          key,
          ciphertext
        );

        const decoder = new TextDecoder();
        const json = decoder.decode(decrypted);
        await importArchive(JSON.parse(json) as ArchiveData);
      } else {
        // Plain JSON
        const text = await file.text();
        await importArchive(JSON.parse(text) as ArchiveData);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "OperationError") {
        setStatus("Decryption failed. Check your passphrase.");
      } else {
        setStatus(`Import error: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const importArchive = async (archive: ArchiveData) => {
    let importedDossiers = 0;
    let importedBeef = 0;
    let importedHeaders = 0;

    // Import headers
    if (archive.headers && archive.headers.headers) {
      const result = await importHeaderStore(archive.headers as Parameters<typeof importHeaderStore>[0]);
      if (result.ok) {
        importedHeaders = result.imported;
      }
    }

    // Import BEEF archives
    if (Array.isArray(archive.beef)) {
      for (const beef of archive.beef) {
        const result = await saveBeef(beef);
        if (result.ok) {
          importedBeef++;
        }
      }
    }

    // Import dossiers
    if (Array.isArray(archive.dossiers)) {
      for (const dossier of archive.dossiers) {
        await saveDossier(dossier);
        importedDossiers++;
      }
    }

    // Import buckets
    if (Array.isArray(archive.buckets) && archive.buckets.length > 0) {
      replaceBuckets(archive.buckets);
    }

    // Refresh all stores
    await refreshHeaders();
    await refreshBeef();
    await refreshDossiers();

    setStatus(
      `Imported ${importedDossiers} dossiers, ${importedBeef} BEEF archives, ${importedHeaders} headers.`
    );
    setImportPassphrase("");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Export & Backup</h1>
        <p className="text-sm text-muted-foreground">
          Export your Cold Vault archive for backup or transfer to another device.
        </p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-4">
        <Badge variant="outline">{totalDossiers} dossiers</Badge>
        <Badge variant="outline">{totalBeef} BEEF archives</Badge>
        <Badge variant="outline">{totalBuckets} buckets</Badge>
      </div>

      {status && (
        <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-600 dark:text-blue-400">
          {status}
        </div>
      )}

      <Separator />

      {/* Selective Export */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle>Selective Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Export specific UTXOs with their BEEF proofs. Useful for restoring individual 
            UTXOs to a wallet or sharing proof bundles.
          </p>
          <Button asChild variant="outline">
            <Link href="/dossiers">Go to Dossiers → Select & Export</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Plain Export */}
      <Card>
        <CardHeader>
          <CardTitle>Full Export (Unencrypted)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Export everything as a plain JSON archive. Use this for quick backups on trusted devices.
          </p>
          <Button onClick={handleExportPlain}>Export Full Archive (JSON)</Button>
          <div className="rounded-md border p-3 space-y-2 text-xs text-muted-foreground">
            <p className="font-medium">About BEEF in Chronicle exports:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>
                BEEF proofs are stored as <strong>base64-encoded</strong> binary data inside the JSON.
              </li>
              <li>
                Some external tools (e.g.{" "}
                <a
                  href="https://beef.bsv.tools/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  beef.bsv.tools
                </a>
                ) expect raw <strong>hex</strong> BEEF, not the JSON wrapper.
              </li>
              <li>
                Use the <Link href="/validation" className="underline underline-offset-2">BEEF Format Converter</Link> (under BEEF Tools on Validation page) to
                convert between base64 and hex offline.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Encrypted Export */}
      <Card>
        <CardHeader>
          <CardTitle>Export (Encrypted)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Export an AES-256-GCM encrypted archive. Use this for backups on untrusted
            storage or for air-gapped transfer.
          </p>
          <div className="space-y-2">
            <Label>Passphrase (min 8 characters)</Label>
            <Input
              type="password"
              placeholder="Enter passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </div>
          <Button onClick={handleExportEncrypted}>Export Encrypted</Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle>Import Archive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Import a Chronicle archive to restore your dossiers, BEEF, and headers.
            Supports both plain JSON (.json) and encrypted (.enc) archives.
          </p>

          <div className="space-y-2">
            <Label>Passphrase (for encrypted archives)</Label>
            <Input
              type="password"
              placeholder="Enter passphrase if importing .enc file"
              value={importPassphrase}
              onChange={(e) => setImportPassphrase(e.target.value)}
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.enc"
            onChange={handleFileChange}
            className="hidden"
          />

          <Button onClick={handleFileSelect} disabled={importing}>
            {importing ? "Importing..." : "Select Archive File"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Note: Importing will merge with existing data. Duplicate entries will be updated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
