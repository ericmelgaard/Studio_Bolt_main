/*
# Create company_brands join table

1. New Tables
  - `company_brands`
    - `id` (bigint, primary key, generated)
    - `company_id` (bigint, references companies)
    - `concept_id` (bigint, references concepts) - the brand
    - `created_at` (timestamptz)
    - Unique constraint on (company_id, concept_id)

2. Security
  - Enable RLS on `company_brands`
  - Allow anon + authenticated full CRUD (no-auth app)

3. Data Population
  - Auto-populate from existing companies.concept_id so every current 
    company-brand relationship is preserved in the new join table

4. Notes
  - This enables a company to subscribe to multiple brands
  - The existing concept_id on companies remains for backward compatibility
  - The join table becomes the source of truth for multi-brand access
*/

CREATE TABLE IF NOT EXISTS company_brands (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  concept_id bigint NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, concept_id)
);

ALTER TABLE company_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_company_brands" ON company_brands;
CREATE POLICY "anon_select_company_brands" ON company_brands FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_company_brands" ON company_brands;
CREATE POLICY "anon_insert_company_brands" ON company_brands FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_company_brands" ON company_brands;
CREATE POLICY "anon_update_company_brands" ON company_brands FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_company_brands" ON company_brands;
CREATE POLICY "anon_delete_company_brands" ON company_brands FOR DELETE
  TO anon, authenticated USING (true);

-- Populate from existing company->concept relationships
INSERT INTO company_brands (company_id, concept_id)
SELECT id, concept_id FROM companies WHERE concept_id IS NOT NULL
ON CONFLICT (company_id, concept_id) DO NOTHING;
