import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface DaypartDefinition {
  id: string;
  daypart_name: string;
  display_label: string;
  description: string;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  concept_id: number | null;
  store_id: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ResolvedDaypart extends DaypartDefinition {
  source_level: 'wand' | 'concept' | 'store';
  inherited: boolean;
  overridden_by?: string;
}

/**
 * Resolves the effective set of daypart definitions for a given context
 * using the inheritance chain: Wand -> Concept -> Store.
 *
 * - Wand-level definitions (concept_id=null, store_id=null) are the base.
 * - Concept-level definitions override or extend Wand-level (matched by daypart_name).
 * - Store-level definitions override or extend Concept/Wand-level.
 * - A lower-level row with is_active=false disables an inherited daypart.
 */
export function useEffectiveDayparts(opts: {
  conceptId?: number | null;
  storeId?: number | null;
  includeSystem?: boolean; // include dark_hours, power_save (default false)
}) {
  const { conceptId, storeId, includeSystem = false } = opts;
  const [resolved, setResolved] = useState<ResolvedDaypart[]>([]);
  const [allRaw, setAllRaw] = useState<DaypartDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('daypart_definitions')
      .select('*')
      .order('sort_order');

    // Build OR filter to only fetch relevant rows
    const orClauses: string[] = ['and(concept_id.is.null,store_id.is.null)'];
    if (conceptId) {
      orClauses.push(`and(concept_id.eq.${conceptId},store_id.is.null)`);
    }
    if (storeId) {
      orClauses.push(`store_id.eq.${storeId}`);
    }
    query = query.or(orClauses.join(','));

    const { data, error } = await query;
    if (error) {
      console.error('useEffectiveDayparts: fetch error', error);
      setLoading(false);
      return;
    }

    const rows = (data || []) as DaypartDefinition[];
    setAllRaw(rows);

    // Group by level
    const wandLevel = rows.filter(r => !r.concept_id && !r.store_id);
    const conceptLevel = rows.filter(r => r.concept_id && !r.store_id);
    const storeLevel = rows.filter(r => !!r.store_id);

    // Start with wand-level as base, keyed by daypart_name
    const effective = new Map<string, ResolvedDaypart>();

    for (const def of wandLevel) {
      effective.set(def.daypart_name, {
        ...def,
        source_level: 'wand',
        inherited: false,
      });
    }

    // Apply concept-level overrides
    if (conceptId) {
      for (const def of conceptLevel) {
        const existing = effective.get(def.daypart_name);
        if (existing) {
          // Concept overrides wand
          effective.set(def.daypart_name, {
            ...def,
            source_level: 'concept',
            inherited: false,
            overridden_by: undefined,
          });
          // Mark the wand one as overridden (for reference if needed)
        } else {
          // New concept-level daypart not in wand
          effective.set(def.daypart_name, {
            ...def,
            source_level: 'concept',
            inherited: false,
          });
        }
      }

      // Mark remaining wand-level ones as inherited at concept level
      for (const [name, val] of effective) {
        if (val.source_level === 'wand') {
          effective.set(name, { ...val, inherited: true });
        }
      }
    }

    // Apply store-level overrides
    if (storeId) {
      for (const def of storeLevel) {
        effective.set(def.daypart_name, {
          ...def,
          source_level: 'store',
          inherited: false,
        });
      }

      // Mark non-store-level ones as inherited
      for (const [name, val] of effective) {
        if (val.source_level !== 'store') {
          effective.set(name, { ...val, inherited: true });
        }
      }
    }

    let result = Array.from(effective.values())
      .filter(d => d.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    if (!includeSystem) {
      result = result.filter(d => d.daypart_name !== 'dark_hours' && d.daypart_name !== 'power_save');
    }

    setResolved(result);
    setLoading(false);
  }, [conceptId, storeId, includeSystem]);

  useEffect(() => { load(); }, [load]);

  return { dayparts: resolved, allRaw, loading, reload: load };
}

/**
 * Returns only the Wand-level (global) daypart definitions.
 * Use this when you need the canonical set without any context overrides.
 */
export function useWandDayparts(opts?: { includeSystem?: boolean }) {
  return useEffectiveDayparts({
    conceptId: null,
    storeId: null,
    includeSystem: opts?.includeSystem ?? false,
  });
}
