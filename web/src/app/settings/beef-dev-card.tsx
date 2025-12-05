"use client";

import * as React from "react";

import { parseBeefBundle, scripthashesFromBeefResult } from "@/core/beef";
import { entryFromBeefResult, reverifyBeefArchiveEntry } from "@/core/beef/archive";
import type { BeefVerifyResult } from "@/core/beef/verify";
import { verifyBeefSubjectAgainstHeaders } from "@/core/beef/verify";
import { useBeefArchive } from "@/contexts/beef-archive-context";
import { useHeaderStore } from "@/contexts/header-store-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SAMPLE_BEEF_PAYLOAD = {
  version: "BEEF-1.0",
  subject: {
    txid: "11".repeat(32),
    rawTxHex: "aa".repeat(20),
    height: 100,
  },
  ancestors: [
    {
      txid: "22".repeat(32),
      rawTxHex: "bb".repeat(20),
      height: 99,
    },
  ],
  metadata: {
    id: "sample-bundle",
    label: "Sample BEEF bundle",
  },
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

  const [verifyResult, setVerifyResult] = React.useState<BeefVerifyResult | null>(
    null,
  );
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const [archiveVerifying, setArchiveVerifying] = React.useState(false);

  const { entries, addEntry, clear } = useBeefArchive();
  const { snapshot: headerSnapshot } = useHeaderStore();

  const handleLoadSample = React.useCallback(() => {
    setRaw(JSON.stringify(SAMPLE_BEEF_PAYLOAD, null, 2));
    setError(null);
    setResult(null);
    setHashes([]);
    setVerifyResult(null);
    setVerifyError(null);
  }, []);

  const handleParse = React.useCallback(() => {
    setError(null);
    setVerifyResult(null);
    setVerifyError(null);
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
    let subjectTxid: string | undefined;
    try {
      const parsedJson = JSON.parse(raw) as {
        subject?: { txid?: string };
      };
      if (parsedJson.subject && typeof parsedJson.subject.txid === "string") {
        subjectTxid = parsedJson.subject.txid.trim().toLowerCase();
      }
    } catch {
      subjectTxid = undefined;
    }

    let entry = entryFromBeefResult(result, hashes.length, {
      subjectTxid,
      rawBeefJson: raw,
    });

    if (verifyResult && verifyResult.outcome !== "unknown") {
      entry = {
        ...entry,
        verifyOutcome: verifyResult.outcome,
        verifyHeaderHeight: verifyResult.headerHeight,
        verifyUpdatedAt: Date.now(),
      };
    }

    addEntry(entry);
  }, [result, hashes.length, addEntry, verifyResult, raw]);

  const totalArchivedScripthashes = React.useMemo(
    () => entries.reduce((acc, e) => acc + e.scripthashCount, 0),
    [entries],
  );

  const handleVerify = React.useCallback(async () => {
    setVerifyError(null);
    setVerifyResult(null);
    try {
      const parsedJson = JSON.parse(raw);
      setVerifying(true);
      const outcome = await verifyBeefSubjectAgainstHeaders(
        parsedJson,
        headerSnapshot,
      );
      setVerifyResult(outcome);
    } catch (err) {
      if (err instanceof Error) {
        setVerifyError(err.message);
      } else {
        setVerifyError("Failed to verify bundle against headers.");
      }
    } finally {
      setVerifying(false);
    }
  }, [raw, headerSnapshot]);

  const handleVerifyArchive = React.useCallback(async () => {
    if (!entries.length) return;
    setArchiveVerifying(true);
    try {
      for (const existing of entries) {
        const updated = await reverifyBeefArchiveEntry(existing, headerSnapshot);
        addEntry(updated);
      }
    } finally {
      setArchiveVerifying(false);
    }
  }, [entries, headerSnapshot, addEntry]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>BEEF archive import</CardTitle>
          <p className="text-xs text-muted-foreground">
            Paste a BEEF-like JSON payload or use the sample to build a local
            BEEF archive. Imported bundles stay on this device and feed the
            BEEF coverage panel on the Monitor page.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Archive
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
            disabled={verifying}
            onClick={handleVerify}
          >
            {verifying ? "Verifying…" : "Verify vs headers"}
          </Button>
          {entries.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-3 text-[0.75rem]"
              onClick={handleVerifyArchive}
              disabled={archiveVerifying}
            >
              {archiveVerifying ? "Re-verifying archive…" : "Re-verify archive"}
            </Button>
          )}
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
        {verifyError && (
          <p className="text-[0.7rem] text-destructive">Verify error: {verifyError}</p>
        )}
        {result && (
          <div className="space-y-1 text-[0.7rem]">
            <p>
              Bundle id: <strong>{result.meta.id}</strong>
            </p>
            <p>
              Records: <strong>{result.meta.utxoCount}</strong> • Derived
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
        {verifyResult && (
          <div className="space-y-1 text-[0.7rem]">
            <p>
              Verify vs headers: <strong>{verifyResult.outcome}</strong>
              {typeof verifyResult.headerHeight === "number" && (
                <>
                  {" "}@ height <strong>{verifyResult.headerHeight}</strong>
                </>
              )}
            </p>
            {verifyResult.reason && (
              <p>Reason: {verifyResult.reason}</p>
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
