"use client";

import * as React from "react";

import { createUtxoEngine } from "@/core/utxo/engine";
import { demoDeltasFromDerived } from "@/core/utxo/derived-demo";
import { runBasicDerivation } from "@/core/wallet/watch-only-derivation";
import { useWatchOnly } from "@/contexts/watch-only-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function DerivedUtxoDemoPanel() {
  const { raw, analysis } = useWatchOnly();

  const derivationResult = React.useMemo(
    () => runBasicDerivation(raw, analysis),
    [raw, analysis],
  );

  const engine = React.useMemo(() => {
    const deltas = demoDeltasFromDerived(derivationResult.entries);
    return createUtxoEngine(deltas);
  }, [derivationResult.entries]);

  const totals = engine.getTotals();

  const hasEntries = derivationResult.entries.length > 0;

  return (
    <Card className="mt-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>Derived watch-only UTXO demo</CardTitle>
          <p className="text-xs text-muted-foreground">
            Uses the basic derivation engine to turn your watch-only material
            into scripthashes, then seeds the local UTXO engine with simulated
            UTXOs. No network calls are made.
          </p>
        </div>
        <Badge variant="outline" className="text-[0.7rem] uppercase tracking-wide">
          Demo
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        {!hasEntries ? (
          <p>
            Paste a few legacy addresses into the onboarding watch-only panel to
            see a simulated UTXO view here.
          </p>
        ) : (
          <>
            <p>
              Derived entries: <strong>{derivationResult.entries.length}</strong>
            </p>
            <p>
              Simulated totals: Confirmed <strong>{totals.confirmed}</strong> sats •
              Unconfirmed <strong>{totals.unconfirmed}</strong> sats
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
