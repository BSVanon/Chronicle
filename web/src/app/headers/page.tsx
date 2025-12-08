"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useNetworkMode } from "@/contexts/network-mode-context";
import {
  getTipHeight,
  getHeaderCount,
  importHeaderStore,
  exportHeaderStore,
  saveHeader,
  type HeaderStoreSnapshot,
} from "@/core/headers/store";
import {
  fetchChainTip,
  fetchHeaderByHeight,
  constructHeaderHex,
} from "@/core/net/providers";

export default function HeadersPage() {
  const { mode } = useNetworkMode();

  const [tipHeight, setTipHeight] = React.useState<number | null>(null);
  const [headerCount, setHeaderCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<string | null>(null);

  // Import state
  const [importData, setImportData] = React.useState("");

  // Online fetch state
  const [fetching, setFetching] = React.useState(false);
  const [fetchProgress, setFetchProgress] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const tip = await getTipHeight();
      const count = await getHeaderCount();
      setTipHeight(tip);
      setHeaderCount(count);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleExport = async () => {
    setStatus(null);
    try {
      const snapshot = await exportHeaderStore();
      const json = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chronicle-headers-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Headers exported successfully.");
    } catch (e) {
      setStatus(`Export error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  const handleImport = async () => {
    setStatus(null);
    if (!importData.trim()) {
      setStatus("Please paste header data to import.");
      return;
    }

    try {
      const snapshot = JSON.parse(importData) as HeaderStoreSnapshot;
      const result = await importHeaderStore(snapshot);
      if (result.ok) {
        setStatus(`Imported ${result.imported} headers.`);
        setImportData("");
        await refresh();
      } else {
        setStatus(`Import failed: ${result.message}`);
      }
    } catch (e) {
      setStatus(`Import error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  const handleUpdateOnline = async () => {
    if (mode === "offline") {
      setStatus("Switch to Online mode to fetch headers.");
      return;
    }

    setFetching(true);
    setStatus(null);
    setFetchProgress("Checking chain tip...");

    try {
      // Get current chain tip from WoC
      const remoteTip = await fetchChainTip();
      if (remoteTip === null) {
        setStatus("Failed to fetch chain tip. Check your connection.");
        return;
      }

      // Determine what we need to fetch
      const localTip = tipHeight ?? 0;
      const startHeight = localTip > 0 ? localTip + 1 : remoteTip - 100; // Start 100 blocks back if empty
      const endHeight = remoteTip;
      const toFetch = endHeight - startHeight + 1;

      if (toFetch <= 0) {
        setStatus("Headers are up to date.");
        return;
      }

      if (toFetch > 1000) {
        setStatus(`Need to fetch ${toFetch} headers. This may take a while. Consider importing a header file instead.`);
        // Still proceed but warn
      }

      setFetchProgress(`Fetching ${toFetch} headers (${startHeight} to ${endHeight})...`);

      let fetched = 0;
      let saved = 0;

      for (let height = startHeight; height <= endHeight; height++) {
        const headerData = await fetchHeaderByHeight(height);
        if (headerData) {
          // Convert to our format and save
          await saveHeader({
            height: headerData.height,
            hash: headerData.hash,
            prev_hash: headerData.prevBlockHash,
            merkle_root: headerData.merkleRoot,
            timestamp: headerData.time,
            header_hex: constructHeaderHex(headerData),
          });
          saved++;
        }
        fetched++;

        if (fetched % 10 === 0 || fetched === toFetch) {
          setFetchProgress(`Fetched ${fetched} of ${toFetch} headers...`);
        }

        // Rate limit: 100ms between requests
        if (fetched < toFetch) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      await refresh();
      setStatus(`Fetched and saved ${saved} headers. Tip is now ${endHeight}.`);
    } catch (e) {
      setStatus(`Fetch error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setFetching(false);
      setFetchProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Headers</h1>
        <p className="text-sm text-muted-foreground">
          Manage your local block header store for BEEF verification.
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-4">
        <Badge variant={mode === "offline" ? "secondary" : "default"}>
          {mode === "offline" ? "Offline" : "Online"}
        </Badge>
        {loading ? (
          <span className="text-sm text-muted-foreground">Loading...</span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {headerCount} headers stored • Tip: {tipHeight ?? "none"}
          </span>
        )}
      </div>

      {status && (
        <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-600 dark:text-blue-400">
          {status}
        </div>
      )}

      {fetchProgress && (
        <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-600 dark:text-yellow-400">
          {fetchProgress}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleUpdateOnline} disabled={mode === "offline" || fetching}>
          {fetching ? "Fetching..." : "Update Headers (Online)"}
        </Button>
        <Button variant="outline" onClick={handleExport} disabled={fetching}>
          Export Headers
        </Button>
      </div>

      <Separator />

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle>Import Headers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste a Chronicle headers JSON file to import headers offline.
          </p>
          <Textarea
            placeholder='{"version": 1, "tipHeight": 123456, "headers": [...]}'
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            rows={6}
          />
          <Button onClick={handleImport}>Import</Button>
        </CardContent>
      </Card>
    </div>
  );
}
