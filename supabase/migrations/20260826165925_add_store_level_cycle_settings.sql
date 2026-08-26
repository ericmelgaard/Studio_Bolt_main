/*
# Add Store-Level Cycle Settings

1. Modified Tables
   - `organization_cycle_settings`
     - Add `store_id` (bigint, references stores.id) - Allows cycle settings at the store level
     - The existing concept_id column remains for backward compatibility

2. Important Notes
   - Cycle duration is a LOCATION-level setting. The whole location shares the same cycle calendar.
   - Individual stations opt in/out via their uses_cycle flag.
   - We make concept_id nullable so store-level settings can exist without a concept.
   - A store's effective cycle is: store-level setting if exists, else fall back to concept-level.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization_cycle_settings' AND column_name='store_id') THEN
    ALTER TABLE organization_cycle_settings ADD COLUMN store_id bigint REFERENCES stores(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make concept_id nullable for store-level settings
ALTER TABLE organization_cycle_settings ALTER COLUMN concept_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_cycle_store_id ON organization_cycle_settings(store_id);
