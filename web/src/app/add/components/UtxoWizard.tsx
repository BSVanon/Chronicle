"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { useDossiers } from "@/contexts/dossier-context";
import { useBeefStore } from "@/contexts/beef-store-context";
import { useNetworkMode } from "@/contexts/network-mode-context";
import type { UtxoDossier, ProofArchive, Bucket } from "@/core/dossier/types";
import { computeBeefHash } from "@/core/dossier/beef-store";
import { fetchRawTx, assembleBeefFromTxid } from "@/core/net/providers";

import { WizardStepInput } from "./WizardStepInput";
import { WizardStepSelect } from "./WizardStepSelect";
import { WizardStepStore } from "./WizardStepStore";
import { WizardStepDone } from "./WizardStepDone";

type WizardStep = "input" | "select-output" | "store" | "done";
type InputType = "utxo" | "beef" | "rawtx";

type ParsedOutput = {
  vout: number;
  satoshis: number;
  script_hex: string;
};

type UtxoWizardProps = {
  buckets: Bucket[];
};

export function UtxoWizard({ buckets }: UtxoWizardProps) {
  const { save: saveDossier } = useDossiers();
  const { save: saveBeef } = useBeefStore();
  const { mode, requestOnline } = useNetworkMode();

  const [step, setStep] = React.useState<WizardStep>("input");
  const [inputType, setInputType] = React.useState<InputType>("utxo");
  const [inputValue, setInputValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [fetching, setFetching] = React.useState(false);
  const [fetchStatus, setFetchStatus] = React.useState<string | null>(null);

  // Parsed data
  const [txid, setTxid] = React.useState<string | null>(null);
  const [outputs, setOutputs] = React.useState<ParsedOutput[]>([]);
  const [beefBase64, setBeefBase64] = React.useState<string | null>(null);
  const [height, setHeight] = React.useState<number | null>(null);
  const [headerHash, setHeaderHash] = React.useState<string | null>(null);

  // Selection
  const [selectedVout, setSelectedVout] = React.useState<number | null>(null);
  const [selectedBucket, setSelectedBucket] = React.useState<string>(buckets[0]?.id ?? "");
  const [labels, setLabels] = React.useState("");

  // Result
  const [resultOutpoint, setResultOutpoint] = React.useState<string | null>(null);

  const handleParseInput = async () => {
    setError(null);

    if (!inputValue.trim()) {
      setError("Please enter a value.");
      return;
    }

    const value = inputValue.trim();

    if (inputType === "utxo") {
      const parts = value.split(":");
      const possibleTxid = parts[0].toLowerCase();

      if (possibleTxid.length !== 64 || !/^[a-f0-9]+$/.test(possibleTxid)) {
        setError("Invalid txid format. Expected 64 hex characters.");
        return;
      }

      setTxid(possibleTxid);

      if (parts.length > 1) {
        const vout = parseInt(parts[1], 10);
        if (!isNaN(vout)) {
          setSelectedVout(vout);
        }
      }

      // Prompt to go online if offline
      let shouldFetch = mode === "online_shielded";
      if (!shouldFetch) {
        shouldFetch = await requestOnline();
      }

      if (shouldFetch) {
        setFetching(true);
        setFetchStatus("Fetching transaction data...");

        try {
          const rawTx = await fetchRawTx(possibleTxid);
          if (rawTx) {
            const parsedOutputs = parseRawTxOutputs(rawTx);
            setOutputs(parsedOutputs);
          }

          const result = await assembleBeefFromTxid(possibleTxid);
          if (result) {
            setBeefBase64(btoa(String.fromCharCode(...hexToBytes(result.beefHex))));
            setHeight(result.height);
            setFetchStatus(`Fetched BEEF proof (block ${result.height})`);
          } else if (rawTx) {
            setFetchStatus("Fetched raw tx (no BEEF proof available)");
          } else {
            setFetchStatus("Could not fetch transaction. Enter outputs manually.");
          }
        } catch (e) {
          setFetchStatus(`Fetch error: ${e instanceof Error ? e.message : "Unknown"}`);
        } finally {
          setFetching(false);
        }
      } else {
        setFetchStatus("Offline mode - enter outputs manually or go online to fetch.");
      }

      setStep("select-output");
    } else if (inputType === "beef") {
      try {
        const parsed = JSON.parse(value);
        if (!parsed.txid || !parsed.beef) {
          setError("Invalid BEEF format. Expected {txid, beef, ...}");
          return;
        }

        setTxid(parsed.txid);
        setBeefBase64(parsed.beef);
        setHeight(parsed.height ?? null);
        setHeaderHash(parsed.header_hash ?? null);
        setOutputs(parsed.utxos ?? []);
        setStep("select-output");
      } catch {
        setError("Invalid JSON format.");
      }
    } else if (inputType === "rawtx") {
      try {
        const parsedOutputs = parseRawTxOutputs(value);
        const computedTxid = computeTxidFromHex(value);
        setTxid(computedTxid);
        setOutputs(parsedOutputs);
        setStep("select-output");
      } catch (e) {
        setError(`Failed to parse raw tx: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    }
  };

  const handleSelectOutput = () => {
    if (selectedVout === null && outputs.length > 0) {
      setError("Please select an output.");
      return;
    }
    setError(null);
    setStep("store");
  };

  const handleStore = async () => {
    if (!txid) {
      setError("No transaction ID.");
      return;
    }

    setError(null);

    try {
      const vout = selectedVout ?? 0;
      const output = outputs.find((o) => o.vout === vout);
      const outpoint = `${txid}:${vout}`;

      const dossier: UtxoDossier = {
        outpoint,
        value_satoshis: output?.satoshis ?? 0,
        locking_script_hex: output?.script_hex ?? null,
        funding_txid: txid,
        funding_tx_raw: null,
        bucket: selectedBucket || buckets[0]?.id || "default",
        labels: labels.split(",").map((l) => l.trim()).filter(Boolean),
        derivation_hint: null,
        beef_hash: null,
        verified: null,
        created_at: new Date().toISOString(),
      };

      if (beefBase64) {
        const beefHash = await computeBeefHash(beefBase64);

        const archive: ProofArchive = {
          txid,
          beef: beefBase64,
          beef_hash: beefHash,
          height: height ?? 0,
          header_hash: headerHash ?? "",
          utxos: outputs,
          labels: dossier.labels,
          bucket: dossier.bucket,
          created_at: new Date().toISOString(),
          integrity: {
            archive_hash: beefHash,
            algo: "sha256",
          },
        };

        await saveBeef(archive);
        dossier.beef_hash = beefHash;
      }

      await saveDossier(dossier);
      setResultOutpoint(outpoint);
      setStep("done");
    } catch (e) {
      setError(`Store error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  const handleReset = () => {
    setStep("input");
    setInputType("utxo");
    setInputValue("");
    setError(null);
    setFetchStatus(null);
    setTxid(null);
    setOutputs([]);
    setBeefBase64(null);
    setHeight(null);
    setHeaderHash(null);
    setSelectedVout(null);
    setSelectedBucket(buckets[0]?.id ?? "");
    setLabels("");
    setResultOutpoint(null);
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={step === "input" ? "default" : "outline"}>1. Input</Badge>
        <span className="text-muted-foreground">→</span>
        <Badge variant={step === "select-output" ? "default" : "outline"}>2. Select Output</Badge>
        <span className="text-muted-foreground">→</span>
        <Badge variant={step === "store" ? "default" : "outline"}>3. Store</Badge>
        <span className="text-muted-foreground">→</span>
        <Badge variant={step === "done" ? "default" : "outline"}>4. Done</Badge>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {step === "input" && (
        <WizardStepInput
          inputType={inputType}
          setInputType={setInputType}
          inputValue={inputValue}
          setInputValue={setInputValue}
          fetchStatus={fetchStatus}
          fetching={fetching}
          isOnline={mode === "online_shielded"}
          onContinue={handleParseInput}
        />
      )}

      {step === "select-output" && txid && (
        <WizardStepSelect
          txid={txid}
          outputs={outputs}
          selectedVout={selectedVout}
          setSelectedVout={setSelectedVout}
          onContinue={handleSelectOutput}
          onBack={() => setStep("input")}
        />
      )}

      {step === "store" && txid && (
        <WizardStepStore
          txid={txid}
          selectedVout={selectedVout ?? 0}
          outputs={outputs}
          beefBase64={beefBase64}
          height={height}
          buckets={buckets}
          selectedBucket={selectedBucket}
          setSelectedBucket={setSelectedBucket}
          labels={labels}
          setLabels={setLabels}
          onStore={handleStore}
          onBack={() => setStep("select-output")}
        />
      )}

      {step === "done" && resultOutpoint && txid && (
        <WizardStepDone
          resultOutpoint={resultOutpoint}
          txid={txid}
          beefBase64={beefBase64}
          height={height}
          onReset={handleReset}
        />
      )}
    </div>
  );
}

// Helper functions
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function parseRawTxOutputs(rawTxHex: string): ParsedOutput[] {
  const outputs: ParsedOutput[] = [];
  
  try {
    const bytes = hexToBytes(rawTxHex);
    let offset = 4;
    
    const inputCount = bytes[offset];
    offset++;
    for (let i = 0; i < inputCount; i++) {
      offset += 36;
      const scriptLen = bytes[offset];
      offset += 1 + scriptLen + 4;
    }
    
    const outputCount = bytes[offset];
    offset++;
    for (let i = 0; i < outputCount; i++) {
      let satoshis = 0;
      for (let j = 0; j < 8; j++) {
        satoshis += bytes[offset + j] * Math.pow(256, j);
      }
      offset += 8;
      
      const scriptLen = bytes[offset];
      offset++;
      const scriptHex = Array.from(bytes.slice(offset, offset + scriptLen))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      offset += scriptLen;
      
      outputs.push({ vout: i, satoshis, script_hex: scriptHex });
    }
  } catch {
    // Return empty if parsing fails
  }
  
  return outputs;
}

function computeTxidFromHex(rawTxHex: string): string {
  // Placeholder - in production use @bsv/sdk
  return rawTxHex.slice(0, 64).toLowerCase();
}
