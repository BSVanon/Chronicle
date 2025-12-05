"use client";

import * as React from "react";

import { createAddressListWallet } from "@/core/wallet/local-wallet";
import { runBasicDerivation } from "@/core/wallet/watch-only-derivation";
import { analyzeWatchOnlyInput } from "@/core/wallet/watch-only-analyzer";
import { useWallets } from "@/contexts/wallets-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WalletsSettingsCard() {
  const { wallets, addWallet } = useWallets();

  const [name, setName] = React.useState("");
  const [addressesRaw, setAddressesRaw] = React.useState("");

  const handleAddWallet = React.useCallback(() => {
    const id = `wallet-${Date.now().toString(36)}`;
    const lines = addressesRaw.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    if (lines.length === 0) return;
    const wallet = createAddressListWallet({ id, name, addressLines: lines });
    addWallet(wallet);
    setName("");
    setAddressesRaw("");
  }, [name, addressesRaw, addWallet]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Local wallets (dev-only)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-xs text-muted-foreground">
        <div className="space-y-2">
          <p className="text-[0.75rem]">
            Define simple watch-only wallets locally. For Step 2, only address
            lists are supported; xpub/descriptor/BEEF will be added later.
          </p>
          <div className="space-y-1">
            <label className="text-[0.75rem] font-medium">Wallet name</label>
            <Input
              className="h-7 text-[0.8rem]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hot wallet"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[0.75rem] font-medium">Addresses (one per line)</label>
            <textarea
              className="h-24 w-full rounded-md border bg-background p-2 font-mono text-[0.7rem]"
              value={addressesRaw}
              onChange={(e) => setAddressesRaw(e.target.value)}
              placeholder="1BoatSLRHtKNngkdXEeobR76b53LETtpyT"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-3 text-[0.75rem]"
            onClick={handleAddWallet}
            disabled={addressesRaw.trim().length === 0}
          >
            Add address-list wallet
          </Button>
        </div>
        <div className="space-y-2">
          <p className="text-[0.75rem] font-medium">Existing wallets</p>
          {wallets.length === 0 ? (
            <p className="text-[0.75rem] text-muted-foreground">
              No local wallets yet. Add an address-list wallet above.
            </p>
          ) : (
            <ul className="space-y-1 text-[0.75rem]">
              {wallets.map((wallet) => {
                const raw = wallet.addressLines.join("\n");
                const analysis = analyzeWatchOnlyInput(raw);
                const derivation = runBasicDerivation(raw, analysis);
                return (
                  <li
                    key={wallet.id}
                    className="flex items-center justify-between rounded-md border bg-card/60 px-2 py-1"
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium">{wallet.name}</p>
                      <p className="text-[0.7rem] text-muted-foreground">
                        Kind: {wallet.kind} • Addresses: {wallet.addressLines.length}
                      </p>
                    </div>
                    <div className="text-right text-[0.7rem] text-muted-foreground">
                      <p>
                        Derived scripthashes: <strong>{derivation.entries.length}</strong>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
