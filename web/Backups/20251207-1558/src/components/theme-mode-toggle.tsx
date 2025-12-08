"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { useThemeMode } from "@/contexts/theme-mode-context";
import { Button } from "@/components/ui/button";

export function ThemeModeToggle() {
  const { mode, toggle } = useThemeMode();
  const isDark = mode === "dark";

  const label = isDark ? "Dark" : "Light";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={`Toggle theme (currently ${label})`}
      onClick={toggle}
      className="h-8 w-8"
    >
      {isDark ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </Button>
  );
}
