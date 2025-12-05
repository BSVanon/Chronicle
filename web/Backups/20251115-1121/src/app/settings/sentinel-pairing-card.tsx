"use client";

import * as React from "react";

import { useNetworkMode } from "@/contexts/network-mode-context";
import { useSentinelConfig } from "@/contexts/sentinel-config-context";
import { useGuardedFetch } from "@/hooks/use-guarded-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SentinelPairingCard() {
  const { mode } = useNetworkMode();
  const { config, setConfig } = useSentinelConfig();
  const guardedFetch = useGuardedFetch();

  const [baseUrlInput, setBaseUrlInput] = React.useState(config?.baseUrl ?? "");
  const [testing, setTesting] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  const handleSaveAndTest = React.useCallback(async () => {
    const rawBase = baseUrlInput.trim();
    if (!rawBase) {
      setStatus("Enter a Sentinel base URL to test and pair.");
      return;
    }

    let healthUrl: string;
    try {
      const url = new URL(rawBase);
      url.pathname = "/v1/health";
      url.search = "";
      url.hash = "";
      healthUrl = url.toString();
    } catch {
      setStatus("Base URL must be an absolute URL, e.g. https://example.workers.dev.");
      return;
    }

    setTesting(true);
    setStatus(null);
    try {
      const response = await guardedFetch(healthUrl, { method: "GET" });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus(`Health check HTTP ${response.status}.`);
      } else if (data && typeof data.ok === "boolean") {
        if (data.ok) {
          setStatus("Health check succeeded. Sentinel is paired.");
        } else {
          setStatus(data.message ? `Sentinel reported unhealthy: ${data.message}` : "Sentinel reported unhealthy.");
        }
      } else {
        setStatus("Health endpoint responded with an unexpected shape.");
      }

      setConfig({ baseUrl: rawBase });
    } catch (error) {
      if (error instanceof Error) {
        setStatus(`Health check error: ${error.message}`);
      } else {
        setStatus("Unknown error during health check.");
      }
    } finally {
      setTesting(false);
    }
  }, [baseUrlInput, guardedFetch, setConfig]);

  const paired = !!config?.baseUrl;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Sentinel pairing (self-deployed)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Paste the base URL of your self-deployed Worker-Sentinel and run a
            health check. Chronicle will only talk to it when you enable
            shielded mode.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          {paired ? "Paired" : "Not paired"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <p>
          Current network mode: <strong>{mode}</strong>
        </p>
        <div className="space-y-1">
          <label className="text-[0.75rem] font-medium">Sentinel base URL</label>
          <Input
            className="h-7 text-[0.8rem]"
            placeholder="https://your-sentinel.workers.dev"
            value={baseUrlInput}
            onChange={(e) => setBaseUrlInput(e.target.value)}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-3 text-[0.75rem]"
          onClick={handleSaveAndTest}
          disabled={testing || baseUrlInput.trim().length === 0}
        >
          {testing ? "Testing..." : "Test & pair"}
        </Button>
        {status && <p className="text-[0.7rem] text-muted-foreground">{status}</p>}
      </CardContent>
    </Card>
  );
}
