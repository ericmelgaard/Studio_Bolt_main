/*
# Seed stations and menu items for WAND Development brand

Completes the seeding started by prior migration (menus + zones already exist).
- 2 stations at store 4907 with explicit IDs
- Station schedules for Mon-Fri (days_of_week uses int[] with 0=Sun..6=Sat)
- Menu items placed from existing products
*/

-- Create stations at store 4907
INSERT INTO stations (id, name, store_id, uses_cycle, status, sort_order)
VALUES
  (200000001, 'Main Grill', 4907, true, 'active', 1),
  (200000002, 'Salad Station', 4907, true, 'active', 2)
ON CONFLICT DO NOTHING;

-- Station schedules: Mon(1) through Fri(5)
INSERT INTO station_schedules (id, station_id, brand_id, cycle_week, days_of_week, is_active)
VALUES 
  (gen_random_uuid(), 200000001, 214, 1, ARRAY[1,2,3,4,5], true),
  (gen_random_uuid(), 200000002, 214, 1, ARRAY[1,2,3,4,5], true)
ON CONFLICT DO NOTHING;

-- Add menu items using existing products
DO $$
DECLARE
  v_breakfast_id uuid;
  v_lunch_id uuid;
  v_breakfast_entrees_zone uuid;
  v_lunch_entrees_zone uuid;
  v_product_ids uuid[];
BEGIN
  SELECT id INTO v_breakfast_id FROM menus WHERE brand_id = 214 AND name = 'Grill Breakfast' LIMIT 1;
  SELECT id INTO v_lunch_id FROM menus WHERE brand_id = 214 AND name = 'Grill Lunch' LIMIT 1;

  SELECT id INTO v_breakfast_entrees_zone FROM menu_zones WHERE menu_id = v_breakfast_id AND name = 'Entrees' LIMIT 1;
  SELECT id INTO v_lunch_entrees_zone FROM menu_zones WHERE menu_id = v_lunch_id AND name = 'Entrees' LIMIT 1;

  SELECT array_agg(id) INTO v_product_ids FROM (SELECT id FROM products WHERE concept_id = 214 LIMIT 6) sub;

  IF v_breakfast_entrees_zone IS NOT NULL AND v_product_ids IS NOT NULL AND array_length(v_product_ids, 1) >= 3 THEN
    INSERT INTO scheduled_menu_items (id, menu_id, zone_id, product_id, sort_order, is_visible) VALUES
      (gen_random_uuid(), v_breakfast_id, v_breakfast_entrees_zone, v_product_ids[1], 1, true),
      (gen_random_uuid(), v_breakfast_id, v_breakfast_entrees_zone, v_product_ids[2], 2, true),
      (gen_random_uuid(), v_breakfast_id, v_breakfast_entrees_zone, v_product_ids[3], 3, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_lunch_entrees_zone IS NOT NULL AND v_product_ids IS NOT NULL AND array_length(v_product_ids, 1) >= 6 THEN
    INSERT INTO scheduled_menu_items (id, menu_id, zone_id, product_id, sort_order, is_visible) VALUES
      (gen_random_uuid(), v_lunch_id, v_lunch_entrees_zone, v_product_ids[4], 1, true),
      (gen_random_uuid(), v_lunch_id, v_lunch_entrees_zone, v_product_ids[5], 2, true),
      (gen_random_uuid(), v_lunch_id, v_lunch_entrees_zone, v_product_ids[6], 3, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
