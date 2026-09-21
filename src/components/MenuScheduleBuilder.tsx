import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Repeat, MapPin, Info } from 'lucide-react';
import { formatScheduleDescription, getNextOccurrences } from '../lib/menuScheduleService';
import type { CreateScheduleForm } from '../types/menuScheduling';

interface MenuScheduleBuilderProps {
  menuId: string;
  menuName: string;
  existingSchedule?: any;
  placements: Array<{ id: string; name: string }>;
  dayparts: Array<{ id: string; daypart_name: string; display_label: string; color: string }>;
  onSave: (schedule: CreateScheduleForm) => void;
  onClose: () => void;
}

const DAYS_OF_WEEK = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' },
  { key: 'sun', label: 'S' },
];

const PATTERN_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'every_n_weeks', label: 'Every N Weeks' },
  { value: 'nth_weekday', label: 'Nth Weekday' },
];

const WEEK_OF_MONTH_OPTIONS = [
  { value: 1, label: '1st' },
  { value: 2, label: '2nd' },
  { value: 3, label: '3rd' },
  { value: 4, label: '4th' },
  { value: 5, label: '5th' },
];

export default function MenuScheduleBuilder({
  menuId,
  menuName,
  existingSchedule,
  placements,
  dayparts,
  onSave,
  onClose,
}: MenuScheduleBuilderProps) {
  const [scheduleType, setScheduleType] = useState<'one-time' | 'recurring'>('one-time');
  const [pattern, setPattern] = useState('weekly');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [interval, setInterval] = useState(2);
  const [weekOfMonth, setWeekOfMonth] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState(100);
  const [placementId, setPlacementId] = useState('');
  const [daypartId, setDaypartId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');

  // Pre-fill form when editing an existing schedule
  useEffect(() => {
    if (!existingSchedule) return;

    setScheduleType(existingSchedule.schedule_type === 'one-time' ? 'one-time' : 'recurring');
    setPattern(existingSchedule.pattern || 'weekly');
    setSelectedDays(existingSchedule.days_of_week || []);
    setInterval(existingSchedule.interval || 2);
    setWeekOfMonth(existingSchedule.week_of_month || 1);
    setStartDate(existingSchedule.start_date || '');
    setEndDate(existingSchedule.end_date || '');
    setPriority(existingSchedule.priority ?? (existingSchedule.schedule_type === 'one-time' ? 100 : 10));
    setPlacementId(existingSchedule.placement_id || '');
    setDaypartId(existingSchedule.daypart_id || '');
    setStartTime(existingSchedule.start_time || '');
    setEndTime(existingSchedule.end_time || '');
    setNotes(existingSchedule.notes || '');
  }, [existingSchedule]);

  // Reset priority default when switching schedule type
  useEffect(() => {
    if (!existingSchedule) {
      setPriority(scheduleType === 'one-time' ? 100 : 10);
    }
  }, [scheduleType, existingSchedule]);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const showDayPicker =
    scheduleType === 'recurring' &&
    ['weekly', 'biweekly', 'every_n_weeks'].includes(pattern);

  const showIntervalInput =
    scheduleType === 'recurring' && pattern === 'every_n_weeks';

  const showWeekOfMonth =
    scheduleType === 'recurring' && pattern === 'nth_weekday';

  const buildFormData = (): CreateScheduleForm => ({
    menu_id: menuId,
    schedule_type: scheduleType,
    pattern: scheduleType === 'recurring' ? pattern : undefined,
    days_of_week: showDayPicker ? selectedDays : undefined,
    interval: showIntervalInput ? interval : undefined,
    week_of_month: showWeekOfMonth ? weekOfMonth : undefined,
    start_date: startDate || undefined,
    end_date: scheduleType === 'recurring' && endDate ? endDate : undefined,
    priority,
    placement_id: placementId || undefined,
    daypart_id: daypartId || undefined,
    start_time: daypartId && startTime ? startTime : undefined,
    end_time: daypartId && endTime ? endTime : undefined,
    notes: notes.trim() || undefined,
  });

  const formData = buildFormData();

  let previewDescription = '';
  let nextOccurrences: string[] = [];
  try {
    previewDescription = formatScheduleDescription(formData);
    nextOccurrences = getNextOccurrences(formData, 3);
  } catch {
    previewDescription = 'Complete the form to see a preview';
  }

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 rounded-t-xl">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              Schedule {menuName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Schedule Type Toggle */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Schedule Type
            </label>
            <div className="inline-flex rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setScheduleType('one-time')}
                className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  scheduleType === 'one-time'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Calendar className="h-4 w-4" />
                One-time
              </button>
              <button
                type="button"
                onClick={() => setScheduleType('recurring')}
                className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  scheduleType === 'recurring'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Repeat className="h-4 w-4" />
                Recurring
              </button>
            </div>
          </div>

          {/* One-time fields */}
          {scheduleType === 'one-time' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Priority: {priority}
                </label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="mt-1 flex justify-between text-xs text-slate-400">
                  <span>1 (Low)</span>
                  <span>100 (High)</span>
                </div>
              </div>
            </div>
          )}

          {/* Recurring fields */}
          {scheduleType === 'recurring' && (
            <div className="space-y-4">
              {/* Pattern Selector */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Pattern
                </label>
                <select
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {PATTERN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Day-of-week Pills */}
              {showDayPicker && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Days of Week
                  </label>
                  <div className="flex gap-1.5">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleDay(day.key)}
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                          selectedDays.includes(day.key)
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Interval Input */}
              {showIntervalInput && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Repeat every N weeks
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={52}
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value))}
                    className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Week of Month */}
              {showWeekOfMonth && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Week of Month
                  </label>
                  <select
                    value={weekOfMonth}
                    onChange={(e) => setWeekOfMonth(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {WEEK_OF_MONTH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    End Date
                    <span className="ml-1 text-xs text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Priority
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Higher priority schedules take precedence on overlapping dates
                </p>
              </div>
            </div>
          )}

          {/* Divider */}
          <hr className="border-slate-200" />

          {/* Station Targeting */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <MapPin className="h-4 w-4 text-slate-400" />
              Station Targeting
            </label>
            <select
              value={placementId}
              onChange={(e) => setPlacementId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Location-wide</option>
              {placements.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Daypart */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Clock className="h-4 w-4 text-slate-400" />
              Daypart
            </label>
            <select
              value={daypartId}
              onChange={(e) => setDaypartId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Day</option>
              {dayparts.map((dp) => (
                <option key={dp.id} value={dp.id}>
                  {dp.display_label || dp.daypart_name}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Time Override */}
          {daypartId && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Custom Time Override
                <span className="ml-1 text-xs text-slate-400">(optional)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes about this schedule..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Live Preview */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-blue-800">
              <Info className="h-4 w-4" />
              Schedule Preview
            </div>
            <p className="text-sm text-blue-700">{previewDescription}</p>
            {nextOccurrences.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-blue-600 uppercase tracking-wide">
                  Next Occurrences
                </p>
                <ul className="space-y-0.5">
                  {nextOccurrences.map((date, idx) => (
                    <li key={idx} className="flex items-center gap-1.5 text-sm text-blue-700">
                      <Calendar className="h-3.5 w-3.5 text-blue-400" />
                      {date}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition-colors"
          >
            Save Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
