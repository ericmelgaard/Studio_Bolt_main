/*
# Create Brand Daypart Enrollments

## Purpose
Tracks which dayparts a brand is actively enrolled in, with optional brand-specific
active hours that may differ from the system daypart hours.

## New Table: brand_daypart_enrollments
- `id` (uuid, primary key)
- `brand_id` (bigint, not null) - References the brand/concept
- `daypart_definition_id` (uuid, nullable) - References daypart_definitions. NULL means "All Dayparts" (the background filler).
- `custom_start_time` (time, nullable) - Brand-specific start time for this daypart. NULL = use system default.
- `custom_end_time` (time, nullable) - Brand-specific end time for this daypart. NULL = use system default.
- `is_active` (boolean, default true) - Allows toggling without deleting
- `created_at` (timestamptz)

## Constraints
- Unique on (brand_id, daypart_definition_id) so a brand cannot enroll in the same daypart twice.
  Uses COALESCE to handle the NULL "All Dayparts" row in the unique constraint.

## Security
- RLS enabled, open CRUD for anon + authenticated (no-auth demo app pattern)

## Seed Data
- Inserts an "All Dayparts" enrollment (daypart_definition_id = NULL) for every existing
  concept that has brand fields, so existing brands start with the automatic default.
*/

CREATE TABLE IF NOT EXISTS brand_daypart_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id bigint NOT NULL,
  daypart_definition_id uuid REFERENCES daypart_definitions(id) ON DELETE CASCADE,
  custom_start_time time,
  custom_end_time time,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_daypart_enrollments_unique
  ON brand_daypart_enrollments (brand_id, COALESCE(daypart_definition_id, '00000000-0000-0000-0000-000000000000'));

CREATE INDEX IF NOT EXISTS idx_brand_daypart_enrollments_brand ON brand_daypart_enrollments(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_daypart_enrollments_daypart ON brand_daypart_enrollments(daypart_definition_id);

ALTER TABLE brand_daypart_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_brand_daypart_enrollments" ON brand_daypart_enrollments;
CREATE POLICY "anon_select_brand_daypart_enrollments" ON brand_daypart_enrollments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_brand_daypart_enrollments" ON brand_daypart_enrollments;
CREATE POLICY "anon_insert_brand_daypart_enrollments" ON brand_daypart_enrollments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_brand_daypart_enrollments" ON brand_daypart_enrollments;
CREATE POLICY "anon_update_brand_daypart_enrollments" ON brand_daypart_enrollments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_brand_daypart_enrollments" ON brand_daypart_enrollments;
CREATE POLICY "anon_delete_brand_daypart_enrollments" ON brand_daypart_enrollments FOR DELETE
  TO anon, authenticated USING (true);

-- Seed "All Dayparts" enrollment for every existing brand (concept with brand fields)
INSERT INTO brand_daypart_enrollments (brand_id, daypart_definition_id, is_active)
SELECT c.id, NULL, true
FROM concepts c
WHERE c.brand_type IS NOT NULL
ON CONFLICT DO NOTHING;
