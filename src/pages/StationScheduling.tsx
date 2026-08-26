import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, Calendar, ChevronLeft, ChevronRight, Settings, Trash2, CreditCard as Edit2, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  const [showAddStation, setShowAddStation] = useState(false);
  const [showAssignBrand, setShowAssignBrand] = useState<{ stationId: number; day: number } | null>(null);
  const [newStationName, setNewStationName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, [storeId]);

  const loadAllData = async () => {
    setLoading(true);
    const [stationsRes, brandsRes, schedulesRes, cycleRes] = await Promise.all([
      supabase.from('stations').select('*').eq('store_id', storeId).order('sort_order'),
      supabase.from('concepts').select('id, name, brand_primary_color, brand_secondary_color, icon').order('name'),
      supabase.from('station_schedules').select('*').in('station_id', (await supabase.from('stations').select('id').eq('store_id', storeId)).data?.map(s => s.id) || []),
      supabase.from('organization_cycle_settings').select('starting_week_date, cycle_duration_weeks').eq('store_id', storeId).maybeSingle()
    ]);

    if (stationsRes.data) setStations(stationsRes.data);
    if (brandsRes.data) setBrands(brandsRes.data);
    if (schedulesRes.data) setSchedules(schedulesRes.data);
    if (cycleRes.data) setCycleSettings(cycleRes.data);
    setLoading(false);
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

  const handleAddStation = async () => {
    if (!newStationName.trim()) return;
    const { error: insertError } = await supabase.from('stations').insert({
      name: newStationName.trim(),
      store_id: storeId,
      sort_order: stations.length,
      uses_cycle: true
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewStationName('');
    setShowAddStation(false);
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
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddStation(true)} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5">
              <Plus className="w-4 h-4" />Station
            </button>
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

      {/* Calendar Grid */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {stations.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No Stations</h3>
            <p className="text-slate-500 mb-6">Add stations to start scheduling brands for this location.</p>
            <button onClick={() => setShowAddStation(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Add First Station</button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-750">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-48 border-b border-r border-slate-200 dark:border-slate-700">Station</th>
                    {DAYS_SHORT.map((day, i) => (
                      <th key={i} className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 min-w-[120px]">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stations.map(station => (
                    <tr key={station.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-750/50">
                      <td className="px-4 py-3 border-b border-r border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{station.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {station.uses_cycle ? 'Cycle' : 'Static'}
                            </p>
                          </div>
                          <button onClick={() => handleDeleteStation(station.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all">
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
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Current cycle week: <strong className="text-slate-700 dark:text-slate-300">Week {currentCycleWeek}</strong></span>
            {cycleSettings && <span className="text-slate-400">({cycleDuration}-week rotation starting {new Date(cycleSettings.starting_week_date).toLocaleDateString()})</span>}
          </div>
        )}
      </div>

      {/* Add Station Modal */}
      {showAddStation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Add Station</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Station Name</label>
                <input type="text" value={newStationName} onChange={e => setNewStationName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" placeholder="e.g., Grill, Deli, Salad Bar" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowAddStation(false); setNewStationName(''); }} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors">Cancel</button>
              <button onClick={handleAddStation} disabled={!newStationName.trim()} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">Add</button>
            </div>
          </div>
        </div>
      )}

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
