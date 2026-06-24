import { useState, useEffect } from 'react';
import { AlertCircle, Calendar, Sparkles, Info, Trash2, Clock, Ban } from 'lucide-react';
import TimeSelector from './TimeSelector';
import DaySelector from './DaySelector';
import { supabase } from '../lib/supabase';
import HolidayTemplatePicker from './HolidayTemplatePicker';
import { formatRecurrenceText, getPriorityLevel } from '../types/schedules';

interface DaypartRoutineFormProps {
  placementGroupId: string;
  existingRoutines: DaypartRoutine[];
  onSave: (routine: Omit<DaypartRoutine, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onCancel: () => void;
  editingRoutine?: DaypartRoutine | null;
  preFillDaypart?: string;
  preFillScheduleType?: 'regular' | 'event_holiday';
  preFillDaysOfWeek?: number[];
  preFillStartTime?: string;
  preFillEndTime?: string;
  daypartDefinition?: {
    daypart_name: string;
    display_label: string;
    color?: string;
  };
  onDelete?: (routineId: string) => Promise<void>;
  onScheduleUnscheduledDays?: (days: number[], template: DaypartRoutine) => void;
}

export interface DaypartRoutine {
  id?: string;
  placement_group_id: string;
  daypart_name: string;
  days_of_week: number[];
  start_time: string | null;
  end_time: string | null;
  runs_on_days?: boolean;
  schedule_name?: string;
  schedule_type?: 'regular' | 'event_holiday';
  event_name?: string;
  event_date?: string;
  recurrence_type?: 'none' | 'annual_date' | 'monthly_date' | 'annual_relative' | 'annual_date_range';
  recurrence_config?: {
    month?: number;
    day_of_month?: number;
    weekday?: number;
    position?: number;
    range_start_date?: string;
    range_end_date?: string;
  };
  priority_level?: number;
  created_at?: string;
  updated_at?: string;
}

interface DaypartDefinition {
  daypart_name: string;
  display_label: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'S' },
  { value: 1, label: 'Monday', short: 'M' },
  { value: 2, label: 'Tuesday', short: 'T' },
  { value: 3, label: 'Wednesday', short: 'W' },
  { value: 4, label: 'Thursday', short: 'T' },
  { value: 5, label: 'Friday', short: 'F' },
  { value: 6, label: 'Saturday', short: 'S' }
];

export default function DaypartRoutineForm({
  placementGroupId,
  existingRoutines,
  onSave,
  onCancel,
  editingRoutine,
  preFillDaypart,
  preFillScheduleType,
  preFillDaysOfWeek,
  preFillStartTime,
  preFillEndTime,
  daypartDefinition,
  onDelete,
  onScheduleUnscheduledDays
}: DaypartRoutineFormProps) {
  const [daypartTypes, setDaypartTypes] = useState<DaypartDefinition[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const scheduleType = editingRoutine?.schedule_type || preFillScheduleType || 'regular' as 'regular' | 'event_holiday';
  const eventName = editingRoutine?.event_name || '';
  const editingIsDisabled = editingRoutine ? editingRoutine.runs_on_days === false : false;
  const initialFormData = {
    schedule_type: scheduleType,
    daypart_name: editingRoutine?.daypart_name || preFillDaypart || '',
    days_of_week: editingRoutine?.days_of_week || preFillDaysOfWeek || [] as number[],
    start_time: editingRoutine?.start_time || preFillStartTime || '06:00',
    end_time: editingRoutine?.end_time || preFillEndTime || '11:00',
    runs_on_days: !editingIsDisabled,
    event_name: eventName,
    event_date: editingRoutine?.event_date || '',
    recurrence_type: editingRoutine?.recurrence_type || 'none' as 'none' | 'annual_date' | 'monthly_date' | 'annual_relative' | 'annual_date_range',
    recurrence_config: editingRoutine?.recurrence_config || {},
    schedule_name: scheduleType === 'event_holiday' ? eventName : (editingRoutine?.schedule_name || '')
  };
  const [formData, setFormData] = useState(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = () => {
    return JSON.stringify(formData) !== JSON.stringify(initialFormData);
  };

  useEffect(() => {
    loadDaypartTypes();
  }, []);

  const loadDaypartTypes = async () => {
    const { data, error } = await supabase
      .from('daypart_definitions')
      .select('daypart_name, display_label')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Error loading daypart types:', error);
    } else {
      setDaypartTypes(data || []);
    }
  };

  const checkCollision = (daypartName: string, selectedDays: number[]): string | null => {
    if (formData.schedule_type === 'event_holiday') {
      return null;
    }

    if (!daypartName || selectedDays.length === 0) {
      return null;
    }

    const conflictingRoutines = existingRoutines.filter(routine => {
      if (editingRoutine && routine.id === editingRoutine.id) return false;
      if (routine.daypart_name !== daypartName) return false;
      if (routine.schedule_type === 'event_holiday') return false;
      return routine.days_of_week.some(day => selectedDays.includes(day));
    });

    if (conflictingRoutines.length > 0) {
      const conflictingDays = conflictingRoutines
        .flatMap(r => r.days_of_week)
        .filter(day => selectedDays.includes(day))
        .filter((day, index, self) => self.indexOf(day) === index)
        .map(day => DAYS_OF_WEEK.find(d => d.value === day)?.label)
        .join(', ');
      return `This daypart already has routines on: ${conflictingDays}`;
    }
    return null;
  };

  const toggleDay = (day: number) => {
    const newDays = formData.days_of_week.includes(day)
      ? formData.days_of_week.filter(d => d !== day)
      : [...formData.days_of_week, day].sort();

    setFormData({ ...formData, days_of_week: newDays });

    const collision = checkCollision(formData.daypart_name, newDays);
    setError(collision);
  };

  const selectAllDays = () => {
    const allDays = [0, 1, 2, 3, 4, 5, 6];
    setFormData({ ...formData, days_of_week: allDays });
    const collision = checkCollision(formData.daypart_name, allDays);
    setError(collision);
  };

  const clearAllDays = () => {
    setFormData({ ...formData, days_of_week: [] });
    setError(null);
  };

  const handleDaypartChange = (daypartName: string) => {
    setFormData({ ...formData, daypart_name: daypartName });

    const collision = checkCollision(daypartName, formData.days_of_week);
    setError(collision);
  };

  const getDayCollisionStatus = (day: number): boolean => {
    if (!formData.daypart_name || formData.days_of_week.includes(day)) return false;
    if (formData.schedule_type === 'event_holiday') return false;
    return existingRoutines.some(routine => {
      if (editingRoutine && routine.id === editingRoutine.id) return false;
      if (routine.schedule_type === 'event_holiday') return false;
      return routine.daypart_name === formData.daypart_name && routine.days_of_week.includes(day);
    });
  };

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const calculatePriorityLevel = (): number => {
    if (formData.schedule_type === 'regular') return 10;
    return getPriorityLevel(formData.recurrence_type);
  };

  const handleSubmit = async () => {
    if (!formData.daypart_name) {
      setError('Please select a daypart type');
      return;
    }

    if (formData.schedule_type === 'event_holiday') {
      if (!formData.event_name?.trim()) {
        setError('Please enter an event name');
        return;
      }
    }

    if (formData.schedule_type === 'regular' && formData.days_of_week.length === 0) {
      setError('Please select at least one day');
      return;
    }

    if (formData.schedule_type === 'regular') {
      const collision = checkCollision(formData.daypart_name, formData.days_of_week);
      if (collision) {
        setError(collision);
        return;
      }
    }

    if (formData.runs_on_days && formData.start_time === formData.end_time) {
      setError('Start time and end time must be different');
      return;
    }

    await completeSave();
  };

  const completeSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const priority_level = calculatePriorityLevel();
      const saveData = {
        placement_group_id: placementGroupId,
        ...formData,
        runs_on_days: formData.runs_on_days,
        start_time: formData.runs_on_days ? formData.start_time : null,
        end_time: formData.runs_on_days ? formData.end_time : null,
        event_date: formData.event_date || undefined,
        priority_level,
        recurrence_config: Object.keys(formData.recurrence_config).length > 0 ? formData.recurrence_config : undefined
      };

      // For event/holiday schedules, ensure schedule_name is set to event_name
      if (formData.schedule_type === 'event_holiday') {
        saveData.schedule_name = formData.event_name;
      }

      await onSave(saveData);
    } catch (err: any) {
      setError(err.message || 'Failed to save daypart routine');
      setSaving(false);
    }
  };

  const handleTemplateApply = (templates: any[]) => {
    if (templates.length > 0) {
      const template = templates[0];
      const updates: any = {
        ...formData,
        event_name: template.name,
        schedule_name: template.name,
        recurrence_type: template.recurrence_type || 'none',
        recurrence_config: template.recurrence_config || {}
      };

      if (template.is_closed) {
        updates.start_time = '00:00';
        updates.end_time = '23:59';
      } else if (template.suggested_hours) {
        updates.start_time = template.suggested_hours.start_time;
        updates.end_time = template.suggested_hours.end_time;
      }

      setFormData(updates);
    }
    setShowTemplatePicker(false);
  };

  const handleDelete = async () => {
    if (!editingRoutine?.id || !onDelete) return;

    if (!confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
      return;
    }

    try {
      await onDelete(editingRoutine.id);
    } catch (err: any) {
      alert(`Failed to delete schedule: ${err.message}`);
    }
  };

  const selectedDaypartLabel = daypartDefinition?.display_label || daypartTypes.find(d => d.daypart_name === formData.daypart_name)?.display_label || formData.daypart_name;
  const daypartColor = daypartDefinition?.color || 'bg-slate-100';

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header with Edit Schedule title and Cancel/Save Buttons */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
        <h3 className="font-semibold text-slate-900">
          Edit Schedule
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-slate-600 hover:text-slate-700 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-1.5 rounded-lg font-medium text-sm transition-all bg-blue-600 text-white hover:bg-blue-700"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {formData.schedule_type === 'event_holiday' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Event schedules override all regular schedules</p>
              <p className="text-blue-700">No collision checking needed for events and holidays</p>
            </div>
          </div>
        )}

        {error && formData.schedule_type === 'regular' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {formData.schedule_type === 'regular' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Schedule Name
            </label>
            <input
              type="text"
              value={formData.schedule_name || ''}
              onChange={(e) => setFormData({ ...formData, schedule_name: e.target.value })}
              placeholder="Optional name for this schedule"
              className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {formData.schedule_type === 'event_holiday' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowTemplatePicker(true)}
              className="w-full px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-medium text-sm flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Quick Add from Holiday Template
            </button>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Event Name *
              </label>
              <input
                type="text"
                value={formData.event_name}
                onChange={(e) => setFormData({ ...formData, event_name: e.target.value, schedule_name: e.target.value })}
                placeholder="e.g., Christmas Day, Holiday Season"
                className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Recurrence Type
              </label>
              <select
                value={formData.recurrence_type}
                onChange={(e) => setFormData({ ...formData, recurrence_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="none">One-time Date</option>
                <option value="annual_date">Annual (same date)</option>
                <option value="monthly_date">Monthly (same day)</option>
                <option value="annual_relative">Annual (relative day)</option>
                <option value="annual_date_range">Annual Date Range</option>
              </select>
            </div>

            {formData.recurrence_type === 'none' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Event Date
                </label>
                <input
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}

            {formData.recurrence_type === 'annual_date' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Month
                  </label>
                  <select
                    value={formData.recurrence_config.month || ''}
                    onChange={(e) => setFormData({ ...formData, recurrence_config: { ...formData.recurrence_config, month: parseInt(e.target.value) } })}
                    className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select month</option>
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={idx} value={idx + 1}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Day
                  </label>
                  <select
                    value={formData.recurrence_config.day_of_month || ''}
                    onChange={(e) => setFormData({ ...formData, recurrence_config: { ...formData.recurrence_config, day_of_month: parseInt(e.target.value) } })}
                    className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select day</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {formData.recurrence_type === 'monthly_date' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Day of Month
                </label>
                <select
                  value={formData.recurrence_config.day_of_month || ''}
                  onChange={(e) => setFormData({ ...formData, recurrence_config: { ...formData.recurrence_config, day_of_month: parseInt(e.target.value) } })}
                  className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Select day</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
            )}

            {formData.recurrence_type === 'annual_relative' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Position
                  </label>
                  <select
                    value={formData.recurrence_config.position || ''}
                    onChange={(e) => setFormData({ ...formData, recurrence_config: { ...formData.recurrence_config, position: e.target.value } })}
                    className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select</option>
                    <option value="first">First</option>
                    <option value="second">Second</option>
                    <option value="third">Third</option>
                    <option value="fourth">Fourth</option>
                    <option value="last">Last</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Weekday
                  </label>
                  <select
                    value={formData.recurrence_config.weekday !== undefined ? formData.recurrence_config.weekday : ''}
                    onChange={(e) => setFormData({ ...formData, recurrence_config: { ...formData.recurrence_config, weekday: parseInt(e.target.value) } })}
                    className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select</option>
                    {DAY_NAMES.map((name, idx) => (
                      <option key={idx} value={idx}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Month
                  </label>
                  <select
                    value={formData.recurrence_config.month || ''}
                    onChange={(e) => setFormData({ ...formData, recurrence_config: { ...formData.recurrence_config, month: parseInt(e.target.value) } })}
                    className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select</option>
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={idx} value={idx + 1}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {formData.recurrence_type === 'annual_date_range' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.recurrence_config.range_start_date || ''}
                    onChange={(e) => setFormData({ ...formData, recurrence_config: { ...formData.recurrence_config, range_start_date: e.target.value } })}
                    className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.recurrence_config.range_end_date || ''}
                    onChange={(e) => setFormData({ ...formData, recurrence_config: { ...formData.recurrence_config, range_end_date: e.target.value } })}
                    className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

            {formData.recurrence_type && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-amber-900">
                    {formatRecurrenceText(formData.recurrence_type, formData.recurrence_config, formData.event_date)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
              <span className="font-medium">
                {getPriorityLevel(formData.recurrence_type) === 100 ? 'Applies to a single occurrence' : 'Applies across a date range'}
              </span>
            </div>

            {/* Schedule Mode Toggle — event/holiday schedules */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Schedule Mode</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, runs_on_days: true })}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    formData.runs_on_days
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Set Custom Times
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, runs_on_days: false })}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    !formData.runs_on_days
                      ? 'bg-slate-700 border-slate-700 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Ban className="w-4 h-4" />
                  Disable / Closed
                </button>
              </div>
              {!formData.runs_on_days && (
                <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400" />
                  This daypart will be closed on this event — no content will be shown
                </p>
              )}
            </div>
          </div>
        )}

        {formData.schedule_type === 'regular' && (
          <DaySelector
            selectedDays={formData.days_of_week}
            onToggleDay={toggleDay}
            schedules={existingRoutines}
            currentDaypartName={formData.daypart_name}
            editingScheduleId={editingRoutine?.id}
            showPresets={false}
          />
        )}

        {/* Schedule Mode Toggle — regular schedules */}
        {formData.schedule_type === 'regular' && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Schedule Mode</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, runs_on_days: true })}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  formData.runs_on_days
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-4 h-4" />
                Set Custom Times
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, runs_on_days: false })}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  !formData.runs_on_days
                    ? 'bg-slate-700 border-slate-700 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Ban className="w-4 h-4" />
                Disable / Closed
              </button>
            </div>
            {!formData.runs_on_days && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400" />
                This daypart will be marked as closed on these days
              </p>
            )}
          </div>
        )}

        {formData.runs_on_days && (
        <div className="grid grid-cols-2 gap-4">
          <TimeSelector
            label="Start Time *"
            value={formData.start_time || '06:00'}
            onChange={(time) => setFormData({ ...formData, start_time: time })}
          />
          <TimeSelector
            label="End Time *"
            value={formData.end_time || '11:00'}
            onChange={(time) => setFormData({ ...formData, end_time: time })}
          />
        </div>
        )}

      </div>

      {/* Footer with Delete Button */}
      {editingRoutine && onDelete && (
        <div className="border-t border-slate-200 px-4 py-3 bg-slate-50">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleDelete}
              className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors font-medium flex items-center gap-2 px-3 py-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Delete Schedule
            </button>
          </div>
        </div>
      )}

      {showTemplatePicker && (
        <HolidayTemplatePicker
          onSelect={handleTemplateApply}
          onClose={() => setShowTemplatePicker(false)}
          allowMultiple={false}
        />
      )}

    </div>
  );
}
