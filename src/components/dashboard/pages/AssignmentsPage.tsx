"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useLiveData, isActiveAssignment } from "@/hooks/useLiveData";

const FLOW: Record<string, { next: string; label: string } | undefined> = {
  PENDING: { next: "ACKNOWLEDGED", label: "Acknowledge" },
  ACKNOWLEDGED: { next: "EN_ROUTE", label: "En Route" },
  EN_ROUTE: { next: "ON_SCENE", label: "On Scene" },
  ON_SCENE: { next: "COMPLETED", label: "Resolve" },
};

export function AssignmentsPage() {
  const { assignments, teams, incidents, refresh } = useLiveData();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);


  async function setStatus(id: string, status: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message: "Update failed");
    }
    setBusy(null);
  }

  const active = assignments.filter(isActiveAssignment);
  const done = assignments.filter((a) => !isActiveAssignment(a));
  void done;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Assignments</h1>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-[var(--color-primary)]">
          {error}
        </p>
      )}

      {!active.length && (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-muted">
          No active assignments. Assign a team to an incident from the Live Map
          or Incidents page.
        </p>
      )}

      {active.map((a) => {
        const team = teams.find((t) => t.id === a.resource_id);
        const incident = incidents.find((i) => i.id === a.incident_id);
        const action = FLOW[a.status];
        return (
          <div key={a.id} className="mb-3 rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                 <b>{team?.team_code ?? "Team"}</b>
                <span className="text-muted">→</span>
                <span className="font-mono text-xs text-muted">{incident?.incident_number}</span>
                <Badge label={a.status} color={a.status === "PENDING" ? "MEDIUM": "ASSIGNED"} />
              </div>
              {action && (
                <Button
                  size="sm"
                  disabled={busy === a.id}
                  onClick={() => setStatus(a.id, action.next)}
                >
                  {busy === a.id ? "...": action.label}
                </Button>
              )}
            </div>

            {incident && (
              <p className="mt-1.5 line-clamp-1 text-sm text-muted">{incident.description}</p>
            )}

            {incident && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                <time dateTime={incident.reported_at}>
                  Reported {new Date(incident.reported_at).toLocaleString()}
                </time>
                <time dateTime={a.assigned_at}>
                  Assigned {new Date(a.assigned_at).toLocaleString()}
                </time>
                {a.acknowledged_at && (
                  <time dateTime={a.acknowledged_at}>
                    Acknowledged {new Date(a.acknowledged_at).toLocaleString()}
                  </time>
                )}
                {a.arrived_at && (
                  <time dateTime={a.arrived_at}>
                    On scene {new Date(a.arrived_at).toLocaleString()}
                  </time>
                )}
                {a.completed_at && (
                  <time dateTime={a.completed_at}>
                    Completed {new Date(a.completed_at).toLocaleString()}
                  </time>
                )}
              </div>
            )}

            <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-muted">
              {a.distance_km != null && <span> {a.distance_km} km</span>}
              {a.eta_minutes != null && <span> ETA {a.eta_minutes} min</span>}
              {a.allocation_score != null && (
                <span> Score {Math.round(a.allocation_score)}</span>
              )}
              {a.is_manual_override && (
                <span className="font-medium text-amber-600">Manual override</span>
              )}
            </div>

            {a.explanation && (
              <p className="mt-1 line-clamp-2 text-xs italic text-muted">{a.explanation}</p>
            )}
          </div>
        );
      })}

      <button
        onClick={() => setShowDone((s) => !s)}
        className="mt-2 text-sm font-medium text-[var(--color-accent)]"
      >
        {showDone ? "Hide completed": "Show completed / cancelled"}
      </button>

      {showDone && (
        <div className="mt-2 opacity-80">
          {done.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-muted">
              No completed or cancelled assignments yet.
            </p>
          ) : (
            done.map((a) => {
              const team = teams.find((t) => t.id === a.resource_id);
              const incident = incidents.find((i) => i.id === a.incident_id);
              return (
                <div key={a.id} className="mb-2 rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <b>{team?.team_code}</b> →{" "}
                      <span className="font-mono text-xs">{incident?.incident_number}</span>
                      {incident && (
                        <span className="ml-2 hidden text-xs text-muted sm:inline">
                          {incident.description.slice(0, 60)}
                          {incident.description.length > 60 ? "…" : ""}
                        </span>
                      )}
                    </span>
                    <Badge label={a.status} color={a.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
                    {a.completed_at && <span>Completed {new Date(a.completed_at).toLocaleString()}</span>}
                    {a.arrived_at && !a.completed_at && (
                      <span>Last update {new Date(a.updated_at).toLocaleString()}</span>
                    )}
                    {a.allocation_score != null && <span>Score {Math.round(a.allocation_score)}</span>}
                    {a.is_manual_override && <span className="text-amber-600">Manual</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

