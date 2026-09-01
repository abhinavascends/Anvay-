"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SCENARIOS } from "@/lib/simulation";

export default function SimulationPage() {
  const [status, setStatus] = useState<{
    running: boolean;
    elapsedSec?: number;
    durationSec?: number;
    scenarioName?: string;
  }>({ running: false });
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function refresh() {
    const res = await fetch("/api/simulation");
    if (res.ok) setStatus(await res.json());
  }

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
    const t = setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
     
  }, []);


  async function act(action: string, scenarioId?: string) {
    setBusy(true);
    const res = await fetch("/api/simulation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, scenarioId }),
    });
    const json = await res.json();
    if (action === "start" && res.ok) {
      setLog((l) => [`▶ Started ${json.scenario}`, ...l].slice(0, 10));
    }
    if (action === "stop" && json.stopped) {
      setLog((l) => ["⏹ Stopped", ...l].slice(0, 10));
    }
    if (action === "reset") {
      setLog((l) =>
        [
          res.ok
            ? "♻ Reset demo data"
            : `⚠ Reset failed: ${json.error ?? "unknown error"}`,
          ...l,
        ].slice(0, 10)
      );
    }
    await refresh();
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Disaster Simulation</h1>
      <p className="mb-6 text-sm text-muted">
        Injects a scripted emergency into the live system. Watch it unfold on
        the Live Map — every change streams in realtime.
      </p>

      {SCENARIOS.map((s) => (
        <div key={s.id} className="mb-4 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">{s.name}</h2>
              <p className="mt-1 text-sm text-muted">{s.description}</p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-muted">
              {s.durationSec}s
            </span>
          </div>
          <Button
            className="mt-4"
            disabled={busy || status.running}
            onClick={() => act("start", s.id)}
          >
            ▶ Start Simulation
          </Button>
        </div>
      ))}

      {/* Status */}
      <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Engine status
            </span>
            <div className="mt-0.5 font-semibold">
              {status.running ? (
                <span className="text-[var(--color-accent)]">
                  ● Running — {status.scenarioName} ({status.elapsedSec}s /{" "}
                  {status.durationSec}s)
                </span>
              ) : (
                <span className="text-muted">Idle</span>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !status.running}
            onClick={() => act("stop")}
          >
            ⏹ Stop
          </Button>
        </div>

        {status.running && status.durationSec ? (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all"
              style={{
                width: `${Math.min(100, ((status.elapsedSec ?? 0) / (status.durationSec ?? 1)) * 100)}%`,
              }}
            />
          </div>
        ) : null}
      </div>

      {/* Reset + log */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Demo reset
            </span>
            <p className="text-sm text-muted">
              Clears all incidents/assignments and restores seed state.
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (confirm("Delete all incidents and reset demo data?")) {
                void act("reset");
              }
            }}
          >
            ♻ Reset
          </Button>
        </div>

        {log.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-3 text-xs text-muted">
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

