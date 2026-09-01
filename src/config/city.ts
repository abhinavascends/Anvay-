// ============================================================
// RakshaSetu — District configuration
//
// Change these values to redeploy the platform for another city.
// After editing:
//   1. Run supabase/seed.sql (it clears old demo data first)
//   2. Update the simulation scenario coords in lib/simulation.ts
//      if you script demos for the new district
// ============================================================

export const CITY = {
  name: "Rourkela",
  district: "Sundargarh District",
  // Rourkela steel city center (near Sector 3 / clock tower)
  latitude: 22.2604,
  longitude: 84.8536,
} as const;

export const CITY_CENTER: [number, number] = [CITY.latitude, CITY.longitude];

// Fallback incident location when SMS reports omit coordinates
export const DEFAULT_REPORT_LOCATION = {
  latitude: CITY.latitude,
  longitude: CITY.longitude,
};
