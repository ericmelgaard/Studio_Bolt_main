/*
# Create Menu Zones Table

1. New Tables
   - `menu_zones`
     - `id` (uuid, primary key)
     - `menu_id` (uuid, references menus.id) - The menu this zone belongs to
     - `parent_zone_id` (uuid, self-referencing) - For nested zones (e.g., Drinks > Alcoholic)
     - `name` (text, not null) - Zone name like "Entrees", "Sides", "Alcoholic Beverages"
     - `description` (text) - Optional
     - `sort_order` (integer) - Display ordering within the menu or parent zone
     - `icon` (text) - Optional icon identifier
     - `color` (text) - Optional color for visual distinction
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - RLS enabled
   - Public read/write (no-auth pattern)

3. Important Notes
   - Zones organize menu items visually: Entrees, Sides, Beverages, etc.
   - Nesting via parent_zone_id allows "Drinks > Alcoholic" hierarchy.
   - Sort order controls the visual stacking on displays.
*/

CREATE TABLE IF NOT EXISTS menu_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  parent_zone_id uuid REFERENCES menu_zones(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  icon text,
  color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_zones_menu_id ON menu_zones(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_zones_parent ON menu_zones(parent_zone_id);

ALTER TABLE menu_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_menu_zones" ON menu_zones;
CREATE POLICY "anon_select_menu_zones" ON menu_zones FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_menu_zones" ON menu_zones;
CREATE POLICY "anon_insert_menu_zones" ON menu_zones FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_menu_zones" ON menu_zones;
CREATE POLICY "anon_update_menu_zones" ON menu_zones FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_menu_zones" ON menu_zones;
CREATE POLICY "anon_delete_menu_zones" ON menu_zones FOR DELETE
  TO anon, authenticated USING (true);
