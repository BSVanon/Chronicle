import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NetworkModeProvider } from "@/contexts/network-mode-context";
import { ThemeModeProvider } from "@/contexts/theme-mode-context";
import { PrivacyProfileProvider } from "@/contexts/privacy-profile-context";
import { BucketProvider } from "@/contexts/bucket-context";
import { WatchOnlyProvider } from "@/contexts/watch-only-context";
import { WalletsProvider } from "@/contexts/wallets-context";
import { ShardConfigProvider } from "@/contexts/shard-config-context";
import { TrackedOutpointsProvider } from "@/contexts/tracked-outpoints-context";
import { BeefArchiveProvider } from "@/contexts/beef-archive-context";
import { SentinelConfigProvider } from "@/contexts/sentinel-config-context";
import { UtxoStreamProvider } from "@/contexts/utxo-stream-context";
import { ChronicleLogoMark } from "@/components/chronicle-logo";
import { NetworkModeToggle } from "@/components/network-mode-toggle";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { SentinelStatusBadge } from "@/components/sentinel-status-badge";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Chronicle",
    template: "%s • Chronicle",
  },
  description:
    "Chronicle is a privacy-first Bitcoin SV wallet visibility tool that keeps keys and labels local while monitoring balances via a shielded proxy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeModeProvider>
          <PrivacyProfileProvider>
            <BucketProvider>
              <WatchOnlyProvider>
                <WalletsProvider>
                  <ShardConfigProvider>
                    <TrackedOutpointsProvider>
                      <BeefArchiveProvider>
                        <SentinelConfigProvider>
                          <NetworkModeProvider>
                            <UtxoStreamProvider>
                  <div className="flex min-h-screen flex-col">
              <header className="border-b bg-card/60 backdrop-blur">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                      <ChronicleLogoMark />
                      <span className="font-mono text-sm uppercase tracking-[0.2em]">
                        chronicle
                      </span>
                    </Link>
                    <nav className="hidden items-center gap-4 text-sm md:flex">
                      <Link href="/onboarding" className="text-muted-foreground hover:text-foreground">
                        Onboarding
                      </Link>
                      <Link href="/monitor" className="text-muted-foreground hover:text-foreground">
                        Monitor
                      </Link>
                      <Link href="/settings" className="text-muted-foreground hover:text-foreground">
                        Settings
                      </Link>
                    </nav>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThemeModeToggle />
                    <NetworkModeToggle />
                    <SentinelStatusBadge />
                  </div>
                </div>
              </header>
              <main className="flex-1">
                <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
              </main>
                <footer className="border-t bg-card/60 text-xs text-muted-foreground">
                  <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <p>
                      Never share seeds or xprv. Chronicle only ever needs scripthashes and outpoints to leave your
                      device when you enable shielded mode.
                    </p>
                    <p className="md:text-right">
                      No telemetry. No analytics. Balances and labels stay local; providers never see totals or bucket
                      groupings.
                    </p>
                  </div>
                </footer>
              </div>
            </UtxoStreamProvider>
            </NetworkModeProvider>
          </SentinelConfigProvider>
          </BeefArchiveProvider>
          </TrackedOutpointsProvider>
          </ShardConfigProvider>
          </WalletsProvider>
          </WatchOnlyProvider>
          </BucketProvider>
          </PrivacyProfileProvider>
        </ThemeModeProvider>
      </body>
    </html>
  );
}
