"use client";

import * as React from "react";

import type { LocalWallet } from "@/core/wallet/local-wallet";
import { deserializeWallets, serializeWallets } from "@/core/wallet/local-wallet";

export type WalletsContextValue = {
  wallets: LocalWallet[];
  addWallet: (wallet: LocalWallet) => void;
  updateWallet: (wallet: LocalWallet) => void;
  deleteWallet: (id: string) => void;
};

const STORAGE_KEY = "chronicle-wallets-v1";

const WalletsContext = React.createContext<WalletsContextValue | undefined>(undefined);

export function WalletsProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = React.useState<LocalWallet[]>([]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const deserialized = deserializeWallets(raw);
      if (deserialized.length === 0) return;
      setWallets(deserialized);
    } catch {
      // ignore storage failures
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeWallets(wallets));
    } catch {
      // ignore storage failures
    }
  }, [wallets]);

  const addWallet = React.useCallback((wallet: LocalWallet) => {
    setWallets((prev) => [...prev, wallet]);
  }, []);

  const updateWallet = React.useCallback((wallet: LocalWallet) => {
    setWallets((prev) => prev.map((w) => (w.id === wallet.id ? wallet : w)));
  }, []);

  const deleteWallet = React.useCallback((id: string) => {
    setWallets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const value = React.useMemo(
    () => ({ wallets, addWallet, updateWallet, deleteWallet }),
    [wallets, addWallet, updateWallet, deleteWallet],
  );

  return <WalletsContext.Provider value={value}>{children}</WalletsContext.Provider>;
}

export function useWallets(): WalletsContextValue {
  const ctx = React.useContext(WalletsContext);
  if (!ctx) {
    throw new Error("useWallets must be used within a WalletsProvider");
  }
  return ctx;
}
