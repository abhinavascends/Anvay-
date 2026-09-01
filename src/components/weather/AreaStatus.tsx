"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { haversineKm } from "@/lib/allocation";
import { CITY_CENTER } from "@/config/city";
import type { Alert, Incident, Shelter } from "@/types/database";

const WMO: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Showers",
  82: "Violent showers",
  85: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm + hail",
  99: "Severe thunderstorm",
};

interface Weather {
  temp: number;
  humidity: number;
  rainNow: number;
  wind: number;
  code: number;
  rainToday: number;
}

type Risk = { level: string; cls: string; note: string };

function assessRisk(w: Weather | null): Risk {
  if (!w) return { level: "—", cls: "bg-gray-100 text-gray-500", note: "" };
  const p = Math.max(w.rainToday ?? 0, (w.rainNow ?? 0) * 12);
  if (p >= 204.4 || w.wind >= 118)
    return {
      level: "EXTREME",
      cls: "bg-red-600 text-white",
      note: "Extremely heavy rainfall expected. Avoid travel, move to higher ground.",
    };
  if (p >= 115.6 || w.wind >= 90)
    return {
      level: "SEVERE",
      cls: "bg-red-100 text-red-700",
      note: "Heavy rainfall likely. Flooding possible in low-lying areas.",
    };
  if (p >= 64.5 || w.wind >= 62)
    return {
      level: "ALERT",
      cls: "bg-orange-100 text-orange-700",
      note: "Heavy showers expected today. Keep emergency numbers handy.",
    };
  if (p >= 15.6 || w.wind >= 40)
    return {
      level: "WATCH",
      cls: "bg-amber-50 text-amber-700",
      note: "Moderate rain/wind today. Plan around waterlogging-prone routes.",
    };
  return {
    level: "NORMAL",
    cls: "bg-green-50 text-green-700",
    note: "No significant weather threat right now.",
  };
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const l1 = (lat1 * Math.PI) / 180;
  const l2 = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(l2);
  const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLng);
  return dirs[Math.round((((Math.atan2(y, x) * 180) / Math.PI + 360) % 360) / 45) % 8];
}

export function AreaStatus({
  incidents,
  shelters,
}: {
  incidents?: Incident[];
  shelters?: Shelter[];
}) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [alertsNearby, setAlertsNearby] = useState<Alert[]>([]);

  // Location (silent best-effort; falls back to district centre)
  useEffect(() => {
    void (async () => {
      const fallback = { lat: CITY_CENTER[0], lng: CITY_CENTER[1] };
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => {
          if (!navigator.geolocation) return rej(new Error("no geo"));
          navigator.geolocation.getCurrentPosition(res, rej, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 300000,
          });
        });
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        setCoords(fallback);
        setLocError("Using district centre - allow location for precise info");
      }
    })();
  }, []);

  // Reverse-geocode coords -> human-readable place name (best-effort)
  useEffect(() => {
    if (!coords) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lng}&localityLanguage=en`
        );
        const j = await res.json();
        const name =
          [j.city || j.locality, j.principalSubdivision]
            .filter(Boolean)
            .join(", ") || null;
        if (alive) setPlaceName(name);
      } catch {
        /* naming is cosmetic - fall back to generic title */
      }
    })();
    return () => {
      alive = false;
    };
  }, [coords]);

  // Weather + official alerts for the area
  useEffect(() => {
    if (!coords) return;
    void (async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}` +
            "&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m" +
            "&daily=precipitation_sum&forecast_days=1&timezone=Asia%2FKolkata"
        );
        const j = await res.json();
        if (j?.current) {
          setWeather({
            temp: j.current.temperature_2m,
            humidity: j.current.relative_humidity_2m,
            rainNow: j.current.precipitation ?? 0,
            wind: j.current.wind_speed_10m ?? 0,
            code: j.current.weather_code ?? 0,
            rainToday: j?.daily?.precipitation_sum?.[0] ?? 0,
          });
        }
      } catch {
        /* weather is best-effort */
      }
      try {
        const { data } = await createClient()
          .from("alerts")
          .select("*")
          .eq("is_active", true)
          .order("effective_from", { ascending: false })
          .limit(10);
        setAlertsNearby(data ?? []);
      } catch {
        /* alerts need auth - skip silently for guests */
      }
    })();
  }, [coords]);

  const risk = assessRisk(weather);

  const activeNear =
    coords && incidents
      ? incidents.filter(
          (i) =>
            !["RESOLVED", "CANCELLED"].includes(i.status) &&
            haversineKm(coords.lat, coords.lng, i.latitude, i.longitude) <= 5
        )
      : [];
  const sheltersNear =
    coords && shelters
      ? shelters
          .map((s) => ({
            s,
            km: haversineKm(coords.lat, coords.lng, s.latitude, s.longitude),
          }))
          .sort((a, b) => a.km - b.km)
          .slice(0, 3)
      : [];

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm sm:p-5">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
            {placeName ?? "Your Area Status"}
          </h2>
          <p className="mt-0.5 truncate text-xs text-muted">
            {coords
              ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}${locError ? " · " + locError : ""}`
              : "Detecting location…"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-wide ${risk.cls}`}
        >
          {risk.level}
        </span>
      </div>

      {/* Weather strip */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {weather ? (
          [
            ["Conditions", WMO[weather.code] ?? "Unknown"],
            ["Temperature", `${Math.round(weather.temp)}°C`],
            ["Rain now", `${weather.rainNow} mm/h`],
            ["Wind", `${Math.round(weather.wind)} km/h`],
          ].map(([label, val]) => (
            <div key={label} className="rounded-xl bg-gray-50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {label}
              </div>
              <div className="truncate text-sm font-bold">{val}</div>
            </div>
          ))
        ) : (
          [0, 1, 2, 3].map((n) => (
            <div key={n} className="h-14 animate-pulse rounded-xl bg-gray-100" />
          ))
        )}
      </div>
      {weather && (
        <p className="mt-2 text-xs leading-relaxed text-muted">{risk.note}</p>
      )}

      {/* Nearby threats (only when data provided) */}
      {incidents && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Active incidents within 5 km
          </div>
          {activeNear.length === 0 ? (
            <p className="mt-1 text-xs text-muted">None reported nearby.</p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {activeNear.slice(0, 4).map((i) => (
                <li key={i.id} className="flex items-center justify-between text-xs">
                  <span className="truncate pr-2">
                    <b>{i.type.replace(/_/g, " ")}</b> · {i.people_affected} people
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-muted">
                    {coords
                      ? `${haversineKm(coords.lat, coords.lng, i.latitude, i.longitude).toFixed(1)} km ${bearing(coords.lat, coords.lng, i.latitude, i.longitude)}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {alertsNearby.length > 0 && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Official warnings
          </div>
          <ul className="mt-1.5 space-y-1">
            {alertsNearby.slice(0, 2).map((a) => (
              <li key={a.id} className="text-xs font-medium">
                {a.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {shelters && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Nearest relief shelters
          </div>
          {sheltersNear.length === 0 ? (
            <p className="mt-1 text-xs text-muted">No shelter data available.</p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {sheltersNear.map(({ s, km }) => {
                const pct = Math.min(
                  100,
                  Math.round((s.current_occupancy / s.total_capacity) * 100)
                );
                return (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate pr-2">
                      {s.name}
                      <span className="ml-1.5 text-muted">
                        ({s.current_occupancy}/{s.total_capacity})
                        {pct >= 90 ? " · almost full" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-muted">
                      {km.toFixed(1)} km{" "}
                      {bearing(
                        coords?.lat ?? 0,
                        coords?.lng ?? 0,
                        s.latitude,
                        s.longitude
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
