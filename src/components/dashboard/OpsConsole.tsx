"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveData, isActiveAssignment } from "@/hooks/useLiveData";
import { IncidentListPanel, type IncidentFilter } from "./IncidentListPanel";
import { IncidentDetailPanel } from "./IncidentDetailPanel";
import { ResourcePanel, type ReallocRec } from "./ResourcePanel";
import { ShelterPanel } from "./ShelterPanel";

const OpsMap = dynamic(() => import("@/components/map/OpsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-gray-100 text-sm text-muted">
      Loading map...
    </div>
  ),
});

type Tab = "incidents" | "resources" | "shelters";

export function OpsConsole() {
  const { incidents, teams, shelters, assignments, alerts, connected, refresh, syncAlerts } =
    useLiveData();

  const [tab, setTab] = useState<Tab>("incidents");
  const [filter, setFilter] = useState<IncidentFilter>("ACTIVE");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [layers, setLayers] = useState({
    incidents: true,
    resources: true,
    shelters: true,
    radar: false,
  });
  const [reallocations, setReallocations] = useState<ReallocRec[] | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Sync IMD warnings every 15 minutes (plus on first load)
  useEffect(() => {
    void (async () => {
      await syncAlerts();
    })();
    const timer = setInterval(() => void syncAlerts(), 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, [syncAlerts]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Toast when a critical incident arrives live
  const seenCritical = useRef(new Set<string>());
  useEffect(() => {
    incidents
.filter((i) => i.severity === "CRITICAL" && i.status === "REPORTED")
.forEach((i) => {
        if (!seenCritical.current.has(i.id)) {
          seenCritical.current.add(i.id);
          showToast(` CRITICAL: ${i.incident_number} — ${i.description.slice(0, 60)}...`);
        }
      });
  }, [incidents, showToast]);

  const selected = incidents.find((i) => i.id === selectedId) ?? null;

  const activeCount = incidents.filter(
    (i) => !["RESOLVED", "CANCELLED"].includes(i.status)
  ).length;
  const criticalCount = incidents.filter((i) => i.severity === "CRITICAL").length;
  const availableTeams = teams.filter((t) => t.status === "AVAILABLE").length;
  const occupancy = shelters.reduce((s, x) => s + x.current_occupancy, 0);
  const capacity = shelters.reduce((s, x) => s + x.total_capacity, 0);

  // Corroboration counts per cluster head
  const clusterSizes = useMemo(() => {
    const sizes = new Map<string, number>();
    incidents.forEach((i) => {
      if (i.cluster_id) sizes.set(i.cluster_id, (sizes.get(i.cluster_id) ?? 0) + 1);
    });
    return sizes;
  }, [incidents]);

  async function changeTeamStatus(teamId: string, status: string) {
    try {
      const res = await fetch(`/api/resources/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (json.reallocations && json.reallocations.length > 0) {
        setReallocations(json.reallocations);
        showToast("Resource became unavailable — system reallocated!");
      }
      refresh();
      return json as { reallocations: ReallocRec[] | null };
    } catch (e) {
      showToast(e instanceof Error ? e.message: "Update failed");
    }
  }

  return (
    <div className="flex h-full gap-3">
      {/* Left panel */}
      <div className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        <div className="flex border-b border-[var(--color-border)]">
          {(
            [
              ["incidents", `Incidents (${activeCount})`],
              ["resources", `Teams (${availableTeams}/${teams.length})`],
              ["shelters", "Shelters"],
            ] as [Tab, string][]
          ).map(([key, label]) => {
            const unassignedCritical = incidents.filter(
              (i) => i.severity === "CRITICAL" && i.status === "REPORTED"
            ).length;
            const showBadge =
              key === "incidents" && unassignedCritical > 0;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 px-2 py-2.5 text-xs font-medium ${
                  tab === key
                    ? "border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]"
: "text-muted hover:bg-gray-50"
                }`}
              >
                {label}
                {showBadge && (
                  <span className="ml-1 inline-flex h-4 min-w-4 animate-pulse items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[10px] text-white">
                    {unassignedCritical}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {tab === "incidents" && (
            <IncidentListPanel
              incidents={incidents}
              filter={filter}
              onFilterChange={setFilter}
              search={search}
              onSearchChange={setSearch}
              selectedId={selectedId}
              onSelect={(id) =>
                setSelectedId((prev) => (prev === id ? prev: id))
              }
              clusterSizes={clusterSizes}
            />
          )}
          {tab === "resources" && (
            <ResourcePanel
              teams={teams}
              onStatusChange={changeTeamStatus}
              reallocations={reallocations}
            />
          )}
          {tab === "shelters" && <ShelterPanel shelters={shelters} onUpdated={refresh} />}
        </div>
      </div>

      {/* Map area */}
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-[var(--color-border)] shadow-sm">
        <OpsMap
          incidents={incidents}
          teams={teams}
          shelters={shelters}
          assignments={assignments}
          alerts={alerts}
          selectedIncidentId={selectedId}
          showHeatmap={showHeatmap}
          layers={layers}
          onSelectIncident={(id) => {
            setSelectedId(id);
            setTab("incidents");
          }}
          onSelectTeam={() => setTab("resources")}
        />

        {/* IMD warning banner */}
        {alerts.length > 0 && (
          <div className="absolute inset-x-3 top-3 z-[1000] flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50/95 px-3 py-2 text-xs font-medium text-orange-800 shadow-md backdrop-blur">
             {alerts[0].title}
            {alerts.length > 1 && (
              <span className="text-orange-600">(+{alerts.length - 1} more)</span>
            )}
            <button
              onClick={() => setAlertsOpen((o) => !o)}
              className="ml-auto shrink-0 rounded-md border border-orange-300 px-2 py-0.5"
            >
              Details
            </button>
          </div>
        )}

        {/* Alerts detail popup */}
        {alertsOpen && alerts.length > 0 && (
          <div className="absolute left-3 top-12 z-[1050] w-80 space-y-2 rounded-xl border border-[var(--color-border)] bg-white/97 p-3 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Weather Warnings</span>
              <button
                onClick={() => setAlertsOpen(false)}
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
            {alerts.map((a) => (
              <div key={a.id} className="rounded-lg bg-gray-50 p-2">
                <div className="text-xs font-semibold">{a.title}</div>
                <p className="mt-0.5 line-clamp-3 text-[11px] text-muted">
                  {a.description}
                </p>
                <div className="mt-1 text-[10px] uppercase tracking-wide text-muted">
                  {a.source} · {a.severity} · until{" "}
                  {new Date(a.effective_until ?? a.effective_from).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Map controls */}
        <div className="absolute right-3 top-12 z-[1000] flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-white/95 p-2 text-xs shadow-md backdrop-blur">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={layers.incidents}
              onChange={(e) => setLayers((l) => ({...l, incidents: e.target.checked }))}
            />
             Incidents
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={layers.resources}
              onChange={(e) => setLayers((l) => ({...l, resources: e.target.checked }))}
            />
             Teams
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={layers.shelters}
              onChange={(e) => setLayers((l) => ({...l, shelters: e.target.checked }))}
            />
             Shelters
          </label>
          <hr className="my-0.5 border-[var(--color-border)]" />
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={(e) => setShowHeatmap(e.target.checked)}
            />
             Heatmap
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={layers.radar}
              onChange={(e) => setLayers((l) => ({ ...l, radar: e.target.checked }))}
            />
             Rain radar
          </label>
        </div>

        {/* Stats bar */}
        <div className="absolute bottom-3 left-3 right-3 z-[1000] flex gap-2">
          <Stat label="Active" value={activeCount} tone="text-[var(--color-accent)]" />
          <Stat
            label="Critical"
            value={criticalCount}
            tone={criticalCount ? "text-[var(--color-critical)]": ""}
          />
          <Stat
            label="Teams Ready"
            value={`${availableTeams}/${teams.length}`}
            tone="text-green-600"
          />
          <Stat
            label="Deployed"
            value={assignments.filter(isActiveAssignment).length}
            tone=""
          />
          <Stat
            label="Shelter Load"
            value={`${capacity ? Math.round((occupancy / capacity) * 100): 0}%`}
            tone=""
          />
        </div>

        {/* Detail drawer */}
        {selected && (
          <div className="absolute inset-y-3 right-3 z-[1100] w-96 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-lg backdrop-blur">
            <IncidentDetailPanel
              incident={selected}
              teams={teams}
              shelters={shelters}
              assignments={assignments}
              onClose={() => setSelectedId(null)}
              onAssigned={() => {
                refresh();
                showToast(`Assigned to ${selected.incident_number}`);
              }}
            />
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[2000] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Connection indicator */}
      <div
        title={connected ? "Live updates connected": "Reconnecting..."}
        className={`fixed right-4 top-4 z-[1500] h-2.5 w-2.5 rounded-full ${
          connected ? "bg-green-500": "animate-pulse bg-amber-500"
        }`}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white/95 px-3 py-1.5 shadow-md backdrop-blur">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className={`text-lg font-bold leading-tight ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
