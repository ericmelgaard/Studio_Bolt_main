/*
# Add daypart_id to brand_stations

1. Modified Tables
   - `brand_stations`
     - Added `daypart_id` (uuid, nullable, FK to daypart_definitions) - when null, station applies to all dayparts
     - Dropped unique constraint on (brand_id, station_id) to allow same station under multiple dayparts

2. Important Notes
   - Existing brand_station rows keep daypart_id = null (meaning "All Dayparts")
   - No unique constraint needed - same station can appear multiple times (user's responsibility)
   - FK to daypart_definitions with ON DELETE SET NULL so removing a daypart doesn't orphan the link
*/

-- Add daypart_id column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_stations' AND column_name = 'daypart_id'
  ) THEN
    ALTER TABLE brand_stations ADD COLUMN daypart_id uuid REFERENCES daypart_definitions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Drop the unique constraint on (brand_id, station_id) since same station can now appear under multiple dayparts
ALTER TABLE brand_stations DROP CONSTRAINT IF EXISTS brand_stations_brand_id_station_id_key;
