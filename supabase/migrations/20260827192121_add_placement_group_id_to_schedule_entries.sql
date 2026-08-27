/*
# Add placement_group_id to brand_schedule_group_entries

1. Modified Tables
   - `brand_schedule_group_entries`
     - `placement_group_id` (uuid, nullable) - References placement_groups.id. This links 
       schedule entries to placements (physical station locations) rather than the legacy 
       webtrition stations table. When set, this takes precedence over station_id.

2. Important Notes
   - The existing station_id integer column is preserved for backwards compatibility
     with any existing data, but new schedule entries should use placement_group_id.
   - Placements (placement_groups with is_store_root=false) are the physical locations 
     where brands are scheduled to appear.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='brand_schedule_group_entries' AND column_name='placement_group_id') THEN
    ALTER TABLE brand_schedule_group_entries ADD COLUMN placement_group_id uuid REFERENCES placement_groups(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_brand_schedule_group_entries_placement ON brand_schedule_group_entries(placement_group_id);
