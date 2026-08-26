/*
# Seed Webtrition wrapper brand and sample sub-brands

1. New Data
   - Creates "Webtrition" as a wrapper brand (is_wrapper=true, visibility='national')
   - Creates "Coffee-764" as a local sub-brand under Webtrition (visibility='local')
   - Creates "Fresh Salads Express" as another local sub-brand (visibility='local')
   - Both sub-brands are assigned created_by_store_id pointing to an existing store

2. Important Notes
   - Webtrition acts as a container; it is not a real operational brand
   - Sub-brands have full brand capabilities but don't appear in main navigation
   - This demonstrates the hierarchy: Webtrition > Coffee-764, Fresh Salads Express
*/

-- Create Webtrition wrapper brand
INSERT INTO concepts (id, name, visibility, is_wrapper, brand_type, scheduling_mode, description)
VALUES (900, 'Webtrition', 'national', true, 'enterprise', 'static', 'Container for data-driven and locally-created sub-brands')
ON CONFLICT (id) DO NOTHING;

-- Get a real store ID to use as the creator
DO $$
DECLARE
  v_store_id bigint;
BEGIN
  SELECT id INTO v_store_id FROM stores LIMIT 1;
  
  -- Create Coffee-764 sub-brand
  INSERT INTO concepts (id, name, visibility, parent_brand_id, created_by_store_id, is_wrapper, brand_type, scheduling_mode, brand_primary_color, description)
  VALUES (901, 'Coffee-764', 'local', 900, v_store_id, false, 'localized', 'static', '#6B4226', 'Local coffee brand - site specific')
  ON CONFLICT (id) DO NOTHING;

  -- Create Fresh Salads Express sub-brand
  INSERT INTO concepts (id, name, visibility, parent_brand_id, created_by_store_id, is_wrapper, brand_type, scheduling_mode, brand_primary_color, description)
  VALUES (902, 'Fresh Salads Express', 'local', 900, v_store_id, false, 'localized', 'static', '#2D8B4E', 'Local salad bar concept - single site')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Link the Webtrition wrapper to the first company so it shows up
INSERT INTO company_brands (company_id, concept_id)
SELECT c.id, 900 FROM companies c LIMIT 1
ON CONFLICT (company_id, concept_id) DO NOTHING;

-- Link sub-brands to the same company
INSERT INTO company_brands (company_id, concept_id)
SELECT c.id, 901 FROM companies c LIMIT 1
ON CONFLICT (company_id, concept_id) DO NOTHING;

INSERT INTO company_brands (company_id, concept_id)
SELECT c.id, 902 FROM companies c LIMIT 1
ON CONFLICT (company_id, concept_id) DO NOTHING;
