"use client";

import * as React from "react";

export type ThemeMode = "light" | "dark";

export type ThemeModeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const STORAGE_KEY = "chronicle-theme";

const ThemeModeContext = React.createContext<ThemeModeState | undefined>(
  undefined,
);

export function ThemeModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setModeState] = React.useState<ThemeMode>("dark");

  // On mount, attempt to hydrate from localStorage.
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        setModeState(stored);
      }
    } catch {
      // Ignore storage errors; fall back to default dark mode.
    }
  }, []);

  // Apply the mode to the document root and persist.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors; theme will still apply for this session.
    }
  }, [mode]);

  const setMode = React.useCallback((next: ThemeMode) => {
    setModeState(next);
  }, []);

  const toggle = React.useCallback(() => {
    setModeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const value = React.useMemo<ThemeModeState>(
    () => ({ mode, setMode, toggle }),
    [mode, setMode, toggle],
  );

  return (
    <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeState {
  const ctx = React.useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error("useThemeMode must be used within a ThemeModeProvider");
  }
  return ctx;
}
