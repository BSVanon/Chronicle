import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Chronicle</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          A privacy-first wallet visibility project. Chronicle gives you
          live(ish) balance and spend awareness across BSV wallets without
          handing any single third party your full wallet map or network
          identity.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Offline by default</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Chronicle boots in <strong>offline</strong> mode. No network
              calls are made until you explicitly switch to
              <strong> online_shielded</strong>.
            </p>
            <p>
              In offline mode you can configure profiles, import
              watch-only material, and inspect what would leave your device in
              a pre-flight privacy check.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="sm">
                <Link href="/onboarding">Start in offline mode</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/monitor">View monitor layout</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What leaves your device?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Never sent:</p>
            <ul className="list-disc pl-5">
              <li>Seeds, xprv, or WIF keys</li>
              <li>Xpubs or descriptors in raw form</li>
              <li>Labels, bucket names, or balance totals</li>
            </ul>
            <Separator className="my-2" />
            <p className="font-medium text-foreground">Allowed when shielded:</p>
            <ul className="list-disc pl-5">
              <li>Scripthashes derived locally from your watch-only view</li>
              <li>Outpoints (txid:vout) used for spentness checks</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
