import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Calendar, Clock,
  AlertTriangle, Filter, MapPin, Layers
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { doesScheduleMatchDate, findScheduleConflicts, formatScheduleDescription } from '../lib/menuScheduleService';
import type { MenuSchedule } from '../types/menuScheduling';

interface MenuCalendarViewProps {
  storeId?: number | null;
  brandId?: number | null;
  onBack: () => void;
  onNavigateToMenu?: (menuId: string) => void;
}

type ViewMode = 'day' | 'week' | 'month';

interface CalDay {
  date: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
}

interface DaypartDef {
  id: string;
  daypart_name: string;
  display_label: string;
  color: string;
  sort_order: number;
}

interface PlacementRow {
  id: string;
  name: string;
}

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function getMonthGrid(year: number, month: number): CalDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  const days: CalDay[] = [];
  const d = new Date(start);
  for (let i = 0; i < 42; i++) {
    days.push({
      date: new Date(d),
      isToday: isSameDay(d, today),
      isCurrentMonth: d.getMonth() === month,
    });
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function getWeekDays(d: Date): CalDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = startOfWeek(d);
  const days: CalDay[] = [];
  const cur = new Date(start);
  for (let i = 0; i < 7; i++) {
    days.push({ date: new Date(cur), isToday: isSameDay(cur, today), isCurrentMonth: true });
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export default function MenuCalendarView({ storeId, brandId, onBack, onNavigateToMenu }: MenuCalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [schedules, setSchedules] = useState<MenuSchedule[]>([]);
  const [dayparts, setDayparts] = useState<DaypartDef[]>([]);
  const [placements, setPlacements] = useState<PlacementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ menus: true, brands: true, gaps: true });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [schRes, dpRes, plRes] = await Promise.all([
        supabase.from('menu_schedules').select('*, menu:menus(id, name, brand_id, status, menu_type)').eq('is_active', true),
        supabase.from('daypart_definitions').select('*').order('sort_order'),
        storeId
          ? supabase.from('placement_groups').select('id, name').eq('store_id', storeId).eq('is_store_root', false)
          : supabase.from('placement_groups').select('id, name').eq('is_store_root', false).limit(50),
      ]);
      setSchedules(schRes.data ?? []);
      setDayparts(dpRes.data ?? []);
      setPlacements(plRes.data ?? []);
      setLoading(false);
    })();
  }, [storeId]);

  const navigate = useCallback((dir: -1 | 0 | 1) => {
    if (dir === 0) { const d = new Date(); d.setHours(0, 0, 0, 0); setCurrentDate(d); return; }
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
      else if (viewMode === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  }, [viewMode]);

  const dateLabel = useMemo(() => {
    if (viewMode === 'month') return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (viewMode === 'week') {
      const ws = startOfWeek(currentDate);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      return `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [currentDate, viewMode]);

  const schedulesForDate = useCallback((date: Date) => {
    if (!filters.menus) return [];
    return schedules.filter(s => doesScheduleMatchDate(s, date));
  }, [schedules, filters.menus]);

  const conflicts = useMemo(() => {
    if (viewMode === 'month') {
      const s = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const e = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return findScheduleConflicts(schedules, s, e);
    }
    const ws = startOfWeek(currentDate);
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    return findScheduleConflicts(schedules, ws, we);
  }, [schedules, currentDate, viewMode]);

  const conflictDates = useMemo(() => new Set(conflicts.map(c => toDateKey(c.date))), [conflicts]);

  const pillColor = (s: MenuSchedule) => s.schedule_type === 'one_time' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <Calendar className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">Schedule Calendar</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* View mode toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(['day', 'week', 'month'] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setViewMode(m)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${viewMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {m}
              </button>
            ))}
          </div>
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <button onClick={() => navigate(0)} className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">Today</button>
            <button onClick={() => navigate(1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <span className="text-sm font-medium text-slate-700">{dateLabel}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        {([['menus', 'Menu Schedules', 'bg-blue-500'], ['brands', 'Brand Schedules', 'bg-teal-500'], ['gaps', 'Gaps', 'bg-red-500']] as const).map(([key, label, dotColor]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={filters[key]} onChange={e => setFilters(prev => ({ ...prev, [key]: e.target.checked }))} className="sr-only peer" />
            <span className={`w-3 h-3 rounded-full border-2 transition-colors ${filters[key] ? dotColor + ' border-transparent' : 'bg-white border-slate-300'}`} />
            {label}
          </label>
        ))}
      </div>

      {/* Month View */}
      {viewMode === 'month' && <MonthView
        grid={getMonthGrid(currentDate.getFullYear(), currentDate.getMonth())}
        schedulesForDate={schedulesForDate}
        conflictDates={conflictDates}
        showGaps={filters.gaps}
        pillColor={pillColor}
        onSelectDay={d => { setCurrentDate(d); setViewMode('day'); }}
      />}

      {/* Week View */}
      {viewMode === 'week' && <WeekView
        days={getWeekDays(currentDate)}
        schedulesForDate={schedulesForDate}
        conflictDates={conflictDates}
        pillColor={pillColor}
        onNavigateToMenu={onNavigateToMenu}
        dayparts={dayparts}
        placements={placements}
      />}

      {/* Day View */}
      {viewMode === 'day' && <DayView
        date={currentDate}
        schedules={schedulesForDate(currentDate)}
        conflicts={conflicts.filter(c => isSameDay(c.date, currentDate))}
        dayparts={dayparts}
        placements={placements}
        onNavigateToMenu={onNavigateToMenu}
      />}
    </div>
  );
}

// ── Month View ──
function MonthView({ grid, schedulesForDate, conflictDates, showGaps, pillColor, onSelectDay }: {
  grid: CalDay[];
  schedulesForDate: (d: Date) => MenuSchedule[];
  conflictDates: Set<string>;
  showGaps: boolean;
  pillColor: (s: MenuSchedule) => string;
  onSelectDay: (d: Date) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7">
        {DAY_HEADERS.map(h => (
          <div key={h} className="px-2 py-2.5 text-xs font-semibold text-slate-500 text-center border-b border-slate-200 bg-slate-50">{h}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((day, i) => {
          const dScheds = schedulesForDate(day.date);
          const hasConflict = conflictDates.has(toDateKey(day.date));
          const dayOfWeek = day.date.getDay();
          const isWeekday = dayOfWeek > 0 && dayOfWeek < 6;
          const hasGap = showGaps && isWeekday && dScheds.length === 0;
          return (
            <button
              key={i}
              onClick={() => onSelectDay(day.date)}
              className={`min-h-[100px] p-1.5 border-b border-r border-slate-100 text-left transition-colors hover:bg-blue-50/30 ${!day.isCurrentMonth ? 'opacity-40' : ''} ${day.isToday ? 'bg-blue-50/50' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${day.isToday ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                  {day.date.getDate()}
                </span>
                <div className="flex items-center gap-0.5">
                  {hasGap && <span className="w-2 h-2 rounded-full bg-red-400" />}
                  {hasConflict && <AlertTriangle className="w-3 h-3 text-orange-500" />}
                </div>
              </div>
              <div className="space-y-0.5">
                {dScheds.slice(0, 3).map(s => (
                  <div key={s.id} className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${pillColor(s)}`}>
                    {s.menu?.name ?? 'Menu'}
                  </div>
                ))}
                {dScheds.length > 3 && <div className="text-[10px] text-slate-400 px-1">+{dScheds.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Week View ──
function WeekView({ days, schedulesForDate, conflictDates, pillColor, onNavigateToMenu, dayparts, placements }: {
  days: CalDay[];
  schedulesForDate: (d: Date) => MenuSchedule[];
  conflictDates: Set<string>;
  pillColor: (s: MenuSchedule) => string;
  onNavigateToMenu?: (menuId: string) => void;
  dayparts: DaypartDef[];
  placements: PlacementRow[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
      {days.map(day => {
        const dScheds = schedulesForDate(day.date);
        const hasConflict = conflictDates.has(toDateKey(day.date));
        return (
          <div key={toDateKey(day.date)} className={`bg-white rounded-lg border shadow-sm overflow-hidden ${day.isToday ? 'ring-2 ring-blue-400 border-blue-200' : 'border-slate-200'}`}>
            <div className={`px-3 py-2 border-b text-center ${day.isToday ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
              <div className="text-[10px] font-medium text-slate-500 uppercase">{DAY_HEADERS[days.indexOf(day)]}</div>
              <div className={`text-lg font-bold ${day.isToday ? 'text-blue-600' : 'text-slate-800'}`}>{day.date.getDate()}</div>
            </div>
            <div className="p-2 space-y-1.5 min-h-[120px]">
              {dScheds.length === 0 && <p className="text-[10px] text-slate-300 text-center mt-4">No schedules</p>}
              {dScheds.map(s => {
                const dp = dayparts.find(d => d.id === s.daypart_definition_id);
                const pl = placements.find(p => p.id === s.placement_group_id);
                const borderColor = s.schedule_type === 'one_time' ? 'border-l-amber-400' : 'border-l-blue-400';
                return (
                  <button
                    key={s.id}
                    onClick={() => s.menu?.id && onNavigateToMenu?.(s.menu.id)}
                    className={`w-full text-left p-2 rounded border-l-[3px] ${borderColor} bg-slate-50 hover:bg-slate-100 transition-colors`}
                  >
                    <p className="text-xs font-medium text-slate-800 truncate">{s.menu?.name ?? 'Menu'}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {dp && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">{dp.display_label}</span>}
                      {pl && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">{pl.name}</span>}
                    </div>
                  </button>
                );
              })}
              {hasConflict && (
                <div className="flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 rounded px-2 py-1">
                  <AlertTriangle className="w-3 h-3" />
                  Conflict
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Day View ──
function DayView({ date, schedules, conflicts, dayparts, placements, onNavigateToMenu }: {
  date: Date;
  schedules: MenuSchedule[];
  conflicts: { placementGroupId: string | null; daypartId: string | null; schedules: MenuSchedule[] }[];
  dayparts: DaypartDef[];
  placements: PlacementRow[];
  onNavigateToMenu?: (menuId: string) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, MenuSchedule[]>();
    for (const s of schedules) {
      const key = s.daypart_definition_id ?? '__all__';
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [schedules]);

  const sortedDayparts = [...dayparts].sort((a, b) => a.sort_order - b.sort_order);
  const allDaySchedules = grouped.get('__all__') ?? [];

  return (
    <div className="space-y-4">
      {/* Day header */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
        <h2 className="text-lg font-bold text-slate-900">
          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </h2>
        <p className="text-sm text-slate-500 mt-1">{schedules.length} active schedule{schedules.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Conflicts banner */}
      {conflicts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800">{conflicts.length} scheduling conflict{conflicts.length > 1 ? 's' : ''} detected</p>
            <p className="text-xs text-orange-600 mt-0.5">Multiple menus assigned to the same station and daypart. The highest-priority schedule wins.</p>
          </div>
        </div>
      )}

      {/* Daypart sections */}
      {sortedDayparts.map(dp => {
        const dpSchedules = grouped.get(dp.id) ?? [];
        if (dpSchedules.length === 0) return (
          <div key={dp.id} className="bg-white rounded-lg border border-dashed border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: dp.color || '#94a3b8' }} />
              <h3 className="text-sm font-semibold text-slate-700">{dp.display_label}</h3>
            </div>
            <p className="text-xs text-slate-400 italic">No menu scheduled</p>
          </div>
        );

        const byStation = new Map<string, MenuSchedule[]>();
        for (const s of dpSchedules) {
          const key = s.placement_group_id ?? '__location__';
          const arr = byStation.get(key) ?? [];
          arr.push(s);
          byStation.set(key, arr);
        }

        return (
          <div key={dp.id} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: dp.color || '#94a3b8' }} />
              <h3 className="text-sm font-semibold text-slate-700">{dp.display_label}</h3>
              <span className="text-xs text-slate-400 ml-auto">{dpSchedules.length} menu{dpSchedules.length > 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {Array.from(byStation.entries()).map(([stKey, stSchedules]) => {
                const stationName = stKey === '__location__' ? 'Location-wide' : placements.find(p => p.id === stKey)?.name ?? 'Unknown';
                return (
                  <div key={stKey} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-medium text-slate-500">{stationName}</span>
                      {stSchedules.length > 1 && (
                        <span className="flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-2.5 h-2.5" />Conflict
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 ml-5">
                      {stSchedules.sort((a, b) => b.priority - a.priority).map((s, idx) => (
                        <button
                          key={s.id}
                          onClick={() => s.menu?.id && onNavigateToMenu?.(s.menu.id)}
                          className="w-full text-left p-3 rounded-lg bg-slate-50 hover:bg-blue-50/50 transition-colors border border-slate-100"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-800">{s.menu?.name ?? 'Menu'}</span>
                            <div className="flex items-center gap-2">
                              {idx === 0 && stSchedules.length > 1 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Winner</span>}
                              {idx > 0 && stSchedules.length > 1 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Overridden</span>}
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-600">P{s.priority}</span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{formatScheduleDescription(s)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* All-day / unassigned */}
      {allDaySchedules.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">All Day / Unassigned</h3>
          </div>
          <div className="p-4 space-y-2">
            {allDaySchedules.map(s => (
              <button
                key={s.id}
                onClick={() => s.menu?.id && onNavigateToMenu?.(s.menu.id)}
                className="w-full text-left p-3 rounded-lg bg-slate-50 hover:bg-blue-50/50 transition-colors border border-slate-100"
              >
                <span className="text-sm font-medium text-slate-800">{s.menu?.name ?? 'Menu'}</span>
                <p className="text-xs text-slate-500 mt-1">{formatScheduleDescription(s)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {schedules.length === 0 && (
        <div className="bg-white rounded-lg border border-dashed border-slate-300 p-12 text-center">
          <Calendar className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">No menus scheduled for this day</p>
        </div>
      )}
    </div>
  );
}
