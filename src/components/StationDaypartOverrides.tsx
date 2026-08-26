import { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, AlertCircle, Calendar, ChevronDown, ChevronRight, Sparkles, ChevronLeft, ArrowLeft, Combine, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DaypartRoutineForm, { DaypartRoutine } from './DaypartRoutineForm';
import Breadcrumb from './Breadcrumb';

interface StationDaypartOverridesProps {
  stationGroupId: string;
}

interface SiteRoutine extends DaypartRoutine {
  is_inherited: boolean;
}

interface DaypartDefinition {
  id: string;
  daypart_name: string;
  display_label: string;
  color: string;
  icon: string;
  sort_order: number;
}

interface DaypartSchedule {
  id: string;
  daypart_definition_id: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  schedule_name?: string;
  runs_on_days?: boolean;
  schedule_type?: 'regular' | 'event_holiday';
  event_name?: string;
  event_date?: string;
  recurrence_type?: string;
}

interface EffectiveSchedule extends DaypartSchedule {
  is_inherited: boolean;
  daypart_name: string;
  daypart_definition: DaypartDefinition;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun', letter: 'S' },
  { value: 1, label: 'Monday', short: 'Mon', letter: 'M' },
  { value: 2, label: 'Tuesday', short: 'Tue', letter: 'T' },
  { value: 3, label: 'Wednesday', short: 'Wed', letter: 'W' },
  { value: 4, label: 'Thursday', short: 'Thu', letter: 'T' },
  { value: 5, label: 'Friday', short: 'Fri', letter: 'F' },
  { value: 6, label: 'Saturday', short: 'Sat', letter: 'S' }
];

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
}

function isScheduleDisabled(startTime: string | null, endTime: string | null): boolean {
  return startTime === '03:00' && endTime === '03:01';
}

function formatScheduleTime(startTime: string | null, endTime: string | null): string {
  if (isScheduleDisabled(startTime, endTime)) {
    return '----';
  }
  return `${formatTime(startTime!)} - ${formatTime(endTime!)}`;
}

function formatDaysList(days: number[]): string {
  if (days.length === 7) return 'Every day';
  if (days.length === 0) return 'No days';

  const dayNames = days.map(d => DAYS_OF_WEEK[d].short);
  return dayNames.join(', ');
}

export default function StationDaypartOverrides({ stationGroupId }: StationDaypartOverridesProps) {
  const [routines, setRoutines] = useState<DaypartRoutine[]>([]);
  const [inheritedSchedules, setInheritedSchedules] = useState<EffectiveSchedule[]>([]);
  const [daypartDefinitions, setDaypartDefinitions] = useState<DaypartDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<DaypartRoutine | null>(null);
  const [editingInherited, setEditingInherited] = useState<EffectiveSchedule | null>(null);
  const [preFillDaypart, setPreFillDaypart] = useState<string | undefined>(undefined);
  const [preFillScheduleType, setPreFillScheduleType] = useState<'regular' | 'event_holiday'>('regular');
  const [preFillDaysOfWeek, setPreFillDaysOfWeek] = useState<number[] | undefined>(undefined);
  const [preFillStartTime, setPreFillStartTime] = useState<string | undefined>(undefined);
  const [preFillEndTime, setPreFillEndTime] = useState<string | undefined>(undefined);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [expandedInherited, setExpandedInherited] = useState<Record<string, boolean>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showMergePrompt, setShowMergePrompt] = useState(false);
  const [mergeableSchedules, setMergeableSchedules] = useState<DaypartRoutine[]>([]);
  const [savedScheduleId, setSavedScheduleId] = useState<string | null>(null);
  const [showUnusedInherited, setShowUnusedInherited] = useState(false);

  useEffect(() => {
    loadData();
  }, [stationGroupId]);

  const loadData = async () => {
    setLoading(true);

    try {
      // Get station's store_id
      const stationResult = await supabase
        .from('placement_groups')
        .select('store_id')
        .eq('id', stationGroupId)
        .single();

      if (stationResult.error || !stationResult.data?.store_id) {
        console.error('Error loading station:', stationResult.error);
        setLoading(false);
        return;
      }

      const storeIdValue = stationResult.data.store_id;
      setStoreId(storeIdValue);

      // Load daypart definitions for this store
      const defsResult = await supabase.rpc('get_effective_daypart_definitions', {
        p_store_id: storeIdValue
      });

      if (defsResult.error) {
        console.error('Error loading daypart definitions:', defsResult.error);
        setLoading(false);
        return;
      }

      const definitions = defsResult.data || [];
      setDaypartDefinitions(definitions);

      // Load station customizations
      const routinesResult = await supabase
        .from('placement_daypart_overrides')
        .select('*')
        .eq('placement_group_id', stationGroupId);

      const customizations = routinesResult.data || [];
      setRoutines(customizations);

      // Load inherited schedules from daypart_schedules
      const defIds = definitions.map((d: DaypartDefinition) => d.id);
      const schedulesResult = await supabase
        .from('daypart_schedules')
        .select('*')
        .in('daypart_definition_id', defIds);

      const storeSchedules = schedulesResult.data || [];

      // Create a set of daypart names that have REGULAR schedule customizations
      // Event/holiday customizations alone should NOT prevent inherited regular schedules from showing
      const customizedDayparts = new Set<string>();
      customizations.forEach(custom => {
        // Only count as customized if it has at least one regular schedule
        if (custom.schedule_type === 'regular' || !custom.schedule_type) {
          customizedDayparts.add(custom.daypart_name);
        }
      });

      console.log('=== DAYPART DEBUG ===');
      console.log('Customizations:', customizations);
      console.log('Customized dayparts Set:', Array.from(customizedDayparts));
      console.log('Store schedules:', storeSchedules);

      // Build inherited schedules list (only dayparts with NO regular schedule customizations)
      // Dayparts with only event/holiday customizations will still show inherited regular schedules
      const inherited: EffectiveSchedule[] = [];
      storeSchedules.forEach((schedule: DaypartSchedule) => {
        const definition = definitions.find((d: DaypartDefinition) => d.id === schedule.daypart_definition_id);
        if (!definition) return;

        // Only add if this entire daypart has no regular schedule customizations
        if (!customizedDayparts.has(definition.daypart_name)) {
          inherited.push({
            ...schedule,
            is_inherited: true,
            daypart_name: definition.daypart_name,
            daypart_definition: definition,
            schedule_type: schedule.schedule_type || 'regular'
          });
        }
      });

      setInheritedSchedules(inherited);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (routine: Omit<DaypartRoutine, 'id' | 'created_at' | 'updated_at'>) => {
    let scheduleId: string | undefined;

    if (editingRoutine) {
      const { error } = await supabase
        .from('placement_daypart_overrides')
        .update(routine)
        .eq('id', editingRoutine.id);

      if (error) {
        console.error('Update error:', error);
        throw error;
      }
      scheduleId = editingRoutine.id;
    } else {
      const schedulesToInsert = [routine];

      // If customizing an inherited schedule, copy ALL other schedules from the same daypart
      if (editingInherited) {
        const sameDaypartSchedules = inheritedSchedules.filter(sched =>
          sched.daypart_name === editingInherited.daypart_name &&
          !(
            sched.daypart_name === editingInherited.daypart_name &&
            sched.schedule_type === editingInherited.schedule_type &&
            sched.event_date === editingInherited.event_date &&
            sched.schedule_name === editingInherited.schedule_name
          )
        );

        sameDaypartSchedules.forEach(sched => {
          schedulesToInsert.push({
            placement_group_id: stationGroupId,
            daypart_name: sched.daypart_name,
            days_of_week: sched.days_of_week,
            start_time: sched.start_time,
            end_time: sched.end_time,
            schedule_name: sched.schedule_name,
            runs_on_days: sched.runs_on_days,
            schedule_type: sched.schedule_type,
            event_name: sched.event_name,
            event_date: sched.event_date,
            recurrence_type: sched.recurrence_type
          });
        });
      }

      const { error, data } = await supabase
        .from('placement_daypart_overrides')
        .insert(schedulesToInsert)
        .select();

      if (error) {
        console.error('Insert error details:', error);
        throw new Error(`Failed to create schedule: ${error.message}`);
      }

      console.log('Insert successful:', data);
      scheduleId = data?.[0]?.id;
    }

    // Check for mergeable schedules (only for regular schedules)
    if (scheduleId && routine.schedule_type === 'regular') {
      const { data: otherSchedules, error: queryError } = await supabase
        .from('placement_daypart_overrides')
        .select('*')
        .eq('placement_group_id', stationGroupId)
        .eq('daypart_name', routine.daypart_name)
        .eq('start_time', routine.start_time)
        .eq('end_time', routine.end_time)
        .eq('schedule_type', 'regular')
        .neq('id', scheduleId);

      if (queryError) {
        console.error('Error checking for mergeable schedules:', queryError);
      } else if (otherSchedules && otherSchedules.length > 0) {
        // Found schedules with same times but different days
        setSavedScheduleId(scheduleId);
        setMergeableSchedules(otherSchedules as DaypartRoutine[]);
        setShowMergePrompt(true);
        return; // Don't close the form yet, wait for merge decision
      }
    }

    setExpandedScheduleId(null);
    setEditingRoutine(null);
    setEditingInherited(null);
    setIsAddingNew(false);
    await loadData();
  };

  const handleCancel = () => {
    setExpandedScheduleId(null);
    setEditingRoutine(null);
    setEditingInherited(null);
    setPreFillDaypart(undefined);
    setIsAddingNew(false);
  };

  const handleEdit = (routine: DaypartRoutine) => {
    if (expandedScheduleId === routine.id) {
      handleCancel();
    } else {
      setExpandedScheduleId(routine.id!);
      setEditingRoutine(routine);
      setEditingInherited(null);
      setIsAddingNew(false);
      setPreFillDaypart(undefined);
    }
  };

  const handleEditInherited = (schedule: EffectiveSchedule) => {
    console.log('handleEditInherited clicked', {
      scheduleId: schedule.id,
      daypartName: schedule.daypart_name,
      currentExpandedId: expandedScheduleId
    });

    if (expandedScheduleId === schedule.id) {
      console.log('Canceling (already expanded)');
      handleCancel();
    } else {
      console.log('Setting expanded to', schedule.id);
      // Clicking an inherited schedule creates a customization
      setExpandedScheduleId(schedule.id);
      setEditingInherited(schedule);
      setEditingRoutine(null);
      setIsAddingNew(false);
      setPreFillDaypart(undefined);
    }
  };

  const handleDelete = async (routineId: string) => {
    if (!confirm('Delete this customization? The schedule will revert to the inherited store-level configuration.')) {
      return;
    }

    const { error } = await supabase
      .from('placement_daypart_overrides')
      .delete()
      .eq('id', routineId);

    if (error) {
      console.error('Error deleting schedule:', error);
      throw new Error(error.message);
    }

    setExpandedScheduleId(null);
    setEditingRoutine(null);
    setEditingInherited(null);
    setIsAddingNew(false);
    await loadData();
  };

  const handleMergeSchedules = async () => {
    if (!savedScheduleId || mergeableSchedules.length === 0) return;

    try {
      // Get the current schedule that was just saved
      const { data: currentSchedule, error: fetchError } = await supabase
        .from('placement_daypart_overrides')
        .select('days_of_week')
        .eq('id', savedScheduleId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!currentSchedule) {
        throw new Error('Schedule not found');
      }

      // Combine all days from all schedules
      const allDays = new Set<number>(currentSchedule.days_of_week);
      mergeableSchedules.forEach(schedule => {
        schedule.days_of_week.forEach(day => allDays.add(day));
      });

      const combinedDays = Array.from(allDays).sort((a, b) => a - b);

      // Delete all other schedules FIRST to avoid collision
      const schedulesToDelete = mergeableSchedules.map(s => s.id).filter(id => id !== undefined) as string[];
      const { error: deleteError } = await supabase
        .from('placement_daypart_overrides')
        .delete()
        .in('id', schedulesToDelete);

      if (deleteError) throw deleteError;

      // Now update the current schedule with combined days and clear the name
      const { error: updateError } = await supabase
        .from('placement_daypart_overrides')
        .update({
          days_of_week: combinedDays,
          schedule_name: null
        })
        .eq('id', savedScheduleId);

      if (updateError) throw updateError;

      // Success - close form and reload
      setShowMergePrompt(false);
      setExpandedScheduleId(null);
      setEditingRoutine(null);
      setEditingInherited(null);
      setIsAddingNew(false);
      await loadData();
    } catch (err) {
      console.error('Error merging schedules:', err);
      alert('Failed to merge schedules. Please try again.');
      setShowMergePrompt(false);
    }
  };

  const handleSkipMerge = async () => {
    setShowMergePrompt(false);
    setExpandedScheduleId(null);
    setEditingRoutine(null);
    setEditingInherited(null);
    setIsAddingNew(false);
    await loadData();
  };

  const handleAddNew = (
    scheduleType: 'regular' | 'event_holiday' = 'regular',
    daypartName?: string,
    daysOfWeek?: number[],
    template?: DaypartRoutine
  ) => {
    const newId = `new-${daypartName}`;
    setExpandedScheduleId(newId);
    setEditingRoutine(null);
    setEditingInherited(null);
    setPreFillDaypart(daypartName);
    setPreFillScheduleType(scheduleType);
    setPreFillDaysOfWeek(daysOfWeek);
    setPreFillStartTime(template?.start_time);
    setPreFillEndTime(template?.end_time);
    setIsAddingNew(true);
  };

  // Group station-specific schedules
  const regularRoutines = routines.filter(s => s.schedule_type !== 'event_holiday');
  const eventRoutines = routines.filter(s => s.schedule_type === 'event_holiday');

  const groupedRoutines = regularRoutines.reduce((acc, routine) => {
    if (!acc[routine.daypart_name]) {
      acc[routine.daypart_name] = [];
    }
    acc[routine.daypart_name].push(routine);
    return acc;
  }, {} as Record<string, DaypartRoutine[]>);

  const groupedEventRoutines = eventRoutines.reduce((acc, routine) => {
    if (!acc[routine.daypart_name]) {
      acc[routine.daypart_name] = [];
    }
    acc[routine.daypart_name].push(routine);
    return acc;
  }, {} as Record<string, DaypartRoutine[]>);

  // Group inherited schedules
  const inheritedRegular = inheritedSchedules.filter(s => s.schedule_type !== 'event_holiday');
  const inheritedEvents = inheritedSchedules.filter(s => s.schedule_type === 'event_holiday');

  const groupedInheritedRoutines = inheritedRegular.reduce((acc, schedule) => {
    if (!acc[schedule.daypart_name]) {
      acc[schedule.daypart_name] = [];
    }
    acc[schedule.daypart_name].push(schedule);
    return acc;
  }, {} as Record<string, EffectiveSchedule[]>);

  const groupedInheritedEvents = inheritedEvents.reduce((acc, schedule) => {
    if (!acc[schedule.daypart_name]) {
      acc[schedule.daypart_name] = [];
    }
    acc[schedule.daypart_name].push(schedule);
    return acc;
  }, {} as Record<string, EffectiveSchedule[]>);

  // Get all dayparts from definitions, not just ones with schedules
  const allDayparts = daypartDefinitions
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(d => d.daypart_name);

  const toggleEventsExpanded = (daypartName: string) => {
    setExpandedEvents(prev => ({
      ...prev,
      [daypartName]: !prev[daypartName]
    }));
  };

  const toggleInheritedExpanded = (daypartName: string) => {
    setExpandedInherited(prev => ({
      ...prev,
      [daypartName]: !prev[daypartName]
    }));
  };

  const [inheritedSectionExpanded, setInheritedSectionExpanded] = useState(false);

  const formatEventDate = (dateString: string | undefined, recurrenceType?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    if (recurrenceType === 'none') {
      options.year = 'numeric';
    }
    return date.toLocaleDateString('en-US', options);
  };

  const getRecurrenceLabel = (type?: string) => {
    switch (type) {
      case 'none': return 'One-time';
      case 'annual_date': return 'Annual';
      case 'monthly_date': return 'Monthly';
      case 'annual_relative': return 'Annual (relative)';
      case 'annual_date_range': return 'Annual range';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-6 h-6 border-3 border-slate-200 border-t-cyan-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Helper to render inline edit form
  const renderInlineEditForm = (scheduleId: string, daypartName: string) => {
    console.log('renderInlineEditForm called', {
      scheduleId,
      daypartName,
      expandedScheduleId,
      match: expandedScheduleId === scheduleId
    });

    if (expandedScheduleId !== scheduleId) return null;

    console.log('Rendering form for', scheduleId, { editingInherited, editingRoutine });

    const currentDefinition = daypartDefinitions.find(d => d.daypart_name === daypartName);
    const allRoutinesForCollision: DaypartRoutine[] = routines.filter(routine => {
      if (editingRoutine && routine.id === editingRoutine.id) return false;
      return true;
    });

    const isEventHoliday = preFillScheduleType === 'event_holiday' || editingRoutine?.schedule_type === 'event_holiday' || editingInherited?.schedule_type === 'event_holiday';

    return (
      <div>
        <DaypartRoutineForm
            stationGroupId={stationGroupId}
            existingRoutines={allRoutinesForCollision}
            onSave={handleSave}
            onCancel={handleCancel}
            editingRoutine={editingInherited ? {
              id: undefined,
              placement_group_id: stationGroupId,
              daypart_name: editingInherited.daypart_name,
              days_of_week: editingInherited.days_of_week,
              start_time: editingInherited.start_time,
              end_time: editingInherited.end_time,
              schedule_name: editingInherited.schedule_name,
              runs_on_days: editingInherited.runs_on_days,
              schedule_type: editingInherited.schedule_type,
              event_name: editingInherited.event_name,
              event_date: editingInherited.event_date,
              recurrence_type: editingInherited.recurrence_type,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } as DaypartRoutine : editingRoutine}
            preFillDaypart={preFillDaypart}
            preFillScheduleType={preFillScheduleType}
            preFillDaysOfWeek={preFillDaysOfWeek}
            preFillStartTime={preFillStartTime}
            preFillEndTime={preFillEndTime}
            daypartDefinition={currentDefinition}
            onDelete={editingRoutine ? handleDelete : undefined}
          />
      </div>
    );
  };

  // List View
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          Station Schedules
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Configure daypart hours and event/holiday schedules for this station.
        </p>
      </div>

      {routines.length === 0 && inheritedSchedules.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
          <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Daypart Schedules Configured</h3>
          <p className="text-slate-600 text-sm px-4">
            Configure daypart schedules at the store level first
          </p>
        </div>
      ) : (routines.length > 0 || inheritedSchedules.length > 0) ? (
        <div className="space-y-5">
          {/* Custom Dayparts Section */}
          {allDayparts.map((daypartName) => {
            const daypartSchedules = groupedRoutines[daypartName] || [];
            const daypartEvents = groupedEventRoutines[daypartName] || [];
            const hasCustom = daypartSchedules.length > 0; // Only regular schedules make it "custom"

            // Only show if has custom regular schedules
            if (!hasCustom) return null;

            const hasEvents = daypartEvents.length > 0;
            const eventsExpanded = expandedEvents[daypartName];
            const definition = daypartDefinitions.find(d => d.daypart_name === daypartName);
            if (!definition) return null;
            const displayLabel = definition.display_label;
            const colorClass = definition.color;

            return (
              <div key={daypartName} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <div className={`px-4 py-3 border-b border-slate-200 ${colorClass}`}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <h4 className="font-semibold">{displayLabel}</h4>
                    {hasEvents && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(222, 56, 222, 0.15)', color: 'rgb(156, 39, 176)' }}>
                        <Calendar className="w-3 h-3" />
                        {daypartEvents.length} {daypartEvents.length === 1 ? 'Event' : 'Events'}
                      </span>
                    )}
                  </div>
                </div>
              <div className="p-3 space-y-3">
                {daypartSchedules.map((schedule) => (
                  <div key={schedule.id}>
                    {expandedScheduleId === schedule.id ? (
                      renderInlineEditForm(schedule.id!, schedule.daypart_name)
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEdit(schedule)}
                        className="w-full p-4 rounded-xl border transition-all hover:shadow-md shadow-sm text-left group border-slate-200 bg-white hover:bg-blue-50 active:bg-blue-100 hover:scale-[1.01] active:scale-[0.99]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex gap-1 mb-2">
                              {DAYS_OF_WEEK.map((day) => {
                                const isActive = schedule.days_of_week.includes(day.value);
                                const bgColor = colorClass.match(/bg-(\w+)-\d+/)?.[0] || 'bg-slate-100';
                                const textColor = bgColor.replace('bg-', 'text-').replace('-100', '-700');
                                return (
                                  <div
                                    key={day.value}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                      isActive
                                        ? `${bgColor} ${textColor}`
                                        : 'bg-slate-100 text-slate-400'
                                    }`}
                                    title={day.label}
                                  >
                                    {day.letter}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Clock className="w-4 h-4" />
                              <span>
                                {schedule.runs_on_days === false
                                  ? 'Does Not Run'
                                  : formatScheduleTime(schedule.start_time, schedule.end_time)}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1 group-hover:text-slate-600 transition-colors" />
                        </div>
                      </button>
                    )}
                  </div>
                ))}

                {/* Add New Schedule Inline Form */}
                {isAddingNew && preFillDaypart === daypartName ? (
                  <div className="mx-3 mb-3">
                    {renderInlineEditForm(`new-${daypartName}`, daypartName)}
                  </div>
                ) : (
                  <>
                    {daypartSchedules.length === 0 && !hasEvents && (
                      <div className="p-6 space-y-4">
                        <div className="text-center">
                          <Plus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-slate-600 text-sm">
                            No schedules configured for this daypart.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddNew('event_holiday', daypartName)}
                          className="w-full min-w-[180px] p-3 border-2 border-dashed rounded-lg transition-all flex items-center justify-center gap-2"
                          style={{
                            borderColor: 'rgba(222, 56, 222, 0.3)',
                            color: 'rgb(156, 39, 176)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(222, 56, 222, 0.5)';
                            e.currentTarget.style.backgroundColor = 'rgba(222, 56, 222, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(222, 56, 222, 0.3)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Sparkles className="w-4 h-4" />
                          <span className="text-xs md:text-sm font-medium">
                            Add Event/Holiday
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Action Buttons Grid */}
                    {daypartSchedules.length > 0 && (() => {
                      const scheduledDays = new Set<number>();
                      daypartSchedules.forEach(schedule => {
                        schedule.days_of_week.forEach(day => scheduledDays.add(day));
                      });
                      const allDays = [0, 1, 2, 3, 4, 5, 6];
                      const unscheduledDays = allDays.filter(day => !scheduledDays.has(day));
                      const hasUnscheduledDays = unscheduledDays.length > 0;

                      return (
                        <div className="mx-3 mb-3 flex flex-wrap gap-3">
                          {hasUnscheduledDays && (
                            <button
                              type="button"
                              onClick={() => {
                                const template = daypartSchedules[0];
                                handleAddNew('regular', daypartName, unscheduledDays, template);
                              }}
                              className="flex-1 min-w-[240px] p-3 border-2 border-dashed rounded-lg transition-all flex items-center justify-center gap-2"
                              style={{
                                borderColor: 'rgba(37, 99, 235, 0.3)',
                                color: 'rgb(30, 64, 175)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.5)';
                                e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.3)';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <Plus className="w-4 h-4" />
                              <span className="text-xs md:text-sm font-medium">
                                Schedule Remaining Days ({unscheduledDays.length})
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAddNew('event_holiday', daypartName)}
                            className="flex-1 min-w-[180px] p-3 border-2 border-dashed rounded-lg transition-all flex items-center justify-center gap-2"
                            style={{
                              borderColor: 'rgba(222, 56, 222, 0.3)',
                              color: 'rgb(156, 39, 176)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(222, 56, 222, 0.5)';
                              e.currentTarget.style.backgroundColor = 'rgba(222, 56, 222, 0.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(222, 56, 222, 0.3)';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <Sparkles className="w-4 h-4" />
                            <span className="text-xs md:text-sm font-medium">
                              Add Event/Holiday
                            </span>
                          </button>
                        </div>
                      );
                    })()}
                  </>
                )}

                {hasEvents && (
                  <div className="mx-3 mb-3 mt-2 rounded-lg overflow-hidden" style={{ border: '2px solid rgba(222, 56, 222, 0.2)', backgroundColor: 'rgba(222, 56, 222, 0.03)' }}>
                    <button
                      type="button"
                      onClick={() => toggleEventsExpanded(daypartName)}
                      className="w-full px-4 py-3 transition-colors flex items-center justify-between group"
                      style={{ backgroundColor: 'rgba(222, 56, 222, 0.08)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(222, 56, 222, 0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(222, 56, 222, 0.08)'}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" style={{ color: 'rgb(156, 39, 176)' }} />
                        <span className="text-sm md:text-base font-medium" style={{ color: 'rgb(156, 39, 176)' }}>
                          Event & Holiday Schedules
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(222, 56, 222, 0.15)', color: 'rgb(156, 39, 176)' }}>
                          {daypartEvents.length}
                        </span>
                      </div>
                      {eventsExpanded ? (
                        <ChevronDown className="w-5 h-5" style={{ color: 'rgb(156, 39, 176)' }} />
                      ) : (
                        <ChevronRight className="w-5 h-5" style={{ color: 'rgb(156, 39, 176)' }} />
                      )}
                    </button>

                    {eventsExpanded && (
                      <div className="divide-y" style={{ borderColor: 'rgba(222, 56, 222, 0.1)' }}>
                        {daypartEvents.map((schedule) => (
                          <div key={schedule.id}>
                            {expandedScheduleId === schedule.id ? (
                              renderInlineEditForm(schedule.id!, schedule.daypart_name)
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleEdit(schedule)}
                                className="w-full p-4 transition-colors text-left"
                                style={{ backgroundColor: 'transparent' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(222, 56, 222, 0.08)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                      <span className="font-medium" style={{ color: 'rgb(156, 39, 176)' }}>
                                        {schedule.event_name || 'Unnamed Event'}
                                      </span>
                                      <span className="text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: 'rgba(222, 56, 222, 0.15)', color: 'rgb(156, 39, 176)' }}>
                                        {getRecurrenceLabel(schedule.recurrence_type)}
                                      </span>
                                    </div>
                                    <div className="text-sm mb-2" style={{ color: 'rgb(156, 39, 176)' }}>
                                      <Calendar className="w-3.5 h-3.5 inline mr-1" />
                                      {formatEventDate(schedule.event_date, schedule.recurrence_type)}
                                      <span className="mx-2" style={{ color: 'rgba(222, 56, 222, 0.4)' }}>•</span>
                                      <Clock className="w-3.5 h-3.5 inline mr-1" />
                                      {schedule.runs_on_days === false
                                        ? 'Does Not Run'
                                        : formatScheduleTime(schedule.start_time, schedule.end_time)}
                                    </div>
                                    {schedule.days_of_week.length > 0 && (
                                      <div className="flex gap-1">
                                        {DAYS_OF_WEEK.map((day) => {
                                          const isActive = schedule.days_of_week.includes(day.value);
                                          const bgColor = colorClass.match(/bg-(\w+)-\d+/)?.[0] || 'bg-slate-100';
                                          const textColor = bgColor.replace('bg-', 'text-').replace('-100', '-700');
                                          return (
                                            <div
                                              key={day.value}
                                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                                isActive
                                                  ? `${bgColor} ${textColor}`
                                                  : 'bg-slate-100 text-slate-400'
                                              }`}
                                              title={day.label}
                                            >
                                              {day.letter}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  <ChevronRight className="w-5 h-5 flex-shrink-0 mt-1" style={{ color: 'rgba(156, 39, 176, 0.4)' }} />
                                </div>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            );
          })}

          {/* Store Dayparts Section - collapsible group containing individual cards */}
          {inheritedSchedules.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setInheritedSectionExpanded(!inheritedSectionExpanded)}
                className="w-full px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">
                    Store Dayparts
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    {allDayparts.filter(dp => {
                      const hasCustom = (groupedRoutines[dp]?.length || 0) > 0; // Only regular schedules count as custom
                      const hasInherited = (groupedInheritedRoutines[dp]?.length || 0) + (groupedInheritedEvents[dp]?.length || 0) > 0;
                      return !hasCustom && hasInherited;
                    }).length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUnusedInherited(!showUnusedInherited);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
                    title={showUnusedInherited ? "Show in-use only" : "Show all dayparts"}
                  >
                    {showUnusedInherited ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>All</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>In-Use</span>
                      </>
                    )}
                  </button>
                  {inheritedSectionExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  )}
                </div>
              </button>

              {inheritedSectionExpanded && (
                <div className="p-4 space-y-5">
                  {allDayparts.map((daypartName) => {
                    const daypartSchedules = groupedRoutines[daypartName] || [];
                    const daypartEvents = groupedEventRoutines[daypartName] || [];
                    const daypartInheritedSchedules = groupedInheritedRoutines[daypartName] || [];
                    const daypartInheritedEvents = groupedInheritedEvents[daypartName] || [];
                    const hasCustom = daypartSchedules.length > 0; // Only regular schedules count as custom
                    const hasInherited = daypartInheritedSchedules.length > 0 || daypartInheritedEvents.length > 0;

                    // Only show dayparts that are ONLY inherited (no customizations)
                    if (hasCustom || !hasInherited) return null;

                    // Check if daypart is "in use" (has at least one non-disabled schedule)
                    const isInUse = daypartInheritedSchedules.some(s => !isScheduleDisabled(s.start_time, s.end_time)) ||
                                    daypartInheritedEvents.length > 0;

                    // Filter based on showUnusedInherited toggle
                    if (!showUnusedInherited && !isInUse) return null;

                    const eventsExpanded = expandedEvents[daypartName];
                    const definition = daypartDefinitions.find(d => d.daypart_name === daypartName);
                    if (!definition) return null;
                    const displayLabel = definition.display_label;
                    const colorClass = definition.color;
                    // Include both inherited and custom events since this daypart has no custom regular schedules
                    const hasEvents = daypartInheritedEvents.length > 0 || daypartEvents.length > 0;
                    const totalEvents = daypartInheritedEvents.length + daypartEvents.length;

                    return (
                      <div key={daypartName} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                        <div className={`px-4 py-3 border-b border-slate-200 ${colorClass}`}>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <h4 className="font-semibold">{displayLabel}</h4>
                            {hasEvents && (
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(222, 56, 222, 0.15)', color: 'rgb(156, 39, 176)' }}>
                                <Calendar className="w-3 h-3" />
                                {totalEvents} {totalEvents === 1 ? 'Event' : 'Events'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="p-3 space-y-3">
                          {/* Inherited Regular Schedules */}
                          {daypartInheritedSchedules.map((schedule) => (
                            <div key={schedule.id}>
                              {expandedScheduleId === schedule.id ? (
                                renderInlineEditForm(schedule.id, schedule.daypart_name)
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleEditInherited(schedule)}
                                  className="w-full p-4 rounded-xl border transition-all hover:shadow-md shadow-sm text-left opacity-75 group border-slate-200 bg-white hover:bg-blue-50 active:bg-blue-100 hover:scale-[1.01] active:scale-[0.99]"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex gap-1 mb-2">
                                        {DAYS_OF_WEEK.map((day) => {
                                          const isActive = schedule.days_of_week.includes(day.value);
                                          const bgColor = colorClass.match(/bg-(\w+)-\d+/)?.[0] || 'bg-slate-100';
                                          const textColor = bgColor.replace('bg-', 'text-').replace('-100', '-700');
                                          return (
                                            <div
                                              key={day.value}
                                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                                isActive
                                                  ? `${bgColor} ${textColor}`
                                                  : 'bg-slate-100 text-slate-400'
                                              }`}
                                              title={day.label}
                                            >
                                              {day.letter}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Clock className="w-4 h-4" />
                                        <span>
                                          {schedule.runs_on_days === false
                                            ? 'Does Not Run'
                                            : formatScheduleTime(schedule.start_time, schedule.end_time)}
                                        </span>
                                      </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1 group-hover:text-slate-600 transition-colors" />
                                  </div>
                                </button>
                              )}
                            </div>
                          ))}

                          {/* Event & Holiday Schedules (both inherited and custom) */}
                          {hasEvents && (
                            <div className="mx-3 mb-3 mt-2 rounded-lg overflow-hidden" style={{ border: '2px solid rgba(222, 56, 222, 0.2)', backgroundColor: 'rgba(222, 56, 222, 0.03)' }}>
                              <button
                                type="button"
                                onClick={() => toggleEventsExpanded(daypartName)}
                                className="w-full px-4 py-3 transition-colors flex items-center justify-between group"
                                style={{ backgroundColor: 'rgba(222, 56, 222, 0.08)' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(222, 56, 222, 0.15)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(222, 56, 222, 0.08)'}
                              >
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4" style={{ color: 'rgb(156, 39, 176)' }} />
                                  <span className="text-sm md:text-base font-medium" style={{ color: 'rgb(156, 39, 176)' }}>
                                    Event & Holiday Schedules
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(222, 56, 222, 0.15)', color: 'rgb(156, 39, 176)' }}>
                                    {totalEvents}
                                  </span>
                                </div>
                                {eventsExpanded ? (
                                  <ChevronDown className="w-5 h-5" style={{ color: 'rgb(156, 39, 176)' }} />
                                ) : (
                                  <ChevronRight className="w-5 h-5" style={{ color: 'rgb(156, 39, 176)' }} />
                                )}
                              </button>

                              {eventsExpanded && (
                                <div className="divide-y" style={{ borderColor: 'rgba(222, 56, 222, 0.1)' }}>
                                  {/* Custom Event Schedules */}
                                  {daypartEvents.map((schedule) => (
                                    <div key={schedule.id}>
                                      {expandedScheduleId === schedule.id ? (
                                        renderInlineEditForm(schedule.id!, schedule.daypart_name)
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleEdit(schedule)}
                                          className="w-full p-4 transition-colors text-left relative group/event"
                                          style={{ backgroundColor: 'transparent' }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(222, 56, 222, 0.08)'}
                                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-3 mb-2">
                                                <span className="font-medium" style={{ color: 'rgb(156, 39, 176)' }}>
                                                  {schedule.event_name || 'Unnamed Event'}
                                                </span>
                                                <span className="text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: 'rgba(222, 56, 222, 0.15)', color: 'rgb(156, 39, 176)' }}>
                                                  {getRecurrenceLabel(schedule.recurrence_type)}
                                                </span>
                                                <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-700">
                                                  Custom
                                                </span>
                                              </div>
                                              <div className="text-sm mb-2" style={{ color: 'rgb(156, 39, 176)' }}>
                                                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                                                {formatEventDate(schedule.event_date, schedule.recurrence_type)}
                                                <span className="mx-2" style={{ color: 'rgba(222, 56, 222, 0.4)' }}>•</span>
                                                <Clock className="w-3.5 h-3.5 inline mr-1" />
                                                {schedule.runs_on_days === false
                                                  ? 'Does Not Run'
                                                  : formatScheduleTime(schedule.start_time, schedule.end_time)}
                                              </div>
                                              {schedule.days_of_week.length > 0 && (
                                                <div className="flex gap-1">
                                                  {DAYS_OF_WEEK.map((day) => {
                                                    const isActive = schedule.days_of_week.includes(day.value);
                                                    const bgColor = colorClass.match(/bg-(\w+)-\d+/)?.[0] || 'bg-slate-100';
                                                    const textColor = bgColor.replace('bg-', 'text-').replace('-100', '-700');
                                                    return (
                                                      <div
                                                        key={day.value}
                                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                                          isActive
                                                            ? `${bgColor} ${textColor}`
                                                            : 'bg-slate-100 text-slate-400'
                                                        }`}
                                                        title={day.label}
                                                      >
                                                        {day.letter}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                            <ChevronRight className="w-5 h-5 flex-shrink-0 mt-1 transition-colors" style={{ color: 'rgb(156, 39, 176)' }} />
                                          </div>
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  {/* Inherited Event Schedules */}
                                  {daypartInheritedEvents.map((schedule) => (
                                    <div key={schedule.id}>
                                      {expandedScheduleId === schedule.id ? (
                                        renderInlineEditForm(schedule.id, schedule.daypart_name)
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleEditInherited(schedule)}
                                          className="w-full p-4 transition-colors text-left"
                                          style={{ backgroundColor: 'transparent' }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(222, 56, 222, 0.08)'}
                                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-3 mb-2">
                                                <span className="font-medium" style={{ color: 'rgb(156, 39, 176)' }}>
                                                  {schedule.event_name || 'Unnamed Event'}
                                                </span>
                                                <span className="text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: 'rgba(222, 56, 222, 0.15)', color: 'rgb(156, 39, 176)' }}>
                                                  {getRecurrenceLabel(schedule.recurrence_type)}
                                                </span>
                                              </div>
                                              <div className="text-sm mb-2" style={{ color: 'rgb(156, 39, 176)' }}>
                                                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                                                {formatEventDate(schedule.event_date, schedule.recurrence_type)}
                                                <span className="mx-2" style={{ color: 'rgba(222, 56, 222, 0.4)' }}>•</span>
                                                <Clock className="w-3.5 h-3.5 inline mr-1" />
                                                {schedule.runs_on_days === false
                                                  ? 'Does Not Run'
                                                  : formatScheduleTime(schedule.start_time, schedule.end_time)}
                                              </div>
                                              {schedule.days_of_week.length > 0 && (
                                                <div className="flex gap-1">
                                                  {DAYS_OF_WEEK.map((day) => {
                                                    const isActive = schedule.days_of_week.includes(day.value);
                                                    const bgColor = colorClass.match(/bg-(\w+)-\d+/)?.[0] || 'bg-slate-100';
                                                    const textColor = bgColor.replace('bg-', 'text-').replace('-100', '-700');
                                                    return (
                                                      <div
                                                        key={day.value}
                                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                                          isActive
                                                            ? `${bgColor} ${textColor}`
                                                            : 'bg-slate-100 text-slate-400'
                                                        }`}
                                                        title={day.label}
                                                      >
                                                        {day.letter}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                            <ChevronRight className="w-5 h-5 flex-shrink-0 mt-1" style={{ color: 'rgba(156, 39, 176, 0.4)' }} />
                                          </div>
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {routines.length === 0 && inheritedSchedules.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            This station uses store-level schedules. Click "Store Dayparts" to view and customize schedules for this station.
          </p>
        </div>
      )}

      {/* Merge Prompt Modal */}
      {showMergePrompt && savedScheduleId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <Combine className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    Merge Schedules?
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    You have {mergeableSchedules.length + 1} schedules with the same times on different days
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {mergeableSchedules.map((sched) => (
                  <div
                    key={sched.id}
                    className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {formatDaysList(sched.days_of_week)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <Sparkles className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  Combine into one schedule covering all days
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSkipMerge}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg transition-colors"
                >
                  Keep Separate
                </button>
                <button
                  onClick={handleMergeSchedules}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
                >
                  Merge Schedules
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
