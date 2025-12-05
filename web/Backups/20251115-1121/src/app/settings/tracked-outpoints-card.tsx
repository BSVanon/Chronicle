"use client";

import * as React from "react";

import { createTrackedOutpoint } from "@/core/utxo/tracked-outpoint";
import { useBuckets } from "@/contexts/bucket-context";
import { useTrackedOutpoints } from "@/contexts/tracked-outpoints-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TrackedOutpointsSettingsCard() {
  const { buckets } = useBuckets();
  const { outpoints, addOutpoint, deleteOutpoint } = useTrackedOutpoints();

  const [txid, setTxid] = React.useState("");
  const [vout, setVout] = React.useState("0");
  const [bucketId, setBucketId] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const handleAdd = React.useCallback(() => {
    const id = `${txid.trim()}:${vout.trim()}`;
    const voutNum = Number.parseInt(vout, 10) || 0;
    const op = createTrackedOutpoint({
      id,
      txid,
      vout: voutNum,
      bucketId: bucketId || undefined,
      notes: notes || undefined,
    });
    addOutpoint(op);
    setTxid("");
    setVout("0");
    setNotes("");
  }, [txid, vout, bucketId, notes, addOutpoint]);

  const disabled = txid.trim().length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tracked outpoints (dev-only)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <p className="text-[0.75rem]">
          Record outpoints (txid:vout) you care about locally. This will later
          feed into a spentness provider and rotation planner; for now it is a
          local-only registry.
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[0.75rem] font-medium">Txid</label>
            <Input
              className="h-7 text-[0.8rem] font-mono"
              value={txid}
              onChange={(e) => setTxid(e.target.value)}
              placeholder="64-hex txid"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[0.75rem] font-medium">Vout</label>
            <Input
              className="h-7 text-[0.8rem]"
              type="number"
              min={0}
              value={vout}
              onChange={(e) => setVout(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[0.75rem] font-medium">Bucket</label>
            <select
              className="h-7 w-full rounded-md border bg-background px-2 text-[0.8rem]"
              value={bucketId}
              onChange={(e) => setBucketId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {buckets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[0.75rem] font-medium">Notes (optional)</label>
          <Input
            className="h-7 text-[0.8rem]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. payout from miner X"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-3 text-[0.75rem]"
          onClick={handleAdd}
          disabled={disabled}
        >
          Add tracked outpoint
        </Button>
        <div className="space-y-2">
          <p className="text-[0.75rem] font-medium">Existing tracked outpoints</p>
          {outpoints.length === 0 ? (
            <p className="text-[0.75rem] text-muted-foreground">
              None yet. Add an outpoint above.
            </p>
          ) : (
            <ul className="space-y-1 text-[0.7rem]">
              {outpoints.map((op) => (
                <li
                  key={op.id}
                  className="flex items-center justify-between rounded-md border bg-card/60 px-2 py-1"
                >
                  <div className="space-y-0.5">
                    <p className="font-mono">
                      {op.txid.slice(0, 10)}...:{op.vout}
                    </p>
                    <p className="text-muted-foreground">
                      Bucket: {op.bucketId ?? "None"}
                    </p>
                    {op.notes && (
                      <p className="text-muted-foreground">Notes: {op.notes}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[0.7rem]"
                    onClick={() => deleteOutpoint(op.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
