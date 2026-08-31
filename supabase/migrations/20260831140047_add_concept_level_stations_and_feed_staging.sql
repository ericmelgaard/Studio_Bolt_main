/*
# Add concept-level station inheritance and feed station staging

## Purpose
Allows meal stations to be defined at the concept level and inherited by all stores under that concept.
Also supports station names discovered in the Webtrition data feed appearing as suggestions before formal adoption.

## Changes

### 1. stations table — new columns
- `concept_id bigint REFERENCES concepts(id)` — when set, this station is a concept-level definition inherited by all stores under that concept. NULL means it is a store-level station.
- `source text DEFAULT 'manual'` — tracks where the station came from: 'manual' (typed by a user), 'feed' (from Webtrition integration), or 'inherited' (selected from concept-level list by a store).
- `is_active boolean DEFAULT true` — allows hiding a station without deleting it.

### 2. New table: feed_station_names
Staging area for station names discovered in the Webtrition feed. These are suggestions only — they do not become active stations until a user selects them from the combobox.
- `id uuid PRIMARY KEY`
- `store_id bigint REFERENCES stores(id) ON DELETE CASCADE` — which location's feed produced this name
- `name text NOT NULL` — the station name from the feed
- `integration_source_id bigint` — which integration source provided it (nullable for flexibility)
- `discovered_at timestamptz DEFAULT now()` — when the feed last reported this name
- `adopted boolean DEFAULT false` — set to true when a user picks this name and creates a station from it
- Unique constraint on (store_id, name) so each feed name appears once per location

### 3. RLS
- stations: anon/authenticated can SELECT; anon/authenticated can INSERT/UPDATE/DELETE (single-tenant demo app, consistent with existing open policies)
- feed_station_names: same open CRUD for anon/authenticated

## Notes
1. Existing stations with store_id=NULL are effectively concept-level already — they have no concept_id set yet but remain visible to all stores (no behavior change).
2. The migration is idempotent: uses IF NOT EXISTS for all column additions and table creation.
3. Policies are dropped-then-recreated for idempotency.
*/

-- Add concept_id column to stations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'concept_id'
  ) THEN
    ALTER TABLE stations ADD COLUMN concept_id bigint REFERENCES concepts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add source column to stations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'source'
  ) THEN
    ALTER TABLE stations ADD COLUMN source text NOT NULL DEFAULT 'manual';
  END IF;
END $$;

-- Add is_active column to stations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE stations ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Create feed_station_names staging table
CREATE TABLE IF NOT EXISTS feed_station_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id bigint REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  integration_source_id bigint,
  discovered_at timestamptz DEFAULT now(),
  adopted boolean NOT NULL DEFAULT false,
  UNIQUE(store_id, name)
);

ALTER TABLE feed_station_names ENABLE ROW LEVEL SECURITY;

-- RLS for feed_station_names (open access, consistent with other tables in this app)
DROP POLICY IF EXISTS "Anyone can view feed station names" ON feed_station_names;
CREATE POLICY "Anyone can view feed station names" ON feed_station_names
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can insert feed station names" ON feed_station_names;
CREATE POLICY "Anyone can insert feed station names" ON feed_station_names
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update feed station names" ON feed_station_names;
CREATE POLICY "Anyone can update feed station names" ON feed_station_names
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete feed station names" ON feed_station_names;
CREATE POLICY "Anyone can delete feed station names" ON feed_station_names
  FOR DELETE TO anon, authenticated USING (true);

-- Update stations RLS to include anon on INSERT/UPDATE/DELETE (was authenticated-only)
DROP POLICY IF EXISTS "Anyone can view stations" ON stations;
CREATE POLICY "Anyone can view stations" ON stations
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can insert stations" ON stations;
CREATE POLICY "Anyone can insert stations" ON stations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update stations" ON stations;
CREATE POLICY "Anyone can update stations" ON stations
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete stations" ON stations;
CREATE POLICY "Anyone can delete stations" ON stations
  FOR DELETE TO anon, authenticated USING (true);

-- Index for faster concept-level station lookups
CREATE INDEX IF NOT EXISTS idx_stations_concept_id ON stations(concept_id) WHERE concept_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stations_store_id ON stations(store_id) WHERE store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feed_station_names_store_id ON feed_station_names(store_id);
