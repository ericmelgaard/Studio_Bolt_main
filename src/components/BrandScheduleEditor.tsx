import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, Plus, X, ChevronLeft, ChevronRight, Trash2,
  Coffee, Sun, Sunset, Moon, Copy, Check, Repeat, Pencil,
  Layers, CalendarPlus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

/* ─── Types ─── */

interface ScheduleGroup {
  id: string;
  brand_id: number;
  store_id: number | null;
  name: string | null;
  start_date: string;
  end_date: string | null;
  recurrence_weeks: number | null;
  is_base: boolean;
}

interface GroupEntry {
  id: string;
  group_id: string;
  station_id: number;
  days_of_week: number[];
  daypart_id: string | null;
}

interface Station {
  id: number;
  name: string;
  store_id: number | null;
  uses_cycle: boolean;
  status: string;
}

interface DaypartDef {
  id: string;
  daypart_name: string;
  display_label: string;
  color: string;
}

interface Props {
  brandId: number;
  brandColor: string;
  userStoreId?: number | null;
  onNavigateToScheduling?: () => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0]; // Mon=1 ... Sat=6, Sun=0

const GROUP_COLORS = [
  '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

const DAYPART_ICONS: Record<string, React.ReactNode> = {
  breakfast: <Coffee className="w-3 h-3" />,
  lunch: <Sun className="w-3 h-3" />,
  dinner: <Sunset className="w-3 h-3" />,
  late_night: <Moon className="w-3 h-3" />,
};

/* ─── Date Helpers ─── */

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(mon.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function addWeeks(d: Date, weeks: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + weeks * 7);
  return r;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00');
}

function weeksBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function isSameWeek(a: Date, b: Date): boolean {
  const ma = getMondayOfWeek(a);
  const mb = getMondayOfWeek(b);
  return ma.getTime() === mb.getTime();
}

/* ─── Priority Resolution ─── */

function resolveGroupForWeek(weekStart: Date, groups: ScheduleGroup[]): ScheduleGroup | null {
  let best: ScheduleGroup | null = null;
  let bestPriority = -1;

  for (const g of groups) {
    const gStart = parseDate(g.start_date);
    if (weekStart < getMondayOfWeek(gStart) && !isSameWeek(weekStart, gStart)) continue;
    if (g.end_date) {
      const gEnd = parseDate(g.end_date);
      if (weekStart > gEnd) continue;
    }

    if (g.is_base) {
      if (bestPriority < 0) {
        best = g;
        bestPriority = 0;
      }
      continue;
    }

    if (g.recurrence_weeks) {
      const diff = weeksBetween(getMondayOfWeek(gStart), weekStart);
      if (diff < 0) continue;
      if (diff % g.recurrence_weeks !== 0) continue;
      const startTime = gStart.getTime();
      if (bestPriority < 1 || (bestPriority === 1 && best && parseDate(best.start_date).getTime() < startTime)) {
        best = g;
        bestPriority = 1;
      }
    } else {
      const gStartMonday = getMondayOfWeek(gStart);
      if (isSameWeek(weekStart, gStartMonday)) {
        const startTime = gStart.getTime();
        if (bestPriority < 2 || (bestPriority === 2 && best && parseDate(best.start_date).getTime() < startTime)) {
          best = g;
          bestPriority = 2;
        }
      }
    }
  }
  return best;
}

function getGroupColor(groupId: string, groups: ScheduleGroup[]): string {
  const idx = groups.findIndex(g => g.id === groupId);
  return GROUP_COLORS[idx % GROUP_COLORS.length];
}

/* ─── Toast ─── */

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 2500);
  }, []);
  return { msg, show };
}

/* ─── Main Component ─── */

export default function BrandScheduleEditor({ brandId, brandColor, userStoreId }: Props) {
  const [groups, setGroups] = useState<ScheduleGroup[]>([]);
  const [entries, setEntries] = useState<GroupEntry[]>([]);
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [daypartDefs, setDaypartDefs] = useState<DaypartDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [calendarStart, setCalendarStart] = useState(() => getMondayOfWeek(new Date()));
  const [weeksToShow] = useState(8);
  const [selectedWeek, setSelectedWeek] = useState<Date | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ScheduleGroup | null>(null);
  const [showAddStation, setShowAddStation] = useState(false);

  const { msg: toastMsg, show: showToast } = useToast();

  /* ─── Load Data ─── */

  useEffect(() => {
    loadData();
  }, [brandId, userStoreId]);

  const loadData = async () => {
    setLoading(true);
    const [groupsRes, stationsRes, daypartsRes] = await Promise.all([
      supabase.from('brand_schedule_groups').select('*').eq('brand_id', brandId),
      supabase.from('stations').select('*').eq('status', 'active'),
      supabase.from('daypart_definitions').select('*'),
    ]);

    const loadedGroups = (groupsRes.data || []) as ScheduleGroup[];
    setGroups(loadedGroups);

    if (loadedGroups.length > 0) {
      const groupIds = loadedGroups.map(g => g.id);
      const { data: entriesData } = await supabase
        .from('brand_schedule_group_entries')
        .select('*')
        .in('group_id', groupIds);
      setEntries((entriesData || []) as GroupEntry[]);
    } else {
      setEntries([]);
    }

    setAllStations((stationsRes.data || []) as Station[]);
    setDaypartDefs((daypartsRes.data || []) as DaypartDef[]);
    setLoading(false);
  };

  /* ─── Calendar weeks ─── */

  const calendarWeeks = useMemo(() => {
    const weeks: Date[] = [];
    for (let i = 0; i < weeksToShow; i++) {
      weeks.push(addWeeks(calendarStart, i));
    }
    return weeks;
  }, [calendarStart, weeksToShow]);

  const todayMonday = useMemo(() => getMondayOfWeek(new Date()), []);

  const weekResolutions = useMemo(() => {
    const map = new Map<string, ScheduleGroup | null>();
    for (const w of calendarWeeks) {
      map.set(formatDateISO(w), resolveGroupForWeek(w, groups));
    }
    return map;
  }, [calendarWeeks, groups]);

  /* ─── Selected group & entries ─── */

  const activeGroup = useMemo(() => {
    if (selectedGroupId) return groups.find(g => g.id === selectedGroupId) || null;
    if (selectedWeek) {
      const resolved = weekResolutions.get(formatDateISO(selectedWeek));
      return resolved || null;
    }
    return null;
  }, [selectedGroupId, selectedWeek, groups, weekResolutions]);

  const activeEntries = useMemo(() => {
    if (!activeGroup) return [];
    return entries.filter(e => e.group_id === activeGroup.id);
  }, [activeGroup, entries]);



  /* ─── Group CRUD ─── */

  const createGroup = async (name: string, startDate: string, endDate: string | null, recurrenceWeeks: number | null, isBase: boolean) => {
    setSaving(true);
    const { data } = await supabase.from('brand_schedule_groups').insert({
      brand_id: brandId,
      store_id: userStoreId || null,
      name: name || null,
      start_date: startDate,
      end_date: endDate || null,
      recurrence_weeks: recurrenceWeeks,
      is_base: isBase,
    }).select().maybeSingle();
    if (data) {
      setGroups(prev => [...prev, data as ScheduleGroup]);
      setSelectedGroupId(data.id);
      setSelectedWeek(null);
      showToast('Schedule group created');
    }
    setShowGroupForm(false);
    setEditingGroup(null);
    setSaving(false);
  };

  const updateGroup = async (id: string, updates: Partial<ScheduleGroup>) => {
    setSaving(true);
    await supabase.from('brand_schedule_groups').update({
      name: updates.name,
      start_date: updates.start_date,
      end_date: updates.end_date,
      recurrence_weeks: updates.recurrence_weeks,
      is_base: updates.is_base,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    setShowGroupForm(false);
    setEditingGroup(null);
    setSaving(false);
    showToast('Schedule group updated');
  };

  const deleteGroup = async (id: string) => {
    setSaving(true);
    await supabase.from('brand_schedule_groups').delete().eq('id', id);
    setGroups(prev => prev.filter(g => g.id !== id));
    setEntries(prev => prev.filter(e => e.group_id !== id));
    if (selectedGroupId === id) {
      setSelectedGroupId(null);
    }
    setSaving(false);
    showToast('Schedule group deleted');
  };

  const duplicateGroupForWeek = async (sourceGroup: ScheduleGroup, targetWeekStart: Date) => {
    setSaving(true);
    const startDate = formatDateISO(targetWeekStart);
    const endDateAdj = new Date(targetWeekStart);
    endDateAdj.setDate(endDateAdj.getDate() + 6);

    const { data: newGroup } = await supabase.from('brand_schedule_groups').insert({
      brand_id: brandId,
      store_id: userStoreId || null,
      name: `Week of ${formatShortDate(targetWeekStart)}`,
      start_date: startDate,
      end_date: formatDateISO(endDateAdj),
      recurrence_weeks: null,
      is_base: false,
    }).select().maybeSingle();

    if (newGroup) {
      const sourceEntries = entries.filter(e => e.group_id === sourceGroup.id);
      if (sourceEntries.length > 0) {
        const newEntries = sourceEntries.map(e => ({
          group_id: newGroup.id,
          station_id: e.station_id,
          days_of_week: [...e.days_of_week],
          daypart_id: e.daypart_id,
        }));
        const { data: insertedEntries } = await supabase.from('brand_schedule_group_entries').insert(newEntries).select();
        if (insertedEntries) {
          setEntries(prev => [...prev, ...(insertedEntries as GroupEntry[])]);
        }
      }
      setGroups(prev => [...prev, newGroup as ScheduleGroup]);
      setSelectedGroupId(newGroup.id);
      setSelectedWeek(targetWeekStart);
      showToast('Week customized - edit it below');
    }
    setSaving(false);
  };

  /* ─── Entry CRUD ─── */

  const addStationToGroup = async (groupId: string, stationId: number, daypartId: string | null) => {
    setSaving(true);
    const { data } = await supabase.from('brand_schedule_group_entries').insert({
      group_id: groupId,
      station_id: stationId,
      days_of_week: [1, 2, 3, 4, 5],
      daypart_id: daypartId,
    }).select().maybeSingle();
    if (data) {
      setEntries(prev => [...prev, data as GroupEntry]);
      showToast('Station added');
    }
    setShowAddStation(false);
    setSaving(false);
  };

  const toggleDay = async (entryId: string, dayIndex: number) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    const hasDayNow = entry.days_of_week.includes(dayIndex);
    const newDays = hasDayNow
      ? entry.days_of_week.filter(d => d !== dayIndex)
      : [...entry.days_of_week, dayIndex];
    await supabase.from('brand_schedule_group_entries').update({ days_of_week: newDays }).eq('id', entryId);
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, days_of_week: newDays } : e));
  };

  const removeEntry = async (entryId: string) => {
    await supabase.from('brand_schedule_group_entries').delete().eq('id', entryId);
    setEntries(prev => prev.filter(e => e.id !== entryId));
    showToast('Station removed');
  };

  /* ─── Quick Actions ─── */

  const handleCreateFirstSchedule = () => {
    setEditingGroup(null);
    setShowGroupForm(true);
  };

  const handleCustomizeWeek = (weekStart: Date) => {
    const resolved = resolveGroupForWeek(weekStart, groups);
    if (resolved) {
      duplicateGroupForWeek(resolved, weekStart);
    } else {
      setEditingGroup(null);
      setShowGroupForm(true);
    }
  };

  const handleWeekClick = (weekStart: Date) => {
    setSelectedWeek(weekStart);
    const resolved = weekResolutions.get(formatDateISO(weekStart));
    setSelectedGroupId(resolved?.id || null);
  };

  /* ─── Render ─── */

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading schedule...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-900">Brand Schedule</h2>
            {saving && <span className="text-xs text-slate-400 animate-pulse ml-2">Saving...</span>}
          </div>
          <div className="flex items-center gap-2">
            {groups.length > 0 && (
              <button
                onClick={handleCreateFirstSchedule}
                className="px-3 py-1.5 text-xs font-medium text-white bg-[#00adf0] hover:bg-[#0099d6] rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> New Schedule Group
              </button>
            )}
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        /* Empty state */
        <div className="p-8 text-center">
          <Layers className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-700 mb-1">No schedule set up yet</p>
          <p className="text-xs text-slate-400 mb-5 max-w-sm mx-auto">
            Create a base schedule to assign this brand to stations. It will run every week until you add variations.
          </p>
          <button
            onClick={handleCreateFirstSchedule}
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#00adf0] hover:bg-[#0099d6] rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <CalendarPlus className="w-4 h-4" /> Create Base Schedule
          </button>
        </div>
      ) : (
        <>
          {/* Schedule Group Cards */}
          <div className="px-6 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Schedule Groups</span>
              <span className="text-[10px] text-slate-400">({groups.length})</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {groups.map((g) => {
                const color = getGroupColor(g.id, groups);
                const isSelected = activeGroup?.id === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      setSelectedGroupId(g.id);
                      setSelectedWeek(null);
                    }}
                    className={`shrink-0 px-3 py-2.5 rounded-lg border text-left transition-all min-w-[160px] max-w-[220px] ${
                      isSelected
                        ? 'border-slate-300 bg-slate-50 shadow-sm ring-2 ring-offset-1'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                    style={isSelected ? { '--tw-ring-color': color } as React.CSSProperties : undefined}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {g.name || (g.is_base ? 'Base Schedule' : `Week of ${formatShortDate(parseDate(g.start_date))}`)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight">
                      {g.is_base ? (
                        'Default - every week'
                      ) : g.recurrence_weeks ? (
                        `Every ${g.recurrence_weeks} week${g.recurrence_weeks > 1 ? 's' : ''} from ${formatShortDate(parseDate(g.start_date))}`
                      ) : (
                        `${formatShortDate(parseDate(g.start_date))}${g.end_date ? ` - ${formatShortDate(parseDate(g.end_date))}` : ' (one-time)'}`
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar Timeline */}
          <div className="px-6 py-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCalendarStart(addWeeks(calendarStart, -4))}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-slate-600">
                  {formatShortDate(calendarWeeks[0])} - {formatShortDate(addWeeks(calendarWeeks[calendarWeeks.length - 1], 1))}
                </span>
                <button
                  onClick={() => setCalendarStart(addWeeks(calendarStart, 4))}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => setCalendarStart(getMondayOfWeek(new Date()))}
                className="text-[10px] text-[#00adf0] hover:text-[#0099d6] font-medium"
              >
                Jump to today
              </button>
            </div>

            <div className="space-y-1">
              {calendarWeeks.map((weekStart) => {
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                const resolved = weekResolutions.get(formatDateISO(weekStart));
                const isCurrentWeek = isSameWeek(weekStart, todayMonday);
                const isSelected = selectedWeek && isSameWeek(weekStart, selectedWeek);
                const color = resolved ? getGroupColor(resolved.id, groups) : '#e2e8f0';
                const weekEntries = resolved ? entries.filter(e => e.group_id === resolved.id) : [];
                const activeDayCount = weekEntries.reduce((sum, e) => sum + e.days_of_week.length, 0);

                return (
                  <div
                    key={formatDateISO(weekStart)}
                    onClick={() => handleWeekClick(weekStart)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all group ${
                      isSelected
                        ? 'bg-slate-100 ring-1 ring-slate-300'
                        : 'hover:bg-slate-50'
                    } ${isCurrentWeek ? 'border border-blue-200 bg-blue-50/30' : ''}`}
                  >
                    {/* Date range */}
                    <div className="w-[110px] shrink-0">
                      <div className={`text-xs font-medium ${isCurrentWeek ? 'text-blue-700' : 'text-slate-700'}`}>
                        {formatShortDate(weekStart)} - {formatShortDate(weekEnd)}
                      </div>
                      {isCurrentWeek && (
                        <span className="text-[8px] font-bold text-blue-600 uppercase tracking-wide">This Week</span>
                      )}
                    </div>

                    {/* Color bar showing active group */}
                    <div className="flex-1 min-w-0">
                      {resolved ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="h-6 rounded flex-1 flex items-center px-2 gap-1.5"
                            style={{ backgroundColor: color + '20', borderLeft: `3px solid ${color}` }}
                          >
                            <span className="text-[11px] font-medium truncate" style={{ color }}>
                              {resolved.name || (resolved.is_base ? 'Base Schedule' : 'Custom')}
                            </span>
                            {resolved.recurrence_weeks && (
                              <Repeat className="w-3 h-3 shrink-0" style={{ color }} />
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {weekEntries.length} stn{weekEntries.length !== 1 ? 's' : ''} / {activeDayCount} day{activeDayCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ) : (
                        <div className="h-6 rounded bg-slate-100 flex items-center px-2">
                          <span className="text-[11px] text-slate-400 italic">No schedule</span>
                        </div>
                      )}
                    </div>

                    {/* Customize button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCustomizeWeek(weekStart); }}
                      className="opacity-0 group-hover:opacity-100 px-2 py-1 text-[10px] font-medium text-slate-500 hover:text-[#00adf0] hover:bg-white rounded transition-all shrink-0"
                      title="Customize this week"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail Editor for Selected Group */}
          {activeGroup && (
            <div className="border-t border-slate-200">
              <GroupDetailEditor
                group={activeGroup}
                entries={activeEntries}
                allStations={allStations}
                daypartDefs={daypartDefs}
                brandColor={brandColor}
                groupColor={getGroupColor(activeGroup.id, groups)}
                saving={saving}
                showAddStation={showAddStation}
                onShowAddStation={setShowAddStation}
                onToggleDay={toggleDay}
                onRemoveEntry={removeEntry}
                onAddStation={(stationId, daypartId) => addStationToGroup(activeGroup.id, stationId, daypartId)}
                onEditGroup={() => { setEditingGroup(activeGroup); setShowGroupForm(true); }}
                onDeleteGroup={() => deleteGroup(activeGroup.id)}
                onSetRecurrence={async (weeks) => {
                  await updateGroup(activeGroup.id, { ...activeGroup, recurrence_weeks: weeks });
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Group Form Modal */}
      {showGroupForm && (
        <GroupFormModal
          existing={editingGroup}
          hasBase={groups.some(g => g.is_base)}
          saving={saving}
          onSave={(name, startDate, endDate, recurrenceWeeks, isBase) => {
            if (editingGroup) {
              updateGroup(editingGroup.id, {
                name, start_date: startDate, end_date: endDate,
                recurrence_weeks: recurrenceWeeks, is_base: isBase,
              });
            } else {
              createGroup(name, startDate, endDate, recurrenceWeeks, isBase);
            }
          }}
          onClose={() => { setShowGroupForm(false); setEditingGroup(null); }}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-[fadeIn_0.2s_ease-out]">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

/* ─── Group Detail Editor ─── */

function GroupDetailEditor({
  group, entries, allStations, daypartDefs, brandColor, groupColor, saving,
  showAddStation, onShowAddStation, onToggleDay, onRemoveEntry, onAddStation, onEditGroup,
  onDeleteGroup, onSetRecurrence,
}: {
  group: ScheduleGroup;
  entries: GroupEntry[];
  allStations: Station[];
  daypartDefs: DaypartDef[];
  brandColor: string;
  groupColor: string;
  saving: boolean;
  showAddStation: boolean;
  onShowAddStation: (v: boolean) => void;
  onToggleDay: (entryId: string, dayIndex: number) => void;
  onRemoveEntry: (entryId: string) => void;
  onAddStation: (stationId: number, daypartId: string | null) => void;
  onEditGroup: () => void;
  onDeleteGroup: () => void;
  onSetRecurrence: (weeks: number | null) => Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const groupLabel = group.name || (group.is_base ? 'Base Schedule' : `Week of ${formatShortDate(parseDate(group.start_date))}`);

  return (
    <div className="p-6">
      {/* Group header bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: groupColor }} />
          <div>
            <h3 className="text-sm font-bold text-slate-900">{groupLabel}</h3>
            <p className="text-[11px] text-slate-400">
              {group.is_base ? (
                'Runs every week unless overridden'
              ) : group.recurrence_weeks ? (
                `Repeats every ${group.recurrence_weeks} week${group.recurrence_weeks > 1 ? 's' : ''} starting ${formatShortDate(parseDate(group.start_date))}${group.end_date ? ` until ${formatShortDate(parseDate(group.end_date))}` : ''}`
              ) : (
                `${formatShortDate(parseDate(group.start_date))}${group.end_date ? ` - ${formatShortDate(parseDate(group.end_date))}` : ' only'}`
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!group.is_base && !group.recurrence_weeks && (
            <button
              onClick={() => onSetRecurrence(1)}
              className="px-2.5 py-1.5 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
              title="Make this schedule repeat every week"
            >
              <Repeat className="w-3 h-3" /> Repeat Weekly
            </button>
          )}
          {!group.is_base && group.recurrence_weeks && (
            <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
              <Repeat className="w-3 h-3 text-green-600" />
              <span className="text-[11px] font-medium text-green-700">
                Every {group.recurrence_weeks}w
              </span>
              <button
                onClick={() => onSetRecurrence(null)}
                className="ml-1 text-green-400 hover:text-red-500 transition-colors"
                title="Stop repeating"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <button
            onClick={onEditGroup}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Edit group settings"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {!group.is_base && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete this schedule group"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onShowAddStation(true)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-[#00adf0] hover:bg-[#0099d6] rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Station
          </button>
        </div>
      </div>

      {/* Station/Day Grid */}
      {entries.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-slate-500 mb-3">No stations assigned to this schedule yet.</p>
          <button
            onClick={() => onShowAddStation(true)}
            className="px-4 py-2 text-sm bg-[#00adf0] text-white rounded-lg hover:bg-[#0099d6] transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Station
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4 w-56">Station</th>
                {DAY_NAMES.map((day) => (
                  <th key={day} className="text-center pb-3 w-14">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{day}</span>
                  </th>
                ))}
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const station = allStations.find(s => s.id === entry.station_id);
                if (!station) return null;
                const dpDef = entry.daypart_id ? daypartDefs.find(d => d.id === entry.daypart_id) : null;
                return (
                  <tr key={entry.id} className="border-t border-slate-100 group/row hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: brandColor }}>
                          {station.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">{station.name}</p>
                          <p className="text-[9px] text-slate-400">{dpDef ? dpDef.display_label : 'All Dayparts'}</p>
                        </div>
                      </div>
                    </td>
                    {DAY_INDICES.map((dayIndex, colIdx) => {
                      const isActive = entry.days_of_week.includes(dayIndex);
                      return (
                        <td key={colIdx} className="py-3">
                          <div className="flex justify-center">
                            <button
                              onClick={() => onToggleDay(entry.id, dayIndex)}
                              disabled={saving}
                              className={`w-9 h-9 rounded-lg transition-all flex items-center justify-center ${
                                isActive
                                  ? 'text-white shadow-sm hover:opacity-80'
                                  : 'bg-slate-100 text-slate-300 hover:bg-slate-200 hover:text-slate-400'
                              }`}
                              style={isActive ? { backgroundColor: brandColor } : undefined}
                            >
                              {isActive ? <Check className="w-4 h-4" /> : <span className="text-[10px]">{DAY_LABELS[colIdx]}</span>}
                            </button>
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-3">
                      <button
                        onClick={() => onRemoveEntry(entry.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg opacity-0 group-hover/row:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Station Modal */}
      {showAddStation && (
        <AddStationModal
          allStations={allStations}
          existingEntries={entries}
          daypartDefs={daypartDefs}
          saving={saving}
          onAdd={onAddStation}
          onClose={() => onShowAddStation(false)}
        />
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2">Delete Schedule Group?</h3>
            <p className="text-sm text-slate-500 mb-5">
              This will permanently remove "{groupLabel}" and all its station assignments. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button
                onClick={() => { setConfirmDelete(false); onDeleteGroup(); }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Add Station Modal ─── */

function AddStationModal({ allStations, existingEntries, daypartDefs, saving, onAdd, onClose }: {
  allStations: Station[];
  existingEntries: GroupEntry[];
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

  const isAlreadyAdded = (stationId: number, dpId: string | null) => {
    return existingEntries.some(e => e.station_id === stationId && e.daypart_id === dpId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">Add Station</h2>
            <p className="text-xs text-slate-500 mt-0.5">Pick a station for this schedule group</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stations..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            autoFocus
          />
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
                  <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">
                    {station.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{station.name}</p>
                  </div>
                  {selectedStation === station.id && <Check className="w-4 h-4 text-[#00adf0] shrink-0" />}
                </button>
              ))
            )}
          </div>
          {selectedStation && daypartDefs.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Daypart</label>
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
          <button
            onClick={() => {
              if (!selectedStation) return;
              onAdd(selectedStation, selectedDaypart === 'all' ? null : selectedDaypart);
            }}
            disabled={!selectedStation || saving || (selectedStation ? isAlreadyAdded(selectedStation, selectedDaypart === 'all' ? null : selectedDaypart) : true)}
            className="px-4 py-2 text-sm font-medium text-white bg-[#00adf0] rounded-lg hover:bg-[#0099d6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Adding...' : 'Add Station'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Group Form Modal ─── */

function GroupFormModal({ existing, hasBase, saving, onSave, onClose }: {
  existing: ScheduleGroup | null;
  hasBase: boolean;
  saving: boolean;
  onSave: (name: string, startDate: string, endDate: string | null, recurrenceWeeks: number | null, isBase: boolean) => void;
  onClose: () => void;
}) {
  const today = formatDateISO(getMondayOfWeek(new Date()));
  const [name, setName] = useState(existing?.name || '');
  const [startDate, setStartDate] = useState(existing?.start_date || today);
  const [endDate, setEndDate] = useState(existing?.end_date || '');

  const [recurrenceWeeks, setRecurrenceWeeks] = useState<string>(
    existing?.recurrence_weeks ? String(existing.recurrence_weeks) : ''
  );
  const [scheduleType, setScheduleType] = useState<'base' | 'recurring' | 'one-time'>(
    existing?.is_base ? 'base' : existing?.recurrence_weeks ? 'recurring' : 'one-time'
  );

  const handleSave = () => {
    const isBaseVal = scheduleType === 'base';
    const recurrence = scheduleType === 'recurring' && recurrenceWeeks ? parseInt(recurrenceWeeks) : null;
    const endVal = scheduleType !== 'base' && endDate ? endDate : null;
    onSave(name, startDate, endVal, recurrence, isBaseVal);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">
            {existing ? 'Edit Schedule Group' : 'New Schedule Group'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Name (optional)</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Q1 Menu, Summer Rotation"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Schedule Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Type</label>
            <div className="space-y-2">
              {([
                { value: 'base' as const, label: 'Base / Default', desc: 'Runs every week unless overridden by another group', disabled: hasBase && !existing?.is_base },
                { value: 'recurring' as const, label: 'Recurring', desc: 'Repeats on an interval (e.g. every 4 weeks)', disabled: false },
                { value: 'one-time' as const, label: 'One-time / Seasonal', desc: 'Runs for a specific date range only (e.g. Q1 menu)', disabled: false },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setScheduleType(opt.value); }}
                  disabled={opt.disabled}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    scheduleType === opt.value
                      ? 'bg-blue-50 border-blue-300'
                      : opt.disabled ? 'border-slate-100 opacity-40' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 ${
                    scheduleType === opt.value ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                  }`}>
                    {scheduleType === opt.value && <div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-[3px]" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{opt.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Start date (not for base) */}
          {scheduleType !== 'base' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Date</label>
              <input
                type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          )}

          {/* End date (for one-time / recurring) */}
          {scheduleType !== 'base' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">End Date {scheduleType === 'recurring' ? '(optional)' : ''}</label>
              <input
                type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Leave empty for indefinite</p>
            </div>
          )}

          {/* Recurrence interval */}
          {scheduleType === 'recurring' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Repeat Every (weeks)</label>
              <input
                type="number" min="1" max="52" value={recurrenceWeeks} onChange={e => setRecurrenceWeeks(e.target.value)}
                placeholder="e.g. 4"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || (scheduleType === 'recurring' && !recurrenceWeeks)}
            className="px-4 py-2 text-sm font-medium text-white bg-[#00adf0] rounded-lg hover:bg-[#0099d6] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : existing ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
