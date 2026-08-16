/*
# Add priority column to wand_integration_sources

## Purpose
When multiple integration sources are active at the same location, priority determines
which source's mapped attributes take precedence. Priority 1 = highest (wins over
all lower-numbered sources). For example, if Source A (priority 1) maps name and
description, and Source B (priority 2) maps price, then:
- Name and description come from Source A
- Price comes from Source B
- If both mapped name, Source A's name would win

This priority lives on the TEMPLATE (wand_integration_sources), not the per-site config.
This allows multiple templates of the same type (e.g., two PAR CSV templates: one
"PAR Export (full item)" at priority 1 and one "PAR Export (price only)" at priority 2).

## Changes
1. New column: `priority` (integer, not null, default 10) on wand_integration_sources
   - Lower number = higher priority (1 is highest)
   - Default of 10 gives room to insert higher-priority templates later
   
2. Set existing templates to sensible defaults:
   - API-based integrations (full data): priority 5
   - CSV/manual upload integrations: priority 10
   - This means API sources win over manual uploads when both are active

## Security
- No RLS changes needed. Existing policies on wand_integration_sources remain unchanged.
*/

ALTER TABLE wand_integration_sources 
ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 10;

-- Set API-based integrations to higher priority (lower number)
UPDATE wand_integration_sources SET priority = 5 
WHERE integration_type IN ('qu', 'par_api', 'par', 'revel', 'toast', 'simphony', 'clover', 'bepoz', 'shift4', 'transact', 'bonappetit', 'mealtracker', 'webtrition');

-- CSV/manual upload integrations stay at default 10 (already set by column default)
