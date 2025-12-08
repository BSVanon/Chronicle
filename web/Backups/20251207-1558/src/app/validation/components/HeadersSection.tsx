"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useNetworkMode } from "@/contexts/network-mode-context";
import { useHeaderStore } from "@/contexts/header-store-context";
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
  fetchChainTipMultiSource,
  fetchHeaderByHeight,
  constructHeaderHex,
} from "@/core/net/providers";
import { applyRequestJitter } from "@/core/net/privacy-shield";

type HeadersSectionProps = {
  onStatusChange: (status: string | null) => void;
  compact?: boolean;
};

export function HeadersSection({ onStatusChange, compact = false }: HeadersSectionProps) {
  const { mode, requestOnline } = useNetworkMode();
  const { tipHeight, headerCount, refresh } = useHeaderStore();

  const [fetching, setFetching] = React.useState(false);
  const [fetchProgress, setFetchProgress] = React.useState<string | null>(null);
  const [importData, setImportData] = React.useState("");
  const [showImport, setShowImport] = React.useState(false);

  const handleUpdateOnline = async () => {
    if (mode !== "online_shielded") {
      const confirmed = await requestOnline();
      if (!confirmed) {
        onStatusChange("Cancelled. Stay in Offline mode.");
        return;
      }
    }

    setFetching(true);
    setFetchProgress("Fetching chain tip from sources...");

    try {
      // Use multi-source fetch with consensus
      const tipResult = await fetchChainTipMultiSource();
      
      if (!tipResult.height) {
        onStatusChange("Could not fetch chain tip from any source.");
        return;
      }
      
      const chainTipHeight = tipResult.height;
      const consensusMsg = tipResult.consensus 
        ? `✓ Consensus from ${tipResult.sources.join(", ")}`
        : `⚠ Single source: ${tipResult.sources.join(", ")}`;
      
      setFetchProgress(`Chain tip: ${chainTipHeight} (${consensusMsg})`);
      await new Promise(r => setTimeout(r, 1000)); // Show consensus status briefly

      const localTip = await getTipHeight();
      const startHeight = localTip ? localTip + 1 : chainTipHeight - 100;
      const endHeight = chainTipHeight;

      if (startHeight > endHeight) {
        onStatusChange(`Headers are up to date. ${consensusMsg}`);
        return;
      }

      const toFetch = Math.min(endHeight - startHeight + 1, 200);
      setFetchProgress(`Fetching ${toFetch} headers from ${startHeight}...`);

      let fetched = 0;
      for (let h = startHeight; h <= Math.min(startHeight + toFetch - 1, endHeight); h++) {
        const headerData = await fetchHeaderByHeight(h);
        if (headerData) {
          await saveHeader({
            height: headerData.height,
            hash: headerData.hash,
            prev_hash: headerData.prevBlockHash,
            merkle_root: headerData.merkleRoot,
            timestamp: headerData.time,
            header_hex: constructHeaderHex(headerData),
          });
          fetched++;
        }

        if (fetched % 10 === 0) {
          setFetchProgress(`Fetched ${fetched} of ${toFetch} headers...`);
        }

        // Privacy Shield: Apply jitter between requests
        await applyRequestJitter();
      }

      await refresh();
      onStatusChange(`Fetched ${fetched} headers. Tip: ${endHeight}. ${consensusMsg}`);
    } catch (e) {
      onStatusChange(`Fetch error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setFetching(false);
      setFetchProgress(null);
    }
  };

  const handleExport = async () => {
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
      onStatusChange("Headers exported successfully.");
    } catch (e) {
      onStatusChange(`Export error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      onStatusChange("Please paste header data to import.");
      return;
    }

    try {
      const snapshot: HeaderStoreSnapshot = JSON.parse(importData);
      if (!snapshot.version || !Array.isArray(snapshot.headers)) {
        onStatusChange("Invalid header snapshot format.");
        return;
      }

      await importHeaderStore(snapshot);
      await refresh();
      setImportData("");
      setShowImport(false);
      onStatusChange(`Imported ${snapshot.headers.length} headers. Tip: ${snapshot.tipHeight}`);
    } catch (e) {
      onStatusChange(`Import error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Block Headers</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {headerCount} stored
            </Badge>
            <Badge variant="outline" className="text-xs">
              Tip: {tipHeight ?? "none"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {fetchProgress && (
          <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 p-2 text-xs text-yellow-600 dark:text-yellow-400">
            {fetchProgress}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={handleUpdateOnline}
            disabled={fetching}
          >
            {fetching ? "Syncing..." : "Sync Headers"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            Export
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowImport(!showImport)}>
            {showImport ? "Cancel" : "Import"}
          </Button>
        </div>

        {showImport && (
          <div className="space-y-2 border-t pt-3">
            <Textarea
              placeholder='{"version": 1, "tipHeight": 123456, "headers": [...]}'
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              rows={4}
              className="text-xs"
            />
            <Button size="sm" onClick={handleImport}>
              Import Headers
            </Button>
          </div>
        )}

        {mode !== "online_shielded" && (
          <p className="text-xs text-muted-foreground">
            Currently offline. Click "Sync Headers" to go online and fetch.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
