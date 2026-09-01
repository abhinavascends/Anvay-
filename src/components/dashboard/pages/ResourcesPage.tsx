"use client";

import { useState } from "react";
import { useLiveData } from "@/hooks/useLiveData";
import { ResourcePanel, type ReallocRec } from "./../ResourcePanel";

export function ResourcesPage() {
  const { teams, refresh } = useLiveData();
  const [reallocations, setReallocations] = useState<ReallocRec[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
        setToast("System reallocated the orphaned incident!");
        setTimeout(() => setToast(null), 4000);
      }
      refresh();
      return json as { reallocations: ReallocRec[] | null };
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Update failed");
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Rescue Teams</h1>
      <ResourcePanel
        teams={teams}
        onStatusChange={changeTeamStatus}
        reallocations={reallocations}
      />
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[2000] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
