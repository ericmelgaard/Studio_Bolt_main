/*
# Add removed products and detail JSON columns to upload history

1. Modified Tables
- `integration_upload_history`
  - `removed_products` (integer, default 0) — count of products in the database but missing from the uploaded file
  - `price_change_details` (jsonb, default '[]') — array of { plu, name, oldPrice, newPrice } for each product whose price changed
  - `new_product_details` (jsonb, default '[]') — array of { plu, name, price } for each newly added product
  - `removed_product_details` (jsonb, default '[]') — array of { plu, name, price } for each product no longer present

2. Security
- No RLS changes. This table already has existing policies.
*/

ALTER TABLE integration_upload_history
  ADD COLUMN IF NOT EXISTS removed_products integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_change_details jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS new_product_details jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS removed_product_details jsonb DEFAULT '[]'::jsonb;
