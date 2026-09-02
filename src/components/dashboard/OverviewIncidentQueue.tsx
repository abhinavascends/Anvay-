"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type {
  Assignment,
  IncidentSeverity,
  IncidentType,
} from "@/types/database";

type OverviewIncident = {
  id: string;
  incident_number: string;
  severity: IncidentSeverity;
  type: IncidentType;
  status: string;
  description: string;
  location_text: string | null;
  reported_at: string;
  people_affected: number;
  confidence_score: number;
};

type GroupBy = "NONE" | "PRIORITY" | "STATUS" | "TYPE" | "LOCATION";

type SortBy =
  | "URGENCY"
  | "NEWEST"
  | "OLDEST"
  | "PEOPLE_AFFECTED"
  | "CONFIDENCE";

type OverviewStatus =
  | "REPORTED"
  | "VERIFIED"
  | "ASSIGNED"
  | "TEAM_ACKNOWLEDGED"
  | "TEAM_EN_ROUTE"
  | "TEAM_ARRIVED"
  | "BACKUP_REQUESTED"
  | "RESOLVED";

const STATUS_LABELS: Record<OverviewStatus, string> = {
  REPORTED: "Reported",
  VERIFIED: "Verified",
  ASSIGNED: "Assigned",
  TEAM_ACKNOWLEDGED: "Team Acknowledged",
  TEAM_EN_ROUTE: "Team En Route",
  TEAM_ARRIVED: "Team Arrived",
  BACKUP_REQUESTED: "Backup Requested",
  RESOLVED: "Resolved",
};

const SEVERITY_ORDER: Record<IncidentSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function getOperationalStatus(
  incident: OverviewIncident,
  assignments: Assignment[],
): OverviewStatus {
  if (incident.status === "RESOLVED") {
    return "RESOLVED";
  }

  if (incident.status === "ESCALATED") {
    return "BACKUP_REQUESTED";
  }

  const assignment = assignments.find(
    (a) =>
      a.incident_id === incident.id &&
      !["CANCELLED", "COMPLETED"].includes(a.status),
  );

  if (!assignment) {
    if (
      incident.status === "VALIDATED" ||
      incident.status === "UNASSIGNED"
    ) {
      return "VERIFIED";
    }

    return "REPORTED";
  }

  switch (assignment.status) {
    case "PENDING":
      return "ASSIGNED";

    case "ACKNOWLEDGED":
      return "TEAM_ACKNOWLEDGED";

    case "EN_ROUTE":
      return "TEAM_EN_ROUTE";

    case "ON_SCENE":
      return "TEAM_ARRIVED";

    case "INTERRUPTED":
      return "BACKUP_REQUESTED";

    default:
      return "ASSIGNED";
  }
}

function formatStatus(status: OverviewStatus) {
  return STATUS_LABELS[status];
}

export function OverviewIncidentQueue({
  incidents,
  assignments,
}: {
  incidents: OverviewIncident[];
  assignments: Assignment[];
}) {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity | "ALL">("ALL");
  const [status, setStatus] = useState<OverviewStatus | "ALL">("ALL");
  const [type, setType] = useState<IncidentType | "ALL">("ALL");
  const [location, setLocation] = useState("ALL");
  const [sortBy, setSortBy] = useState<SortBy>("URGENCY");
  const [groupBy, setGroupBy] = useState<GroupBy>("NONE");
  const [needsAction, setNeedsAction] = useState(false);

  const locations = useMemo(() => {
    return Array.from(
      new Set(
        incidents
          .map((i) => i.location_text)
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort();
  }, [incidents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = incidents.filter((incident) => {
      const operationalStatus = getOperationalStatus(incident, assignments);

      const matchesSearch =
        !q ||
        incident.incident_number.toLowerCase().includes(q) ||
        incident.description.toLowerCase().includes(q) ||
        incident.type.toLowerCase().includes(q) ||
        (incident.location_text ?? "").toLowerCase().includes(q);

      const matchesSeverity =
        severity === "ALL" || incident.severity === severity;

      const matchesStatus =
        status === "ALL" || operationalStatus === status;

      const matchesType = type === "ALL" || incident.type === type;

      const matchesLocation =
        location === "ALL" || incident.location_text === location;

      const matchesNeedsAction =
        !needsAction ||
        ["REPORTED", "VERIFIED", "ASSIGNED", "BACKUP_REQUESTED"].includes(
          operationalStatus,
        );

      return (
        matchesSearch &&
        matchesSeverity &&
        matchesStatus &&
        matchesType &&
        matchesLocation &&
        matchesNeedsAction
      );
    });

    result = [...result].sort((a, b) => {
      if (sortBy === "URGENCY") {
        return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      }

      if (sortBy === "NEWEST") {
        return (
          new Date(b.reported_at).getTime() -
          new Date(a.reported_at).getTime()
        );
      }

      if (sortBy === "OLDEST") {
        return (
          new Date(a.reported_at).getTime() -
          new Date(b.reported_at).getTime()
        );
      }

      if (sortBy === "PEOPLE_AFFECTED") {
        return b.people_affected - a.people_affected;
      }

      if (sortBy === "CONFIDENCE") {
        return b.confidence_score - a.confidence_score;
      }

      return 0;
    });

    return result;
  }, [
    incidents,
    assignments,
    search,
    severity,
    status,
    type,
    location,
    sortBy,
    needsAction,
  ]);

  const grouped = useMemo(() => {
    if (groupBy === "NONE") {
      return [["ALL", filtered]] as const;
    }

    const groups = new Map<string, OverviewIncident[]>();

    filtered.forEach((incident) => {
      let key = "";

      if (groupBy === "PRIORITY") {
        key = incident.severity;
      }

      if (groupBy === "STATUS") {
        key = formatStatus(getOperationalStatus(incident, assignments));
      }

      if (groupBy === "TYPE") {
        key = incident.type.replace(/_/g, " ");
      }

      if (groupBy === "LOCATION") {
        key = incident.location_text ?? "Unknown Location";
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(incident);
    });

    return Array.from(groups.entries());
  }, [filtered, groupBy, assignments]);

  const clearFilters = () => {
    setSearch("");
    setSeverity("ALL");
    setStatus("ALL");
    setType("ALL");
    setLocation("ALL");
    setSortBy("URGENCY");
    setGroupBy("NONE");
    setNeedsAction(false);
  };

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        

        <span className="text-xs text-muted">
          {filtered.length} of {incidents.length} incidents
        </span>
      </div>

      {/* Search */}
      <div className="mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ID, description, type or location..."
          className="w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
        />
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={severity}
          onChange={(e) =>
            setSeverity(e.target.value as IncidentSeverity | "ALL")
          }
          className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="ALL">All Priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as OverviewStatus | "ALL")
          }
          className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="ALL">All Statuses</option>

          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) =>
            setType(e.target.value as IncidentType | "ALL")
          }
          className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="ALL">All Types</option>
          <option value="FLOOD">Flood</option>
          <option value="FIRE">Fire</option>
          <option value="LANDSLIDE">Landslide</option>
          <option value="STRUCTURAL_COLLAPSE">
            Structural Collapse
          </option>
          <option value="MEDICAL_EMERGENCY">
            Medical Emergency
          </option>
          <option value="EARTHQUAKE">Earthquake</option>
          <option value="CYCLONE">Cyclone</option>
          <option value="OTHER">Other</option>
        </select>

        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="max-w-52 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="ALL">All Locations</option>

          {locations.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="URGENCY">Sort: Urgency</option>
          <option value="NEWEST">Sort: Newest</option>
          <option value="OLDEST">Sort: Oldest</option>
          <option value="PEOPLE_AFFECTED">
            Sort: People Affected
          </option>
          <option value="CONFIDENCE">Sort: Confidence</option>
        </select>

        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="NONE">Group: None</option>
          <option value="PRIORITY">Group: Priority</option>
          <option value="STATUS">Group: Status</option>
          <option value="TYPE">Group: Type</option>
          <option value="LOCATION">Group: Location</option>
        </select>

        <button
          onClick={() => setNeedsAction((value) => !value)}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            needsAction
              ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
              : "border-[var(--color-border)] bg-white"
          }`}
        >
          Needs Action
        </button>

        <button
          onClick={clearFilters}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-muted hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      {/* Incident list */}
      <div className="space-y-3">
        {grouped.map(([group, groupIncidents]) => (
          <div key={group}>
            {groupBy !== "NONE" && (
              <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                {group}
              </div>
            )}

            <div className="space-y-2">
              {groupIncidents.map((incident) => {
                const operationalStatus = getOperationalStatus(
                  incident,
                  assignments,
                );

                return (
                  <Link
                    key={incident.id}
                    href={`/dashboard/incidents?incident=${encodeURIComponent(
                      incident.id,
                    )}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm transition-colors hover:border-[var(--color-accent)] hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted">
                          {incident.incident_number}
                        </span>

                        <Badge
                          label={incident.severity}
                          color={incident.severity}
                        />

                        <span className="text-sm font-medium">
                          {incident.type.replace(/_/g, " ")}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-sm text-muted">
                        {incident.description}
                        {incident.location_text
                          ? ` · ${incident.location_text}`
                          : ""}
                      </p>

                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                        <span>
                          {incident.people_affected} affected
                        </span>

                        <span>
                          Confidence{" "}
                          {Math.round(incident.confidence_score * 100)}%
                        </span>
                      </div>

                      <time
                        dateTime={incident.reported_at}
                        className="mt-1 block text-[11px] text-muted"
                      >
                        Reported {new Date(incident.reported_at).toLocaleString()}
                      </time>
                    </div>

                    <div className="shrink-0">
                      <Badge
                        label={STATUS_LABELS[operationalStatus]}
                        color={
                          operationalStatus === "RESOLVED"
                            ? "LOW"
                            : operationalStatus === "BACKUP_REQUESTED"
                              ? "CRITICAL"
                              : incident.severity
                        }
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {!filtered.length && (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-muted">
            No incidents match the current filters.
          </div>
        )}
      </div>
    </section>
  );
}