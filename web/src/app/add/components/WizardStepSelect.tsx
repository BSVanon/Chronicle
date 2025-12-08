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
          <div className="space-y-2">
            {outputs.map((output) => (
              <div
                key={output.vout}
                className={`cursor-pointer rounded-md border p-3 transition-colors ${
                  selectedVout === output.vout
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setSelectedVout(output.vout)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Output #{output.vout}</span>
                  <span>{(output.satoshis / 1e8).toFixed(8)} BSV</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {output.script_hex}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Output Index (vout)</Label>
            <Input
              type="number"
              min={0}
              value={selectedVout ?? ""}
              onChange={(e) => setSelectedVout(parseInt(e.target.value, 10) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              No outputs detected. Enter the output index manually.
            </p>
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
