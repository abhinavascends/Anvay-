import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OverviewIncidentQueue } from "@/components/dashboard/OverviewIncidentQueue";


export default async function DashboardPage() {
  const supabase = await createClient();

  const [incidents, assignments, teams, shelters] = await Promise.all([
  supabase
    .from("incidents")
    .select(
      "id, incident_number, severity, type, status, description, location_text, reported_at, people_affected, confidence_score"
    )
    .order("reported_at", { ascending: false })
    .limit(10),

  supabase.from("assignments").select("*"),

  supabase.from("resource_teams").select("status"),

  supabase.from("shelters").select("total_capacity, current_occupancy"),
]);

  const activeIncidents = (incidents.data ?? []).filter(
    (i) => !["RESOLVED", "CANCELLED"].includes(i.status)
  );
  const critical = activeIncidents.filter((i) => i.severity === "CRITICAL").length;
  const availableTeams = (teams.data ?? []).filter((t) => t.status === "AVAILABLE").length;
  const totalTeams = (teams.data ?? []).length;
  const shelterData = shelters.data ?? [];
  const occupancy = shelterData.reduce((s, x) => s + x.current_occupancy, 0);
  const capacity = shelterData.reduce((s, x) => s + x.total_capacity, 0);
  const utilization = capacity > 0 ? Math.round((occupancy / capacity) * 100) : 0;

  const stats = [
    { label: "Active Incidents", value: activeIncidents.length, tone: critical > 0 ? "text-[var(--color-critical)]" : "" },
    { label: "Critical", value: critical, tone: "text-[var(--color-critical)]" },
    {
      label: "Teams Available",
      value: `${availableTeams}/${totalTeams}`,
      tone: "",
    },
    { label: "Shelter Utilization", value: `${utilization}%`, tone: utilization > 80 ? "text-[var(--color-high)]" : "" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Situation Overview</h1>
        <Link
          href="/dashboard/map"
          className="inline-flex h-10 items-center rounded-lg bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:bg-blue-800"
        >
          Open Live Map →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-muted">
              {s.label}
            </div>
            <div className={`mt-1 text-3xl font-bold ${s.tone}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <h1 className="mb-3 mt-8 text-lg font-semibold">Recent Incidents</h1>
      <OverviewIncidentQueue
  incidents={incidents.data ?? []}
  assignments={assignments.data ?? []}
/>
      
    </div>
  );
}
