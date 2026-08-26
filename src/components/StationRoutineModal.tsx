import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Calendar, MapPin, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import TimeSelector from './TimeSelector';

interface StationRoutine {
  id?: string;
  theme_id: string;
  placement_id: string;
  cycle_week: number;
  days_of_week: number[];
  start_time: string;
  end_time?: string;
  schedule_name?: string;
  status: 'active' | 'inactive' | 'paused';
  priority?: number;
  station?: {
    id: string;
    name: string;
  };
}

interface StationGroup {
  id: string;
  name: string;
  description: string | null;
}

interface StationRoutineModalProps {
  themeId: string;
  themeName: string;
  onClose: () => void;
  onSave: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

export default function StationRoutineModal({ themeId, themeName, onClose, onSave }: StationRoutineModalProps) {
  const [routines, setRoutines] = useState<StationRoutine[]>([]);
  const [stations, setStations] = useState<StationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [cycleSettings, setCycleSettings] = useState<{ cycle_duration_weeks: number } | null>(null);
  const [originalDays, setOriginalDays] = useState<number[]>([]);
  const [originalRoutine, setOriginalRoutine] = useState<typeof newRoutine | null>(null);
  const [showRemovedDaysPrompt, setShowRemovedDaysPrompt] = useState(false);
  const [removedDaysData, setRemovedDaysData] = useState<{ stationId: string; days: number[]; templateRoutine: any } | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  const [newRoutine, setNewRoutine] = useState({
    placement_id: '',
    cycle_week: 1,
    days_of_week: [] as number[],
    start_time: '06:00',
    end_time: '',
    schedule_name: '',
    status: 'active' as const
  });

  useEffect(() => {
    loadData();
  }, [themeId]);

  useEffect(() => {
    console.log('🔍 STATE MONITOR - showAddForm changed to:', showAddForm);
    console.trace('showAddForm change stack trace');
  }, [showAddForm]);

  useEffect(() => {
    console.log('🔍 STATE MONITOR - editingRoutineId changed to:', editingRoutineId);
    console.trace('editingRoutineId change stack trace');
  }, [editingRoutineId]);

  useEffect(() => {
    console.log('State changed - showAddForm:', showAddForm, 'editingRoutineId:', editingRoutineId);
    if (showAddForm && formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [showAddForm, editingRoutineId]);

  const loadData = async () => {
    console.log('loadData called');
    setLoading(true);

    const [routinesResult, stationsResult, settingsResult] = await Promise.all([
      supabase
        .from('placement_routines')
        .select('*, placement_groups(id, name)')
        .eq('theme_id', themeId)
        .order('priority', { ascending: false }),
      supabase
        .from('placement_groups')
        .select('id, name, description')
        .order('name'),
      supabase
        .from('organization_cycle_settings')
        .select('cycle_duration_weeks')
        .limit(1)
        .maybeSingle()
    ]);

    if (routinesResult.error) {
      console.error('Error loading routines:', routinesResult.error);
    } else {
      const transformedRoutines = routinesResult.data?.map((r: any) => ({
        ...r,
        station: r.placement_groups
      })) || [];
      setRoutines(transformedRoutines);
    }

    if (stationsResult.error) {
      console.error('Error loading stations:', stationsResult.error);
    } else {
      setStations(stationsResult.data || []);
    }

    if (settingsResult.error) {
      console.error('Error loading cycle settings:', settingsResult.error);
    } else {
      setCycleSettings(settingsResult.data);
    }

    setLoading(false);
  };

  const handleStartEdit = (routine: StationRoutine, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const routineData = {
      placement_id: routine.placement_id,
      cycle_week: routine.cycle_week,
      days_of_week: [...routine.days_of_week],
      start_time: routine.start_time,
      end_time: routine.end_time || '',
      schedule_name: routine.schedule_name || '',
      status: routine.status
    };

    setShowAddForm(true);
    setEditingRoutineId(routine.id!);
    setOriginalDays([...routine.days_of_week]);
    setOriginalRoutine(routineData);
    setNewRoutine(routineData);
  };

  const handleCancelEdit = () => {
    setEditingRoutineId(null);
    setShowAddForm(false);
    setOriginalDays([]);
    setOriginalRoutine(null);
    setNewRoutine({
      placement_id: '',
      cycle_week: 1,
      days_of_week: [],
      start_time: '06:00',
      end_time: '',
      schedule_name: '',
      status: 'active'
    });
  };

  const hasChanges = () => {
    if (!editingRoutineId || !originalRoutine) return true;

    return (
      newRoutine.placement_id !== originalRoutine.placement_id ||
      newRoutine.cycle_week !== originalRoutine.cycle_week ||
      newRoutine.start_time !== originalRoutine.start_time ||
      newRoutine.end_time !== originalRoutine.end_time ||
      newRoutine.schedule_name !== originalRoutine.schedule_name ||
      newRoutine.status !== originalRoutine.status ||
      JSON.stringify(newRoutine.days_of_week.sort()) !== JSON.stringify(originalRoutine.days_of_week.sort())
    );
  };

  const handleSaveRoutine = async () => {
    if (!newRoutine.placement_id) {
      alert('Please select a station');
      return;
    }

    if (newRoutine.days_of_week.length === 0) {
      alert('Please select at least one day');
      return;
    }

    setSaving(true);

    try {
      if (editingRoutineId) {
        const { error } = await supabase
          .from('placement_routines')
          .update({
            placement_id: newRoutine.placement_id,
            cycle_week: newRoutine.cycle_week,
            days_of_week: newRoutine.days_of_week,
            start_time: newRoutine.start_time,
            end_time: newRoutine.end_time || null,
            schedule_name: newRoutine.schedule_name || null,
            status: newRoutine.status
          })
          .eq('id', editingRoutineId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('placement_routines')
          .insert({
            theme_id: themeId,
            placement_id: newRoutine.placement_id,
            cycle_week: newRoutine.cycle_week,
            days_of_week: newRoutine.days_of_week,
            start_time: newRoutine.start_time,
            end_time: newRoutine.end_time || null,
            schedule_name: newRoutine.schedule_name || null,
            status: newRoutine.status
          });

        if (error) throw error;
      }

      const wasEditing = editingRoutineId !== null;
      const stationId = newRoutine.placement_id;
      const currentRoutine = { ...newRoutine };

      setNewRoutine({
        placement_id: '',
        cycle_week: 1,
        days_of_week: [],
        start_time: '06:00',
        end_time: '',
        schedule_name: '',
        status: 'active'
      });
      setEditingRoutineId(null);
      setOriginalRoutine(null);
      setShowAddForm(false);
      await loadData();

      if (wasEditing && originalDays.length > 0) {
        const removedDays = originalDays.filter(d => !currentRoutine.days_of_week.includes(d));

        if (removedDays.length > 0) {
          const { data: allRoutinesForStation, error: routinesError } = await supabase
            .from('placement_routines')
            .select('days_of_week')
            .eq('theme_id', themeId)
            .eq('placement_id', stationId);

          if (!routinesError && allRoutinesForStation) {
            const coveredDays = new Set<number>();
            allRoutinesForStation.forEach(routine => {
              routine.days_of_week.forEach((day: number) => coveredDays.add(day));
            });

            const uncoveredDays = removedDays.filter(d => !coveredDays.has(d));

            if (uncoveredDays.length > 0) {
              setRemovedDaysData({
                stationId,
                days: uncoveredDays,
                templateRoutine: currentRoutine
              });
              setShowRemovedDaysPrompt(true);
            }
          }
        }
      }

      setOriginalDays([]);
    } catch (error: any) {
      console.error('Error saving routine:', error);
      alert(`Failed to save routine: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setNewRoutine(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort()
    }));
  };

  const selectAllDays = () => {
    setNewRoutine(prev => ({
      ...prev,
      days_of_week: [0, 1, 2, 3, 4, 5, 6]
    }));
  };

  const clearAllDays = () => {
    setNewRoutine(prev => ({
      ...prev,
      days_of_week: []
    }));
  };

  const handleDeleteRoutine = async (routineId: string) => {
    if (!confirm('Are you sure you want to delete this routine?')) {
      return;
    }

    const { error } = await supabase
      .from('placement_routines')
      .delete()
      .eq('id', routineId);

    if (error) {
      console.error('Error deleting routine:', error);
      alert(`Failed to delete routine: ${error.message}`);
    } else {
      await loadData();
    }
  };

  const handleToggleStatus = async (routine: StationRoutine) => {
    const newStatus = routine.status === 'active' ? 'paused' : 'active';

    const { error } = await supabase
      .from('placement_routines')
      .update({ status: newStatus })
      .eq('id', routine.id!);

    if (error) {
      console.error('Error updating routine status:', error);
      alert(`Failed to update routine: ${error.message}`);
    } else {
      await loadData();
    }
  };

  const maxCycleWeek = cycleSettings?.cycle_duration_weeks || 4;

  // Group routines by station
  const groupedRoutines = routines.reduce((acc, routine) => {
    const stationId = routine.station_id;
    if (!acc[stationId]) {
      acc[stationId] = [];
    }
    acc[stationId].push(routine);
    return acc;
  }, {} as Record<string, StationRoutine[]>);

  // Get unscheduled days for a specific station
  const getUnscheduledDays = (stationRoutines: StationRoutine[]): number[] => {
    const scheduledDays = new Set<number>();
    stationRoutines.forEach(routine => {
      routine.days_of_week.forEach(day => scheduledDays.add(day));
    });

    const allDays = [0, 1, 2, 3, 4, 5, 6];
    return allDays.filter(day => !scheduledDays.has(day));
  };

  // Get day coverage count for a station
  const getDayCoverage = (stationRoutines: StationRoutine[]): { scheduled: number; total: number } => {
    const scheduledDays = new Set<number>();
    stationRoutines.forEach(routine => {
      routine.days_of_week.forEach(day => scheduledDays.add(day));
    });

    return {
      scheduled: scheduledDays.size,
      total: 7
    };
  };

  const handleAddRemainingDays = (stationId: string, unscheduledDays: number[]) => {
    const templateRoutine = groupedRoutines[stationId][0];
    setNewRoutine({
      placement_id: stationId,
      cycle_week: templateRoutine.cycle_week,
      days_of_week: unscheduledDays,
      start_time: templateRoutine.start_time,
      end_time: templateRoutine.end_time || '',
      schedule_name: templateRoutine.schedule_name || '',
      status: 'active'
    });
    setShowAddForm(true);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        console.log('Backdrop clicked - DISABLED TEMPORARILY');
        // Temporarily disabled to debug
        // alert('You clicked the backdrop!');
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => {
          console.log('Modal content clicked, stopping propagation');
          e.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Station Routines</h2>
            <p className="text-sm text-slate-600 mt-1">Schedule when "{themeName}" runs on stations</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6">
          {!cycleSettings && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> Organization cycle settings haven't been configured yet.
                Please configure them in Site Configuration to see accurate cycle week options.
              </p>
            </div>
          )}

          {routines.length === 0 && !showAddForm ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No routines configured</h3>
              <p className="text-slate-600 mb-6">
                Add station routines to schedule when this theme should be active
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
              >
                <Plus className="w-5 h-5" />
                Add Routine
              </button>
            </div>
          ) : (
            <>
              {!showAddForm && !editingRoutineId && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Add Routine
                  </button>
                </div>
              )}

              {showAddForm && !editingRoutineId && (
                <div ref={formRef} className="mb-6 bg-blue-50 rounded-lg border-2 border-blue-500 shadow-lg">
                  {/* Header with Save button */}
                  <div className="p-4 flex items-center justify-end border-b border-slate-200">
                    <button
                      type="button"
                      onClick={handleSaveRoutine}
                      disabled={saving || !newRoutine.placement_id || newRoutine.days_of_week.length === 0}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                        saving || !newRoutine.placement_id || newRoutine.days_of_week.length === 0
                          ? 'bg-blue-300 text-white cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>

                  <div className="divide-y divide-slate-200">
                    <div className="p-4">
                      <label className="text-sm font-medium text-slate-700 mb-2 block">
                        Schedule Name (optional)
                      </label>
                      <input
                        type="text"
                        value={newRoutine.schedule_name}
                        onChange={(e) => setNewRoutine({ ...newRoutine, schedule_name: e.target.value })}
                        placeholder="e.g., Weekend Breakfast, Summer Hours"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-900"
                      />
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-700">
                          Station
                        </label>
                        <span className="text-xs text-slate-500">Required</span>
                      </div>
                      <select
                        value={newRoutine.placement_id}
                        onChange={(e) => setNewRoutine({ ...newRoutine, placement_id: e.target.value })}
                        className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-900"
                      >
                        <option value="">Select a station...</option>
                        {stations.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.description && ` - ${p.description}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="p-4">
                      <div className="text-sm font-medium text-slate-700 mb-2">Schedule Time</div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Cycle Week</label>
                          <input
                            type="number"
                            min="1"
                            max={maxCycleWeek}
                            value={newRoutine.cycle_week}
                            onChange={(e) => setNewRoutine({ ...newRoutine, cycle_week: parseInt(e.target.value) || 1 })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <p className="text-xs text-slate-500 mt-1">Week 1-{maxCycleWeek}</p>
                        </div>
                        <div>
                          <TimeSelector
                            label="Start Time"
                            value={newRoutine.start_time}
                            onChange={(time) => setNewRoutine({ ...newRoutine, start_time: time })}
                          />
                        </div>
                        <div>
                          <TimeSelector
                            label="End Time (optional)"
                            value={newRoutine.end_time}
                            onChange={(time) => setNewRoutine({ ...newRoutine, end_time: time })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-slate-700">Days Of The Week</label>
                        <button
                          type="button"
                          onClick={newRoutine.days_of_week.length === 7 ? clearAllDays : selectAllDays}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {newRoutine.days_of_week.length === 7 ? 'Clear All' : 'Select All'}
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 mb-3">Enabled On</div>
                      <div className="flex justify-between gap-3">
                        {DAYS_OF_WEEK.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleDay(day.value)}
                            className={`w-12 h-12 rounded-full text-sm font-medium transition-all ${
                              newRoutine.days_of_week.includes(day.value)
                                ? 'bg-slate-800 text-white shadow-md'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {day.label.charAt(0)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {routines.length > 0 && (
                <div className="space-y-6">
                  {Object.entries(groupedRoutines).map(([stationId, stationRoutines]) => {
                    const firstRoutine = stationRoutines[0];
                    const unscheduledDays = getUnscheduledDays(stationRoutines);
                    const coverage = getDayCoverage(stationRoutines);
                    const hasUnscheduledDays = unscheduledDays.length > 0;

                    return (
                      <div key={stationId} className="space-y-2">
                        {/* Station Header */}
                        <div className="px-2">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <h3 className="text-sm font-semibold text-slate-900">
                              {firstRoutine.station?.name || 'Unknown Station'}
                            </h3>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                                {coverage.scheduled} active
                              </span>
                              {coverage.scheduled < coverage.total && (
                                <span className="px-2 py-0.5 rounded-full font-medium bg-slate-200 text-slate-600">
                                  {coverage.total - coverage.scheduled} inactive
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Routine Cards */}
                        <div className="space-y-2">
                          {stationRoutines.map((routine) => (
                            <div key={routine.id}>
                              {editingRoutineId === routine.id && showAddForm ? (
                              <div className="bg-blue-50 rounded-lg border-2 border-blue-500 shadow-lg">
                                {/* Header with Save button */}
                                <div className="p-4 flex items-center justify-end border-b border-slate-200">
                                  <button
                                    type="button"
                                    onClick={handleSaveRoutine}
                                    disabled={saving || !newRoutine.placement_id || newRoutine.days_of_week.length === 0 || !hasChanges()}
                                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                                      saving || !newRoutine.placement_id || newRoutine.days_of_week.length === 0 || !hasChanges()
                                        ? 'bg-blue-300 text-white cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                                  >
                                    {saving ? 'Saving...' : 'Save'}
                                  </button>
                                </div>

                                <div className="divide-y divide-slate-200">
                                  <div className="p-4">
                                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                                      Schedule Name (optional)
                                    </label>
                                    <input
                                      type="text"
                                      value={newRoutine.schedule_name}
                                      onChange={(e) => setNewRoutine({ ...newRoutine, schedule_name: e.target.value })}
                                      placeholder="e.g., Weekend Breakfast, Summer Hours"
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-900"
                                    />
                                  </div>

                                  <div className="p-4">
                                    <div className="flex items-center justify-between">
                                      <label className="text-sm font-medium text-slate-700">
                                        Station
                                      </label>
                                      <span className="text-xs text-slate-500">Required</span>
                                    </div>
                                    <select
                                      value={newRoutine.placement_id}
                                      onChange={(e) => setNewRoutine({ ...newRoutine, placement_id: e.target.value })}
                                      className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-900"
                                    >
                                      <option value="">Select a station...</option>
                                      {stations.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.name}
                                          {p.description && ` - ${p.description}`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="p-4">
                                    <div className="text-sm font-medium text-slate-700 mb-2">Schedule Time</div>
                                    <div className="grid grid-cols-3 gap-4">
                                      <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Cycle Week</label>
                                        <input
                                          type="number"
                                          min="1"
                                          max={maxCycleWeek}
                                          value={newRoutine.cycle_week}
                                          onChange={(e) => setNewRoutine({ ...newRoutine, cycle_week: parseInt(e.target.value) || 1 })}
                                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Week 1-{maxCycleWeek}</p>
                                      </div>
                                      <div>
                                        <TimeSelector
                                          label="Start Time"
                                          value={newRoutine.start_time}
                                          onChange={(time) => setNewRoutine({ ...newRoutine, start_time: time })}
                                        />
                                      </div>
                                      <div>
                                        <TimeSelector
                                          label="End Time (optional)"
                                          value={newRoutine.end_time}
                                          onChange={(time) => setNewRoutine({ ...newRoutine, end_time: time })}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <label className="text-sm font-medium text-slate-700">Days Of The Week</label>
                                      <button
                                        type="button"
                                        onClick={newRoutine.days_of_week.length === 7 ? clearAllDays : selectAllDays}
                                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                      >
                                        {newRoutine.days_of_week.length === 7 ? 'Clear All' : 'Select All'}
                                      </button>
                                    </div>
                                    <div className="text-xs text-slate-500 mb-3">Enabled On</div>
                                    <div className="flex justify-between gap-3">
                                      {DAYS_OF_WEEK.map((day) => (
                                        <button
                                          key={day.value}
                                          type="button"
                                          onClick={() => toggleDay(day.value)}
                                          className={`w-12 h-12 rounded-full text-sm font-medium transition-all ${
                                            newRoutine.days_of_week.includes(day.value)
                                              ? 'bg-slate-800 text-white shadow-md'
                                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                          }`}
                                        >
                                          {day.label.charAt(0)}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Delete button centered at bottom */}
                                  <div className="p-4 bg-white border-t border-slate-200 flex justify-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRoutine(routine.id!)}
                                      className="px-6 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (editingRoutineId === routine.id) {
                                      handleCancelEdit();
                                    } else {
                                      handleStartEdit(routine, e);
                                    }
                                  }}
                                  disabled={showAddForm && editingRoutineId !== routine.id}
                                  className={`w-full p-4 rounded-lg border transition-all text-left group ${
                                    routine.status === 'active'
                                      ? 'bg-white border-slate-200 hover:bg-slate-50 hover:shadow-md shadow-sm'
                                      : 'bg-slate-50 border-slate-300 opacity-60 hover:opacity-80'
                                  } disabled:cursor-not-allowed disabled:opacity-50`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      {routine.schedule_name && (
                                        <div className="text-xs text-slate-500 mb-1">
                                          {routine.schedule_name}
                                        </div>
                                      )}
                                      <div className="space-y-2 text-sm">
                                        <div className="flex gap-6">
                                          <div>
                                            <span className="text-slate-500">Week:</span>
                                            <span className="ml-2 font-medium text-slate-900">
                                              Week {routine.cycle_week}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-slate-500">Time:</span>
                                            <span className="ml-2 font-medium text-slate-900">
                                              {routine.end_time
                                                ? `${routine.start_time} - ${routine.end_time}`
                                                : routine.start_time
                                              }
                                            </span>
                                          </div>
                                          <div>
                                            <span className={`text-xs px-2 py-1 rounded ${
                                              routine.status === 'active'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-slate-100 text-slate-700'
                                            }`}>
                                              {routine.status}
                                            </span>
                                          </div>
                                        </div>
                                        <div>
                                          <span className="text-slate-500">Days:</span>
                                          <div className="inline-flex flex-wrap gap-1 ml-2">
                                            {routine.days_of_week?.map(day => (
                                              <span
                                                key={day}
                                                className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                                              >
                                                {DAYS_OF_WEEK.find(d => d.value === day)?.label}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1 group-hover:text-slate-600 transition-colors" />
                                  </div>
                                </button>
                              )}
                            </div>
                          ))}

                          {/* Add Schedule for Remaining Days Button */}
                          {hasUnscheduledDays && (
                            <button
                              onClick={() => handleAddRemainingDays(stationId, unscheduledDays)}
                              disabled={showAddForm}
                              className="w-full p-3 bg-white border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-4 h-4 text-slate-600" />
                              <span className="text-sm font-medium text-slate-600">
                                Schedule Remaining Days ({unscheduledDays.length})
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {showRemovedDaysPrompt && removedDaysData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Unscheduled Days Detected</h3>
            <p className="text-slate-600 mb-4">
              You removed {removedDaysData.days.map(d => DAYS_OF_WEEK[d].label).join(', ')} from this station routine,
              and {removedDaysData.days.length === 1 ? 'this day is' : 'these days are'} not covered by any other routines for this station.
            </p>
            <p className="text-slate-700 font-medium mb-4">
              Would you like to create a new routine for {removedDaysData.days.length === 1 ? 'this day' : 'these days'}?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRemovedDaysPrompt(false);
                  setRemovedDaysData(null);
                }}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                No, Leave Unscheduled
              </button>
              <button
                onClick={() => {
                  setNewRoutine({
                    placement_id: removedDaysData.stationId,
                    cycle_week: removedDaysData.templateRoutine.cycle_week,
                    days_of_week: removedDaysData.days,
                    start_time: removedDaysData.templateRoutine.start_time,
                    end_time: removedDaysData.templateRoutine.end_time || '',
                    schedule_name: removedDaysData.templateRoutine.schedule_name || '',
                    status: 'active'
                  });
                  setShowAddForm(true);
                  setShowRemovedDaysPrompt(false);
                  setRemovedDaysData(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Yes, Schedule {removedDaysData.days.length === 1 ? 'This Day' : 'These Days'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
