"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveData } from "@/hooks/useLiveData";
import { IncidentListPanel, type IncidentFilter } from "../IncidentListPanel";
import { IncidentDetailPanel } from "../IncidentDetailPanel";

// Full-page incidents management view (list + detail side by side)
export function IncidentsPage() {
  const { incidents, teams, shelters, assignments, connected, refresh } = useLiveData();

  const searchParams = useSearchParams();
  const incidentIdFromUrl = searchParams.get("incident");

  const [filter, setFilter] = useState<IncidentFilter>("ACTIVE");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
  incidentIdFromUrl
);
  


  const selected = incidents.find((i) => i.id === selectedId) ?? null;

  const clusterSizes = useMemo(() => {
    const sizes = new Map<string, number>();
    incidents.forEach((i) => {
      if (i.cluster_id) sizes.set(i.cluster_id, (sizes.get(i.cluster_id) ?? 0) + 1);
    });
    return sizes;
  }, [incidents]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Incidents</h1>
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "animate-pulse bg-amber-500"}`}
          title={connected ? "Live" : "Reconnecting"}
        />
      </div>

      <div className="flex h-[calc(100vh-11rem)] gap-4">
        <div className="w-96 shrink-0 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
          <IncidentListPanel
            incidents={incidents}
            filter={filter}
            onFilterChange={setFilter}
            search={search}
            onSearchChange={setSearch}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId((p) => (p === id ? p : id))}
            clusterSizes={clusterSizes}
          />
        </div>

        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
          {selected ? (
            <IncidentDetailPanel
              incident={selected}
              teams={teams}
              shelters={shelters}
              assignments={assignments}
              onClose={() => setSelectedId(null)}
              onAssigned={refresh}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              Select an incident to view details and allocate resources.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
