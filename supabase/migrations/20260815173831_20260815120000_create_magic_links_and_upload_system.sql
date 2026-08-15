/*
# Create Magic Links, Authorized Emails, Verification Codes, Upload History, and PAR Presets

## Overview
Adds data infrastructure for preset integrations with magic links, email-governed
file uploads, per-integration automated endpoints, and upload tracking. Seeds PAR
POS API and PAR Export CSV preset integrations.

## New Tables
1. integration_magic_links - one magic link per integration config
2. integration_authorized_emails - email addresses allowed to use each magic link
3. integration_verification_codes - one-time codes for email verification
4. integration_upload_history - logs every upload event (magic link, in-app, endpoint)

## Modified Tables
5. integration_source_configs - added endpoint_url, client_id, client_secret,
   is_wand_managed, has_preset_mappings, mapping_status columns
6. wand_integration_sources - seeded PAR POS API and PAR Export CSV presets

## Security
- RLS enabled on all new tables
- Policies set to anon, authenticated for demo compatibility
*/

-- Add columns to integration_source_configs
ALTER TABLE integration_source_configs
  ADD COLUMN IF NOT EXISTS endpoint_url text,
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS client_secret text,
  ADD COLUMN IF NOT EXISTS is_wand_managed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_preset_mappings boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mapping_status text DEFAULT 'not_started';

-- Create integration_magic_links
CREATE TABLE IF NOT EXISTS integration_magic_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_config_id uuid NOT NULL REFERENCES integration_source_configs(id) ON DELETE CASCADE,
  link_token text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON integration_magic_links(link_token);
CREATE INDEX IF NOT EXISTS idx_magic_links_config ON integration_magic_links(integration_config_id);
ALTER TABLE integration_magic_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_magic_links" ON integration_magic_links;
CREATE POLICY "anon_select_magic_links" ON integration_magic_links FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_magic_links" ON integration_magic_links;
CREATE POLICY "anon_insert_magic_links" ON integration_magic_links FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_magic_links" ON integration_magic_links;
CREATE POLICY "anon_update_magic_links" ON integration_magic_links FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_magic_links" ON integration_magic_links;
CREATE POLICY "anon_delete_magic_links" ON integration_magic_links FOR DELETE TO anon, authenticated USING (true);

-- Create integration_authorized_emails
CREATE TABLE IF NOT EXISTS integration_authorized_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  magic_link_id uuid NOT NULL REFERENCES integration_magic_links(id) ON DELETE CASCADE,
  email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(magic_link_id, email)
);
CREATE INDEX IF NOT EXISTS idx_auth_emails_link ON integration_authorized_emails(magic_link_id);
CREATE INDEX IF NOT EXISTS idx_auth_emails_email ON integration_authorized_emails(email);
ALTER TABLE integration_authorized_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_auth_emails" ON integration_authorized_emails;
CREATE POLICY "anon_select_auth_emails" ON integration_authorized_emails FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_auth_emails" ON integration_authorized_emails;
CREATE POLICY "anon_insert_auth_emails" ON integration_authorized_emails FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_auth_emails" ON integration_authorized_emails;
CREATE POLICY "anon_update_auth_emails" ON integration_authorized_emails FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_auth_emails" ON integration_authorized_emails;
CREATE POLICY "anon_delete_auth_emails" ON integration_authorized_emails FOR DELETE TO anon, authenticated USING (true);

-- Create integration_verification_codes
CREATE TABLE IF NOT EXISTS integration_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authorized_email_id uuid NOT NULL REFERENCES integration_authorized_emails(id) ON DELETE CASCADE,
  code text NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verif_codes_email ON integration_verification_codes(authorized_email_id);
ALTER TABLE integration_verification_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_verif_codes" ON integration_verification_codes;
CREATE POLICY "anon_select_verif_codes" ON integration_verification_codes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_verif_codes" ON integration_verification_codes;
CREATE POLICY "anon_insert_verif_codes" ON integration_verification_codes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_verif_codes" ON integration_verification_codes;
CREATE POLICY "anon_update_verif_codes" ON integration_verification_codes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_verif_codes" ON integration_verification_codes;
CREATE POLICY "anon_delete_verif_codes" ON integration_verification_codes FOR DELETE TO anon, authenticated USING (true);

-- Create integration_upload_history
CREATE TABLE IF NOT EXISTS integration_upload_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_config_id uuid NOT NULL REFERENCES integration_source_configs(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'in_app',
  uploader_email text,
  file_name text NOT NULL,
  file_type text DEFAULT 'csv',
  rows_processed integer DEFAULT 0,
  rows_succeeded integer DEFAULT 0,
  rows_failed integer DEFAULT 0,
  products_updated integer DEFAULT 0,
  new_products_added integer DEFAULT 0,
  error_details jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_upload_history_config ON integration_upload_history(integration_config_id);
CREATE INDEX IF NOT EXISTS idx_upload_history_created ON integration_upload_history(created_at DESC);
ALTER TABLE integration_upload_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_upload_history" ON integration_upload_history;
CREATE POLICY "anon_select_upload_history" ON integration_upload_history FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_upload_history" ON integration_upload_history;
CREATE POLICY "anon_insert_upload_history" ON integration_upload_history FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_upload_history" ON integration_upload_history;
CREATE POLICY "anon_update_upload_history" ON integration_upload_history FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_upload_history" ON integration_upload_history;
CREATE POLICY "anon_delete_upload_history" ON integration_upload_history FOR DELETE TO anon, authenticated USING (true);

-- Seed PAR POS API preset
INSERT INTO wand_integration_sources (name, integration_type, status, description, base_url_template, auth_method, required_config_fields, optional_config_fields, default_sync_frequency_minutes, formatter_name, supports_products, supports_modifiers, supports_discounts, metadata, documentation_url)
SELECT 'PAR POS API', 'par_api', 'active', 'Direct API integration with PAR POS systems. Pre-built field mappings to WAND product attributes. Supports automated data sync and real-time product updates.', 'https://api.parbrink.com/v1/{location_id}', 'api_key', '["location_id", "api_key"]'::jsonb, '["sync_interval"]'::jsonb, 15, 'par_api', true, true, true, '{"preset_mappings": true, "industry_type": "qsr", "managed_by": "wand", "mappings": {"product_name": "itemTitle", "product_price": "price", "product_description": "description", "product_category": "category", "product_id": "externalId", "product_barcode": "barcode", "is_out_of_stock": "isOutOfStock"}}'::jsonb, 'https://docs.parbrink.com/api'
WHERE NOT EXISTS (SELECT 1 FROM wand_integration_sources WHERE integration_type = 'par_api');

-- Seed PAR Export CSV preset
INSERT INTO wand_integration_sources (name, integration_type, status, description, base_url_template, auth_method, required_config_fields, optional_config_fields, default_sync_frequency_minutes, formatter_name, supports_products, supports_modifiers, supports_discounts, metadata, documentation_url)
SELECT 'PAR Export CSV', 'par_csv', 'active', 'Manual CSV export upload from PAR POS systems. Pre-built column mappings to WAND product attributes. Upload via magic link, in-app upload, or automated endpoint. Ideal for locations without API access.', '', 'none', '[]'::jsonb, '[]'::jsonb, 0, 'par_csv', true, false, false, '{"preset_mappings": true, "industry_type": "qsr", "managed_by": "wand", "upload_methods": ["magic_link", "in_app", "endpoint"], "csv_column_mappings": {"Item Number": "externalId", "Item Name": "itemTitle", "Description": "description", "Category": "category", "Price": "price", "Tax Group": "taxGroup", "POS Key": "posKey", "Barcode": "barcode", "Active": "isActive"}}'::jsonb, 'https://docs.parbrink.com/export'
WHERE NOT EXISTS (SELECT 1 FROM wand_integration_sources WHERE integration_type = 'par_csv');
