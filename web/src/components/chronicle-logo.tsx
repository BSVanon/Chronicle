"use client";

import Image from "next/image";

import { useThemeMode } from "@/contexts/theme-mode-context";

export function ChronicleLogoMark() {
  const { mode } = useThemeMode();
  const src = mode === "dark" ? "/icon-light.svg" : "/icon-dark.svg";

  const baseClasses =
    "inline-flex h-7 w-7 items-center justify-center rounded-md";
  const backgroundClass = "bg-primary";

  return (
    <div className={`${baseClasses} ${backgroundClass}`}>
      <Image
        src={src}
        alt="Chronicle logo"
        width={24}
        height={24}
        className="h-5 w-5"
        priority
      />
    </div>
  );
}
