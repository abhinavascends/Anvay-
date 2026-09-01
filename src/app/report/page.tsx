"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = [
  { value: "FLOOD", label: "Flood", icon: "" },
  { value: "FIRE", label: "Fire", icon: "" },
  { value: "LANDSLIDE", label: "Landslide", icon: "" },
  { value: "STRUCTURAL_COLLAPSE", label: "Collapse", icon: "" },
  { value: "MEDICAL_EMERGENCY", label: "Medical", icon: "" },
  { value: "EARTHQUAKE", label: "Earthquake", icon: "" },
  { value: "CYCLONE", label: "Cyclone", icon: "" },
  { value: "OTHER", label: "Other", icon: "" },
] as const;

type Step = 1 | 2 | 3;

export default function ReportPage() {
  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [people, setPeople] = useState(1);
  const [photo, setPhoto] = useState<File | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [landmark, setLandmark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incidentNumber, setIncidentNumber] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      setSignedIn(!!user);
    })();
  }, []);

  function detectLocation() {
    if (!navigator.geolocation) {
      setError("Location not supported on this device");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setError("Could not get location - check permissions");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit() {
    setError(null);

    if (!coords) {
      setError("Please detect your location first");
      return;
    }
    if (description.trim().length < 5) {
      setError("Please describe the situation");
      return;
    }

    setSubmitting(true);
    try {
      let photoUrl: string | null = null;

      if (photo) {
        const supabase = createClient();
        const ext = photo.name.split(".").pop() ?? "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
.from("incident-photos")
.upload(path, photo);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("incident-photos").getPublicUrl(path);
        photoUrl = data.publicUrl;
      }

      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: category || "OTHER",
          description: description.trim(),
          latitude: coords.lat,
          longitude: coords.lng,
          location_text: landmark.trim() || null,
          people_affected: people,
          photo_url: photoUrl,
          source: "APP",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not submit report");

      setIncidentNumber(json.incident.incident_number);
    } catch (e) {
      setError(e instanceof Error ? e.message: "Could not submit report");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Success ----------
  if (incidentNumber) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold">Help is on the way</h1>
        <p className="mt-2 text-muted">
          Your report has been sent to the response team.
        </p>
        <div className="mt-6 w-full rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted">
            Your report number
          </div>
          <div className="mt-1 font-mono text-2xl font-bold">{incidentNumber}</div>
        </div>
        <p className="mt-4 text-sm text-muted">
          {signedIn
            ? "Track its status anytime from your dashboard."
: "Save this number — you reported as a guest, so show it to any responder to check progress."}
        </p>
        {signedIn ? (
          <Link
            href="/citizen"
            className="mt-8 inline-flex h-12 w-full max-w-xs items-center justify-center rounded-xl bg-[var(--color-primary)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] active:scale-[0.99]"
          >
            Go to my dashboard
          </Link>
        ): (
          <>
            <Link
              href="/register"
              className="mt-8 inline-flex h-12 w-full max-w-xs items-center justify-center rounded-xl bg-[var(--color-primary)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] active:scale-[0.99]"
            >
              Create an account to track live
            </Link>
            <Link
              href="/"
              className="mt-3 inline-flex h-11 w-full max-w-xs items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-sm font-medium hover:bg-gray-50"
            >
              Back to home
            </Link>
          </>
        )}
      </main>
    );
  }

  // ---------- Wizard ----------
  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-12 pt-4 sm:px-6 sm:pt-10">
      <header className="sticky top-0 z-20 -mx-4 mb-6 flex items-center gap-3 border-b border-transparent bg-gray-50/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Link href="/" aria-label="Back" className="rounded-lg px-2 py-1 text-xl text-muted transition-colors hover:bg-gray-200/70 hover:text-foreground">
          ←
        </Link>
        <h1 className="text-lg font-bold">Report an Emergency</h1>
      </header>

      {/* Progress dots */}
      <div className="mb-6 flex items-center gap-2 px-1">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${
              s <= step ? "bg-[var(--color-primary)]": "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Category */}
      {step === 1 && (
        <section>
          <h2 className="mb-1 text-xl font-bold">What is happening?</h2>
          <p className="mb-4 text-sm text-muted">Pick the closest match</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => {
                  setCategory(c.value);
                  setStep(2);
                }}
                className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 bg-white p-3 shadow-sm transition-all hover:border-gray-300 active:scale-[0.97] ${
                  category === c.value
                    ? "border-[var(--color-primary)]"
: "border-transparent"
                }`}
              >
                <span className="text-3xl">{c.icon}</span>
                <span className="text-xs font-medium">{c.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Tell us more</h2>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Describe the situation - what do you see? How many people need help?"
            className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-white p-4 text-base focus:outline-2 focus:outline-[var(--color-primary)]"
          />

          <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-sm font-medium">People who need help</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setPeople((p) => Math.max(1, p - 1))}
                className="h-9 w-9 rounded-full border border-[var(--color-border)] text-lg hover:bg-gray-50"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-bold">{people}</span>
              <button
                onClick={() => setPeople((p) => Math.min(999, p + 1))}
                className="h-9 w-9 rounded-full border border-[var(--color-border)] text-lg hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          <label className="mt-4 block cursor-pointer rounded-xl border-2 border-dashed border-[var(--color-border)] bg-white p-6 text-center shadow-sm">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
            {photo ? (
              <span className="text-sm font-medium text-green-600">
                 Photo attached ({photo.name.slice(0, 24)})
              </span>
            ): (
              <span className="text-sm text-muted">
                 Add a photo <span className="text-xs">(optional)</span>
              </span>
            )}
          </label>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-sm font-medium transition-colors hover:bg-gray-50 active:scale-[0.99]"
            >
              Back
            </button>
            <button
              onClick={() => description.trim().length >= 5 && setStep(3)}
              disabled={description.trim().length < 5}
              className="inline-flex h-12 flex-[2] items-center justify-center rounded-xl bg-[var(--color-accent)] text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </section>
      )}

      {/* Step 3: Location */}
      {step === 3 && (
        <section>
          <h2 className="mb-1 text-xl font-bold">Where are you?</h2>
          <p className="mb-4 text-sm text-muted">
            We use GPS only while you report
          </p>

          <button
            onClick={detectLocation}
            className={`w-full rounded-xl border-2 p-5 text-left transition-colors ${
              coords
                ? "border-green-400 bg-green-50"
: "border-dashed border-[var(--color-accent)] bg-blue-50/50"
            }`}
          >
            {locating ? (
              <span className="text-sm font-medium"> Detecting location...</span>
            ): coords ? (
              <>
                <span className="block text-sm font-semibold text-green-700">
                   Location detected
                </span>
                <span className="text-xs text-muted">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </span>
              </>
            ): (
              <>
                <span className="block text-sm font-semibold text-[var(--color-accent)]">
                   Detect my location
                </span>
                <span className="text-xs text-muted">Tap to allow GPS access</span>
              </>
            )}
          </button>

          <input
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            placeholder="Nearby landmark (e.g. near ward 12 bridge)"
            className="mt-4 w-full rounded-xl border border-[var(--color-border)] bg-white p-4 text-base focus:outline-2 focus:outline-[var(--color-primary)]"
          />

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-[var(--color-primary)]">
              {error}
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-sm font-medium transition-colors hover:bg-gray-50 active:scale-[0.99]"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !coords}
              className="inline-flex h-12 flex-[2] items-center justify-center rounded-xl bg-[var(--color-primary)] text-base font-bold text-white transition-all hover:bg-[var(--color-primary-dark)] active:scale-[0.99] disabled:opacity-40"
            >
              {submitting ? "Sending...": " SEND REPORT"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
