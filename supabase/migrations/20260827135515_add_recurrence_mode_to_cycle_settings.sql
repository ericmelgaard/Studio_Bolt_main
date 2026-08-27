/*
# Add recurrence_mode to organization_cycle_settings

Allows distinguishing between:
- "repeating" — cycle loops indefinitely through its weeks
- "static" — same schedule every week, no rotation
- "ending" — cycle repeats but stops after end_date
*/
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization_cycle_settings' AND column_name='recurrence_mode') THEN
    ALTER TABLE organization_cycle_settings ADD COLUMN recurrence_mode text NOT NULL DEFAULT 'repeating';
  END IF;
END $$;
