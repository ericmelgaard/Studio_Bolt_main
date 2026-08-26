/*
# Add Brand Design Resources System

1. Modified Tables
   - `concepts` (brands)
     - `logo_path` (text, nullable) - Path to uploaded brand logo in asset storage
     - `brand_palette` (jsonb, nullable) - Extended color palette array beyond primary/secondary
     - `menu_type_settings` (jsonb, nullable) - Defines what menu types and dayparts this brand supports
     - `design_notes` (text, nullable) - Freeform guidelines or notes about brand usage

2. New Tables
   - `brand_design_resources`
     - `id` (bigint, primary key)
     - `concept_id` (bigint, references concepts) - The brand this resource belongs to
     - `resource_type` (text) - 'font', 'image', 'pattern', 'icon' etc.
     - `file_name` (text) - Display name of the resource
     - `file_path` (text) - Path in asset storage
     - `metadata` (jsonb, nullable) - Font weight, format, dimensions, etc.
     - `sort_order` (integer) - For ordering within a type
     - `created_at` (timestamptz)

3. Security
   - Enable RLS on `brand_design_resources`
   - Allow anon + authenticated full CRUD (no-auth app pattern)

4. Important Notes
   - These fields support the brand overview / design guidelines section
   - Fonts uploaded here are made available to the theme/design tool
   - brand_palette stores an array of hex colors for the full brand color system
   - menu_type_settings stores JSON config like { allowed_types: ['cycle','static'], dayparts: [...] }
*/

-- Add new columns to concepts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='concepts' AND column_name='logo_path') THEN
    ALTER TABLE concepts ADD COLUMN logo_path text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='concepts' AND column_name='brand_palette') THEN
    ALTER TABLE concepts ADD COLUMN brand_palette jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='concepts' AND column_name='menu_type_settings') THEN
    ALTER TABLE concepts ADD COLUMN menu_type_settings jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='concepts' AND column_name='design_notes') THEN
    ALTER TABLE concepts ADD COLUMN design_notes text;
  END IF;
END $$;

-- Create brand_design_resources table
CREATE TABLE IF NOT EXISTS brand_design_resources (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  concept_id bigint NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  metadata jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE brand_design_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_brand_design_resources" ON brand_design_resources;
CREATE POLICY "anon_select_brand_design_resources" ON brand_design_resources FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_brand_design_resources" ON brand_design_resources;
CREATE POLICY "anon_insert_brand_design_resources" ON brand_design_resources FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_brand_design_resources" ON brand_design_resources;
CREATE POLICY "anon_update_brand_design_resources" ON brand_design_resources FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_brand_design_resources" ON brand_design_resources;
CREATE POLICY "anon_delete_brand_design_resources" ON brand_design_resources FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_brand_design_resources_concept ON brand_design_resources(concept_id);
CREATE INDEX IF NOT EXISTS idx_brand_design_resources_type ON brand_design_resources(resource_type);
