import { useState, useEffect, FormEvent, useRef } from 'react';
import { Save, AlertCircle, Clock, Utensils, Palette, Nfc, MapPin, Phone, Globe, X, Info, Copy, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Breadcrumb from '../components/Breadcrumb';
import SiteDaypartManager from '../components/SiteDaypartManager';
import StationDaypartOverrides from '../components/StationDaypartOverrides';
import TimeSelector from '../components/TimeSelector';

interface PlacementGroup {
  id?: string;
  name?: string;
  description?: string | null;
  parent_id?: string | null;
  store_id?: number | null;
  is_store_root?: boolean;
  daypart_hours?: Record<string, any>;
  meal_stations?: string[];
  templates?: Record<string, any>;
  nfc_url?: string | null;
  address?: string | null;
  timezone?: string;
  phone?: string | null;
  operating_hours?: Record<string, any>;
}

interface PlacementEditProps {
  placementId?: string;
  storeId?: number;
  parentId?: string | null;
  conceptName?: string;
  companyName?: string;
  storeName?: string;
  placementName?: string;
  onBack: () => void;
  onSave: () => void;
  onNavigate?: (level: 'wand' | 'concept' | 'company' | 'store') => void;
}

const DEVICE_SIZES = ['4.2"', '5"', '7"'];

export default function PlacementEdit({ placementId, storeId, parentId, conceptName, companyName, storeName, placementName, onBack, onSave, onNavigate }: PlacementEditProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableParents, setAvailableParents] = useState<PlacementGroup[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_id: parentId || '',
    nfc_url: '',
    address: '',
    timezone: 'America/New_York',
    phone: '',
  });

  const [daypartHours, setDaypartHours] = useState<Record<string, { start: string; end: string }>>({});
  const [mealStations, setMealStations] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [operatingHours, setOperatingHours] = useState<Record<string, { open: string; close: string }>>({});
  const [newMealStation, setNewMealStation] = useState('');
  const [isStoreRoot, setIsStoreRoot] = useState(false);
  const [activeSection, setActiveSection] = useState('basic-info');
  const [idCopied, setIdCopied] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const originalDataRef = useRef<{
    formData: typeof formData;
    daypartHours: typeof daypartHours;
    mealStations: typeof mealStations;
    templates: typeof templates;
    operatingHours: typeof operatingHours;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [placementId, storeId]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      const sections = getSections();

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sectionRefs.current[sections[i].id];
        if (section) {
          const offsetTop = section.offsetTop;
          if (scrollPosition >= offsetTop) {
            setActiveSection(sections[i].id);
            return;
          }
        }
      }

      if (sections.length > 0) {
        setActiveSection(sections[0].id);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isStoreRoot, placementId]);

  const checkIfDirty = () => {
    if (!originalDataRef.current) {
      return placementId ? false : true;
    }

    const original = originalDataRef.current;

    const formChanged = JSON.stringify(formData) !== JSON.stringify(original.formData);
    const daypartChanged = JSON.stringify(daypartHours) !== JSON.stringify(original.daypartHours);
    const stationsChanged = JSON.stringify(mealStations) !== JSON.stringify(original.mealStations);
    const templatesChanged = JSON.stringify(templates) !== JSON.stringify(original.templates);
    const hoursChanged = JSON.stringify(operatingHours) !== JSON.stringify(original.operatingHours);

    return formChanged || daypartChanged || stationsChanged || templatesChanged || hoursChanged;
  };

  useEffect(() => {
    setIsDirty(checkIfDirty());
  }, [formData, daypartHours, mealStations, templates, operatingHours]);

  const loadData = async () => {
    setLoading(true);

    if (placementId) {
      const { data, error: fetchError } = await supabase
        .from('placement_groups')
        .select('*')
        .eq('id', placementId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error loading placement:', fetchError);
        setError('Failed to load placement');
      } else if (data) {
        const loadedFormData = {
          name: data.name || '',
          description: data.description || '',
          parent_id: data.parent_id || '',
          nfc_url: data.nfc_url || '',
          address: data.address || '',
          timezone: data.timezone || 'America/New_York',
          phone: data.phone || '',
        };
        const loadedDaypartHours = data.daypart_hours || {};
        const loadedMealStations = data.meal_stations || [];
        const loadedTemplates = data.templates || {};
        const loadedOperatingHours = data.operating_hours || {};

        setFormData(loadedFormData);
        setDaypartHours(loadedDaypartHours);
        setMealStations(loadedMealStations);
        setTemplates(loadedTemplates);
        setOperatingHours(loadedOperatingHours);
        setIsStoreRoot(data.is_store_root || false);

        originalDataRef.current = {
          formData: loadedFormData,
          daypartHours: loadedDaypartHours,
          mealStations: loadedMealStations,
          templates: loadedTemplates,
          operatingHours: loadedOperatingHours,
        };
      }
    }

    if (storeId) {
      const { data: parentsData } = await supabase
        .from('placement_groups')
        .select('*')
        .eq('store_id', storeId)
        .order('name');

      if (parentsData) {
        const filtered = parentsData.filter(p => p.id !== placementId);
        setAvailableParents(filtered);
      }
    }

    setLoading(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const data = {
        name: formData.name,
        description: formData.description || null,
        parent_id: formData.parent_id || null,
        daypart_hours: daypartHours,
        meal_stations: mealStations,
        templates: templates,
        nfc_url: formData.nfc_url || null,
        ...(!placementId && storeId && { store_id: storeId }),
        ...(isStoreRoot && {
          address: formData.address || null,
          timezone: formData.timezone || 'America/New_York',
          phone: formData.phone || null,
          operating_hours: operatingHours,
        }),
      };

      if (placementId) {
        const { error: updateError } = await supabase
          .from('placement_groups')
          .update(data)
          .eq('id', placementId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('placement_groups')
          .insert([data]);

        if (insertError) throw insertError;
      }

      originalDataRef.current = {
        formData,
        daypartHours,
        mealStations,
        templates,
        operatingHours,
      };
      setIsDirty(false);
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save placement');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      onBack();
    }
  };

  const handleNavigate = (level: 'wand' | 'concept' | 'company' | 'store') => {
    if (isDirty) {
      setShowExitConfirm(true);
    } else if (onNavigate) {
      onNavigate(level);
    } else {
      onBack();
    }
  };

  const handleDiscardAndExit = () => {
    setShowExitConfirm(false);
    onBack();
  };

  const handleSaveAndExit = async () => {
    setShowExitConfirm(false);
    const form = document.querySelector('form');
    if (form) {
      form.requestSubmit();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showExitConfirm) {
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, showExitConfirm]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const addMealStation = () => {
    if (newMealStation.trim() && !mealStations.includes(newMealStation.trim())) {
      setMealStations([...mealStations, newMealStation.trim()]);
      setNewMealStation('');
    }
  };

  const removeMealStation = (station: string) => {
    setMealStations(mealStations.filter(s => s !== station));
  };

  const handleTemplateChange = (size: string, templateId: string) => {
    setTemplates(prev => ({
      ...prev,
      [size]: templateId,
    }));
  };

  const scrollToSection = (sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  const copyIdToClipboard = async () => {
    if (placementId) {
      try {
        await navigator.clipboard.writeText(placementId);
        setIdCopied(true);
        setTimeout(() => setIdCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const getSections = () => {
    const sections = [
      { id: 'basic-info', label: 'Basic Information', icon: Info },
    ];

    if (isStoreRoot) {
      sections.push(
        { id: 'store-location', label: 'Store Location', icon: MapPin },
        { id: 'operating-hours', label: 'Operating Hours', icon: Clock }
      );
    }

    if (isStoreRoot && placementId) {
      sections.push({ id: 'daypart-config', label: 'Daypart Configuration', icon: Clock });
    }

    if (!isStoreRoot && placementId) {
      sections.push({ id: 'daypart-overrides', label: 'Placement Schedules', icon: Clock });
    }

    sections.push(
      { id: 'meal-stations', label: 'Meal Stations', icon: Utensils },
      { id: 'device-templates', label: 'Device Templates', icon: Palette },
      { id: 'nfc-settings', label: 'NFC Settings', icon: Nfc }
    );

    return sections;
  };

  const getBreadcrumbItems = () => {
    const items = [
      { label: 'Location Manager', onClick: onBack }
    ];

    if (placementId) {
      if (isStoreRoot) {
        items.push({ label: 'Edit Store Configuration' });
      } else {
        items.push({ label: 'Edit Placement' });
      }
    } else {
      items.push({ label: 'Create Placement' });
    }

    return items;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    Unsaved Changes
                  </h3>
                  <p className="text-slate-600 text-sm">
                    You have unsaved changes. What would you like to do?
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Keep Editing
              </button>
              <button
                onClick={handleDiscardAndExit}
                className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors font-medium"
              >
                Discard Changes
              </button>
              <button
                onClick={handleSaveAndExit}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Save & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <Breadcrumb items={getBreadcrumbItems()} className="mb-0" />
            {placementId && (
              <button
                onClick={copyIdToClipboard}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors text-xs font-mono border border-slate-300"
                title="Click to copy ID"
              >
                {idCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>ID: {placementId.slice(0, 8)}...</span>
                  </>
                )}
              </button>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">
              {placementId
                ? (isStoreRoot ? 'Edit Store Configuration' : 'Edit Placement')
                : 'Create Placement'}
            </h1>
            <p className="text-sm text-slate-600">
              {isStoreRoot
                ? 'Update store details, operating hours, and configuration'
                : placementId
                  ? 'Update placement information and configuration'
                  : 'Create a new placement for your store'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-[124px] z-10 bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide">
                Sections
              </h3>
              <nav className="space-y-1">
                {getSections().map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeSection === section.id
                          ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600 -ml-px pl-2.5'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="text-left">{section.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <form onSubmit={handleSubmit} className="flex-1 space-y-8">
            <div
              id="basic-info"
              ref={(el) => (sectionRefs.current['basic-info'] = el)}
              className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
            >
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Main Dining Area"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>

              {!isStoreRoot && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Parent Group
                  </label>
                  <select
                    value={formData.parent_id}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">None (Root Level)</option>
                    {availableParents.map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

            {isStoreRoot && (
              <>
                <div
                  id="store-location"
                  ref={(el) => (sectionRefs.current['store-location'] = el)}
                  className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-slate-900">Store Location</h3>
                  </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="123 Main St, City, State 12345"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        <Phone className="w-4 h-4 inline mr-1" />
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        <Globe className="w-4 h-4 inline mr-1" />
                        Timezone
                      </label>
                      <select
                        value={formData.timezone}
                        onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                        <option value="America/Phoenix">Arizona Time</option>
                        <option value="America/Anchorage">Alaska Time</option>
                        <option value="Pacific/Honolulu">Hawaii Time</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

                <div
                  id="operating-hours"
                  ref={(el) => (sectionRefs.current['operating-hours'] = el)}
                  className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-slate-900">Operating Hours</h3>
                  </div>
                <div className="space-y-4">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                    <div key={day}>
                      <div className="text-sm font-medium text-slate-700 mb-2">{day}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <TimeSelector
                          label="Open"
                          value={operatingHours[day]?.open || '08:00'}
                          onChange={(time) => setOperatingHours({
                            ...operatingHours,
                            [day]: { ...operatingHours[day], open: time, close: operatingHours[day]?.close || '17:00' }
                          })}
                        />
                        <TimeSelector
                          label="Close"
                          value={operatingHours[day]?.close || '17:00'}
                          onChange={(time) => setOperatingHours({
                            ...operatingHours,
                            [day]: { ...operatingHours[day], open: operatingHours[day]?.open || '08:00', close: time }
                          })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

            {isStoreRoot && placementId && (
              <div
                id="daypart-config"
                ref={(el) => (sectionRefs.current['daypart-config'] = el)}
                className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
              >
                <SiteDaypartManager placementGroupId={placementId} />
              </div>
            )}

            {!isStoreRoot && placementId && (
              <div
                id="daypart-overrides"
                ref={(el) => (sectionRefs.current['daypart-overrides'] = el)}
                className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
              >
                <StationDaypartOverrides stationGroupId={placementId} />
              </div>
            )}

            <div
              id="meal-stations"
              ref={(el) => (sectionRefs.current['meal-stations'] = el)}
              className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
            >
              <div className="flex items-center gap-2 mb-4">
                <Utensils className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900">Meal Stations</h3>
              </div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newMealStation}
                onChange={(e) => setNewMealStation(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMealStation())}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add meal station (e.g., Grill, Salad Bar)"
              />
              <button
                type="button"
                onClick={addMealStation}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
              >
                Add
              </button>
            </div>
            {mealStations.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {mealStations.map(station => (
                  <div
                    key={station}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-sm"
                  >
                    <span className="text-blue-900">{station}</span>
                    <button
                      type="button"
                      onClick={() => removeMealStation(station)}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

            <div
              id="device-templates"
              ref={(el) => (sectionRefs.current['device-templates'] = el)}
              className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
            >
              <div className="flex items-center gap-2 mb-4">
                <Palette className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900">Templates by Device Size</h3>
              </div>
            <p className="text-sm text-slate-600 mb-4">
              Assign templates for different device sizes.
            </p>
            <div className="space-y-3">
              {DEVICE_SIZES.map(size => (
                <div key={size}>
                  <label className="block text-xs font-medium text-slate-700 mb-2">
                    {size} Template
                  </label>
                  <input
                    type="text"
                    value={templates[size] || ''}
                    onChange={(e) => handleTemplateChange(size, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder={`Template ID for ${size} devices`}
                  />
                </div>
              ))}
            </div>
          </div>

            <div
              id="nfc-settings"
              ref={(el) => (sectionRefs.current['nfc-settings'] = el)}
              className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
            >
              <div className="flex items-center gap-2 mb-4">
                <Nfc className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900">NFC URL</h3>
              </div>
            <input
              type="url"
              value={formData.nfc_url}
              onChange={(e) => setFormData({ ...formData, nfc_url: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com/menu"
            />
          </div>

            {isDirty && (
              <div className="sticky bottom-0 bg-white rounded-lg border border-slate-200 p-6 shadow-lg transition-all duration-300 ease-in-out">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 font-medium"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {placementId ? 'Update Placement' : 'Create Placement'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
    </>
  );
}
