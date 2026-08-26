/*
# Add Brand Visibility Tier and Parent Hierarchy

1. Modified Tables
   - `concepts` (brands)
     - `visibility` (text) - 'national' or 'local'. Defaults to 'national' so existing brands stay visible.
     - `parent_brand_id` (bigint, nullable, self-reference) - Sub-brands point to their parent wrapper.
     - `created_by_store_id` (bigint, nullable) - Tracks which store originated a local sub-brand.
     - `is_wrapper` (boolean) - TRUE for container brands like "Webtrition" that hold sub-brands.

2. New Tables
   - `sub_brand_shares`
     - `id` (bigint, primary key)
     - `sub_brand_id` (bigint, references concepts)
     - `target_parent_brand_id` (bigint, references concepts)
     - `target_company_id` (bigint, nullable, references companies)
     - `shared_at` (timestamptz)
     - `shared_by_store_id` (bigint, nullable)

3. Security
   - Enable RLS on `sub_brand_shares`
   - Allow anon + authenticated full CRUD (no-auth app)

4. Important Notes
   - All existing brands remain visibility='national' and parent_brand_id=NULL
   - Sub-brands have visibility='local' with a parent_brand_id
   - is_wrapper distinguishes container brands from operational brands
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='concepts' AND column_name='visibility') THEN
    ALTER TABLE concepts ADD COLUMN visibility text NOT NULL DEFAULT 'national';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='concepts' AND column_name='parent_brand_id') THEN
    ALTER TABLE concepts ADD COLUMN parent_brand_id bigint REFERENCES concepts(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='concepts' AND column_name='created_by_store_id') THEN
    ALTER TABLE concepts ADD COLUMN created_by_store_id bigint REFERENCES stores(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='concepts' AND column_name='is_wrapper') THEN
    ALTER TABLE concepts ADD COLUMN is_wrapper boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sub_brand_shares (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  sub_brand_id bigint NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  target_parent_brand_id bigint NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  target_company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
  shared_at timestamptz DEFAULT now(),
  shared_by_store_id bigint REFERENCES stores(id) ON DELETE SET NULL
);

ALTER TABLE sub_brand_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sub_brand_shares" ON sub_brand_shares;
CREATE POLICY "anon_select_sub_brand_shares" ON sub_brand_shares FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sub_brand_shares" ON sub_brand_shares;
CREATE POLICY "anon_insert_sub_brand_shares" ON sub_brand_shares FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sub_brand_shares" ON sub_brand_shares;
CREATE POLICY "anon_update_sub_brand_shares" ON sub_brand_shares FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sub_brand_shares" ON sub_brand_shares;
CREATE POLICY "anon_delete_sub_brand_shares" ON sub_brand_shares FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_concepts_parent_brand_id ON concepts(parent_brand_id) WHERE parent_brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_concepts_visibility ON concepts(visibility);
CREATE INDEX IF NOT EXISTS idx_sub_brand_shares_sub_brand ON sub_brand_shares(sub_brand_id);
CREATE INDEX IF NOT EXISTS idx_sub_brand_shares_target_parent ON sub_brand_shares(target_parent_brand_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_brand_shares ON sub_brand_shares(sub_brand_id, target_parent_brand_id, target_company_id) WHERE target_company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_brand_shares_no_company ON sub_brand_shares(sub_brand_id, target_parent_brand_id) WHERE target_company_id IS NULL;
