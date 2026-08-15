ALTER TABLE integration_upload_history
  ADD COLUMN IF NOT EXISTS products_unchanged integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_changes integer DEFAULT 0;