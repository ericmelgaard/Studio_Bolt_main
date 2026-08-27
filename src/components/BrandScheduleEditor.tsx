import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, Plus, Copy, Check, X, ChevronLeft, ChevronRight,
  Trash2, BarChart3, Grid3x3 as Grid3X3, Coffee, Sun, Sunset, Moon,
  MoreVertical, Repeat, CalendarPlus, Eraser, ArrowRight, Info,
  CircleDot, Infinity as InfinityIcon, CalendarClock,
} from 'lucide-react';
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

type RecurrenceMode = 'repeating' | 'static' | 'ending';

interface CycleSettings {
  id: string;
  cycle_duration_weeks: number;
  starting_week_date: string;
  end_date: string | null;
  cycle_name: string | null;
  store_id: number | null;
  recurrence_mode: RecurrenceMode;
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
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0];

const DAYPART_ICONS: Record<string, React.ReactNode> = {
  breakfast: <Coffee className="w-3 h-3" />,
  lunch: <Sun className="w-3 h-3" />,
  dinner: <Sunset className="w-3 h-3" />,
  late_night: <Moon className="w-3 h-3" />,
};

const RECURRENCE_LABELS: Record<RecurrenceMode, string> = {
  repeating: 'Repeats indefinitely',
  static: 'Static (same every week)',
  ending: 'Ends on a specific date',
};

/* ─── Date Helpers ─── */

function getWeekStartDate(weekNum: number, cycleStart: string): Date {
  const start = new Date(cycleStart + 'T00:00:00');
  start.setDate(start.getDate() + (weekNum - 1) * 7);
  return start;
}

function getWeekEndDate(weekNum: number, cycleStart: string): Date {
  const start = getWeekStartDate(weekNum, cycleStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekRange(weekNum: number, cycleStart: string): string {
  const start = getWeekStartDate(weekNum, cycleStart);
  const end = getWeekEndDate(weekNum, cycleStart);
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

function computeCurrentWeek(settings: CycleSettings | null): number | null {
  if (!settings) return null;
  const start = new Date(settings.starting_week_date + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);

  if (now < start) return null;

  if (settings.recurrence_mode === 'ending' && settings.end_date) {
    const end = new Date(settings.end_date + 'T00:00:00');
    if (now > end) return null;
  }

  const diffMs = now.getTime() - start.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  const duration = settings.cycle_duration_weeks;
  return (diffWeeks % duration) + 1;
}

function isFutureStart(settings: CycleSettings | null): boolean {
  if (!settings) return false;
  const start = new Date(settings.starting_week_date + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  return start > now;
}

/* ─── Main Component ─── */

export default function BrandScheduleEditor({ brandId, brandColor, userStoreId }: Props) {
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
  const [showWeekActions, setShowWeekActions] = useState(false);
  const [showCopyToPicker, setShowCopyToPicker] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'timeline'>('week');
  const [toast, setToast] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmCopyTo, setConfirmCopyTo] = useState<number | null>(null);

  const showToast = useCallback((msg: string) => setToast(msg), []);

  useEffect(() => { loadAll(); }, [brandId]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (!showWeekActions) return;
    const handler = () => setShowWeekActions(false);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [showWeekActions]);

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
          .select('id, cycle_duration_weeks, starting_week_date, end_date, cycle_name, store_id, recurrence_mode')
          .eq('store_id', firstStoreId)
          .maybeSingle();
        if (cycleData) setCycleSettings(cycleData as CycleSettings);
      }
    } else if (userStoreId) {
      const { data: cycleData } = await supabase
        .from('organization_cycle_settings')
        .select('id, cycle_duration_weeks, starting_week_date, end_date, cycle_name, store_id, recurrence_mode')
        .eq('store_id', userStoreId)
        .maybeSingle();
      if (cycleData) setCycleSettings(cycleData as CycleSettings);
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

  /* ─── Derived state ─── */

  const cycleDuration = cycleSettings?.cycle_duration_weeks || 1;
  const cycleWeeks = Array.from({ length: cycleDuration }, (_, i) => i + 1);
  const cycleName = cycleSettings?.cycle_name || '';
  const currentWeek = useMemo(() => computeCurrentWeek(cycleSettings), [cycleSettings]);
  const futureStart = isFutureStart(cycleSettings);
  const isStatic = cycleSettings?.recurrence_mode === 'static' || (cycleDuration === 1 && !cycleSettings?.recurrence_mode);

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

  /* ─── Schedule matching ─── */

  const getScheduleForRow = (stationId: number, daypartId: string | null, weekNum: number) => {
    const cycleWeekValue = isStatic ? null : weekNum;
    return schedules.find(s =>
      s.station_id === stationId &&
      s.is_active &&
      (s.daypart_id === daypartId || (s.daypart_id === null && daypartId === null)) &&
      (s.cycle_week === cycleWeekValue || (isStatic && s.cycle_week === null))
    );
  };

  /* ─── Week-aware helpers ─── */

  const weekSchedules = useMemo(() => {
    const cycleWeekValue = isStatic ? null : selectedCycleWeek;
    return schedules.filter(s =>
      s.is_active &&
      (s.cycle_week === cycleWeekValue || (isStatic && s.cycle_week === null))
    );
  }, [schedules, selectedCycleWeek, isStatic]);

  const isWeekEmpty = useMemo(() => weekSchedules.length === 0, [weekSchedules]);

  const isWeekDuplicateOfPrev = useMemo(() => {
    if (isStatic || selectedCycleWeek <= 1 || cycleDuration <= 1) return false;
    const prevWeek = selectedCycleWeek - 1;
    const prevScheds = schedules.filter(s =>
      s.is_active && s.cycle_week === prevWeek
    );
    if (prevScheds.length === 0) return false;
    if (prevScheds.length !== weekSchedules.length) return false;

    const normalize = (arr: StationSchedule[]) =>
      arr.map(s => `${s.station_id}-${s.daypart_id || 'all'}-[${[...s.days_of_week].sort()}]`).sort().join('|');

    return normalize(prevScheds) === normalize(weekSchedules);
  }, [schedules, weekSchedules, selectedCycleWeek, isStatic, cycleDuration]);

  /* ─── Toggle handlers ─── */

  const toggleDayForRow = async (stationId: number, daypartId: string | null, dayIndex: number, weekNum: number) => {
    setSaving(true);
    const cycleWeekValue = isStatic ? null : weekNum;
    const existing = schedules.find(s =>
      s.station_id === stationId &&
      s.brand_id === brandId &&
      s.is_active &&
      (s.daypart_id === daypartId || (s.daypart_id === null && daypartId === null)) &&
      (s.cycle_week === cycleWeekValue || (isStatic && s.cycle_week === null))
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

  const toggleDayColumn = async (dayIndex: number, weekNum: number) => {
    setSaving(true);
    const cycleWeekValue = isStatic ? null : weekNum;

    const allActive = scheduleRows.every(row => {
      const sched = getScheduleForRow(row.station.id, row.daypartId, weekNum);
      return sched?.days_of_week.includes(dayIndex);
    });

    if (allActive) {
      for (const row of scheduleRows) {
        const sched = getScheduleForRow(row.station.id, row.daypartId, weekNum);
        if (sched) {
          const newDays = sched.days_of_week.filter(d => d !== dayIndex);
          if (newDays.length === 0) {
            await supabase.from('station_schedules').delete().eq('id', sched.id);
            setSchedules(prev => prev.filter(s => s.id !== sched.id));
          } else {
            await supabase.from('station_schedules').update({ days_of_week: newDays }).eq('id', sched.id);
            setSchedules(prev => prev.map(s => s.id === sched.id ? { ...s, days_of_week: newDays } : s));
          }
        }
      }
    } else {
      for (const row of scheduleRows) {
        const sched = getScheduleForRow(row.station.id, row.daypartId, weekNum);
        if (sched) {
          if (!sched.days_of_week.includes(dayIndex)) {
            const newDays = [...sched.days_of_week, dayIndex];
            await supabase.from('station_schedules').update({ days_of_week: newDays }).eq('id', sched.id);
            setSchedules(prev => prev.map(s => s.id === sched.id ? { ...s, days_of_week: newDays } : s));
          }
        } else {
          const { data } = await supabase
            .from('station_schedules')
            .insert({ station_id: row.station.id, brand_id: brandId, cycle_week: cycleWeekValue, days_of_week: [dayIndex], is_active: true, daypart_id: row.daypartId })
            .select().maybeSingle();
          if (data) setSchedules(prev => [...prev, data]);
        }
      }
    }
    setSaving(false);
  };

  /* ─── Station management ─── */

  const handleAddStation = async (stationId: number, daypartId: string | null) => {
    setSaving(true);
    const cycleWeekValue = isStatic ? null : selectedCycleWeek;
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
    showToast('Station added');
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
    showToast('Station removed');
  };

  /* ─── Cycle settings ─── */

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
      .insert({ store_id: storeId, cycle_duration_weeks: 1, starting_week_date: today, recurrence_mode: 'repeating' })
      .select().maybeSingle();
    if (data) {
      setCycleSettings(data as CycleSettings);
      return data as CycleSettings;
    }
    return null;
  };

  const addBlankWeek = async () => {
    const settings = await ensureCycleSettings();
    if (!settings) {
      setShowCycleSetup(true);
      return;
    }
    const newDuration = settings.cycle_duration_weeks + 1;
    await supabase.from('organization_cycle_settings').update({ cycle_duration_weeks: newDuration, recurrence_mode: settings.recurrence_mode === 'static' ? 'repeating' : settings.recurrence_mode }).eq('id', settings.id);
    const updated = { ...settings, cycle_duration_weeks: newDuration, recurrence_mode: (settings.recurrence_mode === 'static' ? 'repeating' : settings.recurrence_mode) as RecurrenceMode };
    setCycleSettings(updated);
    setSelectedCycleWeek(newDuration);
    setShowWeekActions(false);
    showToast(`Blank Week ${newDuration} added`);
  };

  const duplicateWeek = async (sourceWeek: number) => {
    const settings = await ensureCycleSettings();
    if (!settings) return;
    setSaving(true);

    const targetWeek = settings.cycle_duration_weeks + 1;
    const mode = settings.recurrence_mode === 'static' ? 'repeating' : settings.recurrence_mode;
    await supabase.from('organization_cycle_settings').update({ cycle_duration_weeks: targetWeek, recurrence_mode: mode }).eq('id', settings.id);
    setCycleSettings({ ...settings, cycle_duration_weeks: targetWeek, recurrence_mode: mode });

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
    setShowWeekActions(false);
    setSaving(false);
    showToast(`Week ${targetWeek} created (copied from ${sourceWeek})`);
  };

  const copyWeekTo = async (sourceWeek: number, targetWeek: number) => {
    setSaving(true);
    const sourceWeekValue = isStatic ? null : sourceWeek;
    const targetWeekValue = isStatic ? null : targetWeek;

    const sourceSchedules = schedules.filter(s =>
      s.is_active && (s.cycle_week === sourceWeekValue || (isStatic && s.cycle_week === null))
    );

    const existingTarget = schedules.filter(s =>
      s.is_active && (s.cycle_week === targetWeekValue || (isStatic && s.cycle_week === null))
    );

    if (existingTarget.length > 0) {
      const targetIds = existingTarget.map(s => s.id);
      await supabase.from('station_schedules').delete().in('id', targetIds);
      setSchedules(prev => prev.filter(s => !targetIds.includes(s.id)));
    }

    if (sourceSchedules.length > 0) {
      const newRows = sourceSchedules.map(s => ({
        station_id: s.station_id,
        brand_id: s.brand_id,
        cycle_week: targetWeekValue,
        days_of_week: [...s.days_of_week],
        is_active: true,
        daypart_id: s.daypart_id,
      }));
      const { data } = await supabase.from('station_schedules').insert(newRows).select();
      if (data) setSchedules(prev => [...prev, ...data]);
    }

    setSelectedCycleWeek(targetWeek);
    setShowCopyToPicker(false);
    setConfirmCopyTo(null);
    setSaving(false);
    showToast(`Week ${sourceWeek} copied to Week ${targetWeek}`);
  };

  const clearWeek = async (weekNum: number) => {
    setSaving(true);
    const weekValue = isStatic ? null : weekNum;
    const weekScheds = schedules.filter(s =>
      s.is_active && (s.cycle_week === weekValue || (isStatic && s.cycle_week === null))
    );
    if (weekScheds.length > 0) {
      const ids = weekScheds.map(s => s.id);
      await supabase.from('station_schedules').delete().in('id', ids);
      setSchedules(prev => prev.filter(s => !ids.includes(s.id)));
    }
    setConfirmClear(false);
    setShowWeekActions(false);
    setSaving(false);
    showToast(`Week ${weekNum} cleared`);
  };

  const handleSaveCycleSetup = async (name: string, startDate: string, endDate: string, duration: number, mode: RecurrenceMode) => {
    const storeId = stations[0]?.store_id || userStoreId;
    if (!storeId) return;
    setSaving(true);

    if (cycleSettings) {
      await supabase.from('organization_cycle_settings').update({
        cycle_name: name || null,
        starting_week_date: startDate,
        end_date: mode === 'ending' ? (endDate || null) : null,
        cycle_duration_weeks: duration,
        recurrence_mode: mode,
      }).eq('id', cycleSettings.id);
      setCycleSettings({
        ...cycleSettings,
        cycle_name: name || null,
        starting_week_date: startDate,
        end_date: mode === 'ending' ? (endDate || null) : null,
        cycle_duration_weeks: duration,
        recurrence_mode: mode,
      });
    } else {
      const { data } = await supabase
        .from('organization_cycle_settings')
        .insert({
          store_id: storeId,
          cycle_duration_weeks: duration,
          starting_week_date: startDate,
          end_date: mode === 'ending' ? (endDate || null) : null,
          cycle_name: name || null,
          recurrence_mode: mode,
        })
        .select().maybeSingle();
      if (data) setCycleSettings(data as CycleSettings);
    }

    if (selectedCycleWeek > duration) setSelectedCycleWeek(1);
    setShowCycleSetup(false);
    setSaving(false);
    showToast('Cycle settings saved');
  };

  /* ─── Navigation ─── */

  const goToPrevWeek = () => {
    if (selectedCycleWeek > 1) setSelectedCycleWeek(selectedCycleWeek - 1);
  };
  const goToNextWeek = () => {
    if (selectedCycleWeek < cycleDuration) setSelectedCycleWeek(selectedCycleWeek + 1);
  };

  /* ─── Render ─── */

  if (loading) {
    return (
      <div data-section="schedule" className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00adf0]"></div>
      </div>
    );
  }

  return (
    <div data-section="schedule" className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden relative">
      {toast && (
        <div className="absolute top-3 right-3 z-20 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg shadow-lg animate-fade-in flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#00adf0]" />
            <h2 className="text-base font-semibold text-slate-900">Cycle Schedule</h2>
            {cycleSettings && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                futureStart ? 'bg-amber-100 text-amber-700' :
                isStatic ? 'bg-slate-100 text-slate-600' :
                cycleSettings.recurrence_mode === 'ending' ? 'bg-orange-100 text-orange-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {futureStart ? 'Starts in future' : RECURRENCE_LABELS[cycleSettings.recurrence_mode]}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {saving && <span className="text-xs text-slate-400 animate-pulse">Saving...</span>}

            {/* View toggle */}
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('week')}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'week' ? 'bg-[#00adf0] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                title="Weekly detail view"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'timeline' ? 'bg-[#00adf0] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                title="Timeline overview"
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button onClick={() => setShowAddStation(true)} className="px-3 py-1.5 text-xs font-medium text-white bg-[#00adf0] hover:bg-[#0099d6] rounded-lg transition-colors flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Station
            </button>

            {/* Week Actions dropdown */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowWeekActions(!showWeekActions); }}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <MoreVertical className="w-3.5 h-3.5" /> Week Actions
              </button>
              {showWeekActions && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-30 py-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => duplicateWeek(selectedCycleWeek)} className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5 text-slate-400" /> Duplicate this week
                  </button>
                  <button onClick={addBlankWeek} className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                    <CalendarPlus className="w-3.5 h-3.5 text-slate-400" /> Add blank week
                  </button>
                  <button onClick={() => { setShowWeekActions(false); setShowCopyToPicker(true); }} className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" /> Copy this week to...
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button onClick={() => { setShowWeekActions(false); setConfirmClear(true); }} className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
                    <Eraser className="w-3.5 h-3.5 text-red-400" /> Clear this week
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cycle info bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {cycleName && <span className="text-sm font-semibold text-slate-700">{cycleName}</span>}
            {cycleSettings?.starting_week_date && (
              <span className="text-xs text-slate-400">
                {formatShortDate(new Date(cycleSettings.starting_week_date + 'T00:00:00'))}
                {cycleSettings.end_date && ` - ${formatShortDate(new Date(cycleSettings.end_date + 'T00:00:00'))}`}
                {!cycleSettings.end_date && !isStatic && ' - repeats indefinitely'}
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

        {/* Week navigation bar */}
        {cycleDuration > 1 && (
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={goToPrevWeek}
              disabled={selectedCycleWeek <= 1}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 flex-1">
              {cycleWeeks.map(w => {
                const isCurrent = currentWeek === w;
                const isFuture = cycleSettings?.starting_week_date && getWeekStartDate(w, cycleSettings.starting_week_date) > new Date();
                return (
                  <button
                    key={w}
                    onClick={() => setSelectedCycleWeek(w)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap flex flex-col items-center min-w-[90px] relative ${
                      selectedCycleWeek === w
                        ? 'text-white shadow-sm'
                        : isCurrent
                        ? 'text-blue-700 bg-blue-50 border border-blue-200'
                        : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                    }`}
                    style={selectedCycleWeek === w ? { backgroundColor: brandColor } : undefined}
                  >
                    <div className="flex items-center gap-1">
                      <span>{getWeekLabel(w)}</span>
                      {isCurrent && (
                        <span className={`text-[8px] px-1 py-0 rounded-full font-bold ${selectedCycleWeek === w ? 'bg-white/25' : 'bg-blue-200 text-blue-800'}`}>
                          NOW
                        </span>
                      )}
                    </div>
                    {cycleSettings?.starting_week_date && (
                      <span className="text-[9px] opacity-75 mt-0.5">{formatWeekRange(w, cycleSettings.starting_week_date)}</span>
                    )}
                    {isFuture && !isCurrent && (
                      <span className="text-[8px] text-amber-500 mt-0.5">upcoming</span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={goToNextWeek}
              disabled={selectedCycleWeek >= cycleDuration}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Single-week date display */}
        {cycleDuration === 1 && cycleSettings?.starting_week_date && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Calendar className="w-3 h-3" />
            <span>{formatWeekRange(1, cycleSettings.starting_week_date)}</span>
            {currentWeek === 1 && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold">CURRENT</span>}
          </div>
        )}

        {/* Week status indicators */}
        {viewMode === 'week' && !isStatic && cycleDuration > 1 && (
          <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
            {isWeekEmpty && (
              <span className="flex items-center gap-1 text-amber-500">
                <Info className="w-3 h-3" /> This week is empty
              </span>
            )}
            {isWeekDuplicateOfPrev && (
              <span className="flex items-center gap-1 text-blue-500">
                <Repeat className="w-3 h-3" /> Same as previous week
              </span>
            )}
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
            brandColor={brandColor}
            saving={saving}
            daypartDefs={daypartDefs}
            onToggleDay={toggleDayForRow}
            onToggleDayColumn={toggleDayColumn}
            onRemoveRow={handleRemoveRow}
            getScheduleForRow={getScheduleForRow}
          />
        ) : (
          <TimelineView
            rows={scheduleRows}
            cycleWeeks={cycleWeeks}
            cycleDuration={cycleDuration}
            cycleSettings={cycleSettings}
            brandColor={brandColor}
            daypartDefs={daypartDefs}
            getScheduleForRow={getScheduleForRow}
            getWeekLabel={getWeekLabel}
            currentWeek={currentWeek}
            onJumpToWeek={(w) => { setViewMode('week'); setSelectedCycleWeek(w); }}
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

      {/* Copy To Picker Modal */}
      {showCopyToPicker && (
        <CopyToPickerModal
          sourceWeek={selectedCycleWeek}
          cycleWeeks={cycleWeeks.filter(w => w !== selectedCycleWeek)}
          cycleSettings={cycleSettings}
          getWeekLabel={getWeekLabel}
          onSelect={(target) => setConfirmCopyTo(target)}
          onClose={() => setShowCopyToPicker(false)}
        />
      )}

      {/* Confirm Clear */}
      {confirmClear && (
        <ConfirmDialog
          title={`Clear Week ${selectedCycleWeek}?`}
          message="This will remove all station assignments for this week. This cannot be undone."
          confirmLabel="Clear Week"
          onConfirm={() => clearWeek(selectedCycleWeek)}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {/* Confirm Copy To */}
      {confirmCopyTo !== null && (
        <ConfirmDialog
          title={`Copy Week ${selectedCycleWeek} to Week ${confirmCopyTo}?`}
          message="This will overwrite all existing assignments in the target week."
          confirmLabel="Overwrite & Copy"
          onConfirm={() => copyWeekTo(selectedCycleWeek, confirmCopyTo)}
          onCancel={() => setConfirmCopyTo(null)}
        />
      )}
    </div>
  );
}

/* ─── Weekly Grid View ─── */

function WeeklyGrid({ rows, selectedWeek, brandColor, saving, daypartDefs, onToggleDay, onToggleDayColumn, onRemoveRow, getScheduleForRow }: {
  rows: ScheduleRow[];
  selectedWeek: number;
  brandColor: string;
  saving: boolean;
  daypartDefs: DaypartDef[];
  onToggleDay: (stationId: number, daypartId: string | null, dayIndex: number, weekNum: number) => void;
  onToggleDayColumn: (dayIndex: number, weekNum: number) => void;
  onRemoveRow: (stationId: number, daypartId: string | null) => void;
  getScheduleForRow: (stationId: number, daypartId: string | null, weekNum: number) => StationSchedule | undefined;
}) {
  const [expandedStation, setExpandedStation] = useState<number | null>(null);

  const isDayColumnAllActive = (dayIndex: number) => {
    return rows.every(row => {
      const sched = getScheduleForRow(row.station.id, row.daypartId, selectedWeek);
      return sched?.days_of_week.includes(dayIndex);
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4 w-56">Station</th>
            {DAY_NAMES.map((day, idx) => {
              const dayIndex = DAY_INDICES[idx];
              const allActive = isDayColumnAllActive(dayIndex);
              return (
                <th key={day} className="text-center pb-3 w-16">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{day}</span>
                    {rows.length > 0 && (
                      <button
                        onClick={() => onToggleDayColumn(dayIndex, selectedWeek)}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                          allActive
                            ? 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                            : 'bg-blue-50 text-blue-500 hover:bg-blue-100'
                        }`}
                      >
                        {allActive ? 'Clear' : 'All'}
                      </button>
                    )}
                  </div>
                </th>
              );
            })}
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const sched = getScheduleForRow(row.station.id, row.daypartId, selectedWeek);
            const activeDays = sched?.days_of_week || [];
            const dpDef = row.daypartId ? daypartDefs.find(d => d.id === row.daypartId) : null;
            const isExpanded = expandedStation === row.station.id;
            const stationRows = rows.filter(r => r.station.id === row.station.id);
            const isFirstRowOfStation = stationRows[0]?.daypartId === row.daypartId;

            return (
              <tr
                key={`${row.station.id}-${row.daypartId || 'all'}`}
                className="border-t border-slate-100 group/row hover:bg-slate-50/50 transition-colors"
              >
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
                        {isFirstRowOfStation && stationRows.length > 1 && (
                          <button
                            onClick={() => setExpandedStation(isExpanded ? null : row.station.id)}
                            className="text-[10px] text-[#00adf0] hover:text-[#0099d6] font-medium ml-1"
                          >
                            {isExpanded ? 'Collapse' : `${stationRows.length} dayparts`}
                          </button>
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
                          title={isActive ? `Active on ${DAY_NAMES[colIdx]}` : `Enable on ${DAY_NAMES[colIdx]}`}
                        >
                          {isActive ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px]">{DAY_LABELS[colIdx]}</span>}
                        </button>
                      </div>
                    </td>
                  );
                })}
                <td className="py-3">
                  <button
                    onClick={() => onRemoveRow(row.station.id, row.daypartId)}
                    className="p-1 opacity-0 group-hover/row:opacity-100 hover:bg-red-50 rounded transition-all"
                    title="Remove station"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Per-station daypart quick-toggle panel */}
      {rows.length > 0 && daypartDefs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Quick toggle: enable a single daypart for a day</p>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(rows.map(r => r.station.id))).map(stationId => {
              const station = rows.find(r => r.station.id === stationId)?.station;
              if (!station) return null;
              return daypartDefs.map(dp => {
                const hasRow = rows.some(r => r.station.id === stationId && r.daypartId === dp.id);
                if (!hasRow) return null;
                return (
                  <div key={`${stationId}-${dp.id}`} className="flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg">
                    {DAYPART_ICONS[dp.daypart_name]}
                    <span className="text-[10px] text-slate-500">{station.name} - {dp.display_label}</span>
                  </div>
                );
              });
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Timeline Overview View ─── */

function TimelineView({ rows, cycleWeeks, cycleDuration, cycleSettings, brandColor, daypartDefs, getScheduleForRow, getWeekLabel, currentWeek, onJumpToWeek }: {
  rows: ScheduleRow[];
  cycleWeeks: number[];
  cycleDuration: number;
  cycleSettings: CycleSettings | null;
  brandColor: string;
  daypartDefs: DaypartDef[];
  getScheduleForRow: (stationId: number, daypartId: string | null, weekNum: number) => StationSchedule | undefined;
  getWeekLabel: (weekNum: number) => string;
  currentWeek: number | null;
  onJumpToWeek: (week: number) => void;
}) {
  if (rows.length === 0) return null;

  const [zoom, setZoom] = useState<'cycle' | 'month' | 'quarter'>('cycle');
  const visibleWeeks = useMemo(() => {
    if (zoom === 'month') return cycleWeeks.slice(0, Math.min(4, cycleWeeks.length));
    if (zoom === 'quarter') return cycleWeeks.slice(0, Math.min(12, cycleWeeks.length));
    return cycleWeeks;
  }, [zoom, cycleWeeks]);

  return (
    <div>
      {/* Zoom controls */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Range:</span>
        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
          {(['month', 'quarter', 'cycle'] as const).map(z => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-2.5 py-1 text-[10px] font-medium transition-colors capitalize ${
                zoom === z ? 'bg-[#00adf0] text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
              disabled={z === 'month' && cycleDuration < 4}
            >
              {z === 'month' ? '4 Weeks' : z === 'quarter' ? '12 Weeks' : 'Full Cycle'}
            </button>
          ))}
        </div>
        {currentWeek && (
          <button
            onClick={() => onJumpToWeek(currentWeek)}
            className="ml-auto text-[10px] text-[#00adf0] hover:text-[#0099d6] font-medium flex items-center gap-1"
          >
            Jump to current week <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-2 pr-3 w-48 sticky left-0 bg-white z-10">Station</th>
              {visibleWeeks.map(w => {
                const isCurrent = currentWeek === w;
                const weekStart = cycleSettings?.starting_week_date ? getWeekStartDate(w, cycleSettings.starting_week_date) : null;
                return (
                  <th
                    key={w}
                    colSpan={7}
                    className={`text-center text-[10px] font-semibold uppercase tracking-wide pb-1 border-l border-slate-100 min-w-[168px] cursor-pointer hover:bg-slate-50 transition-colors ${isCurrent ? 'text-blue-600' : 'text-slate-500'}`}
                    onClick={() => onJumpToWeek(w)}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {getWeekLabel(w)}
                      {isCurrent && <span className="text-[8px] px-1 py-0 bg-blue-100 text-blue-700 rounded-full font-bold">NOW</span>}
                    </div>
                    {weekStart && <div className="text-[9px] font-normal text-slate-400 mt-0.5">{formatShortDate(weekStart)}</div>}
                  </th>
                );
              })}
            </tr>
            <tr>
              <th className="sticky left-0 bg-white z-10"></th>
              {visibleWeeks.map(w => (
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
                  {visibleWeeks.map(w => {
                    const sched = getScheduleForRow(row.station.id, row.daypartId, w);
                    const activeDays = sched?.days_of_week || [];
                    return DAY_INDICES.map((dayIndex, colIdx) => {
                      const isActive = activeDays.includes(dayIndex);
                      const isToday = currentWeek === w && new Date().getDay() === dayIndex;
                      return (
                        <td key={`${w}-${colIdx}`} className={`py-2 ${colIdx === 0 ? 'border-l border-slate-100' : ''} ${isToday ? 'bg-blue-50/40' : ''}`}>
                          <div className="flex justify-center">
                            <div
                              className={`w-4 h-4 rounded-sm transition-all ${isActive ? 'shadow-sm' : ''}`}
                              style={isActive ? { backgroundColor: brandColor } : { backgroundColor: '#f1f5f9' }}
                              title={isActive ? `${row.station.name} - ${DAY_NAMES[colIdx]}` : ''}
                            />
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

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: brandColor }} />
          <span>Active</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-slate-200" />
          <span>Inactive</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-300" />
          <span>Today</span>
        </div>
        <span className="ml-auto">Click any week header to jump to its detail view</span>
      </div>
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
              <p className="text-[10px] text-slate-400 mb-2">Choose "All Dayparts" for full-day coverage, or pick a specific daypart to limit when this brand appears.</p>
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
  onSave: (name: string, startDate: string, endDate: string, duration: number, mode: RecurrenceMode) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [name, setName] = useState(existing?.cycle_name || '');
  const [startDate, setStartDate] = useState(existing?.starting_week_date || today);
  const [endDate, setEndDate] = useState(existing?.end_date || '');
  const [duration, setDuration] = useState(existing?.cycle_duration_weeks || 4);
  const [mode, setMode] = useState<RecurrenceMode>(existing?.recurrence_mode || 'repeating');

  const isFuture = (() => {
    const s = new Date(startDate + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    s.setHours(0, 0, 0, 0);
    return s > now;
  })();

  const endDateError = mode === 'ending' && endDate && new Date(endDate) <= new Date(startDate) ? 'End date must be after start date' : '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-slate-900">{existing ? 'Edit Cycle Settings' : 'Set Up Cycle'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Recurrence mode selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Recurrence Mode</label>
            <div className="space-y-2">
              {([
                { value: 'repeating' as const, icon: <InfinityIcon className="w-4 h-4" />, label: 'Repeats indefinitely', desc: 'Cycle loops through all weeks forever' },
                { value: 'ending' as const, icon: <CalendarClock className="w-4 h-4" />, label: 'Ends on a date', desc: 'Cycle repeats but stops after a specific date' },
                { value: 'static' as const, icon: <CircleDot className="w-4 h-4" />, label: 'Static / continuous', desc: 'Same schedule every week, no rotation' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    mode === opt.value
                      ? 'bg-blue-50 border-blue-300'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`mt-0.5 ${mode === opt.value ? 'text-[#00adf0]' : 'text-slate-400'}`}>{opt.icon}</div>
                  <div>
                    <p className={`text-sm font-medium ${mode === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Cycle name */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Cycle Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q1 2026" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" autoFocus />
            <p className="text-[10px] text-slate-400 mt-1">Weeks will display as "{name || 'Cycle'} Week 1", "{name || 'Cycle'} Week 2", etc.</p>
          </div>

          {/* Duration (hidden for static) */}
          {mode !== 'static' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Cycle Duration (weeks)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={duration}
                  onChange={(e) => setDuration(Math.max(1, Math.min(52, parseInt(e.target.value) || 1)))}
                  className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <span className="text-xs text-slate-400">weeks per cycle</span>
                <div className="flex gap-1 ml-auto">
                  {[2, 4, 8, 12].map(preset => (
                    <button
                      key={preset}
                      onClick={() => setDuration(preset)}
                      className={`px-2 py-1 text-[10px] rounded font-medium transition-colors ${duration === preset ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {preset}w
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Start date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            {isFuture && (
              <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                <Info className="w-3 h-3" /> This cycle will start in the future. Until then, no schedule is active.
              </p>
            )}
          </div>

          {/* End date (only for ending mode) */}
          {mode === 'ending' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              {endDateError && <p className="text-[10px] text-red-500 mt-1">{endDateError}</p>}
              {!endDateError && <p className="text-[10px] text-slate-400 mt-1">The cycle stops repeating after this date.</p>}
            </div>
          )}

          {/* Summary */}
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Summary</p>
            <p className="text-xs text-slate-600">
              {mode === 'static'
                ? `Same schedule every week${startDate ? ` starting ${formatShortDate(new Date(startDate + 'T00:00:00'))}` : ''}`
                : `${duration}-week cycle${name ? ` "${name}"` : ''}${startDate ? ` starting ${formatShortDate(new Date(startDate + 'T00:00:00'))}` : ''}${mode === 'ending' && endDate ? ` ending ${formatShortDate(new Date(endDate + 'T00:00:00'))}` : ''}${mode === 'repeating' ? ' repeating indefinitely' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button
            onClick={() => onSave(name, startDate, endDate, mode === 'static' ? 1 : duration, mode)}
            disabled={!startDate || saving || !!endDateError}
            className="px-4 py-2 text-sm font-medium text-white bg-[#00adf0] rounded-lg hover:bg-[#0099d6] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Copy To Picker Modal ─── */

function CopyToPickerModal({ sourceWeek, cycleWeeks, cycleSettings, getWeekLabel, onSelect, onClose }: {
  sourceWeek: number;
  cycleWeeks: number[];
  cycleSettings: CycleSettings | null;
  getWeekLabel: (weekNum: number) => string;
  onSelect: (targetWeek: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">Copy Week {sourceWeek} to...</h2>
            <p className="text-xs text-slate-500 mt-0.5">Select a target week to overwrite</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-3 max-h-80 overflow-y-auto space-y-1">
          {cycleWeeks.map(w => (
            <button
              key={w}
              onClick={() => onSelect(w)}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">{getWeekLabel(w)}</p>
                {cycleSettings?.starting_week_date && (
                  <p className="text-[10px] text-slate-400">{formatWeekRange(w, cycleSettings.starting_week_date)}</p>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Confirm Dialog ─── */

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-5">
          <h2 className="text-base font-bold text-slate-900 mb-2">{title}</h2>
          <p className="text-sm text-slate-500">{message}</p>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
