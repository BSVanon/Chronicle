"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type InputType = "utxo" | "beef" | "rawtx";

type WizardStepInputProps = {
  inputType: InputType;
  setInputType: (type: InputType) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  fetchStatus: string | null;
  fetching: boolean;
  isOnline: boolean;
  onContinue: () => void;
};

export function WizardStepInput({
  inputType,
  setInputType,
  inputValue,
  setInputValue,
  fetchStatus,
  fetching,
  isOnline,
  onContinue,
}: WizardStepInputProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Identify Funding Transaction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={inputType === "utxo" ? "default" : "outline"}
            size="sm"
            onClick={() => setInputType("utxo")}
          >
            UTXO / Txid
          </Button>
          <Button
            variant={inputType === "beef" ? "default" : "outline"}
            size="sm"
            onClick={() => setInputType("beef")}
          >
            BEEF JSON
          </Button>
          <Button
            variant={inputType === "rawtx" ? "default" : "outline"}
            size="sm"
            onClick={() => setInputType("rawtx")}
          >
            Raw Tx Hex
          </Button>
        </div>

        {inputType === "utxo" && (
          <div className="space-y-2">
            <Label>Transaction ID (or txid:vout)</Label>
            <Input
              placeholder="abc123...def or abc123...def:0"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {isOnline
                ? "Will fetch transaction data and BEEF proof from WhatsOnChain."
                : "Switch to Online mode to auto-fetch transaction data."}
            </p>
          </div>
        )}

        {inputType === "beef" && (
          <div className="space-y-2">
            <Label>BEEF JSON</Label>
            <Textarea
              placeholder='{"txid": "...", "beef": "base64...", "height": 123456, "utxos": [...]}'
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
          </div>
        )}

        {inputType === "rawtx" && (
          <div className="space-y-2">
            <Label>Raw Transaction Hex</Label>
            <Textarea
              placeholder="0100000001..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
          </div>
        )}

        {fetchStatus && (
          <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-600 dark:text-blue-400">
            {fetchStatus}
          </div>
        )}

        <Button onClick={onContinue} disabled={fetching}>
          {fetching ? "Fetching..." : "Continue"}
        </Button>
      </CardContent>
    </Card>
  );
}
