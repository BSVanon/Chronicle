"use client";

import * as React from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useDossiers } from "@/contexts/dossier-context";
import { useBeefStore } from "@/contexts/beef-store-context";
import { useHeaderStore } from "@/contexts/header-store-context";
import type { UtxoDossier, ProofArchive } from "@/core/dossier/types";
import { getHeaderByHeight } from "@/core/headers/store";
import { Beef } from "@bsv/sdk";
import { Label } from "@/components/ui/label";
import JSZip from "jszip";

type SortOption = "newest" | "oldest" | "value-high" | "value-low" | "label-asc" | "label-desc";

// Extract proof details from BEEF
function getBeefDetails(beefBase64: string): { 
  txCount: number; 
  merkleDepth: number; 
  txSize: number;
  inputCount: number;
  outputCount: number;
} | null {
  try {
    const beef = Beef.fromString(beefBase64, "base64");
    const validTxids = beef.getValidTxids();
    const subjectTxid = validTxids[validTxids.length - 1];
    
    // Find the subject transaction
    const subjectTx = beef.txs.find(t => t.tx?.id("hex") === subjectTxid);
    const tx = subjectTx?.tx;
    
    // Get merkle path depth
    const merklePath = beef.findBump(subjectTxid);
    const merkleDepth = merklePath?.path?.length ?? 0;
    
    return {
      txCount: beef.txs.length,
      merkleDepth,
      txSize: tx?.toBinary().length ?? 0,
      inputCount: tx?.inputs.length ?? 0,
      outputCount: tx?.outputs.length ?? 0,
    };
  } catch {
    return null;
  }
}

export default function DossiersPage() {
  const { dossiers, buckets, loading, remove, refresh } = useDossiers();
  const { archives } = useBeefStore();
  const { tipHeight } = useHeaderStore();

  const [status, setStatus] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<SortOption>("newest");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [exportPassphrase, setExportPassphrase] = React.useState("");
  const [exportEncrypted, setExportEncrypted] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [displayCount, setDisplayCount] = React.useState(50); // Pagination: show 50 at a time
  
  // Reset display count when filter changes
  React.useEffect(() => {
    setDisplayCount(50);
  }, [filter, search, sort]);

  const toggleExpanded = (outpoint: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(outpoint)) {
      newExpanded.delete(outpoint);
    } else {
      newExpanded.add(outpoint);
    }
    setExpanded(newExpanded);
  };

  // Get archive for a dossier
  const getArchive = (dossier: UtxoDossier): ProofArchive | undefined => {
    if (!dossier.beef_hash) return undefined;
    return archives.find(a => a.beef_hash === dossier.beef_hash);
  };

  const filteredDossiers = React.useMemo(() => {
    let result = dossiers;
    
    // Filter by bucket
    if (filter !== "all") {
      result = result.filter((d) => d.bucket === filter);
    }
    
    // Search by txid, label, or outpoint
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d) => 
        d.outpoint.toLowerCase().includes(q) ||
        d.funding_txid.toLowerCase().includes(q) ||
        d.labels.some(l => l.toLowerCase().includes(q))
      );
    }
    
    // Sort
    result = [...result].sort((a, b) => {
      switch (sort) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "value-high":
          return b.value_satoshis - a.value_satoshis;
        case "value-low":
          return a.value_satoshis - b.value_satoshis;
        case "label-asc": {
          const aLabel = a.labels[0]?.toLowerCase() ?? "";
          const bLabel = b.labels[0]?.toLowerCase() ?? "";
          return aLabel.localeCompare(bLabel);
        }
        case "label-desc": {
          const aLabel = a.labels[0]?.toLowerCase() ?? "";
          const bLabel = b.labels[0]?.toLowerCase() ?? "";
          return bLabel.localeCompare(aLabel);
        }
        default:
          return 0;
      }
    });
    
    return result;
  }, [dossiers, filter, search, sort]);

  const handleDelete = async (outpoint: string) => {
    if (!confirm(`Delete dossier ${outpoint}?`)) return;

    try {
      await remove(outpoint);
      setStatus(`Deleted ${outpoint}`);
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  const getBucketLabel = (bucketId: string) => {
    const bucket = buckets.find((b) => b.id === bucketId);
    return bucket?.label ?? bucketId;
  };

  const toggleSelect = (outpoint: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(outpoint)) {
      newSelected.delete(outpoint);
    } else {
      newSelected.add(outpoint);
    }
    setSelected(newSelected);
  };

  const selectAll = () => {
    setSelected(new Set(filteredDossiers.map((d) => d.outpoint)));
  };

  const selectNone = () => {
    setSelected(new Set());
  };

  const handleExportSelected = async (encrypted: boolean = false, passphrase: string = "") => {
    if (selected.size === 0) {
      setStatus("No UTXOs selected for export.");
      return;
    }

    if (encrypted && passphrase.length < 8) {
      setStatus("Passphrase must be at least 8 characters.");
      return;
    }

    setExporting(true);

    try {
      const selectedDossiers = dossiers.filter((d) => selected.has(d.outpoint));
      
      // Build self-contained UTXO records with embedded BEEF
      const utxoRecords = [];
      const relevantHeights = new Set<number>();
      
      for (const dossier of selectedDossiers) {
        const archive = dossier.beef_hash 
          ? archives.find((a) => a.beef_hash === dossier.beef_hash)
          : undefined;
        
        // Extract txid and vout from outpoint
        const [txid, voutStr] = dossier.outpoint.split(":");
        const vout = parseInt(voutStr, 10);
        
        // Track block heights for header inclusion
        if (archive?.height) {
          relevantHeights.add(archive.height);
        }
        
        utxoRecords.push({
          // Core UTXO identification
          outpoint: dossier.outpoint,
          txid,
          vout,
          
          // Value and script (needed to spend)
          satoshis: dossier.value_satoshis,
          locking_script_hex: dossier.locking_script_hex,
          
          // BEEF proof (self-contained verification)
          beef: archive?.beef ?? null,
          beef_hash: dossier.beef_hash ?? null,
          
          // Block context
          block_height: archive?.height ?? null,
          block_hash: archive?.header_hash ?? null,
          
          // Metadata
          bucket: dossier.bucket,
          labels: dossier.labels,
          created_at: dossier.created_at,
          
          // Verification status at export time
          verified: dossier.verified?.ok ?? null,
        });
      }
      
      // Fetch relevant headers for offline verification
      const relevantHeaders: Array<{height: number; hash: string; raw: string}> = [];
      for (const height of relevantHeights) {
        const header = await getHeaderByHeight(height);
        if (header) {
          relevantHeaders.push({
            height: header.height,
            hash: header.hash,
            raw: header.header_hex,
          });
        }
      }

      const exportData = {
        // Format identification
        version: 2,
        format: "chronicle-utxo-bundle",
        exported_at: new Date().toISOString(),
        
        // Self-contained UTXO records
        utxos: utxoRecords,
        
        // Headers for offline verification
        headers: {
          tip_height: tipHeight,
          relevant: relevantHeaders,
        },
        
        // Summary for quick reference
        summary: {
          utxo_count: utxoRecords.length,
          total_satoshis: utxoRecords.reduce((sum, u) => sum + u.satoshis, 0),
          with_beef: utxoRecords.filter((u) => u.beef).length,
          verified: utxoRecords.filter((u) => u.verified).length,
          headers_included: relevantHeaders.length,
        },
        
        // Documentation for future readers
        _documentation: {
          format_description: "Chronicle Cold Vault UTXO Bundle - self-contained export for long-term storage",
          beef_format: "BRC-62 BEEF (Background Evaluation Extended Format) - base64 encoded",
          verification: "Each UTXO's beef field contains a complete Merkle proof. Use the included headers to verify locally.",
          spending: "To spend, you need: txid, vout, satoshis, locking_script_hex, and your private key",
        },
      };

      const json = JSON.stringify(exportData, null, 2);
      
      let blob: Blob;
      let filename: string;
      
      if (encrypted) {
        // Encrypt with AES-GCM
        const encoder = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const keyMaterial = await crypto.subtle.importKey(
          "raw",
          encoder.encode(passphrase),
          "PBKDF2",
          false,
          ["deriveBits", "deriveKey"]
        );
        
        const key = await crypto.subtle.deriveKey(
          { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt"]
        );
        
        const encrypted_data = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          encoder.encode(json)
        );
        
        // Combine salt + iv + ciphertext
        const result = new Uint8Array(salt.length + iv.length + encrypted_data.byteLength);
        result.set(salt, 0);
        result.set(iv, salt.length);
        result.set(new Uint8Array(encrypted_data), salt.length + iv.length);
        
        // Create zip with encrypted file + decryption tool
        const zip = new JSZip();
        const baseName = `chronicle-utxos-${selected.size}-${new Date().toISOString().slice(0, 10)}`;
        zip.file(`${baseName}.enc`, result);
        
        // Fetch and include the decryption tool
        const decryptToolResponse = await fetch("/decrypt-tool.html");
        const decryptToolHtml = await decryptToolResponse.text();
        zip.file("decrypt-tool.html", decryptToolHtml);
        
        // Add a README
        zip.file("README.txt", `Chronicle Cold Vault - Encrypted Export
========================================

This archive contains:
- ${baseName}.enc - Your encrypted UTXO data
- decrypt-tool.html - Standalone decryption tool

To decrypt:
1. Open decrypt-tool.html in any modern web browser
2. Select the .enc file
3. Enter your passphrase
4. Download the decrypted JSON

Encryption: AES-256-GCM with PBKDF2 (100,000 iterations, SHA-256)

Exported: ${new Date().toISOString()}
UTXOs: ${selected.size}
`);
        
        blob = await zip.generateAsync({ type: "blob" });
        filename = `${baseName}-encrypted.zip`;
      } else {
        blob = new Blob([json], { type: "application/json" });
        filename = `chronicle-utxos-${selected.size}-${new Date().toISOString().slice(0, 10)}.json`;
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setStatus(`Exported ${selected.size} UTXO(s) with ${relevantHeaders.length} header(s)${encrypted ? " (encrypted)" : ""}.`);
      setSelectMode(false);
      setSelected(new Set());
      setShowExportModal(false);
      setExportPassphrase("");
      setExportEncrypted(false);
    } catch (e) {
      setStatus(`Export error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setExporting(false);
    }
  };
  
  const openExportModal = () => {
    if (selected.size === 0) {
      setStatus("No UTXOs selected for export.");
      return;
    }
    setShowExportModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Export {selected.size} UTXO(s)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export creates a self-contained bundle with BEEF proofs and relevant headers for offline verification.
              </p>
              
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="encrypt-export"
                  checked={exportEncrypted}
                  onCheckedChange={(checked) => setExportEncrypted(checked === true)}
                />
                <Label htmlFor="encrypt-export" className="text-sm cursor-pointer">
                  Encrypt with passphrase
                </Label>
              </div>
              
              {exportEncrypted && (
                <div className="space-y-2">
                  <Label htmlFor="export-passphrase">Passphrase (min 8 characters)</Label>
                  <Input
                    id="export-passphrase"
                    type="password"
                    value={exportPassphrase}
                    onChange={(e) => setExportPassphrase(e.target.value)}
                    placeholder="Enter passphrase..."
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    � Encrypted exports include a standalone decryption tool in the .zip for future-proof access.
                  </p>
                </div>
              )}
              
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowExportModal(false);
                    setExportPassphrase("");
                    setExportEncrypted(false);
                  }}
                  disabled={exporting}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleExportSelected(exportEncrypted, exportPassphrase)}
                  disabled={exporting || (exportEncrypted && exportPassphrase.length < 8)}
                >
                  {exporting ? "Exporting..." : exportEncrypted ? "Export Encrypted" : "Export Plain"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">UTXO Dossiers</h1>
        <p className="text-sm text-muted-foreground">
          View and manage your UTXO inventory.
        </p>
      </div>

      {/* Summary & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Badge variant="outline">
            {loading ? "..." : filter !== "all" 
              ? `${filteredDossiers.length} of ${dossiers.length} dossiers`
              : `${dossiers.length} dossiers`
            }
          </Badge>
          <Badge 
            variant="outline"
            title={filter !== "all" 
              ? `Showing balance for "${getBucketLabel(filter)}" bucket only. Total across all buckets: ${(dossiers.reduce((sum, d) => sum + d.value_satoshis, 0) / 1e8).toFixed(8)} BSV`
              : "Total balance across all buckets"
            }
            className="cursor-help"
          >
            {filter !== "all" 
              ? `${(filteredDossiers.reduce((sum, d) => sum + d.value_satoshis, 0) / 1e8).toFixed(8)} BSV`
              : `${(dossiers.reduce((sum, d) => sum + d.value_satoshis, 0) / 1e8).toFixed(8)} BSV`
            }
            {filter !== "all" && <span className="ml-1 text-xs opacity-60">(filtered)</span>}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/add">Add UTXO</Link>
          </Button>
          <Button 
            variant={selectMode ? "default" : "outline"} 
            size="sm"
            onClick={() => {
              setSelectMode(!selectMode);
              if (selectMode) setSelected(new Set());
            }}
          >
            {selectMode ? "Cancel Select" : "Select & Export"}
          </Button>
          {dossiers.some(d => !d.beef_hash) && (
            <Button asChild variant="outline" size="sm">
              <Link href="/validation?action=batch">Fetch Missing BEEF</Link>
            </Button>
          )}
          {dossiers.some(d => d.beef_hash && !d.verified?.ok) && (
            <Button asChild variant="outline" size="sm">
              <Link href="/validation?action=verify">Verify Proofs</Link>
            </Button>
          )}
        </div>
      </div>

      {status && (
        <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-600 dark:text-blue-400">
          {status}
        </div>
      )}

      {/* Search, Filter, Sort */}
      <div className="space-y-3">
        {/* Search */}
        <Input
          placeholder="Search by txid, outpoint, or label..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        
        {/* Bucket filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Bucket:</span>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          {buckets.map((bucket) => (
            <Button
              key={bucket.id}
              variant={filter === bucket.id ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(bucket.id)}
            >
              {bucket.label}
            </Button>
          ))}
        </div>
        
        {/* Sort */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <Button
            variant={sort === "newest" ? "default" : "outline"}
            size="sm"
            onClick={() => setSort("newest")}
          >
            Newest
          </Button>
          <Button
            variant={sort === "oldest" ? "default" : "outline"}
            size="sm"
            onClick={() => setSort("oldest")}
          >
            Oldest
          </Button>
          <Button
            variant={sort === "value-high" ? "default" : "outline"}
            size="sm"
            onClick={() => setSort("value-high")}
          >
            Value ↓
          </Button>
          <Button
            variant={sort === "value-low" ? "default" : "outline"}
            size="sm"
            onClick={() => setSort("value-low")}
          >
            Value ↑
          </Button>
          <Button
            variant={sort === "label-asc" ? "default" : "outline"}
            size="sm"
            onClick={() => setSort("label-asc")}
          >
            Label A-Z
          </Button>
          <Button
            variant={sort === "label-desc" ? "default" : "outline"}
            size="sm"
            onClick={() => setSort("label-desc")}
          >
            Label Z-A
          </Button>
        </div>
      </div>

      {/* Selection toolbar */}
      {selectMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={selectAll}>
            Select All ({filteredDossiers.length})
          </Button>
          <Button size="sm" variant="outline" onClick={selectNone}>
            Clear
          </Button>
          <Button 
            size="sm" 
            onClick={openExportModal}
            disabled={selected.size === 0}
          >
            Export Selected
          </Button>
        </div>
      )}

      <Separator />

      {/* Dossier List */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : filteredDossiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No dossiers found.</p>
        ) : (
          <div className="space-y-2">
            {filteredDossiers.slice(0, displayCount).map((dossier) => {
              const archive = getArchive(dossier);
              const isExpanded = expanded.has(dossier.outpoint);
              const beefDetails = isExpanded && archive ? getBeefDetails(archive.beef) : null;
              
              return (
              <Card 
                key={dossier.outpoint} 
                className={`bg-card/60 transition-all ${selectMode ? "cursor-pointer" : "cursor-pointer hover:bg-card/80"} ${selected.has(dossier.outpoint) ? "ring-2 ring-primary" : ""}`}
                onClick={selectMode ? () => toggleSelect(dossier.outpoint) : () => toggleExpanded(dossier.outpoint)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {selectMode && (
                      <Checkbox
                        checked={selected.has(dossier.outpoint)}
                        onCheckedChange={() => toggleSelect(dossier.outpoint)}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        className="mt-1"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">{isExpanded ? "▼" : "▶"}</span>
                        <code className="block truncate text-xs">{dossier.outpoint}</code>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {(dossier.value_satoshis / 1e8).toFixed(8)} BSV
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {getBucketLabel(dossier.bucket)}
                        </Badge>
                        {dossier.beef_hash ? (
                          <Badge variant="default" className="text-xs bg-green-600">
                            BEEF ✓
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            No BEEF
                          </Badge>
                        )}
                        {dossier.verified?.ok === true ? (
                          <Badge variant="default" className="text-xs bg-blue-600">
                            Proof Verified ✓
                          </Badge>
                        ) : dossier.verified?.ok === false ? (
                          <Badge variant="destructive" className="text-xs" title="BEEF proof failed verification against local headers. May need updated headers.">
                            Proof Failed ✗
                          </Badge>
                        ) : dossier.beef_hash ? (
                          <Badge variant="outline" className="text-xs" title="Has BEEF but not yet verified against headers">
                            Not Verified
                          </Badge>
                        ) : null}
                      </div>
                      {dossier.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {dossier.labels.map((label) => (
                            <Badge 
                              key={label} 
                              variant="outline" 
                              className="text-xs bg-gray-700 text-gray-100 border-gray-600 dark:bg-gray-200 dark:text-gray-800 dark:border-gray-300"
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Added: {new Date(dossier.created_at).toLocaleDateString()}
                      </p>
                      
                      {/* Expanded Proof Details */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Proof Details</p>
                          {archive ? (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div>
                                <span className="text-muted-foreground">Block Height:</span>{" "}
                                <span className="font-mono">{archive.height.toLocaleString()}</span>
                              </div>
                              {beefDetails && (
                                <>
                                  <div>
                                    <span className="text-muted-foreground">Merkle Depth:</span>{" "}
                                    <span className="font-mono">{beefDetails.merkleDepth} levels</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Tx Size:</span>{" "}
                                    <span className="font-mono">{beefDetails.txSize.toLocaleString()} bytes</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Inputs/Outputs:</span>{" "}
                                    <span className="font-mono">{beefDetails.inputCount} / {beefDetails.outputCount}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">BEEF Txs:</span>{" "}
                                    <span className="font-mono">{beefDetails.txCount}</span>
                                  </div>
                                </>
                              )}
                              {dossier.verified?.ok && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Verified:</span>{" "}
                                  <span className="font-mono text-green-600 dark:text-green-400">
                                    ✓ at height {dossier.verified.at_height.toLocaleString()}
                                  </span>
                                </div>
                              )}
                              {archive.header_hash && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Block Hash:</span>{" "}
                                  <code className="font-mono text-[10px] break-all">{archive.header_hash.slice(0, 16)}...{archive.header_hash.slice(-16)}</code>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              No BEEF proof stored. Go to Validation to fetch.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleDelete(dossier.outpoint);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
            
            {/* Load More / Pagination */}
            {filteredDossiers.length > displayCount && (
              <div className="flex flex-col items-center gap-2 pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {displayCount} of {filteredDossiers.length} dossiers
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setDisplayCount(prev => prev + 50)}
                  >
                    Load 50 More
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setDisplayCount(filteredDossiers.length)}
                  >
                    Show All ({filteredDossiers.length})
                  </Button>
                </div>
              </div>
            )}
            
            {/* End of list indicator */}
            {filteredDossiers.length > 0 && displayCount >= filteredDossiers.length && filteredDossiers.length > 50 && (
              <p className="text-center text-sm text-muted-foreground pt-4">
                — End of list ({filteredDossiers.length} dossiers) —
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
