/*
# Add Daypart Reference to Station Schedules and Cycle Date/Name Fields

1. Modified Tables
   - `station_schedules`
     - `daypart_id` (uuid, nullable, references daypart_definitions.id) - When null means "all dayparts". When set, the schedule only applies during that specific daypart.
   - `organization_cycle_settings`
     - `end_date` (date, nullable) - When the cycle period ends (e.g. end of Q1)
     - `cycle_name` (text, nullable) - Label for the cycle period (e.g. "Q1 2026") so weeks display as "Q1 Week 1"

2. Important Notes
   - daypart_id NULL = "all dayparts" (default behavior, one schedule row covers the whole day)
   - daypart_id set = schedule only applies during that specific daypart (e.g. Breakfast)
   - cycle_name + week number produces display labels like "Q1 Week 1", "Q1 Week 2"
   - end_date allows cycle periods to have defined boundaries for quarterly menu planning
   - start_date already exists as starting_week_date on organization_cycle_settings
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='station_schedules' AND column_name='daypart_id') THEN
    ALTER TABLE station_schedules ADD COLUMN daypart_id uuid REFERENCES daypart_definitions(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization_cycle_settings' AND column_name='end_date') THEN
    ALTER TABLE organization_cycle_settings ADD COLUMN end_date date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization_cycle_settings' AND column_name='cycle_name') THEN
    ALTER TABLE organization_cycle_settings ADD COLUMN cycle_name text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_station_schedules_daypart ON station_schedules(daypart_id);
