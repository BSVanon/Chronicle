"use client";

import { useThemeMode } from "@/contexts/theme-mode-context";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function ChronicleLogoMark() {
  const { mode } = useThemeMode();
  const src = mode === "dark" ? `${basePath}/icon-light.svg` : `${basePath}/icon-dark.svg`;

  const baseClasses =
    "inline-flex h-7 w-7 items-center justify-center rounded-md";
  const backgroundClass = "bg-primary";

  return (
    <div className={`${baseClasses} ${backgroundClass}`}>
      <img
        src={src}
        alt="Chronicle logo"
        width={24}
        height={24}
        className="h-5 w-5"
      />
    </div>
  );
}
