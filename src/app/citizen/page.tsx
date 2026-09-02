"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLiveData } from "@/hooks/useLiveData";
import { AreaStatus } from "@/components/weather/AreaStatus";
import { SignOutButton } from "@/components/layout/SignOutButton";
import type { Alert, Incident, Shelter } from "@/types/database";
import { Logo } from "@/components/ui/Logo";

const ALERT_COLORS: Record<string, { bar: string; bg: string; text: string }> = {
  EXTREME: { bar: "#dc2626", bg: "bg-red-50", text: "text-red-700" },
  SEVERE: { bar: "#ea580c", bg: "bg-orange-50", text: "text-orange-700" },
  MODERATE: { bar: "#d97706", bg: "bg-amber-50", text: "text-amber-700" },
  MINOR: { bar: "#16a34a", bg: "bg-green-50", text: "text-green-700" },
};

const STATUS_CHIPS: Record<string, { label: string; cls: string }> = {
  REPORTED: { label: "Submitted", cls: "bg-gray-100 text-gray-600" },
  VALIDATED: { label: "Verified", cls: "bg-blue-50 text-blue-700" },
  UNASSIGNED: { label: "Awaiting team", cls: "bg-amber-50 text-amber-700" },
  ASSIGNED: { label: "Help dispatched", cls: "bg-blue-50 text-blue-700" },
  EN_ROUTE: { label: "Team on the way", cls: "bg-indigo-50 text-indigo-700" },
  ON_SCENE: { label: "Team on scene", cls: "bg-purple-50 text-purple-700" },
  RESOLVED: { label: "Resolved ✓", cls: "bg-green-50 text-green-700" },
  ESCALATED: { label: "Escalated", cls: "bg-red-50 text-red-700" },
  CANCELLED: { label: "Closed", cls: "bg-gray-100 text-gray-500" },
};

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200/70 ${className ?? ""}`} />;
}

export default function CitizenDashboard() {
  const { incidents, shelters, alerts, connected, initialLoading, refresh } =
    useLiveData();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setUserName(user.user_metadata?.name ?? user.email?.split("@")[0] ?? "");
    })();
  }, []);

  const myReports = userId
    ? incidents.filter((i) => i.reporter_id === userId)
: [];
  const openReports = myReports.filter(
    (i) => !["RESOLVED", "CANCELLED"].includes(i.status)
  );
  const topAlerts = alerts.slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo size={48} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold leading-tight">
                Anvay
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    connected ? "bg-green-500": "bg-amber-400"
                  }`}
                />
                <span className="truncate">
                  {!connected
                    ? "Reconnecting…"
: userName
                      ? `Live · Hi, ${userName}`
: "Live"}
                </span>
              </div>
            </div>
          </div>
          <SignOutButton
            label="Sign out"
            className="shrink-0 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-medium text-muted transition-colors hover:bg-gray-50 hover:text-foreground disabled:opacity-60 sm:text-sm"
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6 sm:pt-7">
        {/* Area status: weather + nearby threats */}
        <div className="mb-7">
          <AreaStatus incidents={incidents} shelters={shelters} />
        </div>

        {/* Alerts */}
        {initialLoading ? (
          <Skeleton className="mb-5 h-[72px] rounded-xl" />
        ): topAlerts.length > 0 ? (
          <section
            className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Active warnings"
          >
            {topAlerts.map((a: Alert) => {
              const c = ALERT_COLORS[a.severity] ?? ALERT_COLORS.MODERATE;
              return (
                <div
                  key={a.id}
                  className={`flex gap-3 rounded-xl p-3.5 ${c.bg} transition-transform hover:-translate-y-px`}
                  style={{ borderLeft: `4px solid ${c.bar}` }}
                >
                    <div className="min-w-0">
                    <div className={`text-sm font-semibold leading-snug ${c.text}`}>
                      {a.title}
                    </div>
                    {a.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                        {a.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        ): null}

        {/* Primary actions */}
        <section className="mb-8 grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Link
            href="/report"
            className="group flex items-center justify-between gap-4 rounded-2xl bg-[var(--color-primary)] px-5 py-5 text-white shadow-md transition-all hover:bg-[var(--color-primary-dark)] hover:shadow-lg active:scale-[0.99] sm:px-7"
          >
            <div>
              <div className="text-lg font-bold sm:text-xl">
                Report an Emergency
              </div>
              <div className="mt-0.5 text-xs opacity-80 sm:text-sm">
                Flood · Fire · Medical — takes under a minute
              </div>
            </div>
            
          </Link>
          <a
            href="tel:112"
            className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-5 py-4 text-sm font-semibold text-[var(--color-primary)] shadow-sm transition-colors hover:bg-red-50 active:scale-[0.99]"
          >
            Call helpline 112
          </a>
        </section>

        {/* Content grid */}
        <div className="grid items-start gap-8 lg:grid-cols-[3fr_2fr]">
          {/* My reports */}
          <section aria-label="My reports">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
                My Reports{" "}
                {myReports.length > 0 && (
                  <span className="ml-1 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                    {openReports.length} open
                  </span>
                )}
              </h2>
              {myReports.length > 0 && (
                <button
                  onClick={() => refresh()}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-blue-50"
                >
                  ↻ Refresh
                </button>
              )}
            </div>

            {initialLoading || !userId ? (
              <ul className="space-y-2.5">
                {[0, 1, 2].map((n) => (
                  <li key={n} className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-1/3" />
                    <Skeleton className="mt-3 h-3 w-full" />
                  </li>
                ))}
              </ul>
            ): myReports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white p-8 text-center">
                
                <p className="mt-2 text-sm font-medium">No reports yet</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">
                  When you report an emergency it appears here with live status
                  updates as response teams act on it.
                </p>
                <Link
                  href="/report"
                  className="mt-4 inline-flex h-10 items-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
                >
                  Make your first report
                </Link>
              </div>
            ): (
              <ul className="space-y-2.5">
                {myReports.slice(0, 10).map((r: Incident) => {
                  const chip = STATUS_CHIPS[r.status] ?? STATUS_CHIPS.REPORTED;
                  return (
                    <li
                      key={r.id}
                      className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            <span className="mr-1" aria-hidden>
                              
                            </span>
                            {r.location_text ?? r.type.replace(/_/g, " ")}
                          </div>
                          <div className="mt-0.5 text-xs text-muted">
                            <span className="font-mono">{r.incident_number}</span>{" "}
                            · {timeAgo(r.reported_at)} · {r.people_affected}{" "}
                            {r.people_affected === 1 ? "person": "people"}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${chip.cls}`}
                        >
                          {chip.label}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
                        {r.description}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Shelters */}
          <section aria-label="Relief shelters">
            <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wider text-muted">
              Relief Shelters
            </h2>
            {initialLoading ? (
              <ul className="space-y-2.5">
                {[0, 1].map((n) => (
                  <li key={n} className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                    <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
                  </li>
                ))}
              </ul>
            ): shelters.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white p-6 text-center text-sm text-muted">
                No shelter information available right now.
              </div>
            ): (
              <ul className="space-y-2.5">
                {shelters.map((s: Shelter) => {
                  const pct = Math.min(
                    100,
                    Math.round((s.current_occupancy / s.total_capacity) * 100)
                  );
                  const color =
                    pct >= 90 ? "#dc2626": pct >= 50 ? "#d97706": "#16a34a";
                  const closed = s.status === "CLOSED";
                  return (
                    <li
                      key={s.id}
                      className={`rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
                        closed ? "opacity-55": ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {s.name}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted">
                            {s.address}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            closed
                              ? "bg-gray-100 text-gray-500"
: pct >= 90
                                ? "bg-red-50 text-red-700"
: pct >= 50
                                  ? "bg-amber-50 text-amber-700"
: "bg-green-50 text-green-700"
                          }`}
                        >
                          {closed
                            ? "Closed"
: pct >= 90
                              ? "Almost full"
: pct >= 50
                                ? "Filling"
: "Open"}
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${closed ? 0: pct}%`, background: color }}
                          />
                        </div>
                        <span className="text-[11px] font-medium tabular-nums text-muted">
                          {s.current_occupancy}/{s.total_capacity}
                        </span>
                      </div>
                      {s.contact_phone && !closed && (
                        <a
                          href={`tel:${s.contact_phone}`}
                          className="mt-2 inline-block rounded-lg px-1 py-0.5 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-blue-50"
                        >
                          {s.contact_phone}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
