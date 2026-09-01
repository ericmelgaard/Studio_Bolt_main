/*
# Add custom daypart times to brand schedule entries

## Summary
Brands can now override the system-default daypart start/end times directly
on each schedule entry. For example, a brand's "Breakfast" row can specify
a custom window like 6:30 AM - 10:00 AM that differs from the global
daypart definition.

## Modified Tables
- `brand_schedule_group_entries`
  - Added `custom_start_time` (time, nullable) -- brand-specific start override
  - Added `custom_end_time` (time, nullable) -- brand-specific end override

## Important Notes
1. When both fields are NULL, the entry inherits the daypart's default times
   from the daypart_definitions table.
2. These fields are independent -- a brand can override just the start, just
   the end, or both.
3. No data loss -- purely additive column additions.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_schedule_group_entries' AND column_name = 'custom_start_time'
  ) THEN
    ALTER TABLE brand_schedule_group_entries ADD COLUMN custom_start_time time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brand_schedule_group_entries' AND column_name = 'custom_end_time'
  ) THEN
    ALTER TABLE brand_schedule_group_entries ADD COLUMN custom_end_time time;
  END IF;
END $$;
