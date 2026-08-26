/*
# Expand Stations Table and Create Station Schedules

1. Modified Tables
   - `stations`
     - `store_id` (bigint, references stores.id) - Which location this station belongs to
     - `placement_group_id` (uuid, references placement_groups.id) - Links station to physical display group
     - `description` (text) - Optional description
     - `uses_cycle` (boolean) - Whether this station participates in the location's cycle rotation
     - `status` (text) - 'active', 'inactive'
     - `sort_order` (integer) - Display ordering

2. New Tables
   - `station_schedules`
     - `id` (uuid, primary key)
     - `station_id` (integer, references stations.id) - Which station
     - `brand_id` (bigint, references concepts.id) - Which brand runs at this station
     - `cycle_week` (integer) - Which week of the cycle (null = every week / static)
     - `days_of_week` (integer array) - Which days this brand is active [0=Sun..6=Sat]
     - `is_active` (boolean) - Toggle on/off without deleting
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

3. Security
   - RLS on station_schedules
   - Public read/write (no-auth pattern)

4. Important Notes
   - The station table already exists with (id, name, created_at). We add columns for location binding and scheduling participation.
   - station_schedules is the core scheduling record: "This station shows this brand on these days of this cycle week."
   - For static stations, cycle_week is null and there's a single assignment.
   - For cycle stations, multiple rows cover different weeks/days.
   - The schedule resolves: station -> brand -> brand's menu for the current daypart -> menu items.
*/

-- Expand stations table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stations' AND column_name='store_id') THEN
    ALTER TABLE stations ADD COLUMN store_id bigint REFERENCES stores(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stations' AND column_name='placement_group_id') THEN
    ALTER TABLE stations ADD COLUMN placement_group_id uuid REFERENCES placement_groups(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stations' AND column_name='description') THEN
    ALTER TABLE stations ADD COLUMN description text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stations' AND column_name='uses_cycle') THEN
    ALTER TABLE stations ADD COLUMN uses_cycle boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stations' AND column_name='status') THEN
    ALTER TABLE stations ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stations' AND column_name='sort_order') THEN
    ALTER TABLE stations ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stations_store_id ON stations(store_id);

-- Create station_schedules table
CREATE TABLE IF NOT EXISTS station_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id integer NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  brand_id bigint NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  cycle_week integer,
  days_of_week integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_station_schedules_station ON station_schedules(station_id);
CREATE INDEX IF NOT EXISTS idx_station_schedules_brand ON station_schedules(brand_id);
CREATE INDEX IF NOT EXISTS idx_station_schedules_week ON station_schedules(cycle_week);

ALTER TABLE station_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_station_schedules" ON station_schedules;
CREATE POLICY "anon_select_station_schedules" ON station_schedules FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_station_schedules" ON station_schedules;
CREATE POLICY "anon_insert_station_schedules" ON station_schedules FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_station_schedules" ON station_schedules;
CREATE POLICY "anon_update_station_schedules" ON station_schedules FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_station_schedules" ON station_schedules;
CREATE POLICY "anon_delete_station_schedules" ON station_schedules FOR DELETE
  TO anon, authenticated USING (true);
