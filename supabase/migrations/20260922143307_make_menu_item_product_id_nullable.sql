/*
# Make scheduled_menu_items.product_id nullable

## Summary
Allows menu items to exist without a linked product. This supports two item types:
- **Product-linked items**: reference a product from the product catalog (product_id is set)
- **Freeform items**: custom one-off items with just a display name and optional price (product_id is NULL)

## Modified Tables
- `scheduled_menu_items`
  - `product_id` changed from `uuid NOT NULL` to `uuid NULL` (nullable)

## Important Notes
1. No data loss — this only relaxes the NOT NULL constraint.
2. The existing foreign key to products(id) ON DELETE CASCADE remains intact.
3. Freeform items (product_id IS NULL) should have a display_name set so they are identifiable.
*/

ALTER TABLE scheduled_menu_items ALTER COLUMN product_id DROP NOT NULL;
