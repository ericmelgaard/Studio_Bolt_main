/*
# Add Brand Fields to Concepts Table

1. Modified Tables
   - `concepts` (will serve as "Brands" in the application)
     - `brand_type` (text) - 'enterprise' or 'localized'. Enterprise brands share menus org-wide; localized brands create menus per-location.
     - `scheduling_mode` (text) - 'cycle' or 'static'. Cycle brands rotate through the location's cycle weeks; static brands show the same content every day.

2. Important Notes
   - The `concepts` table is being rebranded as "Brands" in the UI layer. The table name stays as-is to avoid breaking existing references.
   - brand_type defaults to 'enterprise' (most brands are defined at org level).
   - scheduling_mode defaults to 'cycle' (most cafeteria brands rotate).
   - No data loss; additive columns only.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='concepts' AND column_name='brand_type') THEN
    ALTER TABLE concepts ADD COLUMN brand_type text NOT NULL DEFAULT 'enterprise';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='concepts' AND column_name='scheduling_mode') THEN
    ALTER TABLE concepts ADD COLUMN scheduling_mode text NOT NULL DEFAULT 'cycle';
  END IF;
END $$;
