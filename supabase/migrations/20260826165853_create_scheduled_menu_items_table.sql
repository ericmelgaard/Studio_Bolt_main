/*
# Create Scheduled Menu Items Table

1. New Tables
   - `scheduled_menu_items`
     - `id` (uuid, primary key)
     - `menu_id` (uuid, references menus.id) - Which menu this item belongs to
     - `zone_id` (uuid, references menu_zones.id) - Which zone within the menu (nullable for unzoned items)
     - `product_id` (uuid, references products.id) - The master product record
     - `display_name` (text) - Override name for this menu context (nullable, falls back to product name)
     - `sort_order` (integer) - Position within the zone
     - `portion_size` (text) - e.g., "2oz", "6oz" - portion specific to this menu placement
     - `price_override` (numeric) - Price specific to this menu/station context
     - `price_label` (text) - e.g., "Small", "Regular", "Large"
     - `is_visible` (boolean) - Whether this item shows on the menu currently
     - `available_days` (integer array) - Days of week this item appears (null = every day)
     - `available_cycle_weeks` (integer array) - Which cycle weeks this item appears (null = every week)
     - `merchandising` (jsonb) - Additional display/merchandising settings
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - RLS enabled
   - Public read/write (no-auth pattern)

3. Important Notes
   - This is the "menu item" concept: a product placed into a menu with context-specific overrides.
   - The same product can appear in multiple menus with different portion sizes, prices, and names.
   - available_days allows per-item daily rotation within a menu (Monday soup special, etc.)
   - available_cycle_weeks allows items to only show on certain weeks of the rotation.
*/

CREATE TABLE IF NOT EXISTS scheduled_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES menu_zones(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  display_name text,
  sort_order integer NOT NULL DEFAULT 0,
  portion_size text,
  price_override numeric(10,2),
  price_label text,
  is_visible boolean NOT NULL DEFAULT true,
  available_days integer[],
  available_cycle_weeks integer[],
  merchandising jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smi_menu_id ON scheduled_menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_smi_zone_id ON scheduled_menu_items(zone_id);
CREATE INDEX IF NOT EXISTS idx_smi_product_id ON scheduled_menu_items(product_id);

ALTER TABLE scheduled_menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_smi" ON scheduled_menu_items;
CREATE POLICY "anon_select_smi" ON scheduled_menu_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_smi" ON scheduled_menu_items;
CREATE POLICY "anon_insert_smi" ON scheduled_menu_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_smi" ON scheduled_menu_items;
CREATE POLICY "anon_update_smi" ON scheduled_menu_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_smi" ON scheduled_menu_items;
CREATE POLICY "anon_delete_smi" ON scheduled_menu_items FOR DELETE
  TO anon, authenticated USING (true);
