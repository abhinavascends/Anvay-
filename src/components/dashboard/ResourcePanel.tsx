"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import type { ResourceTeam } from "@/types/database";

export function ResourcePanel({
  teams,
  onStatusChange,
  reallocations,
}: {
  teams: ResourceTeam[];
  onStatusChange: (
    teamId: string,
    status: string
  ) => Promise<{ reallocations: ReallocRec[] | null } | undefined>;
  reallocations: ReallocRec[] | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(teamId: string, current: string) {
    const next = current === "UNAVAILABLE" ? "AVAILABLE": "UNAVAILABLE";
    setBusy(teamId);
    await onStatusChange(teamId, next);
    setBusy(null);
  }

  return (
    <div>
      <h3 className="mb-2 px-1 text-sm font-semibold">Rescue Teams</h3>

      {/* Live reassignment recommendations (judge demo moment) */}
      {reallocations && reallocations.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="text-xs font-bold uppercase tracking-wide text-amber-700">
             Auto-reallocated
          </div>
          {reallocations.map((r, i) => (
            <div key={i} className="mt-1 text-sm">
              → New pick for orphaned incident:{" "}
              <b>{teams.find((t) => t.id === r.recommended_resource_id)?.team_code}</b>{" "}
              (score {r.total_score}, ETA ~{r.eta_minutes} min)
            </div>
          ))}
        </div>
      )}

      {teams.map((t) => (
        <div
          key={t.id}
          className="mb-2 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-sm"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <b>{t.team_code}</b>
              <Badge label={t.status} color={t.status} />
            </div>
            <div className="mt-0.5 truncate text-xs text-muted">
              {t.name} · {t.capacity} capacity · {t.capabilities.join(", ") || "general"}
            </div>
          </div>
          <button
            disabled={busy === t.id || t.status === "ASSIGNED" || t.status === "EN_ROUTE"}
            onClick={() => toggle(t.id, t.status)}
            className={`ml-3 shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              t.status === "UNAVAILABLE"
                ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
: "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40"
            }`}
          >
            {t.status === "UNAVAILABLE" ? "Mark Available": "Mark Unavailable"}
          </button>
        </div>
      ))}
    </div>
  );
}

export interface ReallocRec {
  incident_id: string;
  recommended_resource_id: string;
  total_score: number;
  eta_minutes: number;
  explanation: string;
}
