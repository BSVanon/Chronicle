"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ParsedOutput = {
  vout: number;
  satoshis: number;
  script_hex: string;
};

type WizardStepSelectProps = {
  txid: string;
  outputs: ParsedOutput[];
  selectedVout: number | null;
  setSelectedVout: (vout: number | null) => void;
  onContinue: () => void;
  onBack: () => void;
};

export function WizardStepSelect({
  txid,
  outputs,
  selectedVout,
  setSelectedVout,
  onContinue,
  onBack,
}: WizardStepSelectProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Output</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Transaction: <code className="text-xs">{txid}</code>
        </p>

        {outputs.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Click on the output you want to add:
            </p>
            <div className="space-y-2">
              {outputs.map((output) => (
                <div
                  key={output.vout}
                  className={`cursor-pointer rounded-md border p-3 transition-colors ${
                    selectedVout === output.vout
                      ? "border-primary bg-primary/5 ring-2 ring-primary/50"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedVout(output.vout)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2">
                      {selectedVout === output.vout && <span className="text-primary">✓</span>}
                      Output #{output.vout}
                    </span>
                    <span>{(output.satoshis / 1e8).toFixed(8)} BSV</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {output.script_hex}
                  </p>
                </div>
              ))}
            </div>
            {selectedVout !== null && (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✓ Output #{selectedVout} selected — click Continue to proceed
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                Offline Mode — Manual Entry Required
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Transaction outputs couldn&apos;t be fetched. Enter the output index (vout) manually.
                You can find this in your wallet or a block explorer.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Output Index (vout)</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={selectedVout ?? ""}
                onChange={(e) => setSelectedVout(parseInt(e.target.value, 10) || 0)}
                className="max-w-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                Most UTXOs use vout 0. Check your wallet if unsure.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={onContinue}>Continue</Button>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
