"use client";

import * as React from "react";

type TipPool = {
  version: number;
  generatedAt: string;
  fallbackPaymail?: string;
};

export function TipJarButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-md px-2 py-1 text-lg text-primary hover:bg-accent hover:text-primary/80"
        title="Support Chronicle"
      >
        💚
      </button>
      {open && <TipJarModal onClose={() => setOpen(false)} />}
    </>
  );
}

function TipJarModal({ onClose }: { onClose: () => void }) {
  const [paymail, setPaymail] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    async function loadPool() {
      try {
        const res = await fetch("/tips.pool.json");
        if (!res.ok) throw new Error("Failed to load");
        const data: TipPool = await res.json();
        setPaymail(data.fallbackPaymail ?? null);
      } catch {
        // Fallback if file doesn't load
        setPaymail(null);
      } finally {
        setLoading(false);
      }
    }
    loadPool();
  }, []);

  // Close on escape
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleCopy = async () => {
    if (!paymail) return;
    try {
      await navigator.clipboard.writeText(paymail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = paymail;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>

        <div className="space-y-4 text-center">
          <h2 className="text-xl font-semibold">Support Chronicle</h2>
          <p className="text-sm text-muted-foreground">
            Chronicle is free and open source. Tips help fund development.
          </p>

          {loading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}

          {!loading && paymail && (
            <div className="space-y-4">
              <p className="text-sm">
                Send a tip via paymail:
              </p>
              <div 
                className="flex items-center justify-center gap-2 rounded-md bg-muted px-3 py-3 cursor-pointer hover:bg-muted/80"
                onClick={handleCopy}
                title="Click to copy"
              >
                <code className="text-lg font-medium">
                  {paymail}
                </code>
                <span className="text-muted-foreground">
                  {copied ? "✓" : "📋"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {copied ? "Copied!" : "Click to copy, then send any amount from your BSV wallet."}
              </p>
            </div>
          )}

          {!loading && !paymail && (
            <p className="text-sm text-muted-foreground">
              Tip jar not configured.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Thank you for supporting open source! 💚
          </p>
        </div>
      </div>
    </div>
  );
}
