import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, Calendar, ChevronLeft, ChevronRight, Settings, Trash2, CreditCard as Edit2, MapPin, Inbox } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StationCombobox, { StationSuggestion } from '../components/StationCombobox';

interface StationSchedulingProps {
  storeId: number;
  storeName: string;
  onBack: () => void;
}

interface Station {
  id: number;
  name: string;
  uses_cycle: boolean;
  status: string;
  sort_order: number;
  source: string | null;
  concept_id: number | null;
  store_id: number | null;
}

interface Brand {
  id: number;
  name: string;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  icon: string | null;
}

interface StationSchedule {
  id: string;
  station_id: number;
  brand_id: number;
  cycle_week: number | null;
  days_of_week: number[];
  is_active: boolean;
}

interface CycleSettings {
  starting_week_date: string;
  cycle_duration_weeks: number;
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StationScheduling({ storeId, storeName, onBack }: StationSchedulingProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [schedules, setSchedules] = useState<StationSchedule[]>([]);
  const [cycleSettings, setCycleSettings] = useState<CycleSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeWeek, setActiveWeek] = useState(1);
  const [showAssignBrand, setShowAssignBrand] = useState<{ stationId: number; day: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comboboxSuggestions, setComboboxSuggestions] = useState<StationSuggestion[]>([]);

  useEffect(() => {
    loadAllData();
  }, [storeId]);

  const loadAllData = async () => {
    setLoading(true);

    const storeStationIdsRes = await supabase.from('stations').select('id').eq('store_id', storeId);
    const storeStationIds = storeStationIdsRes.data?.map(s => s.id) || [];

    const [stationsRes, brandsRes, schedulesRes, cycleRes] = await Promise.all([
      supabase.from('stations').select('*').eq('store_id', storeId).order('sort_order'),
      supabase.from('concepts').select('id, name, brand_primary_color, brand_secondary_color, icon').order('name'),
      storeStationIds.length > 0
        ? supabase.from('station_schedules').select('*').in('station_id', storeStationIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('organization_cycle_settings').select('starting_week_date, cycle_duration_weeks').eq('store_id', storeId).maybeSingle()
    ]);

    if (stationsRes.data) setStations(stationsRes.data as Station[]);
    if (brandsRes.data) setBrands(brandsRes.data as Brand[]);
    if (schedulesRes.data) setSchedules(schedulesRes.data as StationSchedule[]);
    if (cycleRes.data) setCycleSettings(cycleRes.data as CycleSettings);

    const existingStationNames = (stationsRes.data || []).map((s: any) => s.name.toLowerCase());
    await loadSuggestions(existingStationNames);

    setLoading(false);
  };

  const loadSuggestions = async (existingNamesLower: string[] = []) => {
    const { data: storeData } = await supabase
      .from('stores')
      .select('company_id')
      .eq('id', storeId)
      .maybeSingle();

    if (!storeData) return;
    const companyId = storeData.company_id;

    const { data: companyData } = await supabase
      .from('companies')
      .select('concept_id')
      .eq('id', companyId)
      .maybeSingle();

    let conceptId: number | null = null;
    if (companyData?.concept_id) {
      conceptId = companyData.concept_id;
    } else {
      const { data: brandLink } = await supabase
        .from('company_brands')
        .select('concept_id')
        .eq('company_id', companyId)
        .limit(1)
        .maybeSingle();
      conceptId = brandLink?.concept_id || null;
    }

    const [inheritedRes, feedRes] = await Promise.all([
      conceptId
        ? supabase.from('stations').select('id, name').eq('concept_id', conceptId).order('name')
        : Promise.resolve({ data: [], error: null }),
      supabase.from('feed_station_names').select('id, name, adopted').eq('store_id', storeId).order('name'),
    ]);

    const existingNames = existingNamesLower;

    const inheritedSuggestions: StationSuggestion[] = (inheritedRes.data || [])
      .filter((s: any) => !existingNames.includes(s.name.toLowerCase()))
      .map((s: any) => ({ id: s.id, name: s.name, source: 'inherited' as const, station_id: s.id }));

    const feedSuggestions: StationSuggestion[] = (feedRes.data || [])
      .filter((f: any) => !f.adopted && !existingNames.includes(f.name.toLowerCase()))
      .map((f: any) => ({ id: f.id, name: f.name, source: 'feed' as const }));

    setComboboxSuggestions([...inheritedSuggestions, ...feedSuggestions]);
  };

  const cycleDuration = cycleSettings?.cycle_duration_weeks || 1;

  const currentCycleWeek = useMemo(() => {
    if (!cycleSettings) return 1;
    const start = new Date(cycleSettings.starting_week_date);
    const now = new Date();
    const diffWeeks = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return ((diffWeeks % cycleDuration) + cycleDuration) % cycleDuration + 1;
  }, [cycleSettings, cycleDuration]);

  const getScheduleForCell = (stationId: number, dayOfWeek: number): StationSchedule | undefined => {
    return schedules.find(s =>
      s.station_id === stationId &&
      s.days_of_week.includes(dayOfWeek) &&
      s.is_active &&
      (s.cycle_week === activeWeek || s.cycle_week === null)
    );
  };

  const getBrandForSchedule = (schedule: StationSchedule | undefined): Brand | undefined => {
    if (!schedule) return undefined;
    return brands.find(b => b.id === schedule.brand_id);
  };

  const handleSelectStation = async (name: string, suggestion?: StationSuggestion) => {
    if (suggestion && suggestion.source === 'inherited' && suggestion.station_id) {
      const { error: insertError } = await supabase.from('stations').insert({
        name: suggestion.name,
        store_id: storeId,
        concept_id: null,
        source: 'inherited',
        sort_order: stations.length,
        uses_cycle: true,
      });
      if (insertError) {
        setError(insertError.message);
        return;
      }
    } else if (suggestion && suggestion.source === 'feed') {
      const { error: insertError } = await supabase.from('stations').insert({
        name: suggestion.name,
        store_id: storeId,
        concept_id: null,
        source: 'feed',
        sort_order: stations.length,
        uses_cycle: true,
      });
      if (insertError) {
        setError(insertError.message);
        return;
      }
      await supabase.from('feed_station_names').update({ adopted: true }).eq('id', suggestion.id);
    } else {
      const { error: insertError } = await supabase.from('stations').insert({
        name,
        store_id: storeId,
        concept_id: null,
        source: 'manual',
        sort_order: stations.length,
        uses_cycle: true,
      });
      if (insertError) {
        setError(insertError.message);
        return;
      }
    }
    setError(null);
    loadAllData();
  };

  const handleDeleteStation = async (stationId: number) => {
    await supabase.from('stations').delete().eq('id', stationId);
    loadAllData();
  };

  const handleAssignBrand = async (brandId: number) => {
    if (!showAssignBrand) return;
    const { stationId, day } = showAssignBrand;
    const station = stations.find(s => s.id === stationId);

    const existingSchedule = getScheduleForCell(stationId, day);
    if (existingSchedule) {
      const newDays = existingSchedule.days_of_week.filter(d => d !== day);
      if (newDays.length === 0) {
        await supabase.from('station_schedules').delete().eq('id', existingSchedule.id);
      } else {
        await supabase.from('station_schedules').update({ days_of_week: newDays }).eq('id', existingSchedule.id);
      }
    }

    const matchingSchedule = schedules.find(s =>
      s.station_id === stationId &&
      s.brand_id === brandId &&
      s.is_active &&
      (s.cycle_week === (station?.uses_cycle ? activeWeek : null))
    );

    if (matchingSchedule) {
      const updatedDays = [...new Set([...matchingSchedule.days_of_week, day])].sort();
      await supabase.from('station_schedules').update({ days_of_week: updatedDays }).eq('id', matchingSchedule.id);
    } else {
      await supabase.from('station_schedules').insert({
        station_id: stationId,
        brand_id: brandId,
        cycle_week: station?.uses_cycle ? activeWeek : null,
        days_of_week: [day],
        is_active: true
      });
    }

    setShowAssignBrand(null);
    loadAllData();
  };

  const handleClearCell = async (stationId: number, day: number) => {
    const schedule = getScheduleForCell(stationId, day);
    if (!schedule) return;

    const newDays = schedule.days_of_week.filter(d => d !== day);
    if (newDays.length === 0) {
      await supabase.from('station_schedules').delete().eq('id', schedule.id);
    } else {
      await supabase.from('station_schedules').update({ days_of_week: newDays }).eq('id', schedule.id);
    }
    loadAllData();
  };

  const sourceBadge = (source: string | null) => {
    const config: Record<string, { label: string; className: string }> = {
      inherited: { label: 'Inherited', className: 'bg-blue-100 text-blue-700' },
      feed: { label: 'From Feed', className: 'bg-amber-100 text-amber-700' },
      manual: { label: 'Local', className: 'bg-slate-100 text-slate-600' },
    };
    const c = config[source || 'manual'] || config.manual;
    return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${c.className}`}>{c.label}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Station Scheduling</h1>
                <p className="text-xs text-slate-500">{storeName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cycle Week Tabs */}
        {cycleDuration > 1 && (
          <div className="px-6 pb-3 flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 mr-2">Cycle Week:</span>
            {Array.from({ length: cycleDuration }, (_, i) => i + 1).map(week => (
              <button
                key={week}
                onClick={() => setActiveWeek(week)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  activeWeek === week
                    ? 'bg-blue-600 text-white shadow-sm'
                    : week === currentCycleWeek
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Week {week}
                {week === currentCycleWeek && activeWeek !== week && <span className="ml-1 text-[10px]">(now)</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {/* Add Station Combobox */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add Station</h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Type to search inherited stations from the concept, stations from the data feed, or create a new one by typing a unique name.
          </p>
          <StationCombobox
            suggestions={comboboxSuggestions}
            existingNames={stations.map(s => s.name)}
            onSelect={handleSelectStation}
          />
        </div>

        {/* Station Grid */}
        {stations.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No Stations</h3>
            <p className="text-slate-500 mb-2">Use the search above to add stations from the inherited list, the data feed, or by creating your own.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-750">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-56 border-b border-r border-slate-200 dark:border-slate-700">Station</th>
                    {DAYS_SHORT.map((day, i) => (
                      <th key={i} className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 min-w-[120px]">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stations.map(station => (
                    <tr key={station.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-750/50">
                      <td className="px-4 py-3 border-b border-r border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{station.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-400">
                                {station.uses_cycle ? 'Cycle' : 'Static'}
                              </span>
                              {sourceBadge(station.source)}
                            </div>
                          </div>
                          <button onClick={() => handleDeleteStation(station.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all flex-shrink-0">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </td>
                      {DAYS_SHORT.map((_, dayIndex) => {
                        const schedule = getScheduleForCell(station.id, dayIndex);
                        const brand = getBrandForSchedule(schedule);
                        return (
                          <td key={dayIndex} className="px-1 py-2 border-b border-slate-200 dark:border-slate-700 text-center">
                            {brand ? (
                              <div
                                className="relative group/cell rounded-lg px-2 py-2 mx-1 cursor-pointer transition-all hover:shadow-md"
                                style={{
                                  backgroundColor: brand.brand_primary_color ? `${brand.brand_primary_color}18` : '#f1f5f9',
                                  borderLeft: `3px solid ${brand.brand_primary_color || '#94a3b8'}`
                                }}
                                onClick={() => setShowAssignBrand({ stationId: station.id, day: dayIndex })}
                              >
                                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{brand.name}</p>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleClearCell(station.id, dayIndex); }}
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center justify-center text-[10px]"
                                >
                                  x
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowAssignBrand({ stationId: station.id, day: dayIndex })}
                                className="w-full h-10 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all mx-1 flex items-center justify-center"
                              >
                                <Plus className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Today indicator */}
        {cycleDuration > 1 && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Current cycle week: <strong className="text-slate-700 dark:text-slate-300">Week {currentCycleWeek}</strong></span>
            {cycleSettings && <span className="text-slate-400">({cycleDuration}-week rotation starting {new Date(cycleSettings.starting_week_date).toLocaleDateString()})</span>}
          </div>
        )}
      </div>

      {/* Assign Brand Modal */}
      {showAssignBrand && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[70vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Assign Brand
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {stations.find(s => s.id === showAssignBrand.stationId)?.name} - {DAYS_FULL[showAssignBrand.day]}
                {cycleDuration > 1 && ` (Week ${activeWeek})`}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {brands.map(brand => (
                <button
                  key={brand.id}
                  onClick={() => handleAssignBrand(brand.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-left transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: brand.brand_primary_color || '#64748b' }}
                  >
                    {brand.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{brand.name}</span>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setShowAssignBrand(null)} className="w-full px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
