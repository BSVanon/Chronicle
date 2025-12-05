"use client";

import * as React from "react";

import { createUtxoEngine } from "@/core/utxo/engine";
import type { UtxoDeltaEvent } from "@/core/sentinel/types";

export type UtxoStreamSource = "none" | "sentinel" | "simulation";

export type UtxoStreamContextValue = {
  engine: ReturnType<typeof createUtxoEngine>;
  recentEvents: UtxoDeltaEvent[];
  applyEvent: (event: UtxoDeltaEvent) => void;
  applyEvents: (events: UtxoDeltaEvent[]) => void;
  reset: () => void;
  streamSource: UtxoStreamSource;
  setStreamSource: (source: UtxoStreamSource) => void;
  lastEventAt: number | null;
  eventCount: number;
};

const UtxoStreamContext = React.createContext<UtxoStreamContextValue | undefined>(
  undefined,
);

export function UtxoStreamProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const engineRef = React.useRef(createUtxoEngine());
  const [recentEvents, setRecentEvents] = React.useState<UtxoDeltaEvent[]>([]);
  const [streamSource, setStreamSource] = React.useState<UtxoStreamSource>("none");
  const [lastEventAt, setLastEventAt] = React.useState<number | null>(null);
  const [eventCount, setEventCount] = React.useState(0);
  const [, setVersion] = React.useState(0);

  const applyEvent = React.useCallback((event: UtxoDeltaEvent) => {
    engineRef.current.applyDelta(event);
    setVersion((value) => value + 1);
    setLastEventAt(Date.now());
    setEventCount((value) => value + 1);
    setRecentEvents((previous) => {
      const next = [...previous, event];
      if (next.length > 50) next.shift();
      return next;
    });
  }, []);

  const applyEvents = React.useCallback(
    (events: UtxoDeltaEvent[]) => {
      if (events.length === 0) return;
      for (const event of events) {
        engineRef.current.applyDelta(event);
      }
      setVersion((value) => value + 1);
      setLastEventAt(Date.now());
      setEventCount((value) => value + events.length);
      setRecentEvents((previous) => {
        const combined = [...previous, ...events];
        if (combined.length <= 50) return combined;
        return combined.slice(combined.length - 50);
      });
    },
    [],
  );

  const reset = React.useCallback(() => {
    engineRef.current = createUtxoEngine();
    setRecentEvents([]);
    setStreamSource("none");
    setLastEventAt(null);
    setEventCount(0);
    setVersion((value) => value + 1);
  }, []);

  const value = React.useMemo(
    () => ({
      engine: engineRef.current,
      recentEvents,
      applyEvent,
      applyEvents,
      reset,
      streamSource,
      setStreamSource,
      lastEventAt,
      eventCount,
    }),
    [recentEvents, applyEvent, applyEvents, reset, streamSource, lastEventAt, eventCount],
  );

  return <UtxoStreamContext.Provider value={value}>{children}</UtxoStreamContext.Provider>;
}

export function useUtxoStream(): UtxoStreamContextValue {
  const context = React.useContext(UtxoStreamContext);
  if (!context) {
    throw new Error("useUtxoStream must be used within a UtxoStreamProvider");
  }
  return context;
}
