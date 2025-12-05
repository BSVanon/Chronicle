"use client";

import * as React from "react";

import { normalizeHeaderStore } from "@/core/headers/store";
import { useHeaderStore } from "@/contexts/header-store-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SAMPLE_HEADERS_PAYLOAD = {
  version: 1,
  bestHeight: 1,
  headers: [
    { height: 0, headerHex: "00".repeat(80) },
    { height: 1, headerHex: "11".repeat(80) },
  ],
};

export function HeadersDevCard() {
  const { snapshot, setSnapshot, clear } = useHeaderStore();

  const [raw, setRaw] = React.useState(() =>
    JSON.stringify(SAMPLE_HEADERS_PAYLOAD, null, 2),
  );
  const [error, setError] = React.useState<string | null>(null);

  const handleLoadSample = React.useCallback(() => {
    setRaw(JSON.stringify(SAMPLE_HEADERS_PAYLOAD, null, 2));
    setError(null);
  }, []);

  const handleApply = React.useCallback(() => {
    setError(null);
    try {
      const parsed = JSON.parse(raw);
      const normalized = normalizeHeaderStore(parsed);
      setSnapshot(normalized);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to parse headers JSON.");
      }
    }
  }, [raw, setSnapshot]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Headers (dev import)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Paste a minimal header snapshot (height + headerHex) to seed Chronicle&apos;s
            local header store. This is local-only and intended for early
            verification experiments.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Headers
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
            onClick={handleApply}
          >
            Apply headers JSON
          </Button>
          {snapshot.headers.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-3 text-[0.75rem]"
              onClick={clear}
            >
              Clear headers
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
        <div className="space-y-1 text-[0.7rem]">
          <p>
            Stored headers: <strong>{snapshot.headers.length}</strong>
          </p>
          <p>
            Best height: <strong>{snapshot.bestHeight ?? "n/a"}</strong>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
