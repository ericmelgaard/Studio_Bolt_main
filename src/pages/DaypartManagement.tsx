import { useState, useEffect } from 'react';
import { Clock, Plus, Edit2, Trash2, AlertCircle, Check, X, Calendar, ChevronDown, ChevronRight, MapPin, Layers, Zap, Sparkles, ToggleLeft, ToggleRight, ArrowDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import IconPicker from '../components/IconPicker';
import ScheduleGroupForm from '../components/ScheduleGroupForm';
import { useLocation } from '../hooks/useLocation';
import { Schedule } from '../hooks/useScheduleCollisionDetection';
import DaypartAdvancedView from '../components/DaypartAdvancedView';

interface DaypartDefinition {
  id: string;
  daypart_name: string;
  display_label: string;
  description: string;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  concept_id: number | null;
  store_id: number | null;
}

interface DaypartSchedule extends Schedule {
  daypart_definition_id: string;
}

interface SiteRoutine extends Schedule {
  placement_group_id: string;
  daypart_definition_id: string;
}

type ContextLevel = 'wand' | 'concept' | 'company' | 'store';

interface ResolvedDef {
  definition: DaypartDefinition;
  source_level: 'wand' | 'concept' | 'store';
  inherited: boolean;
  disabled_at_this_level: boolean;
  overridden: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' }
];

const SCOPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  wand: { bg: 'bg-slate-100 border-slate-300', text: 'text-slate-700', label: 'WAND' },
  concept: { bg: 'bg-emerald-100 border-emerald-300', text: 'text-emerald-700', label: 'Concept' },
  store: { bg: 'bg-amber-100 border-amber-300', text: 'text-amber-700', label: 'Store' },
};

export default function DaypartManagement() {
  const { location, getLocationBreadcrumb } = useLocation();
  const [contextLevel, setContextLevel] = useState<ContextLevel>('wand');
  const [currentConceptId, setCurrentConceptId] = useState<number | null>(null);
  const [currentStoreId, setCurrentStoreId] = useState<number | null>(null);
  const [siteRootPlacementId, setSiteRootPlacementId] = useState<string | null>(null);

  const [rawDefinitions, setRawDefinitions] = useState<DaypartDefinition[]>([]);
  const [allSchedules, setAllSchedules] = useState<DaypartSchedule[]>([]);
  const [siteRoutines, setSiteRoutines] = useState<SiteRoutine[]>([]);

  const [loading, setLoading] = useState(true);
  const [showDefinitionForm, setShowDefinitionForm] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState<DaypartDefinition | null>(null);
  const [addingScheduleForDef, setAddingScheduleForDef] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<DaypartSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [showAdvancedView, setShowAdvancedView] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    daypart_name: '',
    display_label: '',
    description: '',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: 'Clock',
    sort_order: 0,
  });

  useEffect(() => { detectContextLevel(); }, [location]);
  useEffect(() => { loadData(); }, [contextLevel, currentConceptId, currentStoreId, siteRootPlacementId]);

  const detectContextLevel = async () => {
    if (location.store) {
      setCurrentStoreId(location.store.id);
      setCurrentConceptId(location.concept?.id || null);
      const { data: placementData } = await supabase
        .from('placement_groups').select('id')
        .eq('store_id', location.store.id).is('parent_id', null).maybeSingle();
      setSiteRootPlacementId(placementData?.id || null);
      setContextLevel('store');
    } else if (location.concept) {
      setCurrentConceptId(location.concept.id);
      setCurrentStoreId(null);
      setSiteRootPlacementId(null);
      setContextLevel('concept');
    } else {
      setCurrentConceptId(null);
      setCurrentStoreId(null);
      setSiteRootPlacementId(null);
      setContextLevel('wand');
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadDefinitions(), loadSchedules(), loadSiteRoutines()]);
    } catch (err: any) {
      setError(err.message || 'Failed to load daypart data');
    } finally {
      setLoading(false);
    }
  };

  const loadDefinitions = async () => {
    const { data, error } = await supabase
      .from('daypart_definitions')
      .select('*')
      .or(
        contextLevel === 'store'
          ? `concept_id.eq.${currentConceptId},store_id.eq.${currentStoreId},and(concept_id.is.null,store_id.is.null)`
          : contextLevel === 'concept'
          ? `concept_id.eq.${currentConceptId},and(concept_id.is.null,store_id.is.null)`
          : 'and(concept_id.is.null,store_id.is.null)'
      )
      .order('sort_order');

    if (error) {
      setError('Failed to load daypart definitions');
    } else {
      setRawDefinitions(data || []);
    }
  };

  const loadSchedules = async () => {
    const { data } = await supabase.from('daypart_schedules').select('*');
    setAllSchedules(data || []);
  };

  const loadSiteRoutines = async () => {
    if (!siteRootPlacementId) { setSiteRoutines([]); return; }
    const { data } = await supabase.from('placement_daypart_overrides').select('*')
      .eq('placement_group_id', siteRootPlacementId);
    setSiteRoutines(data || []);
  };

  // Resolve inheritance: group raw definitions by daypart_name, pick effective one per level
  const resolvedDefinitions: ResolvedDef[] = (() => {
    const wandLevel = rawDefinitions.filter(r => !r.concept_id && !r.store_id);
    const conceptLevel = rawDefinitions.filter(r => r.concept_id && !r.store_id);
    const storeLevel = rawDefinitions.filter(r => !!r.store_id);

    const byName = new Map<string, ResolvedDef>();

    // Start with wand-level
    for (const def of wandLevel) {
      byName.set(def.daypart_name, {
        definition: def,
        source_level: 'wand',
        inherited: contextLevel !== 'wand',
        disabled_at_this_level: false,
        overridden: false,
      });
    }

    // Apply concept-level overrides
    if (contextLevel === 'concept' || contextLevel === 'store') {
      for (const def of conceptLevel) {
        const existing = byName.get(def.daypart_name);
        if (existing) {
          existing.overridden = true;
        }
        byName.set(def.daypart_name, {
          definition: def,
          source_level: 'concept',
          inherited: contextLevel === 'store',
          disabled_at_this_level: !def.is_active,
          overridden: false,
        });
      }
    }

    // Apply store-level overrides
    if (contextLevel === 'store') {
      for (const def of storeLevel) {
        const existing = byName.get(def.daypart_name);
        if (existing) {
          existing.overridden = true;
        }
        byName.set(def.daypart_name, {
          definition: def,
          source_level: 'store',
          inherited: false,
          disabled_at_this_level: !def.is_active,
          overridden: false,
        });
      }
    }

    return Array.from(byName.values()).sort((a, b) => a.definition.sort_order - b.definition.sort_order);
  })();

  const handleToggleActive = async (resolved: ResolvedDef) => {
    const def = resolved.definition;
    setTogglingId(def.id);

    if (resolved.inherited) {
      // Create a local override row at the current level with is_active toggled
      await supabase.from('daypart_definitions').insert({
        daypart_name: def.daypart_name,
        display_label: def.display_label,
        description: def.description,
        color: def.color,
        icon: def.icon,
        sort_order: def.sort_order,
        is_active: false,
        concept_id: contextLevel === 'concept' || contextLevel === 'store' ? currentConceptId : null,
        store_id: contextLevel === 'store' ? currentStoreId : null,
      });
    } else {
      // Toggle existing row
      await supabase.from('daypart_definitions')
        .update({ is_active: !def.is_active, updated_at: new Date().toISOString() })
        .eq('id', def.id);
    }

    await loadDefinitions();
    setTogglingId(null);
  };

  const handleSubmitDefinition = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const defData = {
        ...formData,
        concept_id: contextLevel === 'concept' || contextLevel === 'store' ? currentConceptId : null,
        store_id: contextLevel === 'store' ? currentStoreId : null,
        is_active: true,
      };

      if (editingDefinition) {
        const { error: updateError } = await supabase.from('daypart_definitions')
          .update({
            display_label: formData.display_label,
            description: formData.description,
            color: formData.color,
            icon: formData.icon,
            sort_order: formData.sort_order,
            updated_at: new Date().toISOString(),
          }).eq('id', editingDefinition.id);
        if (updateError) throw updateError;
        setSuccess('Daypart definition updated successfully');
      } else {
        const { data: newDef, error: insertError } = await supabase.from('daypart_definitions')
          .insert([defData]).select().single();
        if (insertError) throw insertError;
        setSuccess('Daypart definition created successfully');
        if (newDef) setAddingScheduleForDef(newDef.id);
      }

      setShowDefinitionForm(false);
      setEditingDefinition(null);
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save daypart definition');
    }
  };

  const handleDeleteDefinition = async (definition: DaypartDefinition) => {
    if (!confirm(`Delete "${definition.display_label}"? This will also delete all its schedules.`)) return;
    try {
      const { error: deleteError } = await supabase.from('daypart_definitions').delete().eq('id', definition.id);
      if (deleteError) throw deleteError;
      setSuccess('Daypart definition deleted successfully');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete definition');
    }
  };

  const handleAddSchedule = (defId: string) => {
    setAddingScheduleForDef(defId);
    setEditingSchedule(null);
  };

  const handleEditSchedule = (schedule: DaypartSchedule) => {
    const definition = rawDefinitions.find(d => d.id === schedule.daypart_definition_id);
    setEditingSchedule({ ...schedule, daypart_name: definition?.daypart_name });
    setAddingScheduleForDef(null);
  };

  const handleSaveSchedule = async (schedule: Schedule) => {
    try {
      if (editingSchedule) {
        const updateData: any = {
          days_of_week: schedule.days_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          updated_at: new Date().toISOString(),
        };
        if (schedule.schedule_name !== undefined) updateData.schedule_name = schedule.schedule_name;
        const { error: updateError } = await supabase.from('daypart_schedules').update(updateData).eq('id', editingSchedule.id);
        if (updateError) throw updateError;
      } else if (addingScheduleForDef) {
        const insertData: any = {
          daypart_definition_id: addingScheduleForDef,
          days_of_week: schedule.days_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
        };
        if (schedule.schedule_name !== undefined) insertData.schedule_name = schedule.schedule_name;
        const { error: insertError } = await supabase.from('daypart_schedules').insert([insertData]);
        if (insertError) throw insertError;
      }
      setEditingSchedule(null);
      setAddingScheduleForDef(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save schedule');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
      const { error: deleteError } = await supabase.from('daypart_schedules').delete().eq('id', scheduleId);
      if (deleteError) throw deleteError;
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete schedule');
    }
  };

  const handleScheduleUnscheduledDays = async (days: number[], template: any) => {
    try {
      const schedule = template;
      if (schedule.id) {
        const updateData: any = {
          days_of_week: schedule.days_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          updated_at: new Date().toISOString(),
        };
        if (schedule.schedule_name !== undefined) updateData.schedule_name = schedule.schedule_name;
        const { error: updateError } = await supabase.from('daypart_schedules').update(updateData).eq('id', schedule.id);
        if (updateError) throw updateError;
      } else if (schedule.daypart_definition_id) {
        const insertData: any = {
          daypart_definition_id: schedule.daypart_definition_id,
          days_of_week: schedule.days_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
        };
        if (schedule.schedule_name !== undefined) insertData.schedule_name = schedule.schedule_name;
        const { error: insertError } = await supabase.from('daypart_schedules').insert([insertData]);
        if (insertError) throw insertError;
      }
      await loadData();
      const definition = rawDefinitions.find(d => d.daypart_name === template.daypart_name);
      if (definition) {
        setEditingSchedule({
          daypart_name: definition.daypart_name,
          daypart_definition_id: definition.id,
          days_of_week: days,
          start_time: template.start_time,
          end_time: template.end_time,
          runs_on_days: true,
          schedule_name: template.schedule_name || ''
        });
        setAddingScheduleForDef(definition.id);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save schedule');
    }
  };

  const toggleEventsExpanded = (defId: string) => {
    setExpandedEvents(prev => ({ ...prev, [defId]: !prev[defId] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (showAdvancedView) {
    return (
      <DaypartAdvancedView
        locationId={currentStoreId}
        conceptId={currentConceptId}
        onClose={() => setShowAdvancedView(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-7 h-7 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">Daypart Management</h1>
              {(() => {
                const style = SCOPE_STYLES[contextLevel] || SCOPE_STYLES.wand;
                return (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium ${style.bg} ${style.text} border rounded-lg`}>
                    {contextLevel === 'store' ? <MapPin className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                    {style.label} Level
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowAdvancedView(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all font-medium shadow-md hover:shadow-lg">
                <Zap className="w-5 h-5" /> Advanced View
              </button>
              {!showDefinitionForm && (
                <button onClick={() => {
                  setEditingDefinition(null);
                  setFormData({ daypart_name: '', display_label: '', description: '', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: 'Clock', sort_order: rawDefinitions.length });
                  setShowDefinitionForm(true);
                }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  <Plus className="w-5 h-5" /> Add Daypart
                </button>
              )}
            </div>
          </div>

          {/* Inheritance legend */}
          {contextLevel !== 'wand' && (
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <ArrowDown className="w-3 h-3" /> Inherited dayparts are shown in lighter styling and cannot be edited at this level.
              </span>
              <span className="flex items-center gap-1">
                Use the toggle to disable an inherited daypart for this {contextLevel}.
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-start gap-2">
            <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <div className="space-y-4 mb-6">
          {resolvedDefinitions.map((resolved) => {
            const definition = resolved.definition;
            const defSchedules = allSchedules
              .filter(s => s.daypart_definition_id === definition.id)
              .map(s => ({ ...s, daypart_name: definition.daypart_name }));
            const regularSchedules = defSchedules.filter(s => s.schedule_type !== 'event_holiday');
            const eventSchedules = defSchedules.filter(s => s.schedule_type === 'event_holiday');
            const hasEvents = eventSchedules.length > 0;
            const eventsExpanded = expandedEvents[definition.id];

            const isOwned = !resolved.inherited;
            const scopeStyle = SCOPE_STYLES[resolved.source_level] || SCOPE_STYLES.wand;
            const isDisabled = !definition.is_active;

            return (
              <div key={definition.id}
                className={`bg-white rounded-lg border overflow-hidden transition-opacity ${
                  isDisabled ? 'opacity-50 border-slate-200' : resolved.inherited ? 'border-slate-200 border-dashed' : 'border-slate-200'
                }`}>
                <div className={`px-4 py-3 ${isDisabled ? 'bg-slate-100' : definition.color}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <Clock className="w-4 h-4" />
                      <h4 className="font-semibold">{definition.display_label}</h4>

                      {/* Scope badge */}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${scopeStyle.bg} ${scopeStyle.text}`}>
                        {scopeStyle.label}
                      </span>

                      {/* Inherited indicator */}
                      {resolved.inherited && (
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 flex items-center gap-1">
                          <ArrowDown className="w-2.5 h-2.5" /> Inherited
                        </span>
                      )}

                      {isDisabled && (
                        <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                          Disabled
                        </span>
                      )}

                      {hasEvents && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-900 font-medium">
                          <Sparkles className="w-3 h-3" />
                          {eventSchedules.length} {eventSchedules.length === 1 ? 'Event' : 'Events'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Enable/disable toggle */}
                      <button onClick={() => handleToggleActive(resolved)} disabled={togglingId === definition.id}
                        className={`p-1.5 rounded-lg transition-colors ${
                          definition.is_active
                            ? 'text-emerald-600 hover:bg-emerald-50'
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                        title={definition.is_active ? 'Disable this daypart' : 'Enable this daypart'}>
                        {definition.is_active
                          ? <ToggleRight className="w-5 h-5" />
                          : <ToggleLeft className="w-5 h-5" />
                        }
                      </button>

                      {isOwned && (
                        <>
                          <button type="button" onClick={() => {
                            setEditingDefinition(definition);
                            setFormData({
                              daypart_name: definition.daypart_name,
                              display_label: definition.display_label,
                              description: definition.description,
                              color: definition.color,
                              icon: definition.icon,
                              sort_order: definition.sort_order,
                            });
                            setShowDefinitionForm(true);
                          }} className="p-1.5 hover:bg-white/50 rounded-lg transition-colors" title="Edit definition">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleDeleteDefinition(definition)}
                            className="p-1.5 hover:bg-white/50 rounded-lg transition-colors" title="Delete definition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {!isDisabled && regularSchedules.length > 0 && !addingScheduleForDef && !editingSchedule && (
                        <button type="button" onClick={() => handleAddSchedule(definition.id)}
                          className="p-1.5 hover:bg-white/50 rounded-lg transition-colors" title="Add schedule">
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {!isDisabled && (
                  <>
                    {regularSchedules.length === 0 && !addingScheduleForDef && !hasEvents ? (
                      <div className="p-6 text-center">
                        <p className="text-slate-600 text-sm mb-4">
                          No schedules yet. Add a schedule to define when this daypart is active.
                        </p>
                        <button type="button" onClick={() => handleAddSchedule(definition.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                          <Plus className="w-4 h-4" /> Add Schedule
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 space-y-3">
                        {regularSchedules.map((schedule) => {
                          const isEditing = editingSchedule?.id === schedule.id;
                          if (isEditing) {
                            return (
                              <div key={schedule.id} className="bg-blue-50 border-2 border-blue-200 rounded-xl overflow-hidden">
                                <ScheduleGroupForm
                                  schedule={editingSchedule}
                                  allSchedules={defSchedules}
                                  onUpdate={setEditingSchedule}
                                  onSave={() => handleSaveSchedule(editingSchedule)}
                                  onCancel={() => setEditingSchedule(null)}
                                  onDelete={editingSchedule.id ? () => handleDeleteSchedule(editingSchedule.id!) : undefined}
                                  onScheduleUnscheduledDays={handleScheduleUnscheduledDays}
                                  level="site"
                                  daypartColor={definition.color}
                                />
                              </div>
                            );
                          }
                          return (
                            <button key={schedule.id} onClick={() => handleEditSchedule(schedule)}
                              className="w-full p-4 rounded-xl border border-slate-200 bg-white hover:bg-blue-50 active:bg-blue-100 transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] shadow-sm text-left group">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex gap-1 mb-2">
                                    {DAYS_OF_WEEK.map((day) => {
                                      const isActive = schedule.days_of_week.includes(day.value);
                                      const bgColor = definition.color.match(/bg-(\w+)-\d+/)?.[0] || 'bg-slate-100';
                                      const textColor = bgColor.replace('bg-', 'text-').replace('-100', '-700');
                                      return (
                                        <div key={day.value}
                                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                            isActive ? `${bgColor} ${textColor}` : 'bg-slate-100 text-slate-400'
                                          }`} title={day.label}>
                                          {day.short[0]}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Clock className="w-4 h-4" />
                                    <span>{schedule.runs_on_days === false ? 'Does Not Run' : `${schedule.start_time} - ${schedule.end_time}`}</span>
                                  </div>
                                  {schedule.schedule_name && (
                                    <div className="mt-1 text-xs text-slate-500">{schedule.schedule_name}</div>
                                  )}
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1 group-hover:text-slate-600 transition-colors" />
                              </div>
                            </button>
                          );
                        })}

                        {addingScheduleForDef === definition.id && (
                          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-4">
                              <h5 className="font-semibold text-slate-900">Add Schedule</h5>
                              <button onClick={() => setAddingScheduleForDef(null)} className="p-1 hover:bg-slate-200 rounded transition-colors">
                                <X className="w-4 h-4 text-slate-600" />
                              </button>
                            </div>
                            <ScheduleGroupForm
                              schedule={{
                                daypart_name: definition.daypart_name,
                                daypart_definition_id: definition.id,
                                days_of_week: [],
                                start_time: '06:00',
                                end_time: '11:00',
                              }}
                              allSchedules={defSchedules}
                              onUpdate={() => {}}
                              onSave={(updatedSchedule) => handleSaveSchedule(updatedSchedule)}
                              onCancel={() => setAddingScheduleForDef(null)}
                              onScheduleUnscheduledDays={handleScheduleUnscheduledDays}
                              level="site"
                              daypartColor={definition.color}
                            />
                          </div>
                        )}

                        {hasEvents && (
                          <div className="mx-0 mt-2 rounded-lg overflow-hidden" style={{ border: '2px solid rgba(222, 56, 222, 0.2)', backgroundColor: 'rgba(222, 56, 222, 0.03)' }}>
                            <button type="button" onClick={() => toggleEventsExpanded(definition.id)}
                              className="w-full px-4 py-3 transition-colors flex items-center justify-between"
                              style={{ backgroundColor: 'rgba(222, 56, 222, 0.08)' }}>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" style={{ color: 'rgb(156, 39, 176)' }} />
                                <span className="text-sm font-medium" style={{ color: 'rgb(156, 39, 176)' }}>Event & Holiday Schedules</span>
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(222, 56, 222, 0.15)', color: 'rgb(156, 39, 176)' }}>
                                  {eventSchedules.length}
                                </span>
                              </div>
                              {eventsExpanded
                                ? <ChevronDown className="w-5 h-5" style={{ color: 'rgb(156, 39, 176)' }} />
                                : <ChevronRight className="w-5 h-5" style={{ color: 'rgb(156, 39, 176)' }} />
                              }
                            </button>
                            {eventsExpanded && (
                              <div className="p-3 space-y-3" style={{ backgroundColor: 'rgba(222, 56, 222, 0.03)' }}>
                                {eventSchedules.map((schedule) => {
                                  const isEditing = editingSchedule?.id === schedule.id;
                                  if (isEditing) {
                                    return (
                                      <div key={schedule.id} className="p-4" style={{ backgroundColor: 'rgba(222, 56, 222, 0.08)', borderRadius: '12px', border: '2px solid rgba(222, 56, 222, 0.2)' }}>
                                        <div className="flex items-center justify-between mb-4">
                                          <h5 className="font-semibold" style={{ color: 'rgb(156, 39, 176)' }}>Edit Event</h5>
                                          <button onClick={() => setEditingSchedule(null)} className="p-1 hover:bg-slate-200 rounded transition-colors">
                                            <X className="w-4 h-4" style={{ color: 'rgb(156, 39, 176)' }} />
                                          </button>
                                        </div>
                                        <ScheduleGroupForm
                                          schedule={editingSchedule}
                                          allSchedules={defSchedules}
                                          onUpdate={setEditingSchedule}
                                          onSave={() => handleSaveSchedule(editingSchedule)}
                                          onCancel={() => setEditingSchedule(null)}
                                          onDelete={editingSchedule.id ? () => handleDeleteSchedule(editingSchedule.id!) : undefined}
                                          onScheduleUnscheduledDays={handleScheduleUnscheduledDays}
                                          level="site"
                                          daypartColor={definition.color}
                                        />
                                      </div>
                                    );
                                  }
                                  return (
                                    <button key={schedule.id} onClick={() => handleEditSchedule(schedule)}
                                      className="w-full p-4 rounded-xl border text-left transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] shadow-sm"
                                      style={{ borderColor: 'rgba(222, 56, 222, 0.2)', backgroundColor: 'white' }}>
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-3 mb-2">
                                            <span className="font-medium" style={{ color: 'rgb(156, 39, 176)' }}>
                                              {schedule.event_name || 'Unnamed Event'}
                                            </span>
                                          </div>
                                          <div className="text-sm mb-2" style={{ color: 'rgb(156, 39, 176)' }}>
                                            <Clock className="w-3.5 h-3.5 inline mr-1" />
                                            {schedule.runs_on_days === false ? 'Does Not Run' : `${schedule.start_time} - ${schedule.end_time}`}
                                          </div>
                                          {schedule.recurrence_type && schedule.recurrence_type !== 'none' && (
                                            <div className="text-xs mb-1" style={{ color: 'rgb(156, 39, 176)' }}>
                                              {schedule.recurrence_type === 'annual_date' && 'Recurs annually'}
                                              {schedule.recurrence_type === 'monthly_date' && 'Recurs monthly'}
                                              {schedule.recurrence_type === 'annual_relative' && 'Recurs annually (relative)'}
                                              {schedule.recurrence_type === 'annual_date_range' && 'Annual date range'}
                                            </div>
                                          )}
                                          {schedule.event_date && (
                                            <div className="text-xs" style={{ color: 'rgb(156, 39, 176)' }}>
                                              Date: {new Date(schedule.event_date).toLocaleDateString()}
                                            </div>
                                          )}
                                        </div>
                                        <ChevronRight className="w-5 h-5 flex-shrink-0 mt-1" style={{ color: 'rgba(156, 39, 176, 0.4)' }} />
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {resolvedDefinitions.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
              <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900 mb-2">No Daypart Definitions Available</h3>
              <p className="text-slate-600 text-sm mb-4">
                {contextLevel === 'store'
                  ? 'No daypart definitions have been created at WAND or concept level yet.'
                  : 'Create your first daypart definition to get started.'}
              </p>
              {contextLevel !== 'store' && (
                <button onClick={() => {
                  setEditingDefinition(null);
                  setFormData({ daypart_name: '', display_label: '', description: '', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: 'Clock', sort_order: 0 });
                  setShowDefinitionForm(true);
                }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  <Plus className="w-4 h-4" /> Add Daypart
                </button>
              )}
            </div>
          )}
        </div>

        {showDefinitionForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowDefinitionForm(false); setEditingDefinition(null); } }}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {editingDefinition ? 'Edit Daypart Definition' : 'Add Daypart Definition'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    This definition will be created at the <span className="font-semibold">{SCOPE_STYLES[contextLevel]?.label || 'WAND'}</span> level.
                  </p>
                </div>
                <button type="button" onClick={() => { setShowDefinitionForm(false); setEditingDefinition(null); }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitDefinition} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Daypart Name *</label>
                  <input type="text" required disabled={!!editingDefinition}
                    value={formData.daypart_name}
                    onChange={(e) => setFormData({ ...formData, daypart_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500"
                    placeholder="e.g., breakfast, lunch" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Display Label *</label>
                  <input type="text" required
                    value={formData.display_label}
                    onChange={(e) => setFormData({ ...formData, display_label: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Breakfast" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                  <textarea value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2} placeholder="Description of this daypart" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
                    <select value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="bg-blue-100 text-blue-800 border-blue-300">Blue</option>
                      <option value="bg-green-100 text-green-800 border-green-300">Green</option>
                      <option value="bg-orange-100 text-orange-800 border-orange-300">Orange</option>
                      <option value="bg-red-100 text-red-800 border-red-300">Red</option>
                      <option value="bg-slate-100 text-slate-800 border-slate-300">Gray</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Icon</label>
                    <IconPicker selectedIcon={formData.icon} onSelect={(icon) => setFormData({ ...formData, icon })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Sort Order</label>
                  <input type="number" value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => { setShowDefinitionForm(false); setEditingDefinition(null); }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    {editingDefinition ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
