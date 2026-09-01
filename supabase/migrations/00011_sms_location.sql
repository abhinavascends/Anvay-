ALTER TABLE public.incidents
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL;

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS location_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS location_source TEXT,
  ADD COLUMN IF NOT EXISTS location_accuracy_m DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

ALTER TABLE public.incidents
  ADD CONSTRAINT incidents_location_status_check
  CHECK (
    location_status IN (
      'PENDING',
      'GPS_CONFIRMED',
      'GEOCODED_APPROXIMATE',
      'LANDMARK_ONLY'
    )
  );