/*
# Create Brand Schedule Groups System

1. New Tables
  - `brand_schedule_groups`
    - `id` (uuid, primary key)
    - `brand_id` (bigint, not null) - references the brand/concept
    - `store_id` (bigint) - the store this schedule applies to
    - `name` (text) - optional label like "Q1 Menu", "Week 2 Rotation"
    - `start_date` (date, not null) - the Monday this group starts from
    - `end_date` (date, nullable) - null means indefinite; set for seasonal menus
    - `recurrence_weeks` (integer, nullable) - null means base default (every week); 1 = weekly, 4 = every 4 weeks from start
    - `is_base` (boolean, default false) - true if this is the base/default schedule (lowest priority)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  - `brand_schedule_group_entries`
    - `id` (uuid, primary key)
    - `group_id` (uuid, not null) - references parent group
    - `station_id` (integer, not null) - the station assigned
    - `days_of_week` (integer[], not null) - days active (0=Sun, 1=Mon...6=Sat)
    - `daypart_id` (uuid, nullable) - optional daypart scope
    - `created_at` (timestamptz)

2. Security
  - RLS enabled on both tables
  - Public access (anon + authenticated) since app has no auth requirement for this feature

3. Notes
  - Priority resolution: is_base groups are lowest priority. Among non-base groups,
    most recent start_date wins when two groups claim the same week.
  - A group with recurrence_weeks=null and is_base=true is the fallback for all unclaimed weeks.
  - A group with recurrence_weeks set claims every Nth week from its start_date.
  - A group with end_date set stops claiming weeks after that date.
*/

-- Brand Schedule Groups
CREATE TABLE IF NOT EXISTS brand_schedule_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id bigint NOT NULL,
  store_id bigint,
  name text,
  start_date date NOT NULL,
  end_date date,
  recurrence_weeks integer,
  is_base boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_schedule_groups_brand ON brand_schedule_groups(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_schedule_groups_store ON brand_schedule_groups(store_id);

ALTER TABLE brand_schedule_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_brand_schedule_groups" ON brand_schedule_groups;
CREATE POLICY "anon_select_brand_schedule_groups" ON brand_schedule_groups FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_brand_schedule_groups" ON brand_schedule_groups;
CREATE POLICY "anon_insert_brand_schedule_groups" ON brand_schedule_groups FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_brand_schedule_groups" ON brand_schedule_groups;
CREATE POLICY "anon_update_brand_schedule_groups" ON brand_schedule_groups FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_brand_schedule_groups" ON brand_schedule_groups;
CREATE POLICY "anon_delete_brand_schedule_groups" ON brand_schedule_groups FOR DELETE
  TO anon, authenticated USING (true);

-- Brand Schedule Group Entries
CREATE TABLE IF NOT EXISTS brand_schedule_group_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES brand_schedule_groups(id) ON DELETE CASCADE,
  station_id integer NOT NULL,
  days_of_week integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  daypart_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_schedule_group_entries_group ON brand_schedule_group_entries(group_id);
CREATE INDEX IF NOT EXISTS idx_brand_schedule_group_entries_station ON brand_schedule_group_entries(station_id);

ALTER TABLE brand_schedule_group_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_brand_schedule_group_entries" ON brand_schedule_group_entries;
CREATE POLICY "anon_select_brand_schedule_group_entries" ON brand_schedule_group_entries FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_brand_schedule_group_entries" ON brand_schedule_group_entries;
CREATE POLICY "anon_insert_brand_schedule_group_entries" ON brand_schedule_group_entries FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_brand_schedule_group_entries" ON brand_schedule_group_entries;
CREATE POLICY "anon_update_brand_schedule_group_entries" ON brand_schedule_group_entries FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_brand_schedule_group_entries" ON brand_schedule_group_entries;
CREATE POLICY "anon_delete_brand_schedule_group_entries" ON brand_schedule_group_entries FOR DELETE
  TO anon, authenticated USING (true);
