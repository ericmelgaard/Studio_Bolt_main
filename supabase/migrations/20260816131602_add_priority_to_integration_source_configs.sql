/*
# Add priority column to integration_source_configs

## Purpose
Priority can be overridden per config (concept/company/site level), not just on the 
template. This matches how `is_active` works - the template has a default, but each
location level can override it.

Examples:
- All of Auntie Anne's uses POS A at priority 5 (concept-level config)
- One site is migrating to POS B and sets POS B to priority 3 (site-level override)
- A Compass site uses both Webtrition (priority 10) and Transact price-only (priority 5)
  so Transact's price mapping wins over Webtrition's

## Changes
1. New column: `priority` (integer, nullable) on integration_source_configs
   - NULL = inherit from the template's priority (wand_integration_sources.priority)
   - Setting a value = override at this level
   
2. No data migration needed - all existing configs will inherit from their template

## Security
- No RLS changes. Existing policies remain unchanged.
*/

ALTER TABLE integration_source_configs
ADD COLUMN IF NOT EXISTS priority integer;
