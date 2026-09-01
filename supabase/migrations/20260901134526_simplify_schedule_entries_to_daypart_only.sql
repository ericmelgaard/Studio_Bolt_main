/*
# Simplify brand schedule entries to daypart-only rows

## Summary
The brand schedule grid is being restructured so each row represents a daypart
(Breakfast, Lunch, Dinner, etc.) with day-of-week toggles -- stations are no
longer part of the schedule. This migration:

1. Makes `station_id` nullable on `brand_schedule_group_entries` since new
   entries will no longer carry a station reference.
2. Deduplicates rows: within each group_id, only one entry per daypart_id is
   kept (the earliest by created_at). Extra rows are deleted.
3. Adds a UNIQUE constraint on (group_id, daypart_id) to enforce the rule
   that a daypart can only appear once per schedule group.

## Modified Tables
- `brand_schedule_group_entries`
  - `station_id` changed from NOT NULL to nullable
  - Added unique constraint `uq_group_daypart` on (group_id, daypart_id)
  - Duplicate rows (same group_id + daypart_id) deleted (keeps earliest)

## Important Notes
1. Existing entries retain their station_id values; they are not cleared.
2. The unique constraint allows one NULL daypart_id per group (the "All Dayparts" row).
3. No columns are dropped -- station_id remains for potential future use.
*/

-- 1. Make station_id nullable
ALTER TABLE brand_schedule_group_entries ALTER COLUMN station_id DROP NOT NULL;

-- 2. Deduplicate: keep only the earliest entry per (group_id, daypart_id)
DELETE FROM brand_schedule_group_entries
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY group_id, COALESCE(daypart_id, '00000000-0000-0000-0000-000000000000')
             ORDER BY created_at ASC
           ) AS rn
    FROM brand_schedule_group_entries
  ) ranked
  WHERE rn > 1
);

-- 3. Add unique constraint (uses a unique index so NULLs in daypart_id are treated as equal)
DROP INDEX IF EXISTS uq_group_daypart;
CREATE UNIQUE INDEX uq_group_daypart
  ON brand_schedule_group_entries (group_id, COALESCE(daypart_id, '00000000-0000-0000-0000-000000000000'));
