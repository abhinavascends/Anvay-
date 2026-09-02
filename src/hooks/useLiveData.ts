"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type {
  Alert,
  Assignment,
  Incident,
  ResourceTeam,
  Shelter,
} from "@/types/database";

export interface LiveData {
  incidents: Incident[];
  teams: ResourceTeam[];
  shelters: Shelter[];
  assignments: Assignment[];
  alerts: Alert[];
  connected: boolean;
  initialLoading: boolean;
  refresh: () => void;
  syncAlerts: () => Promise<void>;
}

type ChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

// Every hook instance needs its own topic - reusing a channel name
// returns the already-subscribed channel and adding callbacks to it
// throws "cannot add postgres_changes after subscribe()".
let channelSeq = 0;

// Loads all operational data once and then keeps it in sync via
// Supabase Realtime (postgres_changes) - no polling needed.
export function useLiveData(): LiveData {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [teams, setTeams] = useState<ResourceTeam[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connected, setConnected] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchAll = useCallback(async () => {
    const supabase = createClient();
    const [inc, tm, sh, asg] = await Promise.all([
      supabase.from("incidents").select("*").order("reported_at", { ascending: false }),
      supabase.from("resource_teams").select("*").order("team_code"),
      supabase.from("shelters").select("*").order("name"),
      supabase
        .from("assignments")
        .select("*")
        .order("assigned_at", { ascending: false })
        .limit(200),
    ]);
    if (inc.data) setIncidents(inc.data);
    if (tm.data) setTeams(tm.data);
    if (sh.data) setShelters(sh.data);
    if (asg.data) setAssignments(asg.data);

    const { data: al } = await supabase
      .from("alerts")
      .select("*")
      .eq("is_active", true)
      .order("effective_from", { ascending: false });
    setAlerts(al ?? []);
    setInitialLoading(false);
  }, []);

  // Pull IMD warnings (falls back to labelled demo data if API unavailable)
  const syncAlerts = useCallback(async () => {
    await fetch("/api/alerts/sync", { method: "POST" });
    const supabase = createClient();
    const { data } = await supabase
      .from("alerts")
      .select("*")
      .eq("is_active", true)
      .order("effective_from", { ascending: false });
    setAlerts(data ?? []);
  }, []);

  useEffect(() => {
    // Initial load (setState fires after awaits, never synchronously)
    void (async () => {
      await fetchAll();
    })();

    const supabase = createClient();
    const channel = supabase
      .channel(`ops-live-${++channelSeq}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        (payload: ChangePayload) => applyChange(setIncidents, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resource_teams" },
        (payload: ChangePayload) => applyChange(setTeams, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shelters" },
        (payload: ChangePayload) => applyChange(setShelters, payload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments" },
        (payload: ChangePayload) => {
          applyChange(setAssignments, payload);
          if (
            (payload.eventType === "UPDATE" || payload.eventType === "DELETE") &&
            !isActiveAssignment(payload.new as Assignment)
          ) {
            void fetchAll();
          }
        }
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [fetchAll]);

  return {
    incidents,
    teams,
    shelters,
    assignments,
    alerts,
    connected,
    initialLoading,
    refresh: fetchAll,
    syncAlerts,
  };
}

function applyChange<T extends { id: string }>(
  setter: (updater: (prev: T[]) => T[]) => void,
  payload: ChangePayload
) {
  setter((prev) => {
    switch (payload.eventType) {
      case "INSERT": {
        const row = payload.new as T;
        return prev.some((r) => r.id === row.id)
          ? prev.map((r) => (r.id === row.id ? row : r))
          : [row, ...prev];
      }
      case "UPDATE": {
        const row = payload.new as T;
        return prev.map((r) => (r.id === row.id ? { ...r, ...row } : r));
      }
      case "DELETE": {
        const old = payload.old as { id?: string };
        return prev.filter((r) => r.id !== old?.id);
      }
      default:
        return prev;
    }
  });
}

export function isActiveAssignment(a: Assignment): boolean {
  return ["PENDING", "ACKNOWLEDGED", "EN_ROUTE", "ON_SCENE"].includes(a.status);
}
