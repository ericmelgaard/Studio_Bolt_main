import { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, Copy, Check, X, ChevronLeft, ChevronRight, Trash2, BarChart3, Grid3x3 as Grid3X3, Coffee, Sun, Sunset, Moon } from 'lucide-react';
import { supabase } from '../lib/supabase';

/* ─── Types ─── */

interface StationSchedule {
  id: string;
  station_id: number;
  brand_id: number;
  cycle_week: number | null;
  days_of_week: number[];
  is_active: boolean;
  daypart_id: string | null;
}

interface Station {
  id: number;
  name: string;
  store_id: number | null;
  uses_cycle: boolean;
  status: string;
}

interface CycleSettings {
  id: string;
  cycle_duration_weeks: number;
  starting_week_date: string;
  end_date: string | null;
  cycle_name: string | null;
  store_id: number | null;
}

interface DaypartDef {
  id: string;
  daypart_name: string;
  display_label: string;
  color: string;
}

interface ScheduleRow {
  station: Station;
  daypartId: string | null;
  daypartLabel: string;
}

interface Props {
  brandId: number;
  brandColor: string;
  userStoreId?: number | null;
  onNavigateToScheduling?: () => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0]; // Mon=1..Sat=6, Sun=0

const DAYPART_ICONS: Record<string, React.ReactNode> = {
  breakfast: <Coffee className="w-3 h-3" />,
  lunch: <Sun className="w-3 h-3" />,
  dinner: <Sunset className="w-3 h-3" />,
  late_night: <Moon className="w-3 h-3" />,
};

export default function BrandScheduleEditor({ brandId, brandColor, userStoreId, onNavigateToScheduling }: Props) {
  const [stations, setStations] = useState<Station[]>([]);
  const [allStoreStations, setAllStoreStations] = useState<Station[]>([]);
  const [schedules, setSchedules] = useState<StationSchedule[]>([]);
  const [cycleSettings, setCycleSettings] = useState<CycleSettings | null>(null);
  const [daypartDefs, setDaypartDefs] = useState<DaypartDef[]>([]);
  const [selectedCycleWeek, setSelectedCycleWeek] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddStation, setShowAddStation] = useState(false);
  const [showCycleSetup, setShowCycleSetup] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'gantt'>('week');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, [brandId]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadScheduleData(), loadDayparts(), loadAllStoreStations()]);
    setLoading(false);
  };

  const loadScheduleData = async () => {
    const { data: schedData } = await supabase
      .from('station_schedules')
      .select('id, station_id, brand_id, cycle_week, days_of_week, is_active, daypart_id')
      .eq('brand_id', brandId);
    if (schedData) setSchedules(schedData);

    const stationIds = [...new Set((schedData || []).map(s => s.station_id))];
    if (stationIds.length > 0) {
      const { data: stData } = await supabase.from('stations').select('id, name, store_id, uses_cycle, status').in('id', stationIds);
      if (stData) setStations(stData);

      const firstStoreId = stData?.[0]?.store_id || userStoreId;
      if (firstStoreId) {
        const { data: cycleData } = await supabase
          .from('organization_cycle_settings')
          .select('id, cycle_duration_weeks, starting_week_date, end_date, cycle_name, store_id')
          .eq('store_id', firstStoreId)
          .maybeSingle();
        if (cycleData) setCycleSettings(cycleData);
      }
    } else if (userStoreId) {
      const { data: cycleData } = await supabase
        .from('organization_cycle_settings')
        .select('id, cycle_duration_weeks, starting_week_date, end_date, cycle_name, store_id')
        .eq('store_id', userStoreId)
        .maybeSingle();
      if (cycleData) setCycleSettings(cycleData);
    }
  };

  const loadDayparts = async () => {
    const { data } = await supabase.from('daypart_definitions').select('id, daypart_name, display_label, color').eq('is_active', true).order('sort_order');
    if (data) {
      const unique = data.reduce<DaypartDef[]>((acc, d) => {
        if (!acc.find(x => x.daypart_name === d.daypart_name)) acc.push(d);
        return acc;
      }, []);
      setDaypartDefs(unique);
    }
  };

  const loadAllStoreStations = async () => {
    if (!userStoreId) {
      const { data } = await supabase.from('stations').select('id, name, store_id, uses_cycle, status').eq('status', 'active').order('sort_order').limit(100);
      if (data) setAllStoreStations(data);
    } else {
      const { data } = await supabase.from('stations').select('id, name, store_id, uses_cycle, status').eq('store_id', userStoreId).eq('status', 'active').order('sort_order');
      if (data) setAllStoreStations(data);
    }
  };

  const cycleDuration = cycleSettings?.cycle_duration_weeks || 1;
  const cycleWeeks = Array.from({ length: cycleDuration }, (_, i) => i + 1);
  const cycleName = cycleSettings?.cycle_name || '';

  const getWeekLabel = (weekNum: number) => {
    if (cycleName) return `${cycleName} Week ${weekNum}`;
    return `Week ${weekNum}`;
  };

  const scheduleRows = useMemo<ScheduleRow[]>(() => {
    const rows: ScheduleRow[] = [];
    const seen = new Set<string>();

    for (const sched of schedules) {
      const station = stations.find(s => s.id === sched.station_id);
      if (!station) continue;
      const key = `${sched.station_id}-${sched.daypart_id || 'all'}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const dp = sched.daypart_id ? daypartDefs.find(d => d.id === sched.daypart_id) : null;
      rows.push({
        station,
        daypartId: sched.daypart_id,
        daypartLabel: dp ? dp.display_label : 'All Dayparts',
      });
    }

    rows.sort((a, b) => a.station.name.localeCompare(b.station.name));
    return rows;
  }, [schedules, stations, daypartDefs]);

  const getScheduleForRow = (stationId: number, daypartId: string | null, weekNum: number) => {
    const cycleWeekValue = cycleDuration === 1 ? null : weekNum;
    return schedules.find(s =>
      s.station_id === stationId &&
      s.is_active &&
      (s.daypart_id === daypartId || (s.daypart_id === null && daypartId === null)) &&
      (s.cycle_week === cycleWeekValue || (cycleDuration === 1 && s.cycle_week === null))
    );
  };

  const toggleDayForRow = async (stationId: number, daypartId: string | null, dayIndex: number, weekNum: number) => {
    setSaving(true);
    const cycleWeekValue = cycleDuration === 1 ? null : weekNum;
    const existing = schedules.find(s =>
      s.station_id === stationId &&
      s.brand_id === brandId &&
      s.is_active &&
      (s.daypart_id === daypartId || (s.daypart_id === null && daypartId === null)) &&
      (s.cycle_week === cycleWeekValue || (cycleDuration === 1 && s.cycle_week === null))
    );

    if (existing) {
      const hasDayNow = existing.days_of_week.includes(dayIndex);
      const newDays = hasDayNow
        ? existing.days_of_week.filter(d => d !== dayIndex)
        : [...existing.days_of_week, dayIndex];

      if (newDays.length === 0) {
        await supabase.from('station_schedules').delete().eq('id', existing.id);
        setSchedules(prev => prev.filter(s => s.id !== existing.id));
      } else {
        await supabase.from('station_schedules').update({ days_of_week: newDays }).eq('id', existing.id);
        setSchedules(prev => prev.map(s => s.id === existing.id ? { ...s, days_of_week: newDays } : s));
      }
    } else {
      const { data } = await supabase
        .from('station_schedules')
        .insert({ station_id: stationId, brand_id: brandId, cycle_week: cycleWeekValue, days_of_week: [dayIndex], is_active: true, daypart_id: daypartId })
        .select().maybeSingle();
      if (data) setSchedules(prev => [...prev, data]);
    }
    setSaving(false);
  };

  const handleAddStation = async (stationId: number, daypartId: string | null) => {
    setSaving(true);
    const cycleWeekValue = cycleDuration === 1 ? null : selectedCycleWeek;
    const { data } = await supabase
      .from('station_schedules')
      .insert({ station_id: stationId, brand_id: brandId, cycle_week: cycleWeekValue, days_of_week: [1, 2, 3, 4, 5], is_active: true, daypart_id: daypartId })
      .select().maybeSingle();
    if (data) {
      setSchedules(prev => [...prev, data]);
      const station = allStoreStations.find(s => s.id === stationId);
      if (station && !stations.find(s => s.id === stationId)) {
        setStations(prev => [...prev, station]);
      }
    }
    setShowAddStation(false);
    setSaving(false);
    setToast('Station added');
  };

  const handleRemoveRow = async (stationId: number, daypartId: string | null) => {
    setSaving(true);
    let query = supabase.from('station_schedules').delete().eq('station_id', stationId).eq('brand_id', brandId);
    if (daypartId) {
      query = query.eq('daypart_id', daypartId);
    } else {
      query = query.is('daypart_id', null);
    }
    await query;
    setSchedules(prev => prev.filter(s => !(s.station_id === stationId && (daypartId ? s.daypart_id === daypartId : s.daypart_id === null))));
    setSaving(false);
    setToast('Station removed');
  };

  const ensureCycleSettings = async (): Promise<CycleSettings | null> => {
    if (cycleSettings) return cycleSettings;
    const storeId = stations[0]?.store_id || userStoreId;
    if (!storeId) {
      setShowCycleSetup(true);
      return null;
    }
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('organization_cycle_settings')
      .insert({ store_id: storeId, cycle_duration_weeks: 1, starting_week_date: today })
      .select().maybeSingle();
    if (data) {
      setCycleSettings(data);
      return data;
    }
    return null;
  };

  const addCycleWeek = async () => {
    const settings = await ensureCycleSettings();
    if (!settings) {
      setShowCycleSetup(true);
      return;
    }
    const newDuration = settings.cycle_duration_weeks + 1;
    await supabase.from('organization_cycle_settings').update({ cycle_duration_weeks: newDuration }).eq('id', settings.id);
    const updated = { ...settings, cycle_duration_weeks: newDuration };
    setCycleSettings(updated);
    setSelectedCycleWeek(newDuration);
    setToast(`Week ${newDuration} added`);
  };

  const repeatWeek = async (sourceWeek: number) => {
    const settings = await ensureCycleSettings();
    if (!settings) return;
    setSaving(true);

    const targetWeek = settings.cycle_duration_weeks + 1;
    await supabase.from('organization_cycle_settings').update({ cycle_duration_weeks: targetWeek }).eq('id', settings.id);
    setCycleSettings({ ...settings, cycle_duration_weeks: targetWeek });

    const sourceWeekValue = settings.cycle_duration_weeks === 1 ? null : sourceWeek;
    const sourceSchedules = schedules.filter(s =>
      s.is_active && (s.cycle_week === sourceWeekValue || (settings.cycle_duration_weeks === 1 && s.cycle_week === null))
    );

    if (sourceSchedules.length > 0) {
      const newRows = sourceSchedules.map(s => ({
        station_id: s.station_id,
        brand_id: s.brand_id,
        cycle_week: targetWeek,
        days_of_week: [...s.days_of_week],
        is_active: true,
        daypart_id: s.daypart_id,
      }));
      const { data } = await supabase.from('station_schedules').insert(newRows).select();
      if (data) setSchedules(prev => [...prev, ...data]);
    }

    setSelectedCycleWeek(targetWeek);
    setSaving(false);
    setToast(`Week ${targetWeek} created (copied from Week ${sourceWeek})`);
  };

  const handleSaveCycleSetup = async (name: string, startDate: string, endDate: string) => {
    const storeId = stations[0]?.store_id || userStoreId;
    if (!storeId) return;
    setSaving(true);

    if (cycleSettings) {
      await supabase.from('organization_cycle_settings').update({ cycle_name: name || null, starting_week_date: startDate, end_date: endDate || null }).eq('id', cycleSettings.id);
      setCycleSettings({ ...cycleSettings, cycle_name: name || null, starting_week_date: startDate, end_date: endDate || null });
    } else {
      const { data } = await supabase
        .from('organization_cycle_settings')
        .insert({ store_id: storeId, cycle_duration_weeks: 1, starting_week_date: startDate, end_date: endDate || null, cycle_name: name || null })
        .select().maybeSingle();
      if (data) setCycleSettings(data);
    }
    setShowCycleSetup(false);
    setSaving(false);
    setToast('Cycle settings saved');
  };

  // Gantt helpers
  const getWeekStartDate = (weekNum: number): Date | null => {
    if (!cycleSettings?.starting_week_date) return null;
    const start = new Date(cycleSettings.starting_week_date + 'T00:00:00');
    start.setDate(start.getDate() + (weekNum - 1) * 7);
    return start;
  };

  const formatShortDate = (d: Date) => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00adf0]"></div>
      </div>
    );
  }

  return (
    <div data-section="schedule" className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div className="absolute top-3 right-3 z-20 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg shadow-lg animate-fade-in flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#00adf0]" /> Cycle Schedule
          </h2>
          <div className="flex items-center gap-2">
            {saving && <span className="text-xs text-slate-400 animate-pulse">Saving...</span>}

            {/* View toggle */}
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('week')}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'week' ? 'bg-[#00adf0] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                title="Weekly view"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('gantt')}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'gantt' ? 'bg-[#00adf0] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                title="Timeline view"
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button onClick={() => setShowAddStation(true)} className="px-3 py-1.5 text-xs font-medium text-white bg-[#00adf0] hover:bg-[#0099d6] rounded-lg transition-colors flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Station
            </button>
            <button onClick={() => repeatWeek(selectedCycleWeek)} className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5" title="Duplicate this week">
              <Copy className="w-3.5 h-3.5" /> Repeat Week
            </button>
            <button onClick={addCycleWeek} className="px-3 py-1.5 text-xs font-medium text-[#00adf0] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Week
            </button>
          </div>
        </div>

        {/* Cycle info bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {cycleName && <span className="text-sm font-semibold text-slate-700">{cycleName}</span>}
            {cycleSettings?.starting_week_date && (
              <span className="text-xs text-slate-400">
                {formatShortDate(new Date(cycleSettings.starting_week_date + 'T00:00:00'))}
                {cycleSettings.end_date && ` - ${formatShortDate(new Date(cycleSettings.end_date + 'T00:00:00'))}`}
              </span>
            )}
            <button onClick={() => setShowCycleSetup(true)} className="text-xs text-[#00adf0] hover:text-[#0099d6] font-medium">
              {cycleSettings ? 'Edit Cycle' : 'Set Up Cycle'}
            </button>
          </div>

          {/* Daypart legend */}
          {daypartDefs.length > 0 && (
            <div className="flex items-center gap-3">
              {daypartDefs.map(dp => (
                <div key={dp.id} className="flex items-center gap-1">
                  {DAYPART_ICONS[dp.daypart_name] || <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />}
                  <span className="text-[10px] text-slate-500">{dp.display_label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cycle week tabs */}
        {cycleDuration > 1 && (
          <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1">
            {cycleWeeks.map(w => {
              const weekStart = getWeekStartDate(w);
              return (
                <button key={w} onClick={() => setSelectedCycleWeek(w)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap flex flex-col items-center min-w-[80px] ${
                    selectedCycleWeek === w ? 'text-white shadow-sm' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                  }`}
                  style={selectedCycleWeek === w ? { backgroundColor: brandColor } : undefined}
                >
                  <span>{cycleName ? `${cycleName} Wk ${w}` : `Week ${w}`}</span>
                  {weekStart && <span className="text-[9px] opacity-75 mt-0.5">{formatShortDate(weekStart)}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {scheduleRows.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No stations assigned to this brand yet</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">Add a station to start building this brand's schedule.</p>
            <button onClick={() => setShowAddStation(true)} className="px-4 py-2 text-sm bg-[#00adf0] text-white rounded-lg hover:bg-[#0099d6] transition-colors inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Station
            </button>
          </div>
        ) : viewMode === 'week' ? (
          <WeeklyGrid
            rows={scheduleRows}
            selectedWeek={selectedCycleWeek}
            cycleDuration={cycleDuration}
            schedules={schedules}
            brandColor={brandColor}
            saving={saving}
            daypartDefs={daypartDefs}
            onToggleDay={toggleDayForRow}
            onRemoveRow={handleRemoveRow}
            getScheduleForRow={getScheduleForRow}
          />
        ) : (
          <GanttView
            rows={scheduleRows}
            cycleWeeks={cycleWeeks}
            cycleDuration={cycleDuration}
            schedules={schedules}
            cycleSettings={cycleSettings}
            brandColor={brandColor}
            daypartDefs={daypartDefs}
            getWeekStartDate={getWeekStartDate}
            formatShortDate={formatShortDate}
            getScheduleForRow={getScheduleForRow}
            getWeekLabel={getWeekLabel}
          />
        )}
      </div>

      {/* Add Station Modal */}
      {showAddStation && (
        <AddStationModal
          allStations={allStoreStations}
          existingRows={scheduleRows}
          daypartDefs={daypartDefs}
          saving={saving}
          onAdd={handleAddStation}
          onClose={() => setShowAddStation(false)}
        />
      )}

      {/* Cycle Setup Modal */}
      {showCycleSetup && (
        <CycleSetupModal
          existing={cycleSettings}
          saving={saving}
          onSave={handleSaveCycleSetup}
          onClose={() => setShowCycleSetup(false)}
        />
      )}
    </div>
  );
}

/* ─── Weekly Grid View ─── */

function WeeklyGrid({ rows, selectedWeek, cycleDuration, schedules, brandColor, saving, daypartDefs, onToggleDay, onRemoveRow, getScheduleForRow }: {
  rows: ScheduleRow[];
  selectedWeek: number;
  cycleDuration: number;
  schedules: StationSchedule[];
  brandColor: string;
  saving: boolean;
  daypartDefs: DaypartDef[];
  onToggleDay: (stationId: number, daypartId: string | null, dayIndex: number, weekNum: number) => void;
  onRemoveRow: (stationId: number, daypartId: string | null) => void;
  getScheduleForRow: (stationId: number, daypartId: string | null, weekNum: number) => StationSchedule | undefined;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4 w-56">Station</th>
            {DAY_NAMES.map(day => (
              <th key={day} className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3 w-14">{day}</th>
            ))}
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const sched = getScheduleForRow(row.station.id, row.daypartId, selectedWeek);
            const activeDays = sched?.days_of_week || [];
            const dpDef = row.daypartId ? daypartDefs.find(d => d.id === row.daypartId) : null;

            return (
              <tr key={`${row.station.id}-${row.daypartId || 'all'}`} className="border-t border-slate-100 group/row hover:bg-slate-50/50 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: brandColor }}>
                      {row.station.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{row.station.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {dpDef ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                            {DAYPART_ICONS[dpDef.daypart_name]} {dpDef.display_label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">All Dayparts</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                {DAY_INDICES.map((dayIndex, colIdx) => {
                  const isActive = activeDays.includes(dayIndex);
                  return (
                    <td key={colIdx} className="py-3">
                      <div className="flex justify-center">
                        <button
                          onClick={() => onToggleDay(row.station.id, row.daypartId, dayIndex, selectedWeek)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border-2 ${
                            isActive
                              ? 'text-white border-transparent shadow-sm hover:opacity-80'
                              : 'border-slate-200 bg-white text-slate-300 hover:border-slate-300 hover:text-slate-400'
                          }`}
                          style={isActive ? { backgroundColor: brandColor, borderColor: brandColor } : undefined}
                          disabled={saving}
                        >
                          {isActive ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px]">{DAY_LABELS[colIdx]}</span>}
                        </button>
                      </div>
                    </td>
                  );
                })}
                <td className="py-3">
                  <button onClick={() => onRemoveRow(row.station.id, row.daypartId)} className="p-1 opacity-0 group-hover/row:opacity-100 hover:bg-red-50 rounded transition-all" title="Remove station">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Gantt Timeline View ─── */

function GanttView({ rows, cycleWeeks, cycleDuration, schedules, cycleSettings, brandColor, daypartDefs, getWeekStartDate, formatShortDate, getScheduleForRow, getWeekLabel }: {
  rows: ScheduleRow[];
  cycleWeeks: number[];
  cycleDuration: number;
  schedules: StationSchedule[];
  cycleSettings: CycleSettings | null;
  brandColor: string;
  daypartDefs: DaypartDef[];
  getWeekStartDate: (weekNum: number) => Date | null;
  formatShortDate: (d: Date) => string;
  getScheduleForRow: (stationId: number, daypartId: string | null, weekNum: number) => StationSchedule | undefined;
  getWeekLabel: (weekNum: number) => string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-3 w-48 sticky left-0 bg-white z-10">Station</th>
            {cycleWeeks.map(w => {
              const weekStart = getWeekStartDate(w);
              return (
                <th key={w} colSpan={7} className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wide pb-1 border-l border-slate-100 min-w-[168px]">
                  <div>{getWeekLabel(w)}</div>
                  {weekStart && <div className="text-[9px] font-normal text-slate-400 mt-0.5">{formatShortDate(weekStart)}</div>}
                </th>
              );
            })}
          </tr>
          <tr>
            <th className="sticky left-0 bg-white z-10"></th>
            {cycleWeeks.map(w => (
              DAY_LABELS.map((label, idx) => (
                <th key={`${w}-${idx}`} className={`text-center text-[9px] text-slate-400 pb-2 w-6 ${idx === 0 ? 'border-l border-slate-100' : ''}`}>{label}</th>
              ))
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const dpDef = row.daypartId ? daypartDefs.find(d => d.id === row.daypartId) : null;
            return (
              <tr key={`${row.station.id}-${row.daypartId || 'all'}`} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="py-2 pr-3 sticky left-0 bg-white z-10">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: brandColor }}>
                      {row.station.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate leading-tight">{row.station.name}</p>
                      <p className="text-[9px] text-slate-400 leading-tight">{dpDef ? dpDef.display_label : 'All'}</p>
                    </div>
                  </div>
                </td>
                {cycleWeeks.map(w => {
                  const sched = getScheduleForRow(row.station.id, row.daypartId, w);
                  const activeDays = sched?.days_of_week || [];
                  return DAY_INDICES.map((dayIndex, colIdx) => {
                    const isActive = activeDays.includes(dayIndex);
                    return (
                      <td key={`${w}-${colIdx}`} className={`py-2 ${colIdx === 0 ? 'border-l border-slate-100' : ''}`}>
                        <div className="flex justify-center">
                          <div className={`w-4 h-4 rounded-sm ${isActive ? 'shadow-sm' : ''}`} style={isActive ? { backgroundColor: brandColor } : { backgroundColor: '#f1f5f9' }} />
                        </div>
                      </td>
                    );
                  });
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Add Station Modal ─── */

function AddStationModal({ allStations, existingRows, daypartDefs, saving, onAdd, onClose }: {
  allStations: Station[];
  existingRows: ScheduleRow[];
  daypartDefs: DaypartDef[];
  saving: boolean;
  onAdd: (stationId: number, daypartId: string | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedStation, setSelectedStation] = useState<number | null>(null);
  const [selectedDaypart, setSelectedDaypart] = useState<string>('all');

  const filtered = search.trim()
    ? allStations.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : allStations;

  const handleAdd = () => {
    if (!selectedStation) return;
    onAdd(selectedStation, selectedDaypart === 'all' ? null : selectedDaypart);
  };

  const isAlreadyAdded = (stationId: number, dpId: string | null) => {
    return existingRows.some(r => r.station.id === stationId && r.daypartId === dpId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">Add Station</h2>
            <p className="text-xs text-slate-500 mt-0.5">Pick a station and daypart for this brand</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <div className="relative">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stations..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" autoFocus />
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No stations found</p>
            ) : (
              filtered.map(station => (
                <button key={station.id} onClick={() => setSelectedStation(station.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${
                    selectedStation === station.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">{station.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{station.name}</p>
                    <p className="text-[10px] text-slate-400">{station.uses_cycle ? 'Cycle' : 'Static'}</p>
                  </div>
                  {selectedStation === station.id && <Check className="w-4 h-4 text-[#00adf0] shrink-0" />}
                </button>
              ))
            )}
          </div>

          {selectedStation && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Daypart Assignment</label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedDaypart('all')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                    selectedDaypart === 'all' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  } ${isAlreadyAdded(selectedStation, null) ? 'opacity-40 cursor-not-allowed' : ''}`}
                  disabled={isAlreadyAdded(selectedStation, null)}
                >
                  All Dayparts
                </button>
                {daypartDefs.map(dp => (
                  <button key={dp.id} onClick={() => setSelectedDaypart(dp.id)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
                      selectedDaypart === dp.id ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    } ${isAlreadyAdded(selectedStation, dp.id) ? 'opacity-40 cursor-not-allowed' : ''}`}
                    disabled={isAlreadyAdded(selectedStation, dp.id)}
                  >
                    {DAYPART_ICONS[dp.daypart_name]} {dp.display_label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleAdd} disabled={!selectedStation || saving || isAlreadyAdded(selectedStation, selectedDaypart === 'all' ? null : selectedDaypart)}
            className="px-4 py-2 text-sm font-medium text-white bg-[#00adf0] rounded-lg hover:bg-[#0099d6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Adding...' : 'Add Station'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Cycle Setup Modal ─── */

function CycleSetupModal({ existing, saving, onSave, onClose }: {
  existing: CycleSettings | null;
  saving: boolean;
  onSave: (name: string, startDate: string, endDate: string) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [name, setName] = useState(existing?.cycle_name || '');
  const [startDate, setStartDate] = useState(existing?.starting_week_date || today);
  const [endDate, setEndDate] = useState(existing?.end_date || '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">{existing ? 'Edit Cycle Settings' : 'Set Up Cycle'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Cycle Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q1 2026" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" autoFocus />
            <p className="text-[10px] text-slate-400 mt-1">Weeks will display as "{name || 'Q1'} Week 1", "{name || 'Q1'} Week 2", etc.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={() => onSave(name, startDate, endDate)} disabled={!startDate || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-[#00adf0] rounded-lg hover:bg-[#0099d6] disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
