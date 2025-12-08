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
import type { UtxoDossier, ProofArchive } from "@/core/dossier/types";

type SortOption = "newest" | "oldest" | "value-high" | "value-low" | "label-asc" | "label-desc";

export default function DossiersPage() {
  const { dossiers, buckets, loading, remove, refresh } = useDossiers();
  const { archives } = useBeefStore();

  const [status, setStatus] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<SortOption>("newest");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = React.useState(false);

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

  const handleExportSelected = async () => {
    if (selected.size === 0) {
      setStatus("No UTXOs selected for export.");
      return;
    }

    try {
      const selectedDossiers = dossiers.filter((d) => selected.has(d.outpoint));
      const relatedArchives: ProofArchive[] = [];

      // Get BEEF archives for selected dossiers
      for (const dossier of selectedDossiers) {
        if (dossier.beef_hash) {
          const archive = archives.find((a) => a.beef_hash === dossier.beef_hash);
          if (archive) {
            relatedArchives.push(archive);
          }
        }
      }

      const exportData = {
        version: 1,
        exported_at: new Date().toISOString(),
        type: "utxo_bundle",
        dossiers: selectedDossiers,
        beef_archives: relatedArchives,
        summary: {
          utxo_count: selectedDossiers.length,
          total_satoshis: selectedDossiers.reduce((sum, d) => sum + d.value_satoshis, 0),
          with_beef: selectedDossiers.filter((d) => d.beef_hash).length,
          verified: selectedDossiers.filter((d) => d.verified?.ok).length,
        },
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chronicle-utxos-${selected.size}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus(`Exported ${selected.size} UTXO(s) with ${relatedArchives.length} BEEF archive(s).`);
      setSelectMode(false);
      setSelected(new Set());
    } catch (e) {
      setStatus(`Export error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  return (
    <div className="space-y-6">
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
            {loading ? "..." : `${dossiers.length} dossiers`}
          </Badge>
          <Badge variant="outline">
            {(dossiers.reduce((sum, d) => sum + d.value_satoshis, 0) / 1e8).toFixed(8)} BSV
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
            onClick={handleExportSelected}
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
            {filteredDossiers.map((dossier) => (
              <Card 
                key={dossier.outpoint} 
                className={`bg-card/60 ${selectMode ? "cursor-pointer" : ""} ${selected.has(dossier.outpoint) ? "ring-2 ring-primary" : ""}`}
                onClick={selectMode ? () => toggleSelect(dossier.outpoint) : undefined}
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
                      <code className="block truncate text-xs">{dossier.outpoint}</code>
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
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(dossier.outpoint)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
