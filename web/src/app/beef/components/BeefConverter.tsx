"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Offline BEEF format converter.
 * Converts between base64 and hex representations of raw BEEF.
 */
export function BeefConverter() {
  const [input, setInput] = React.useState("");
  const [output, setOutput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [lastConversion, setLastConversion] = React.useState<"toHex" | "toBase64" | null>(null);

  const handleToHex = () => {
    setError(null);
    setOutput("");

    if (!input.trim()) {
      setError("Please paste base64 BEEF data.");
      return;
    }

    try {
      // Decode base64 to bytes
      const bytes = Uint8Array.from(atob(input.trim()), (c) => c.charCodeAt(0));

      // Validate BEEF magic (first 4 bytes little-endian should be 0x0100BEEF or 0x0200BEEF)
      if (bytes.length < 4) {
        setError("Input too short to be valid BEEF.");
        return;
      }

      const magic =
        bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);

      if (magic !== 0xbeef0001 && magic !== 0xbeef0002) {
        setError(
          `Warning: BEEF magic mismatch. Expected 0x0100BEEF or 0x0200BEEF, got 0x${magic.toString(16).padStart(8, "0")}. Output may not be valid BEEF.`
        );
      }

      // Convert to hex
      const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      setOutput(hex);
      setLastConversion("toHex");
    } catch (e) {
      setError(`Conversion error: ${e instanceof Error ? e.message : "Invalid base64"}`);
    }
  };

  const handleToBase64 = () => {
    setError(null);
    setOutput("");

    if (!input.trim()) {
      setError("Please paste hex BEEF data.");
      return;
    }

    try {
      const hex = input.trim().toLowerCase().replace(/\s/g, "");

      if (!/^[0-9a-f]+$/.test(hex)) {
        setError("Invalid hex string. Only 0-9 and a-f characters allowed.");
        return;
      }

      if (hex.length % 2 !== 0) {
        setError("Hex string must have even length.");
        return;
      }

      // Convert hex to bytes
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
      }

      // Validate BEEF magic
      if (bytes.length < 4) {
        setError("Input too short to be valid BEEF.");
        return;
      }

      const magic =
        bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);

      if (magic !== 0xbeef0001 && magic !== 0xbeef0002) {
        setError(
          `Warning: BEEF magic mismatch. Expected 0x0100BEEF or 0x0200BEEF, got 0x${magic.toString(16).padStart(8, "0")}. Output may not be valid BEEF.`
        );
      }

      // Convert to base64
      const base64 = btoa(String.fromCharCode(...bytes));

      setOutput(base64);
      setLastConversion("toBase64");
    } catch (e) {
      setError(`Conversion error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = output;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  const handleClear = () => {
    setInput("");
    setOutput("");
    setError(null);
    setLastConversion(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>BEEF Format Converter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Convert raw BEEF between base64 and hex formats. This runs entirely offline in your browser.
        </p>

        <div className="space-y-2">
          <Label>Input (base64 or hex)</Label>
          <Textarea
            placeholder="Paste base64 or hex BEEF data here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleToHex} variant="outline" size="sm">
            Base64 → Hex
          </Button>
          <Button onClick={handleToBase64} variant="outline" size="sm">
            Hex → Base64
          </Button>
          <Button onClick={handleClear} variant="ghost" size="sm">
            Clear
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-2 text-xs text-yellow-700 dark:text-yellow-400">
            {error}
          </div>
        )}

        {output && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Output ({lastConversion === "toHex" ? "hex" : "base64"})
              </Label>
              <Button onClick={handleCopy} variant="ghost" size="sm">
                Copy
              </Button>
            </div>
            <Textarea
              value={output}
              readOnly
              rows={4}
              className="font-mono text-xs bg-muted"
            />
          </div>
        )}

        <div className="rounded-md border p-3 space-y-2 text-xs text-muted-foreground">
          <p className="font-medium">About BEEF formats:</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>
              <strong>Base64:</strong> Used in Chronicle exports and JSON APIs. Compact text representation.
            </li>
            <li>
              <strong>Hex:</strong> Used by some tools like{" "}
              <a
                href="https://beef.bsv.tools/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                beef.bsv.tools
              </a>
              . Raw bytes as hexadecimal.
            </li>
            <li>
              Valid BEEF starts with magic bytes <code>0100beef</code> (v1) or <code>0200beef</code> (v2).
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
