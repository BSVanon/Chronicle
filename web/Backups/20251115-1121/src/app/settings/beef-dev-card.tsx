"use client";

import * as React from "react";

import { parseBeefBundle, scripthashesFromBeefResult } from "@/core/beef";
import { entryFromBeefResult } from "@/core/beef/archive";
import { useBeefArchive } from "@/contexts/beef-archive-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SAMPLE_BEEF_PAYLOAD = {
  meta: {
    id: "sample-bundle",
    importedAt: 123,
    utxoCount: 1,
    scripthashCount: 0,
  },
  utxos: [
    {
      txid: "00".repeat(32),
      vout: 0,
      scriptPubKey: "76a914" + "00".repeat(20) + "88ac",
      satoshis: 1000,
    },
  ],
};

export function BeefDevCard() {
  const [raw, setRaw] = React.useState(() =>
    JSON.stringify(SAMPLE_BEEF_PAYLOAD, null, 2),
  );
  const [result, setResult] = React.useState<
    ReturnType<typeof parseBeefBundle> | null
  >(null);
  const [hashes, setHashes] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const { entries, addEntry, clear } = useBeefArchive();

  const handleLoadSample = React.useCallback(() => {
    setRaw(JSON.stringify(SAMPLE_BEEF_PAYLOAD, null, 2));
    setError(null);
    setResult(null);
    setHashes([]);
  }, []);

  const handleParse = React.useCallback(() => {
    setError(null);
    try {
      const parsedJson = JSON.parse(raw);
      const parsed = parseBeefBundle(parsedJson);
      setResult(parsed);
      const derived = scripthashesFromBeefResult(parsed);
      setHashes(derived);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to parse BEEF JSON.");
      }
      setResult(null);
      setHashes([]);
    }
  }, [raw]);

  const handleAddToArchive = React.useCallback(() => {
    if (!result) return;
    const entry = entryFromBeefResult(result, hashes.length);
    addEntry(entry);
  }, [result, hashes.length, addEntry]);

  const totalArchivedScripthashes = React.useMemo(
    () => entries.reduce((acc, e) => acc + e.scripthashCount, 0),
    [entries],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>BEEF dev-only import</CardTitle>
          <p className="text-xs text-muted-foreground">
            Paste a BEEF-like JSON payload or use the sample to exercise
            Chronicle&apos;s BEEF types and helpers. Everything stays local.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Dev stub
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-3 text-[0.75rem]"
            onClick={handleLoadSample}
          >
            Load sample
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-3 text-[0.75rem]"
            onClick={handleParse}
          >
            Parse BEEF JSON
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-3 text-[0.75rem]"
            disabled={!result}
            onClick={handleAddToArchive}
          >
            Add to archive
          </Button>
          {entries.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-3 text-[0.75rem]"
              onClick={clear}
            >
              Clear archive
            </Button>
          )}
        </div>
        <textarea
          className="mt-2 h-40 w-full rounded-md border bg-background p-2 font-mono text-[0.7rem]"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        {error && (
          <p className="text-[0.7rem] text-destructive">Error: {error}</p>
        )}
        {result && (
          <div className="space-y-1 text-[0.7rem]">
            <p>
              Bundle id: <strong>{result.meta.id}</strong>
            </p>
            <p>
              UTXOs: <strong>{result.utxos.length}</strong> • Derived
              scripthashes: <strong>{hashes.length}</strong>
            </p>
            {hashes.length > 0 && (
              <p className="font-mono">
                {hashes
                  .slice(0, 3)
                  .map((h) => `${h.slice(0, 10)}...${h.slice(-6)}`)
                  .join(" ")}
                {hashes.length > 3 ? " …" : ""}
              </p>
            )}
          </div>
        )}
        {entries.length > 0 && (
          <div className="space-y-1 text-[0.7rem]">
            <p>
              Archive bundles: <strong>{entries.length}</strong> • Archived
              scripthashes: <strong>{totalArchivedScripthashes}</strong>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
