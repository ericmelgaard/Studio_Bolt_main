import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, MapPin, AlertTriangle,
  CheckCircle, Calendar, Clock, X, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { doesScheduleMatchDate, formatScheduleDescription } from '../lib/menuScheduleService';
import type { MenuSchedule } from '../types/menuScheduling';

interface StationCoverageViewProps {
  storeId?: number | null;
  onBack: () => void;
  onNavigateToMenu?: (menuId: string) => void;
}

interface PlacementGroup {
  id: string;
  name: string;
}

interface CoverageCell {
  schedules: MenuSchedule[];
  hasConflict: boolean;
  covered: boolean;
}

interface CoverageRow {
  stationId: string | null;
  stationName: string;
  cells: CoverageCell[];
  coveredDays: number;
  totalConflicts: number;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function StationCoverageView({ storeId, onBack, onNavigateToMenu }: StationCoverageViewProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [stations, setStations] = useState<PlacementGroup[]>([]);
  const [schedules, setSchedules] = useState<MenuSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailCell, setDetailCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [mobileDay, setMobileDay] = useState(0);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const d = new Date(weekStart);
    for (let i = 0; i < 7; i++) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return days;
  }, [weekStart]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayColIdx = weekDays.findIndex(d => isSameDay(d, today));

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [stRes, schRes] = await Promise.all([
        storeId
          ? supabase.from('placement_groups').select('id, name').eq('store_id', storeId).eq('is_store_root', false).order('name')
          : supabase.from('placement_groups').select('id, name').eq('is_store_root', false).order('name').limit(50),
        supabase.from('menu_schedules').select('*, menu:menus(id, name, brand_id, status, menu_type)').eq('is_active', true),
      ]);
      setStations(stRes.data ?? []);
      setSchedules(schRes.data ?? []);
      setLoading(false);
    })();
  }, [storeId]);

  const coverageGrid = useMemo((): CoverageRow[] => {
    const stationIds: (string | null)[] = [null, ...stations.map(s => s.id)];
    return stationIds.map(sid => {
      const name = sid ? stations.find(s => s.id === sid)?.name ?? 'Unknown' : 'Location-wide';
      let coveredDays = 0;
      let totalConflicts = 0;
      const cells: CoverageCell[] = weekDays.map(day => {
        const daySchedules = schedules.filter(s => {
          if (!doesScheduleMatchDate(s, day)) return false;
          return sid === null ? !s.placement_group_id : s.placement_group_id === sid;
        });
        const dpGroups = new Map<string, number>();
        daySchedules.forEach(s => {
          const k = s.daypart_definition_id ?? '__all__';
          dpGroups.set(k, (dpGroups.get(k) ?? 0) + 1);
        });
        const hasConflict = Array.from(dpGroups.values()).some(c => c > 1);
        const covered = daySchedules.length > 0;
        if (covered) coveredDays++;
        if (hasConflict) totalConflicts++;
        return { schedules: daySchedules, hasConflict, covered };
      });
      return { stationId: sid, stationName: name, cells, coveredDays, totalConflicts };
    });
  }, [stations, schedules, weekDays]);

  const summary = useMemo(() => {
    const stationRows = coverageGrid.filter(r => r.stationId !== null);
    return {
      total: stationRows.length,
      full: stationRows.filter(r => r.coveredDays === 7).length,
      partial: stationRows.filter(r => r.coveredDays > 0 && r.coveredDays < 7).length,
      uncovered: stationRows.filter(r => r.coveredDays === 0).length,
      conflicts: stationRows.reduce((sum, r) => sum + r.totalConflicts, 0),
    };
  }, [coverageGrid]);

  const navigateWeek = (dir: -1 | 0 | 1) => {
    if (dir === 0) { setWeekStart(startOfWeek(new Date())); return; }
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + dir * 7); return d; });
  };

  const dateRangeLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [weekStart]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const detailRow = detailCell ? coverageGrid[detailCell.rowIdx] : null;
  const detailCellData = detailCell ? coverageGrid[detailCell.rowIdx]?.cells[detailCell.colIdx] : null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <MapPin className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">Station Coverage</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigateWeek(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={() => navigateWeek(0)} className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">This Week</button>
          <button onClick={() => navigateWeek(1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-sm font-medium text-slate-700 ml-2">{dateRangeLabel}</span>
        </div>
      </div>

      {/* Desktop Grid */}
      <div className="hidden md:block bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto mb-6">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 bg-slate-50 border-b border-r border-slate-200 sticky left-0 z-10 min-w-[160px]">Station</th>
              {weekDays.map((day, i) => (
                <th key={i} className={`px-3 py-3 text-center text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-200 min-w-[120px] ${i === todayColIdx ? 'border-t-2 border-t-blue-500' : ''}`}>
                  <div>{DAY_LABELS[i]}</div>
                  <div className={`text-sm font-bold mt-0.5 ${i === todayColIdx ? 'text-blue-600' : 'text-slate-700'}`}>{day.getDate()}</div>
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 bg-slate-50 border-b border-l border-slate-200 min-w-[100px]">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {coverageGrid.map((row, rowIdx) => (
              <tr key={row.stationId ?? 'location'} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 text-sm font-medium text-slate-700 border-r border-b border-slate-100 sticky left-0 bg-white z-10">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{row.stationName}</span>
                  </div>
                </td>
                {row.cells.map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    onClick={() => setDetailCell({ rowIdx, colIdx })}
                    className={`px-2 py-2 border-b border-slate-100 cursor-pointer transition-colors ${
                      cell.hasConflict ? 'border-l-2 border-l-orange-400' : ''
                    } ${cell.covered ? 'bg-emerald-50/40 hover:bg-emerald-50' : 'hover:bg-red-50/30'} ${colIdx === todayColIdx ? 'bg-blue-50/20' : ''}`}
                    style={!cell.covered ? {
                      background: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(239,68,68,0.06) 4px, rgba(239,68,68,0.06) 8px)'
                    } : undefined}
                  >
                    <div className="space-y-0.5">
                      {cell.schedules.slice(0, 2).map(s => (
                        <div key={s.id} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 truncate">
                          {s.menu?.name ?? 'Menu'}
                        </div>
                      ))}
                      {cell.schedules.length > 2 && <div className="text-[10px] text-slate-400">+{cell.schedules.length - 2}</div>}
                    </div>
                  </td>
                ))}
                <td className="px-3 py-3 border-b border-l border-slate-100 text-center">
                  <div className="text-xs font-medium text-slate-700">{row.coveredDays}/7</div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${row.coveredDays === 7 ? 'bg-emerald-500' : row.coveredDays > 0 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${(row.coveredDays / 7) * 100}%` }}
                    />
                  </div>
                  {row.totalConflicts > 0 && (
                    <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] text-orange-600">
                      <AlertTriangle className="w-2.5 h-2.5" />{row.totalConflicts}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden mb-6">
        <div className="flex items-center justify-between mb-3 bg-white rounded-lg border border-slate-200 p-3">
          <button onClick={() => setMobileDay(Math.max(0, mobileDay - 1))} disabled={mobileDay === 0} className="p-1 disabled:opacity-30">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="text-center">
            <div className="text-xs text-slate-500">{DAY_LABELS[mobileDay]}</div>
            <div className="text-lg font-bold text-slate-800">{weekDays[mobileDay]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
          </div>
          <button onClick={() => setMobileDay(Math.min(6, mobileDay + 1))} disabled={mobileDay === 6} className="p-1 disabled:opacity-30">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="space-y-2">
          {coverageGrid.map(row => {
            const cell = row.cells[mobileDay];
            return (
              <div key={row.stationId ?? 'loc'} className={`bg-white rounded-lg border p-3 ${
                cell.hasConflict ? 'border-l-4 border-l-orange-400 border-slate-200' : cell.covered ? 'border-l-4 border-l-emerald-400 border-slate-200' : 'border-l-4 border-l-red-300 border-slate-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">{row.stationName}</span>
                </div>
                {cell.schedules.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No menus scheduled</p>
                ) : (
                  <div className="space-y-1">
                    {cell.schedules.map(s => (
                      <div key={s.id} className="px-2 py-1 rounded bg-blue-50 text-xs text-blue-800 font-medium truncate">
                        {s.menu?.name ?? 'Menu'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total Stations', value: summary.total, icon: MapPin, color: 'text-blue-600 bg-blue-50' },
          { label: 'Fully Covered', value: summary.full, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Partial', value: summary.partial, icon: Clock, color: 'text-amber-600 bg-amber-50' },
          { label: 'Uncovered', value: summary.uncovered, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
          { label: 'Conflicts', value: summary.conflicts, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50' },
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${item.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{item.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{item.label}</div>
            </div>
          );
        })}
      </div>

      {/* Detail Popover */}
      {detailCell && detailRow && detailCellData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setDetailCell(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">{detailRow.stationName}</h3>
                <p className="text-xs text-slate-500">{DAY_LABELS[detailCell.colIdx]} {weekDays[detailCell.colIdx]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
              <button onClick={() => setDetailCell(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              {detailCellData.schedules.length === 0 ? (
                <div className="text-center py-4">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-500">No menus scheduled</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {detailCellData.schedules.sort((a, b) => b.priority - a.priority).map((s, idx) => (
                    <div key={s.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-800">{s.menu?.name ?? 'Menu'}</span>
                        <div className="flex items-center gap-1.5">
                          {detailCellData.hasConflict && idx === 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Winner</span>}
                          {detailCellData.hasConflict && idx > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 font-medium">Overridden</span>}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">{formatScheduleDescription(s)}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${s.schedule_type === 'one_time' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {s.schedule_type === 'one_time' ? 'One-time' : 'Recurring'}
                        </span>
                        {onNavigateToMenu && s.menu?.id && (
                          <button onClick={() => onNavigateToMenu(s.menu!.id)} className="text-[10px] text-blue-600 hover:text-blue-800 font-medium transition-colors">
                            View Menu &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {detailCellData.hasConflict && (
                    <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg border border-orange-100">
                      <Info className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-orange-700">Multiple menus target the same daypart. The schedule with the highest priority wins.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
