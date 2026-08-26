/*
# Create Menus Table

1. New Tables
   - `menus`
     - `id` (uuid, primary key)
     - `brand_id` (bigint, references concepts.id) - The brand this menu belongs to
     - `daypart_definition_id` (uuid, references daypart_definitions.id) - The daypart this menu serves (Breakfast, Lunch, etc.)
     - `name` (text, not null) - Human-readable name like "Grill Breakfast" or "Drinks All Day"
     - `description` (text) - Optional description
     - `scope` (text) - 'enterprise' (shared org-wide) or 'local' (specific to a site)
     - `site_id` (bigint, references stores.id) - Null for enterprise-level menus, set for local menus
     - `status` (text) - 'active', 'draft', 'archived'
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - RLS enabled
   - Public read/write access (no-auth app pattern matching existing tables)

3. Important Notes
   - A menu is intrinsically tied to a daypart. "Grill Breakfast" IS a breakfast menu.
   - Enterprise menus can be used at any location. Local menus override or supplement for a specific site.
   - The brand_id references the existing concepts table which now serves as the Brand entity.
*/

CREATE TABLE IF NOT EXISTS menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id bigint NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  daypart_definition_id uuid NOT NULL REFERENCES daypart_definitions(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  scope text NOT NULL DEFAULT 'enterprise',
  site_id bigint REFERENCES stores(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menus_brand_id ON menus(brand_id);
CREATE INDEX IF NOT EXISTS idx_menus_daypart ON menus(daypart_definition_id);
CREATE INDEX IF NOT EXISTS idx_menus_site_id ON menus(site_id);

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_menus" ON menus;
CREATE POLICY "anon_select_menus" ON menus FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_menus" ON menus;
CREATE POLICY "anon_insert_menus" ON menus FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_menus" ON menus;
CREATE POLICY "anon_update_menus" ON menus FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_menus" ON menus;
CREATE POLICY "anon_delete_menus" ON menus FOR DELETE
  TO anon, authenticated USING (true);
