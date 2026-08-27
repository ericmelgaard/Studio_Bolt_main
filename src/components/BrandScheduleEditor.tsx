import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Calendar, Plus, X, ChevronLeft, ChevronRight, Trash2,
  Coffee, Sun, Sunset, Moon, Check, Repeat, RotateCcw,
  CalendarDays, Copy, ClipboardPaste, Pencil, CalendarRange,
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
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0];

const GROUP_COLORS: Record<string, string> = {};
const COLOR_PALETTE = [
  '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

const DAYPART_ICONS: Record<string, React.ReactNode> = {
  breakfast: <Coffee className="w-3.5 h-3.5" />,
  lunch: <Sun className="w-3.5 h-3.5" />,
  dinner: <Sunset className="w-3.5 h-3.5" />,
  late_night: <Moon className="w-3.5 h-3.5" />,
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
  return getMondayOfWeek(a).getTime() === getMondayOfWeek(b).getTime();
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
      if (bestPriority < 0) { best = g; bestPriority = 0; }
      continue;
    }

    if (g.recurrence_weeks) {
      const diff = weeksBetween(getMondayOfWeek(gStart), weekStart);
      if (diff < 0) continue;
      if (diff % g.recurrence_weeks !== 0) continue;
      const startTime = gStart.getTime();
      if (bestPriority < 1 || (bestPriority === 1 && best && parseDate(best.start_date).getTime() < startTime)) {
        best = g; bestPriority = 1;
      }
    } else {
      if (isSameWeek(weekStart, getMondayOfWeek(gStart))) {
        const startTime = gStart.getTime();
        if (bestPriority < 2 || (bestPriority === 2 && best && parseDate(best.start_date).getTime() < startTime)) {
          best = g; bestPriority = 2;
        }
      }
    }
  }
  return best;
}

function getGroupColor(groupId: string, groups: ScheduleGroup[]): string {
  if (GROUP_COLORS[groupId]) return GROUP_COLORS[groupId];
  const idx = groups.filter(g => !g.is_base).findIndex(g => g.id === groupId);
  const color = idx >= 0 ? COLOR_PALETTE[idx % COLOR_PALETTE.length] : '#94a3b8';
  GROUP_COLORS[groupId] = color;
  return color;
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

  const [showAddStation, setShowAddStation] = useState(false);
  const [showRepeatPopover, setShowRepeatPopover] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [repeatWeeksInput, setRepeatWeeksInput] = useState('2');

  const [selectedWeek, setSelectedWeek] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [calendarStart, setCalendarStart] = useState(() => getMondayOfWeek(new Date()));

  // Copy/paste state
  const [copiedWeekData, setCopiedWeekData] = useState<{ entries: GroupEntry[]; sourceName: string } | null>(null);
  const [showPasteConfirm, setShowPasteConfirm] = useState(false);

  // Inline naming
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  // Inline date editing
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [editingEndDate, setEditingEndDate] = useState(false);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');

  // New schedule creation prompt
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createStartDate, setCreateStartDate] = useState('');
  const [createEndDate, setCreateEndDate] = useState('');
  const [pendingCreateAction, setPendingCreateAction] = useState<'customize' | 'first-station' | null>(null);

  const { msg: toastMsg, show: showToast } = useToast();
  const todayMonday = useMemo(() => getMondayOfWeek(new Date()), []);

  /* ─── Load Data ─── */

  useEffect(() => { loadData(); }, [brandId, userStoreId]);

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
        .from('brand_schedule_group_entries').select('*').in('group_id', groupIds);
      setEntries((entriesData || []) as GroupEntry[]);
    } else {
      setEntries([]);
    }

    setAllStations((stationsRes.data || []) as Station[]);
    setDaypartDefs((daypartsRes.data || []) as DaypartDef[]);
    setLoading(false);
  };

  /* ─── Derived state ─── */

  const calendarWeeks = useMemo(() => {
    const weeks: Date[] = [];
    for (let i = 0; i < 8; i++) weeks.push(addWeeks(calendarStart, i));
    return weeks;
  }, [calendarStart]);

  const weekResolutions = useMemo(() => {
    const map = new Map<string, ScheduleGroup | null>();
    for (const w of calendarWeeks) {
      map.set(formatDateISO(w), resolveGroupForWeek(w, groups));
    }
    map.set(formatDateISO(selectedWeek), resolveGroupForWeek(selectedWeek, groups));
    return map;
  }, [calendarWeeks, groups, selectedWeek]);

  const resolvedGroup = weekResolutions.get(formatDateISO(selectedWeek)) ?? null;
  const weekEntries = useMemo(() => {
    if (!resolvedGroup) return [];
    return entries.filter(e => e.group_id === resolvedGroup.id);
  }, [resolvedGroup, entries]);

  const isBaseWeek = resolvedGroup?.is_base ?? false;
  const isOwnOverride = resolvedGroup && !resolvedGroup.is_base &&
    isSameWeek(parseDate(resolvedGroup.start_date), selectedWeek) && !resolvedGroup.recurrence_weeks;

  const groupDisplayName = (g: ScheduleGroup | null): string => {
    if (!g) return 'No schedule';
    if (g.name) return g.name;
    if (g.is_base) return 'Default Schedule';
    return 'Untitled';
  };

  /* ─── Schedule Creation ─── */

  const openCreatePrompt = (action: 'customize' | 'first-station') => {
    setPendingCreateAction(action);
    setCreateName('');
    setCreateStartDate(formatDateISO(selectedWeek));
    setCreateEndDate('');
    setShowCreatePrompt(true);
  };

  const executeCreate = async () => {
    setSaving(true);
    setShowCreatePrompt(false);

    if (pendingCreateAction === 'first-station') {
      const { data } = await supabase.from('brand_schedule_groups').insert({
        brand_id: brandId,
        store_id: userStoreId || null,
        name: createName || null,
        start_date: createStartDate || formatDateISO(selectedWeek),
        end_date: createEndDate || null,
        recurrence_weeks: null,
        is_base: true,
      }).select().maybeSingle();

      if (data) {
        setGroups(prev => [...prev, data as ScheduleGroup]);
        showToast('Schedule created');
      }
      setSaving(false);
      setShowAddStation(true);
      return;
    }

    // customize week
    if (!resolvedGroup) { setSaving(false); return; }
    const startDate = createStartDate || formatDateISO(selectedWeek);
    const endAdj = new Date(selectedWeek);
    endAdj.setDate(endAdj.getDate() + 6);

    const { data: newGroup } = await supabase.from('brand_schedule_groups').insert({
      brand_id: brandId,
      store_id: userStoreId || null,
      name: createName || null,
      start_date: startDate,
      end_date: createEndDate || formatDateISO(endAdj),
      recurrence_weeks: null,
      is_base: false,
    }).select().maybeSingle();

    if (newGroup) {
      const sourceEntries = entries.filter(e => e.group_id === resolvedGroup.id);
      if (sourceEntries.length > 0) {
        const newEntries = sourceEntries.map(e => ({
          group_id: newGroup.id,
          station_id: e.station_id,
          days_of_week: [...e.days_of_week],
          daypart_id: e.daypart_id,
        }));
        const { data: inserted } = await supabase.from('brand_schedule_group_entries').insert(newEntries).select();
        if (inserted) setEntries(prev => [...prev, ...(inserted as GroupEntry[])]);
      }
      setGroups(prev => [...prev, newGroup as ScheduleGroup]);
      showToast('Week customized');
    }
    setSaving(false);
  };

  /* ─── Inline Rename ─── */

  const startRename = () => {
    if (!resolvedGroup) return;
    setNameInput(resolvedGroup.name || '');
    setEditingName(true);
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const saveRename = async () => {
    if (!resolvedGroup) return;
    const newName = nameInput.trim() || null;
    await supabase.from('brand_schedule_groups').update({ name: newName, updated_at: new Date().toISOString() }).eq('id', resolvedGroup.id);
    setGroups(prev => prev.map(g => g.id === resolvedGroup.id ? { ...g, name: newName } : g));
    setEditingName(false);
    showToast('Name updated');
  };

  /* ─── Date Editing ─── */

  const saveStartDate = async () => {
    if (!resolvedGroup || !startDateInput) return;
    await supabase.from('brand_schedule_groups').update({ start_date: startDateInput, updated_at: new Date().toISOString() }).eq('id', resolvedGroup.id);
    setGroups(prev => prev.map(g => g.id === resolvedGroup.id ? { ...g, start_date: startDateInput } : g));
    setEditingStartDate(false);
    showToast('Start date updated');
  };

  const saveEndDate = async () => {
    if (!resolvedGroup) return;
    const endDate = endDateInput || null;
    await supabase.from('brand_schedule_groups').update({ end_date: endDate, updated_at: new Date().toISOString() }).eq('id', resolvedGroup.id);
    setGroups(prev => prev.map(g => g.id === resolvedGroup.id ? { ...g, end_date: endDate } : g));
    setEditingEndDate(false);
    showToast(endDate ? 'End date updated' : 'End date removed');
  };

  /* ─── Recurrence ─── */

  const setRecurrence = async (weeks: number) => {
    if (!resolvedGroup || resolvedGroup.is_base) return;
    setSaving(true);
    await supabase.from('brand_schedule_groups').update({
      recurrence_weeks: weeks, end_date: null, updated_at: new Date().toISOString(),
    }).eq('id', resolvedGroup.id);
    setGroups(prev => prev.map(g => g.id === resolvedGroup.id ? { ...g, recurrence_weeks: weeks, end_date: null } : g));
    setShowRepeatPopover(false);
    setSaving(false);
    showToast(`Now repeats every ${weeks} week${weeks > 1 ? 's' : ''}`);
  };

  const stopRecurrence = async () => {
    if (!resolvedGroup) return;
    setSaving(true);
    await supabase.from('brand_schedule_groups').update({ recurrence_weeks: null, updated_at: new Date().toISOString() }).eq('id', resolvedGroup.id);
    setGroups(prev => prev.map(g => g.id === resolvedGroup.id ? { ...g, recurrence_weeks: null } : g));
    setSaving(false);
    showToast('Recurrence removed');
  };

  /* ─── Revert ─── */

  const revertWeek = async () => {
    if (!resolvedGroup || resolvedGroup.is_base) return;
    setSaving(true);
    await supabase.from('brand_schedule_groups').delete().eq('id', resolvedGroup.id);
    setGroups(prev => prev.filter(g => g.id !== resolvedGroup.id));
    setEntries(prev => prev.filter(e => e.group_id !== resolvedGroup.id));
    setConfirmRevert(false);
    setSaving(false);
    showToast('Reverted to default schedule');
  };

  /* ─── Copy / Paste Week ─── */

  const copyWeek = () => {
    if (weekEntries.length === 0) return;
    setCopiedWeekData({
      entries: weekEntries.map(e => ({ ...e })),
      sourceName: `${groupDisplayName(resolvedGroup)} (${formatShortDate(selectedWeek)})`,
    });
    showToast('Week copied \u2014 navigate to another week and paste');
  };

  const pasteWeek = async () => {
    if (!copiedWeekData) return;
    setShowPasteConfirm(false);
    setSaving(true);

    const existing = resolveGroupForWeek(selectedWeek, groups);
    const isOwnGroup = existing && !existing.is_base &&
      isSameWeek(parseDate(existing.start_date), selectedWeek) && !existing.recurrence_weeks;

    let targetGroupId: string;

    if (isOwnGroup && existing) {
      // Replace entries in existing override
      await supabase.from('brand_schedule_group_entries').delete().eq('group_id', existing.id);
      setEntries(prev => prev.filter(e => e.group_id !== existing.id));
      targetGroupId = existing.id;
    } else {
      // Create new override for this week
      const endAdj = new Date(selectedWeek);
      endAdj.setDate(endAdj.getDate() + 6);
      const { data: newGroup } = await supabase.from('brand_schedule_groups').insert({
        brand_id: brandId,
        store_id: userStoreId || null,
        name: null,
        start_date: formatDateISO(selectedWeek),
        end_date: formatDateISO(endAdj),
        recurrence_weeks: null,
        is_base: false,
      }).select().maybeSingle();
      if (!newGroup) { setSaving(false); return; }
      setGroups(prev => [...prev, newGroup as ScheduleGroup]);
      targetGroupId = newGroup.id;
    }

    const newEntries = copiedWeekData.entries.map(e => ({
      group_id: targetGroupId,
      station_id: e.station_id,
      days_of_week: [...e.days_of_week],
      daypart_id: e.daypart_id,
    }));
    const { data: inserted } = await supabase.from('brand_schedule_group_entries').insert(newEntries).select();
    if (inserted) setEntries(prev => [...prev, ...(inserted as GroupEntry[])]);

    setSaving(false);
    showToast('Week pasted');
  };

  /* ─── Entry CRUD ─── */

  const handleAddStation = () => {
    if (groups.length === 0) {
      openCreatePrompt('first-station');
    } else {
      setShowAddStation(true);
    }
  };

  const addStationToGroup = async (stationId: number, daypartId: string | null) => {
    setSaving(true);
    let targetGroup = resolvedGroup;
    if (!targetGroup) {
      const existing = groups.find(g => g.is_base);
      if (existing) {
        targetGroup = existing;
      } else {
        setSaving(false);
        return;
      }
    }

    const { data } = await supabase.from('brand_schedule_group_entries').insert({
      group_id: targetGroup.id,
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
    const newDays = entry.days_of_week.includes(dayIndex)
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

  /* ─── Render ─── */

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading schedule...</span>
        </div>
      </div>
    );
  }

  const weekEnd = new Date(selectedWeek);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

      {/* ──── Header + Week Navigator ──── */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-900">Brand Schedule</h2>
            {saving && <span className="text-xs text-slate-400 animate-pulse">Saving...</span>}
          </div>
          {copiedWeekData && (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 text-[11px] text-emerald-700 font-medium">
              <ClipboardPaste className="w-3 h-3" />
              Copied: {copiedWeekData.sourceName}
              <button onClick={() => setCopiedWeekData(null)} className="ml-1 text-emerald-400 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-3">
          <button onClick={() => setSelectedWeek(addWeeks(selectedWeek, -1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-900">Week of {formatShortDate(selectedWeek)}</p>
            <p className="text-[11px] text-slate-400">
              {formatShortDate(selectedWeek)} &ndash; {formatShortDate(weekEnd)}
              {isSameWeek(selectedWeek, todayMonday) && (
                <span className="ml-1.5 text-[10px] font-bold text-blue-600 uppercase">This week</span>
              )}
            </p>
          </div>
          <button onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isSameWeek(selectedWeek, todayMonday) && (
            <button onClick={() => setSelectedWeek(getMondayOfWeek(new Date()))}
              className="ml-1 text-[11px] text-[#00adf0] hover:text-[#0099d6] font-medium">
              Today
            </button>
          )}
        </div>
      </div>

      {/* ──── 8-Week Timeline ──── */}
      <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setCalendarStart(addWeeks(calendarStart, -4))}
              className="p-0.5 rounded hover:bg-slate-200 text-slate-400 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              {formatShortDate(calendarWeeks[0])} &ndash; {formatShortDate(calendarWeeks[7])}
            </span>
            <button onClick={() => setCalendarStart(addWeeks(calendarStart, 4))}
              className="p-0.5 rounded hover:bg-slate-200 text-slate-400 transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={() => { setCalendarStart(getMondayOfWeek(new Date())); setSelectedWeek(getMondayOfWeek(new Date())); }}
            className="text-[10px] text-[#00adf0] hover:text-[#0099d6] font-medium">
            Jump to today
          </button>
        </div>

        <div className="grid grid-cols-8 gap-1">
          {calendarWeeks.map((ws) => {
            const resolved = weekResolutions.get(formatDateISO(ws));
            const isSelected = isSameWeek(ws, selectedWeek);
            const isCurrent = isSameWeek(ws, todayMonday);
            const wEntries = resolved ? entries.filter(e => e.group_id === resolved.id) : [];
            const stationCount = wEntries.length;
            const hasSchedule = !!resolved;
            const hasContent = stationCount > 0;

            let barColor: string;
            let barStyle: string;
            if (!hasSchedule) {
              barColor = 'transparent';
              barStyle = 'border border-dashed border-slate-300';
            } else if (!hasContent) {
              barColor = 'transparent';
              barStyle = `border-2 border-dashed`;
            } else {
              barColor = resolved!.is_base ? '#94a3b8' : getGroupColor(resolved!.id, groups);
              barStyle = '';
            }

            const borderDashColor = hasSchedule && !hasContent
              ? (resolved!.is_base ? '#94a3b8' : getGroupColor(resolved!.id, groups))
              : undefined;

            return (
              <button
                key={formatDateISO(ws)}
                onClick={() => setSelectedWeek(ws)}
                className={`rounded-lg p-1.5 text-center transition-all border ${
                  isSelected
                    ? 'border-slate-400 bg-white shadow-sm ring-1 ring-slate-300'
                    : isCurrent
                      ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-50'
                      : 'border-transparent hover:bg-white hover:border-slate-200'
                }`}
              >
                <p className={`text-[10px] font-semibold mb-1 ${isSelected ? 'text-slate-900' : isCurrent ? 'text-blue-700' : 'text-slate-600'}`}>
                  {formatShortDate(ws)}
                </p>
                <div
                  className={`h-1.5 rounded-full mx-auto transition-all ${barStyle}`}
                  style={{
                    backgroundColor: barColor,
                    width: hasSchedule ? '100%' : '50%',
                    borderColor: borderDashColor,
                  }}
                />
                {resolved && resolved.name ? (
                  <p className="text-[8px] text-slate-500 mt-1 truncate leading-tight">{resolved.name}</p>
                ) : (
                  <p className="text-[9px] text-slate-400 mt-1">
                    {hasContent ? `${stationCount} stn${stationCount !== 1 ? 's' : ''}` : hasSchedule ? 'empty' : '\u00A0'}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ──── Active Schedule Info Bar ──── */}
      <div className="px-6 py-3 border-b border-slate-100">
        {resolvedGroup ? (
          <div className="space-y-2">
            {/* Name row */}
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: resolvedGroup.is_base ? '#64748b' : getGroupColor(resolvedGroup.id, groups) }} />
              {editingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <input ref={nameRef} value={nameInput} onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditingName(false); }}
                    placeholder="Schedule name..."
                    className="text-sm font-semibold text-slate-900 bg-transparent border-b-2 border-[#00adf0] outline-none px-0 py-0.5 flex-1" />
                  <button onClick={saveRename} className="text-[#00adf0] hover:text-[#0099d6]"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingName(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button onClick={startRename} className="flex items-center gap-1.5 group">
                  <span className="text-sm font-semibold text-slate-900">{groupDisplayName(resolvedGroup)}</span>
                  <Pencil className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </button>
              )}
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 ml-auto shrink-0">
                {resolvedGroup.is_base ? 'Every week' : resolvedGroup.recurrence_weeks ? `Every ${resolvedGroup.recurrence_weeks}w` : 'One-time'}
              </span>
            </div>

            {/* Date range row */}
            <div className="flex items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5">
                <CalendarRange className="w-3 h-3 text-slate-400" />
                {editingStartDate ? (
                  <div className="flex items-center gap-1">
                    <input type="date" value={startDateInput} onChange={e => setStartDateInput(e.target.value)}
                      className="px-1.5 py-0.5 border border-slate-300 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none" />
                    <button onClick={saveStartDate} className="text-[#00adf0]"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingStartDate(false)} className="text-slate-400"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <button onClick={() => { setStartDateInput(resolvedGroup.start_date); setEditingStartDate(true); }}
                    className="text-slate-600 hover:text-[#00adf0] transition-colors font-medium">
                    Starts {formatShortDate(parseDate(resolvedGroup.start_date))}
                  </button>
                )}
              </div>

              {!resolvedGroup.is_base && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-300">&rarr;</span>
                  {editingEndDate ? (
                    <div className="flex items-center gap-1">
                      <input type="date" value={endDateInput} onChange={e => setEndDateInput(e.target.value)}
                        className="px-1.5 py-0.5 border border-slate-300 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none" />
                      <button onClick={saveEndDate} className="text-[#00adf0]"><Check className="w-3 h-3" /></button>
                      <button onClick={() => setEditingEndDate(false)} className="text-slate-400"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEndDateInput(resolvedGroup.end_date || ''); setEditingEndDate(true); }}
                      className={`transition-colors font-medium ${
                        resolvedGroup.end_date ? 'text-slate-600 hover:text-[#00adf0]' : 'text-slate-400 hover:text-[#00adf0]'
                      }`}>
                      {resolvedGroup.end_date ? `Ends ${formatShortDate(parseDate(resolvedGroup.end_date))}` : 'No end date'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {/* Customize this week */}
              {resolvedGroup && (isBaseWeek || (!isOwnOverride && resolvedGroup.recurrence_weeks)) && (
                <button onClick={() => openCreatePrompt('customize')} disabled={saving}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> {isBaseWeek ? 'Customize this week' : 'Override this week'}
                </button>
              )}

              {/* Copy week */}
              {weekEntries.length > 0 && (
                <button onClick={copyWeek}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1">
                  <Copy className="w-3 h-3" /> Copy week
                </button>
              )}

              {/* Paste week */}
              {copiedWeekData && (
                <button onClick={() => setShowPasteConfirm(true)}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1">
                  <ClipboardPaste className="w-3 h-3" /> Paste here
                </button>
              )}

              {/* Repeat (non-base, non-recurring) */}
              {!resolvedGroup.is_base && !resolvedGroup.recurrence_weeks && (
                <div className="relative">
                  <button onClick={() => setShowRepeatPopover(!showRepeatPopover)}
                    className="px-2.5 py-1.5 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1">
                    <Repeat className="w-3 h-3" /> Repeat every...
                  </button>
                  {showRepeatPopover && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-20 w-52">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Repeat every N weeks</label>
                      <div className="flex gap-2">
                        <input type="number" min="1" max="52" value={repeatWeeksInput}
                          onChange={e => setRepeatWeeksInput(e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                        <button onClick={() => { const n = parseInt(repeatWeeksInput); if (n > 0) setRecurrence(n); }}
                          disabled={!repeatWeeksInput || parseInt(repeatWeeksInput) < 1}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-[#00adf0] rounded-lg hover:bg-[#0099d6] disabled:opacity-50 transition-colors">
                          Set
                        </button>
                      </div>
                      <div className="flex gap-1 mt-2">
                        {[2, 3, 4].map(n => (
                          <button key={n} onClick={() => setRecurrence(n)}
                            className="flex-1 px-2 py-1 text-[10px] font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 rounded transition-colors">
                            {n}w
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Recurrence badge */}
              {resolvedGroup.recurrence_weeks && (
                <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                  <Repeat className="w-3 h-3 text-emerald-600" />
                  <span className="text-[11px] font-medium text-emerald-700">Every {resolvedGroup.recurrence_weeks}w</span>
                  <button onClick={stopRecurrence} className="ml-1 text-emerald-400 hover:text-red-500 transition-colors" title="Stop repeating">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Revert */}
              {!resolvedGroup.is_base && isOwnOverride && (
                <button onClick={() => setConfirmRevert(true)}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> Revert
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            <span className="text-sm text-slate-500">No schedule for this week</span>
            {copiedWeekData && (
              <button onClick={() => setShowPasteConfirm(true)}
                className="ml-auto px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1">
                <ClipboardPaste className="w-3 h-3" /> Paste here
              </button>
            )}
          </div>
        )}
      </div>

      {/* ──── Station / Day Grid ──── */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800">Stations &amp; Days</h3>
          <button onClick={handleAddStation}
            className="px-3 py-1.5 text-xs font-medium text-white bg-[#00adf0] hover:bg-[#0099d6] rounded-lg transition-colors flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Station
          </button>
        </div>

        {weekEntries.length === 0 ? (
          <div className="text-center py-10">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-600 mb-1">
              {groups.length === 0 ? 'No schedule set up yet' : 'No stations this week'}
            </p>
            <p className="text-xs text-slate-400 mb-5 max-w-xs mx-auto">
              {groups.length === 0
                ? 'Add a station to start building your schedule.'
                : 'This week has no station assignments. Add a station or customize this week.'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button onClick={handleAddStation}
                className="px-4 py-2 text-sm font-medium text-white bg-[#00adf0] hover:bg-[#0099d6] rounded-lg transition-colors inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Station
              </button>
              {copiedWeekData && (
                <button onClick={() => setShowPasteConfirm(true)}
                  className="px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors inline-flex items-center gap-2">
                  <ClipboardPaste className="w-4 h-4" /> Paste
                </button>
              )}
            </div>
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
                {weekEntries.map(entry => {
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
                            <div className="flex items-center gap-1 mt-0.5">
                              {dpDef ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: dpDef.color + '20', color: dpDef.color }}>
                                  {DAYPART_ICONS[dpDef.daypart_name]}
                                  {dpDef.display_label}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-400">All Dayparts</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      {DAY_INDICES.map((dayIndex, colIdx) => {
                        const isActive = entry.days_of_week.includes(dayIndex);
                        return (
                          <td key={colIdx} className="py-3">
                            <div className="flex justify-center">
                              <button onClick={() => toggleDay(entry.id, dayIndex)} disabled={saving}
                                className={`w-9 h-9 rounded-lg transition-all flex items-center justify-center ${
                                  isActive
                                    ? 'text-white shadow-sm hover:opacity-80'
                                    : 'bg-slate-100 text-slate-300 hover:bg-slate-200 hover:text-slate-400'
                                }`}
                                style={isActive ? { backgroundColor: brandColor } : undefined}>
                                {isActive ? <Check className="w-4 h-4" /> : <span className="text-[10px]">{DAY_LABELS[colIdx]}</span>}
                              </button>
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-3">
                        <button onClick={() => removeEntry(entry.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg opacity-0 group-hover/row:opacity-100 transition-all">
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
      </div>

      {/* ──── All Schedules List ──── */}
      {groups.length > 1 && (
        <div className="px-6 pb-5 pt-0">
          <details className="group">
            <summary className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none flex items-center gap-1.5 hover:text-slate-700 transition-colors">
              <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
              All Schedules ({groups.length})
            </summary>
            <div className="mt-2 space-y-1">
              {groups.map(g => {
                const isActive = resolvedGroup?.id === g.id;
                const color = g.is_base ? '#64748b' : getGroupColor(g.id, groups);
                const gEntries = entries.filter(e => e.group_id === g.id);
                return (
                  <button key={g.id}
                    onClick={() => { setSelectedWeek(getMondayOfWeek(parseDate(g.start_date))); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                      isActive ? 'bg-slate-100 ring-1 ring-slate-300' : 'hover:bg-slate-50'
                    }`}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{groupDisplayName(g)}</p>
                      <p className="text-[10px] text-slate-400">
                        {formatShortDate(parseDate(g.start_date))}
                        {g.end_date ? ` \u2013 ${formatShortDate(parseDate(g.end_date))}` : ''}
                        {g.recurrence_weeks ? ` \u00B7 Every ${g.recurrence_weeks}w` : ''}
                        {g.is_base ? ' \u00B7 Default' : ''}
                        {' \u00B7 '}{gEntries.length} station{gEntries.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {isActive && <Check className="w-3.5 h-3.5 text-[#00adf0] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </details>
        </div>
      )}

      {/* ──── Add Station Modal ──── */}
      {showAddStation && (
        <AddStationModal allStations={allStations} existingEntries={weekEntries}
          daypartDefs={daypartDefs} saving={saving} onAdd={addStationToGroup}
          onClose={() => setShowAddStation(false)} />
      )}

      {/* ──── Create Schedule Prompt ──── */}
      {showCreatePrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {pendingCreateAction === 'first-station' ? 'Create Schedule' : 'Customize This Week'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {pendingCreateAction === 'first-station'
                ? 'Set up your first schedule. You can add stations after this.'
                : 'Create a separate schedule for this week.'}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Name (optional)</label>
                <input value={createName} onChange={e => setCreateName(e.target.value)}
                  placeholder="e.g., Grill 1 Q1, Summer Menu..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Date</label>
                  <input type="date" value={createStartDate} onChange={e => setCreateStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">End Date</label>
                  <input type="date" value={createEndDate} onChange={e => setCreateEndDate(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowCreatePrompt(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={executeCreate} disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-[#00adf0] rounded-lg hover:bg-[#0099d6] disabled:opacity-50 transition-colors">
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──── Paste Confirm Modal ──── */}
      {showPasteConfirm && copiedWeekData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2">Paste schedule here?</h3>
            <p className="text-sm text-slate-500 mb-1">
              Copy {copiedWeekData.entries.length} station{copiedWeekData.entries.length !== 1 ? 's' : ''} from <strong>{copiedWeekData.sourceName}</strong> to the week of <strong>{formatShortDate(selectedWeek)}</strong>.
            </p>
            {resolvedGroup && !resolvedGroup.is_base && isOwnOverride && (
              <p className="text-xs text-amber-600 mt-2">This will replace the existing custom schedule for this week.</p>
            )}
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowPasteConfirm(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={pasteWeek}
                className="px-4 py-2 text-sm font-medium text-white bg-[#00adf0] rounded-lg hover:bg-[#0099d6] transition-colors">
                Paste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──── Confirm Revert Modal ──── */}
      {confirmRevert && resolvedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2">Revert to default?</h3>
            <p className="text-sm text-slate-500 mb-5">
              This will remove the custom schedule for this week and go back to the default every-week schedule.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmRevert(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={revertWeek} className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg">Revert</button>
            </div>
          </div>
        </div>
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

  const isAlreadyAdded = (stationId: number, dpId: string | null) =>
    existingEntries.some(e => e.station_id === stationId && e.daypart_id === dpId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">Add Station</h2>
            <p className="text-xs text-slate-500 mt-0.5">Pick a station and choose which dayparts it covers</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Daypart selection first */}
          {daypartDefs.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">1. Which dayparts?</label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedDaypart('all')}
                  className={`px-3 py-2.5 text-xs font-medium rounded-lg border transition-all ${
                    selectedDaypart === 'all' ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  All Dayparts
                </button>
                {daypartDefs.map(dp => (
                  <button key={dp.id} onClick={() => setSelectedDaypart(dp.id)}
                    className={`px-3 py-2.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
                      selectedDaypart === dp.id ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>
                    {DAYPART_ICONS[dp.daypart_name]} {dp.display_label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Station search */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {daypartDefs.length > 0 ? '2. Pick a station' : 'Pick a station'}
            </label>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stations..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              autoFocus />
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No stations found</p>
            ) : (
              filtered.map(station => {
                const dpId = selectedDaypart === 'all' ? null : selectedDaypart;
                const alreadyIn = isAlreadyAdded(station.id, dpId);
                return (
                  <button key={station.id} onClick={() => !alreadyIn && setSelectedStation(station.id)}
                    disabled={alreadyIn}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${
                      alreadyIn ? 'opacity-40 cursor-not-allowed' :
                      selectedStation === station.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                    }`}>
                    <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">
                      {station.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{station.name}</p>
                      {alreadyIn && <p className="text-[10px] text-slate-400">Already added</p>}
                    </div>
                    {selectedStation === station.id && !alreadyIn && <Check className="w-4 h-4 text-[#00adf0] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button
            onClick={() => {
              if (!selectedStation) return;
              onAdd(selectedStation, selectedDaypart === 'all' ? null : selectedDaypart);
            }}
            disabled={!selectedStation || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-[#00adf0] rounded-lg hover:bg-[#0099d6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Adding...' : 'Add Station'}
          </button>
        </div>
      </div>
    </div>
  );
}
