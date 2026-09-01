"use client";

import { useLiveData } from "@/hooks/useLiveData";
import { ShelterPanel } from "../ShelterPanel";

export function SheltersPage() {
  const { shelters, refresh } = useLiveData();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Relief Shelters</h1>
      <ShelterPanel shelters={shelters} onUpdated={refresh} />
    </div>
  );
}
