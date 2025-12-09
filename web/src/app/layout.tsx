import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NetworkModeProvider } from "@/contexts/network-mode-context";
import { ThemeModeProvider } from "@/contexts/theme-mode-context";
import { HeaderStoreProvider } from "@/contexts/header-store-context";
import { DossierProvider } from "@/contexts/dossier-context";
import { BeefStoreProvider } from "@/contexts/beef-store-context";
import { ChronicleLogoMark } from "@/components/chronicle-logo";
import { ErrorBoundary } from "@/components/error-boundary";
import { NetworkModeToggle } from "@/components/network-mode-toggle";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { TipJarButton } from "@/components/tip-jar";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

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
    "Chronicle Cold Vault Archive — maintain everything needed to validate and spend your long-term BSV without asking an indexer what you own.",
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
    apple: `${basePath}/favicon.svg`,
  },
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
          <NetworkModeProvider>
            <HeaderStoreProvider>
              <DossierProvider>
                <BeefStoreProvider>
                  <ErrorBoundary>
                  <div className="flex min-h-screen flex-col">
                    <header className="sticky top-0 z-40 border-b bg-card">
                      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                            <ChronicleLogoMark />
                            <span className="hidden font-mono text-sm uppercase tracking-[0.2em] sm:inline">
                              chronicle
                            </span>
                          </Link>
                          <nav className="hidden items-center gap-4 text-sm md:flex">
                            <Link href="/" className="text-muted-foreground hover:text-foreground">
                              Dashboard
                            </Link>
                            <Link href="/dossiers" className="text-muted-foreground hover:text-foreground">
                              Dossiers
                            </Link>
                            <Link href="/add" className="text-muted-foreground hover:text-foreground">
                              Add
                            </Link>
                            <Link href="/validation" className="text-muted-foreground hover:text-foreground">
                              Validation
                            </Link>
                            <Link href="/export" className="text-muted-foreground hover:text-foreground">
                              Export
                            </Link>
                            <Link href="/settings" className="text-muted-foreground hover:text-foreground">
                              Settings
                            </Link>
                          </nav>
                        </div>
                        <div className="flex items-center gap-1">
                          <TipJarButton />
                          <NetworkModeToggle />
                          <ThemeModeToggle />
                        </div>
                      </div>
                      {/* Mobile nav */}
                      <nav className="flex items-center justify-center gap-4 border-t px-4 py-2 text-xs md:hidden">
                        <Link href="/" className="text-muted-foreground hover:text-foreground">
                          Home
                        </Link>
                        <Link href="/dossiers" className="text-muted-foreground hover:text-foreground">
                          Dossiers
                        </Link>
                        <Link href="/add" className="text-muted-foreground hover:text-foreground">
                          Add
                        </Link>
                        <Link href="/validation" className="text-muted-foreground hover:text-foreground">
                          Verify
                        </Link>
                        <Link href="/export" className="text-muted-foreground hover:text-foreground">
                          Export
                        </Link>
                        <Link href="/settings" className="text-muted-foreground hover:text-foreground">
                          ⚙️
                        </Link>
                      </nav>
                    </header>
                    <main className="flex-1">
                      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
                    </main>
                    <footer className="border-t bg-card/60 text-xs text-muted-foreground">
                      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-4 md:flex-row md:items-center md:justify-between">
                        <p>
                          Chronicle shows verified inclusion proofs, not unspentness claims.
                          Unspentness requires current chain state.
                        </p>
                        <p className="md:text-right">
                          No telemetry. No analytics. No keys. No seeds.
                        </p>
                      </div>
                    </footer>
                  </div>
                  </ErrorBoundary>
                </BeefStoreProvider>
              </DossierProvider>
            </HeaderStoreProvider>
          </NetworkModeProvider>
        </ThemeModeProvider>
      </body>
    </html>
  );
}
