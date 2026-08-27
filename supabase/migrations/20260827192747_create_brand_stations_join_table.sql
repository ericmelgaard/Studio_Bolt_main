/*
# Create brand_stations join table

Links webtrition stations (from the `stations` table) to brands (concepts).
This is a many-to-many relationship: multiple webtrition stations can be 
assigned to a single brand, and potentially a station could belong to multiple brands.

1. New Tables
   - `brand_stations`
     - `id` (uuid, primary key)
     - `brand_id` (integer, references concepts.id) - the brand
     - `station_id` (integer, references stations.id) - the webtrition station
     - `created_at` (timestamptz)
     - Unique constraint on (brand_id, station_id) to prevent duplicates

2. Security
   - RLS enabled
   - Public read/write access (anon + authenticated) since this is a no-auth demo app
*/

CREATE TABLE IF NOT EXISTS brand_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id integer NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  station_id integer NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, station_id)
);

ALTER TABLE brand_stations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_brand_stations" ON brand_stations;
CREATE POLICY "anon_select_brand_stations" ON brand_stations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_brand_stations" ON brand_stations;
CREATE POLICY "anon_insert_brand_stations" ON brand_stations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_brand_stations" ON brand_stations;
CREATE POLICY "anon_update_brand_stations" ON brand_stations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_brand_stations" ON brand_stations;
CREATE POLICY "anon_delete_brand_stations" ON brand_stations FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_brand_stations_brand ON brand_stations(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_stations_station ON brand_stations(station_id);
