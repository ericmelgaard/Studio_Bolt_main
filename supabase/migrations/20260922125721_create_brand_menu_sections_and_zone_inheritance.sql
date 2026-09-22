/*
# Brand Menu Sections and Zone Inheritance

## Overview
Creates a brand-level section template library and adds inheritance tracking
to menu_zones so sections can be either inherited from a brand or custom-created.

## 1. New Tables
- `brand_menu_sections`
  - `id` (uuid, PK) — unique section template ID
  - `brand_id` (bigint, NOT NULL) — references concepts(id), the brand that owns this template
  - `name` (text, NOT NULL) — section display name (e.g. "Entrees", "Sides", "Beverages")
  - `description` (text) — optional description of what belongs in this section
  - `icon` (text) — optional icon identifier
  - `color` (text) — optional color for visual grouping
  - `sort_order` (integer, default 0) — controls default order when inherited
  - `parent_section_id` (uuid) — self-referencing FK for parent-brand section inheritance
  - `created_at` / `updated_at` — timestamps

## 2. Modified Tables
- `menu_zones` — adds:
  - `source_type` (text, default 'custom') — either 'inherited' or 'custom'
  - `brand_section_id` (uuid) — FK to brand_menu_sections; set when source_type='inherited'

## 3. Security
- RLS enabled on brand_menu_sections with public read/write (no-auth app pattern)
- Existing menu_zones RLS unchanged
*/

-- Brand menu sections table
CREATE TABLE IF NOT EXISTS brand_menu_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id bigint NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  parent_section_id uuid REFERENCES brand_menu_sections(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_menu_sections_brand ON brand_menu_sections(brand_id);

ALTER TABLE brand_menu_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_brand_menu_sections" ON brand_menu_sections;
CREATE POLICY "anon_select_brand_menu_sections" ON brand_menu_sections FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_brand_menu_sections" ON brand_menu_sections;
CREATE POLICY "anon_insert_brand_menu_sections" ON brand_menu_sections FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_brand_menu_sections" ON brand_menu_sections;
CREATE POLICY "anon_update_brand_menu_sections" ON brand_menu_sections FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_brand_menu_sections" ON brand_menu_sections;
CREATE POLICY "anon_delete_brand_menu_sections" ON brand_menu_sections FOR DELETE
  TO anon, authenticated USING (true);

-- Add inheritance tracking to menu_zones
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_zones' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE menu_zones ADD COLUMN source_type text NOT NULL DEFAULT 'custom';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_zones' AND column_name = 'brand_section_id'
  ) THEN
    ALTER TABLE menu_zones ADD COLUMN brand_section_id uuid REFERENCES brand_menu_sections(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_menu_zones_brand_section ON menu_zones(brand_section_id) WHERE brand_section_id IS NOT NULL;
