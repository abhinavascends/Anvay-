"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import type { Shelter } from "@/types/database";

export function ShelterPanel({
  shelters,
  onUpdated,
}: {
  shelters: Shelter[];
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState(0);
  const [busy, setBusy] = useState(false);

  async function save(shelterId: string) {
    setBusy(true);
    await createClient()
      .from("shelters")
      .update({ current_occupancy: value })
      .eq("id", shelterId);
    setBusy(false);
    setEditing(null);
    onUpdated();
  }

  return (
    <div>
      <h3 className="mb-2 px-1 text-sm font-semibold">Relief Shelters</h3>

      {shelters.map((s) => {
        const pct = Math.round((s.current_occupancy / s.total_capacity) * 100);
        return (
          <div
            key={s.id}
            className="mb-2 rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <b className="truncate">{s.name}</b>
              <Badge label={s.status} color={s.status} />
            </div>

            <div className="mt-2 flex items-center gap-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${
                    pct >= 90 ? "bg-red-500" : pct >= 50 ? "bg-amber-500" : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-xs text-muted">
                {s.current_occupancy}/{s.total_capacity} ({pct}%)
              </span>
            </div>

            {editing === s.id ? (
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={s.total_capacity}
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                  className="h-8 w-24 rounded-lg border border-[var(--color-border)] px-2 text-sm"
                />
                <button
                  disabled={busy}
                  onClick={() => save(s.id)}
                  className="rounded-md bg-[var(--color-accent)] px-3 text-xs font-medium text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-md px-2 text-xs text-muted hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditing(s.id);
                  setValue(s.current_occupancy);
                }}
                className="mt-2 text-xs font-medium text-[var(--color-accent)] hover:underline"
              >
                Update occupancy
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
