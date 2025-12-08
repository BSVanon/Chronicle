"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useNetworkMode } from "@/contexts/network-mode-context";
import { useDossiers } from "@/contexts/dossier-context";
import { resetDbCache } from "@/core/db";

export default function SettingsPage() {
  const { mode, setMode } = useNetworkMode();
  const { buckets, addBucket, updateBucket, deleteBucket } = useDossiers();

  const [status, setStatus] = React.useState<string | null>(null);
  const [newBucketId, setNewBucketId] = React.useState("");
  const [newBucketLabel, setNewBucketLabel] = React.useState("");

  const handleAddBucket = () => {
    if (!newBucketId.trim() || !newBucketLabel.trim()) {
      setStatus("Please enter both ID and label for the new bucket.");
      return;
    }

    if (buckets.some((b) => b.id === newBucketId.trim())) {
      setStatus("A bucket with this ID already exists.");
      return;
    }

    addBucket({
      id: newBucketId.trim(),
      label: newBucketLabel.trim(),
    });

    setNewBucketId("");
    setNewBucketLabel("");
    setStatus(`Bucket "${newBucketLabel.trim()}" added.`);
  };

  const handleClearData = async () => {
    if (!confirm("This will delete ALL local data (dossiers, BEEF, headers). Are you sure?")) {
      return;
    }

    try {
      // Delete the IndexedDB database
      const deleteRequest = indexedDB.deleteDatabase("chronicle-cold-vault");
      deleteRequest.onsuccess = () => {
        resetDbCache();
        setStatus("All data cleared. Refresh the page to start fresh.");
      };
      deleteRequest.onerror = () => {
        setStatus("Failed to clear data.");
      };
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your Cold Vault preferences.
        </p>
      </div>

      {status && (
        <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-600 dark:text-blue-400">
          {status}
        </div>
      )}

      {/* Network Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Network Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Control whether the app can make network requests.
          </p>
          
          {/* Current status */}
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">Current Mode:</p>
            <p className={`text-lg font-semibold ${mode === "offline" ? "text-orange-600 dark:text-orange-400" : "text-green-700 dark:text-green-400"}`}>
              {mode === "offline" ? "🔒 Offline" : "🌐 Online"}
            </p>
          </div>
          
          {/* Toggle buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant={mode === "offline" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("offline")}
              disabled={mode === "offline"}
            >
              Go Offline
            </Button>
            <Button
              variant={mode === "online_shielded" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("online_shielded")}
              disabled={mode === "online_shielded"}
            >
              Go Online
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            <strong>Offline:</strong> No network requests. All data stays local.<br />
            <strong>Online:</strong> Allows fetching headers, BEEF proofs, and transaction data from WhatsOnChain.
          </p>
          
          {/* Privacy Shield Info */}
          <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 space-y-2">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">🛡️ Privacy Shield Active</p>
            <p className="text-xs text-muted-foreground">
              When online, Chronicle protects your privacy with these techniques:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
              <li><strong>Batching:</strong> Requests grouped in batches of 3-7 items</li>
              <li><strong>Jitter:</strong> Random 0.5-3 second delays between requests</li>
              <li><strong>Decoys:</strong> 1-2 fake txids added per batch and discarded locally</li>
              <li><strong>Batch delays:</strong> 3-8 seconds between batches</li>
              <li><strong>Rate limiting:</strong> Max 100 requests/hour with backoff</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              This makes it much harder for observers to correlate which UTXOs belong to you.
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Buckets */}
      <Card>
        <CardHeader>
          <CardTitle>Buckets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Manage your UTXO buckets for organizing holdings.
          </p>

          {/* Existing buckets */}
          <div className="space-y-2">
            {buckets.map((bucket) => (
              <div
                key={bucket.id}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <div>
                  <p className="text-sm font-medium">{bucket.label}</p>
                  <p className="text-xs text-muted-foreground">ID: {bucket.id}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Delete bucket "${bucket.label}"?`)) {
                      deleteBucket(bucket.id);
                      setStatus(`Bucket "${bucket.label}" deleted.`);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>

          {/* Add new bucket */}
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Add New Bucket</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">ID (lowercase, no spaces)</Label>
                <Input
                  placeholder="e.g., cold-c"
                  value={newBucketId}
                  onChange={(e) => setNewBucketId(e.target.value.toLowerCase().replace(/\s/g, "-"))}
                />
              </div>
              <div>
                <Label className="text-xs">Label</Label>
                <Input
                  placeholder="e.g., Cold-C"
                  value={newBucketLabel}
                  onChange={(e) => setNewBucketLabel(e.target.value)}
                />
              </div>
            </div>
            <Button size="sm" onClick={handleAddBucket}>
              Add Bucket
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Danger Zone */}
      <Card className="border-red-500/30">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            These actions are destructive and cannot be undone.
          </p>
          <Button variant="destructive" onClick={handleClearData}>
            Clear All Data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
