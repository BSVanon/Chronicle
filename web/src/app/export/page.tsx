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
import { markExportPerformed, saveDossiersBatch } from "@/core/dossier/store";
import type { UtxoDossier, ProofArchive, Bucket } from "@/core/dossier/types";
import JSZip from "jszip";

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
  const { dossiers, buckets, replaceBuckets, refresh: refreshDossiers } = useDossiers();
  const { archives, index, save: saveBeef, refresh: refreshBeef } = useBeefStore();
  const { refresh: refreshHeaders } = useHeaderStore();

  const [status, setStatus] = React.useState<string | null>(null);
  const [passphrase, setPassphrase] = React.useState("");
  const [passphraseError, setPassphraseError] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Import state - two-step flow
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = React.useState(false);
  const [importPassphrase, setImportPassphrase] = React.useState("");
  const [importResult, setImportResult] = React.useState<{
    dossiers: number;
    beef: number;
    headers: number;
  } | null>(null);

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

      // Mark export performed for reminder tracking
      markExportPerformed(dossiers.length);
      setStatus("Archive exported successfully (unencrypted).");
    } catch (e) {
      setStatus(`Export error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  const handleExportEncrypted = async () => {
    setStatus(null);
    setPassphraseError(null);

    if (!passphrase || passphrase.length < 8) {
      setPassphraseError(`Passphrase must be at least 8 characters (currently ${passphrase.length}).`);
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

      // Create zip with encrypted file + decryption tool
      const zip = new JSZip();
      const baseName = `chronicle-archive-${new Date().toISOString().slice(0, 10)}`;
      zip.file(`${baseName}.enc`, result);
      
      // Fetch and include the decryption tool
      const decryptToolResponse = await fetch("/decrypt-tool.html");
      const decryptToolHtml = await decryptToolResponse.text();
      zip.file("decrypt-tool.html", decryptToolHtml);
      
      // Add a README
      zip.file("README.txt", `Chronicle Cold Vault - Encrypted Full Backup
=============================================

This archive contains:
- ${baseName}.enc - Your encrypted Chronicle data (dossiers, BEEF proofs, headers)
- decrypt-tool.html - Standalone decryption tool

To decrypt:
1. Open decrypt-tool.html in any modern web browser
2. Select the .enc file
3. Enter your passphrase
4. Download the decrypted JSON

Encryption: AES-256-GCM with PBKDF2 (100,000 iterations, SHA-256)

Exported: ${new Date().toISOString()}
Dossiers: ${dossiers.length}
BEEF Archives: ${archives.length}
`);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}-encrypted.zip`;
      a.click();
      URL.revokeObjectURL(url);

      // Mark export performed for reminder tracking
      markExportPerformed(dossiers.length);
      setStatus("Encrypted archive exported successfully (zip with decryption tool).");
      setPassphrase("");
    } catch (e) {
      setStatus(`Encryption error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Just store the file, don't import yet
    setSelectedFile(file);
    setImportResult(null);
    setImportError(null);
    setShowPasswordPrompt(false);
    setImportPassphrase("");
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setImportResult(null);
    setImportError(null);
    setShowPasswordPrompt(false);
    setImportPassphrase("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImportClick = async () => {
    if (!selectedFile) return;

    const isEncrypted = selectedFile.name.endsWith(".enc");

    // If encrypted and no password prompt shown yet, show it
    if (isEncrypted && !showPasswordPrompt) {
      setShowPasswordPrompt(true);
      return;
    }

    // If encrypted and password prompt shown but no password entered
    if (isEncrypted && (!importPassphrase || importPassphrase.length < 8)) {
      setImportError("Please enter the passphrase (min 8 characters).");
      return;
    }

    setImportError(null);

    // Proceed with import
    setImporting(true);
    setStatus(null);

    try {
      if (isEncrypted) {
        // Read encrypted file
        const arrayBuffer = await selectedFile.arrayBuffer();
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
        const text = await selectedFile.text();
        await importArchive(JSON.parse(text) as ArchiveData);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "OperationError") {
        setImportError("Decryption failed. The passphrase is incorrect.");
      } else {
        setImportError(`Import error: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    } finally {
      setImporting(false);
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

    // Import dossiers (use batch for efficiency)
    if (Array.isArray(archive.dossiers) && archive.dossiers.length > 0) {
      await saveDossiersBatch(archive.dossiers);
      importedDossiers = archive.dossiers.length;
    }

    // Import buckets
    if (Array.isArray(archive.buckets) && archive.buckets.length > 0) {
      replaceBuckets(archive.buckets);
    }

    // Refresh all stores
    await refreshHeaders();
    await refreshBeef();
    await refreshDossiers();

    // Set result for confirmation display
    setImportResult({
      dossiers: importedDossiers,
      beef: importedBeef,
      headers: importedHeaders,
    });
    setSelectedFile(null);
    setShowPasswordPrompt(false);
    setImportPassphrase("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
              onChange={(e) => {
                setPassphrase(e.target.value);
                setPassphraseError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleExportEncrypted();
              }}
              className={passphraseError ? "border-red-500" : ""}
            />
            {passphraseError && (
              <p className="text-sm text-red-600 dark:text-red-400">{passphraseError}</p>
            )}
          </div>
          <Button onClick={handleExportEncrypted}>Export Encrypted</Button>
          <p className="text-xs text-muted-foreground">
            📦 Encrypted exports are bundled as a .zip with a standalone{" "}
            <a href="/decrypt-tool.html" target="_blank" className="text-primary underline">
              decryption tool
            </a>{" "}
            for future-proof access without Chronicle.
          </p>
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

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.enc"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Step 1: Select file */}
          {!selectedFile && !importResult && (
            <Button onClick={handleFileSelect} variant="outline" className="w-full sm:w-auto">
              📁 Select Archive File
            </Button>
          )}

          {/* Step 2: File selected - show details and import button */}
          {selectedFile && (
            <div className="space-y-3">
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                      {selectedFile.name.endsWith(".enc") && " • Encrypted"}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearFile}>
                    ✕
                  </Button>
                </div>
              </div>

              {/* Password prompt for encrypted files */}
              {showPasswordPrompt && (
                <div className="space-y-2">
                  <Label>Enter Passphrase</Label>
                  <Input
                    type="password"
                    placeholder="Passphrase used to encrypt this archive"
                    value={importPassphrase}
                    onChange={(e) => {
                      setImportPassphrase(e.target.value);
                      setImportError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleImportClick();
                    }}
                    autoFocus
                    className={importError ? "border-red-500" : ""}
                  />
                </div>
              )}

              {/* Import error */}
              {importError && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-sm text-red-700 dark:text-red-400">{importError}</p>
                </div>
              )}

              <Button 
                onClick={handleImportClick} 
                disabled={importing}
                className="w-full"
              >
                {importing ? "Importing..." : "Import Archive"}
              </Button>
            </div>
          )}

          {/* Success confirmation */}
          {importResult && (
            <div className="rounded-md border border-green-500/30 bg-green-500/10 p-4 space-y-2">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                ✓ Import Successful
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {importResult.dossiers} dossier{importResult.dossiers !== 1 ? "s" : ""} imported</li>
                <li>• {importResult.beef} BEEF archive{importResult.beef !== 1 ? "s" : ""} imported</li>
                <li>• {importResult.headers} header{importResult.headers !== 1 ? "s" : ""} imported</li>
              </ul>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setImportResult(null)}
                className="mt-2"
              >
                Done
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Note: Importing merges with existing data. Duplicate UTXOs (same outpoint) will be updated, not duplicated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
