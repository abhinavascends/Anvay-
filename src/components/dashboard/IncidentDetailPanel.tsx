"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { haversineKm, etaMinutes } from "@/lib/allocation";
import type {
  Assignment,
  IncidentActivity,
  Incident,
  ResourceTeam,
  Shelter,
} from "@/types/database";

interface Recommendation {
  resourceId: string;
  incidentId: string;
  totalScore: number;
  distanceKm: number;
  etaMinutes: number;
  severityScore: number;
  etaScore: number;
  capabilityScore: number;
  availabilityScore: number;
  capacityScore: number;
  explanation: string;
}

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "text-[var(--color-critical)]",
  HIGH: "text-[var(--color-high)]",
  MEDIUM: "text-[var(--color-medium)]",
  LOW: "text-[var(--color-low)]",
};

function mergeActivity(
  current: IncidentActivity[],
  incoming: IncidentActivity[]
): IncidentActivity[] {
  const byId = new Map(current.map((event) => [event.id, event]));
  incoming.forEach((event) => byId.set(event.id, event));
  return [...byId.values()].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
  );
}

function activityActor(actorType: IncidentActivity["actor_type"]): string {
  switch (actorType) {
    case "citizen":
      return "Citizen";
    case "rescue_team":
      return "Rescue team";
    case "operator":
      return "Operator";
    default:
      return "System";
  }
}

type TimelineEntry = {
  id: string;
  message: string;
  actor: string;
  created_at: string;
};

export function IncidentDetailPanel({
  incident,
  teams,
  shelters,
  assignments,
  onClose,
  onAssigned,
}: {
  incident: Incident | null;
  teams: ResourceTeam[];
  shelters: Shelter[];
  assignments: Assignment[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualPick, setManualPick] = useState("");
  const [lightbox, setLightbox] = useState(false);
  const [activity, setActivity] = useState<IncidentActivity[]>([]);
  const incidentId = incident?.id;

  const activeAssignment = incident
    ? assignments.find((a) => a.incident_id === incident.id)
: undefined;

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    if (activity.length > 0) {
      return activity.map((event) => ({
        id: event.id,
        message: event.message,
        actor: activityActor(event.actor_type),
        created_at: event.created_at,
      }));
    }

    const entries: TimelineEntry[] = [
      {
        id: `${incident?.id ?? "incident"}-reported`,
        message: "Incident reported",
        actor: "Citizen",
        created_at: incident?.reported_at ?? "",
      },
    ];

    if (incident && incident.updated_at !== incident.reported_at) {
      entries.push({
        id: `${incident.id}-updated`,
        message: "Incident last updated",
        actor: "System",
        created_at: incident.updated_at,
      });
    }

    if (activeAssignment) {
      entries.push({
        id: `${activeAssignment.id}-assigned`,
        message: "Team assigned",
        actor: "Operator",
        created_at: activeAssignment.assigned_at,
      });
      if (activeAssignment.acknowledged_at) {
        entries.push({
          id: `${activeAssignment.id}-acknowledged`,
          message: "Team acknowledged",
          actor: "Rescue team",
          created_at: activeAssignment.acknowledged_at,
        });
      }
      if (activeAssignment.arrived_at) {
        entries.push({
          id: `${activeAssignment.id}-arrived`,
          message: "Team arrived on scene",
          actor: "Rescue team",
          created_at: activeAssignment.arrived_at,
        });
      }
      if (activeAssignment.completed_at) {
        entries.push({
          id: `${activeAssignment.id}-completed`,
          message: "Incident response completed",
          actor: "Rescue team",
          created_at: activeAssignment.completed_at,
        });
      }
    }

    return entries.sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
    );
  }, [activity, activeAssignment, incident]);

  // Nearest shelters with free capacity - shelters that can absorb
  // everyone affected rank before partial-capacity ones, then distance.
  const suggestedShelters = useMemo(() => {
    if (!incident) return [];
    return shelters
      .map((s) => ({
        shelter: s,
        free: s.total_capacity - s.current_occupancy,
        distanceKm: haversineKm(
          incident.latitude,
          incident.longitude,
          s.latitude,
          s.longitude
        ),
      }))
      .filter((x) => x.free > 0)
      .sort((a, b) => {
        const need = incident.people_affected;
        const aFits = a.free >= need ? 0 : 1;
        const bFits = b.free >= need ? 0 : 1;
        if (aFits !== bFits) return aFits - bFits;
        return a.distanceKm - b.distanceKm;
      })
      .slice(0, 3);
  }, [incident, shelters]);

  // Closed incidents are read-only - no dispatch UI
  const isClosed =
    !!incident && ["RESOLVED", "CANCELLED"].includes(incident.status);

  // Resolution history (includes COMPLETED assignments, which the live
  // store excludes) - fetched when an open incident turns closed.
  const [history, setHistory] = useState<Assignment[]>([]);
  useEffect(() => {
    void (async () => {
      if (!incident || !["RESOLVED", "CANCELLED"].includes(incident.status)) {
        setHistory([]);
        return;
      }
      const { data } = await createClient()
        .from("assignments")
        .select("*")
        .eq("incident_id", incident.id)
        .order("assigned_at", { ascending: false });
      setHistory(data ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident?.id, incident?.status]);

  useEffect(() => {
    if (!incidentId) return;

    let cancelled = false;
    const supabase = createClient();
    const channel = supabase
      .channel(`incident-activity-${incidentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incident_activity",
          filter: `incident_id=eq.${incidentId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id?: string }).id;
            if (deletedId) {
              setActivity((current) => current.filter((event) => event.id !== deletedId));
            }
            return;
          }

          const nextEvent = payload.new as IncidentActivity;
          setActivity((current) => mergeActivity(current, [nextEvent]));
        }
      )
      .subscribe();

    void (async () => {
      const { data } = await supabase
        .from("incident_activity")
        .select("*")
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setActivity((current) => mergeActivity(current, data ?? []));
      }
    })();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [incidentId]);

  const allocate = useCallback(async (incidentId: string) => {
    setLoading(true);
    setError(null);
    setShowAll(false);
    try {
      const res = await fetch("/api/assignments/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Allocation failed");
      setRecs(json.recommendations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message: "Allocation failed");
      setRecs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset per-incident state during render (React's recommended pattern)
  const [prevIncidentId, setPrevIncidentId] = useState<string | null>(null);
  if ((incident?.id ?? null) !== prevIncidentId) {
    setPrevIncidentId(incident?.id ?? null);
    setRecs([]);
    setManualPick("");
    setError(null);
    setLightbox(false);
    setActivity([]);
  }

  useEffect(() => {
    // Defer allocation fetch so setState never runs synchronously
    if (incidentId && !isClosed && !activeAssignment && recs.length === 0)
      void (async () => {
        await allocate(incidentId);
      })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId]);

  async function assign(resourceId: string, rec?: Recommendation) {
    if (!incident) return;
    setAssigning(resourceId);
    setError(null);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: incident.id,
          resourceId,
          score: rec?.totalScore,
          breakdown: rec
            ? {
                severityScore: rec.severityScore,
                etaScore: rec.etaScore,
                capabilityScore: rec.capabilityScore,
                availabilityScore: rec.availabilityScore,
                capacityScore: rec.capacityScore,
              }
: undefined,
          explanation: rec?.explanation,
          distanceKm: rec?.distanceKm,
          etaMinutes: rec?.etaMinutes,
          manual: !rec,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Assignment failed");
      onAssigned();
    } catch (e) {
      setError(e instanceof Error ? e.message: "Assignment failed");
    } finally {
      setAssigning(null);
    }
  }

  if (!incident) return null;

  const shown = showAll ? recs: recs.slice(0, 3);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <span className="font-mono text-xs text-muted">{incident.incident_number}</span>
          <h2 className={`text-lg font-bold ${SEV_COLORS[incident.severity]}`}>
            {incident.severity} · {incident.type.replace(/_/g, " ")}
          </h2>
        </div>
        <button onClick={onClose} className="rounded-md px-2 py-1 text-muted hover:bg-gray-100">✕</button>
      </div>

      <p className="mb-2 text-sm">{incident.description}</p>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-muted">
        <div> {incident.location_text ?? `${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}`}</div>
        <div> {incident.people_affected} people affected</div>
        <div> Needs: {incident.required_capabilities.join(", ") || "general"}</div>
        <div> Confidence: {Math.round(incident.confidence_score * 100)}%</div>
      </div>

      {incident.photo_url ? (
        <button
          onClick={() => setLightbox(true)}
          className="relative mb-3 block w-full overflow-hidden rounded-lg border border-[var(--color-border)]"
          title="Click to enlarge"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={incident.photo_url}
            alt={`Citizen photo for ${incident.incident_number}`}
            className="h-36 w-full cursor-zoom-in object-cover"
          />
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            📷 citizen photo
          </span>
        </button>
      ) : (
        <div className="mb-3 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-muted">
          📷 No photo attached to this report
        </div>
      )}

      <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-gray-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">
          Activity / Timeline
        </div>
        <ol className="mt-2 space-y-2">
          {timelineEntries.map((entry) => (
            <li key={entry.id} className="text-xs">
              <div className="font-medium">{entry.message}</div>
              <div className="mt-0.5 text-muted">
                <time dateTime={entry.created_at}>
                  {new Date(entry.created_at).toLocaleString()}
                </time>
                {" · "}
                {entry.actor}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {!isClosed && suggestedShelters.length > 0 && (
        <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            🏥 Suggested Shelters
          </div>
          <div className="mt-2 space-y-1.5">
            {suggestedShelters.map(({ shelter, free, distanceKm }) => (
              <a
                key={shelter.id}
                href={`https://www.google.com/maps/dir/?api=1&destination=${shelter.latitude},${shelter.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1.5 text-xs hover:bg-gray-100"
              >
                <span className="truncate font-medium">{shelter.name}</span>
                <span
                  className={`ml-auto shrink-0 font-medium ${
                    free >= incident.people_affected ? "text-green-700" : "text-muted"
                  }`}
                >
                  {free >= incident.people_affected
                    ? `✓ fits all · ${distanceKm.toFixed(1)} km`
                    : `${free} free · ${distanceKm.toFixed(1)} km`}
                </span>
              </a>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            Ranked by ability to absorb {incident.people_affected} people, then distance. Click for directions.
          </p>
        </div>
      )}

      {isClosed && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-green-700">
            {incident.status === "RESOLVED" ? "Resolved" : "Cancelled"}
            {incident.resolved_at
              ? ` · ${new Date(incident.resolved_at).toLocaleString()}`
              : ""}
          </div>

          {history.length > 0 ? (
            <div className="mt-2 space-y-2">
              {history.map((a) => {
                const team = teams.find((t) => t.id === a.resource_id);
                return (
                  <div
                    key={a.id}
                    className="rounded-lg bg-white/80 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <b>{team?.team_code ?? "Unknown team"}</b>
                      <Badge label={a.status} color={a.status === "COMPLETED" ? "RESOLVED" : a.status} />
                    </div>
                    <div className="mt-1 text-muted">
                      Assigned{" "}
                      {new Date(a.assigned_at).toLocaleString()}
                      {a.is_manual_override && " (manual)"}
                    </div>
                    {(a.distance_km != null || a.eta_minutes != null) && (
                      <div className="mt-0.5 text-muted">
                        {[a.distance_km != null ? `${a.distance_km.toFixed(1)} km` : null,
                          a.eta_minutes != null ? `ETA ~${Math.round(a.eta_minutes)} min` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                    {a.acknowledged_at && (
                      <div className="mt-0.5 text-muted">
                        Acknowledged {new Date(a.acknowledged_at).toLocaleTimeString()}
                        {a.arrived_at &&
                          ` · On scene ${new Date(a.arrived_at).toLocaleTimeString()}`}
                        {a.completed_at &&
                          ` · Completed ${new Date(a.completed_at).toLocaleTimeString()}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted">
              No team was dispatched to this incident.
            </p>
          )}
        </div>
      )}

      {!isClosed && activeAssignment && (
        <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-blue-700">
            Current assignment · {activeAssignment.status.replace("_", " ")}
          </div>
          {(() => {
            const team = teams.find((t) => t.id === activeAssignment.resource_id);
            const km =
              activeAssignment.distance_km ??
              (team && incident
                ? haversineKm(
                    team.latitude,
                    team.longitude,
                    incident.latitude,
                    incident.longitude
                  )
                : null);
            const eta =
              activeAssignment.eta_minutes ?? (km != null ? etaMinutes(km) : null);
            return (
              <div className="mt-1 text-sm">
                 <b>{team?.team_code}</b>
                {km != null && ` · ${km.toFixed(1)} km`}
                {eta != null && ` · ETA ~${Math.round(eta)} min`}
                {activeAssignment.is_manual_override && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    manual
                  </span>
                )}
                {team && incident && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${team.latitude},${team.longitude}&destination=${incident.latitude},${incident.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-xs font-medium text-[var(--color-accent)] underline"
                  >
                    Navigate route
                  </a>
                )}
                {team && activeAssignment.status === "PENDING" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-2"
                    disabled={assigning !== null}
                    onClick={() =>
                      fetch(`/api/assignments/${activeAssignment.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "ACKNOWLEDGED" }),
                      }).then(onAssigned)
                    }
                  >
                    Acknowledge
                  </Button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {!isClosed && !activeAssignment && (
        <div className="flex-1">
          <h3 className="mb-2 text-sm font-semibold">Recommended Resources</h3>

          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-24 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          )}

          {error && (
            <p className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-[var(--color-primary)]">
              {error}
            </p>
          )}

          {!loading &&
            shown.map((r, idx) => {
              const team = teams.find((t) => t.id === r.resourceId);
              return (
                <div
                  key={r.resourceId}
                  className="mb-2 rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {idx === 0 && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                          BEST
                        </span>
                      )}
                      <b>{team?.team_code}</b>
                      {team && <Badge label={team.status} color={team.status} />}
                    </div>
                    <span className="text-lg font-bold text-[var(--color-accent)]">
                      {r.totalScore}
                    </span>
                  </div>

                  <div className="mt-1.5 text-xs text-muted">
                     {r.distanceKm} km · ~{r.etaMinutes} min ETA
                  </div>

                  {/* score breakdown bars */}
                  <div className="mt-2 space-y-1">
                    {(
                      [
                        ["Capability", r.capabilityScore],
                        ["ETA", r.etaScore],
                        ["Availability", r.availabilityScore],
                        ["Capacity", r.capacityScore],
                      ] as [string, number][]
                    ).map(([label, v]) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-[11px] text-muted">{label}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${v >= 75 ? "bg-green-500": v >= 40 ? "bg-amber-500": "bg-red-400"}`}
                            style={{ width: `${v}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[11px] text-muted">{v}</span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs italic text-muted">{r.explanation}</p>

                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    disabled={assigning !== null}
                    onClick={() => assign(r.resourceId, r)}
                  >
                    {assigning === r.resourceId ? "Assigning...": "ASSIGN"}
                  </Button>
                </div>
              );
            })}

          {!loading && recs.length > 3 && (
            <button
              onClick={() => setShowAll((s) => !s)}
              className="mb-2 w-full text-sm font-medium text-[var(--color-accent)]"
            >
              {showAll ? "Show top 3 only": `See all alternatives (${recs.length - 3})`}
            </button>
          )}

          {/* manual override */}
          <div className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] p-3">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Manual Override
            </div>
            <div className="flex gap-2">
              <select
                value={manualPick}
                onChange={(e) => setManualPick(e.target.value)}
                className="h-8 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-2 text-xs"
              >
                <option value="">Select a team...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.team_code} ({t.status})
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="secondary"
                disabled={!manualPick || assigning !== null || Boolean(activeAssignment)}
                onClick={() => assign(manualPick)}
              >
                Assign
              </Button>
            </div>
          </div>
        </div>
      )}
      {lightbox && incident.photo_url && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 p-6"
          onClick={() => setLightbox(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={incident.photo_url}
            alt={`Citizen photo for ${incident.incident_number}`}
            className="max-h-[88vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
          <button
            className="absolute right-4 top-4 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
            onClick={() => setLightbox(false)}
          >
            ✕ Close
          </button>
        </div>
      )}
    </div>
  );
}
