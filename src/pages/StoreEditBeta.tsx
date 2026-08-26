import { useState, useEffect, FormEvent, useRef } from 'react';
import { Save, AlertCircle, Clock, Info, Calendar, Globe, MapPin, LayoutGrid } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StoreDaypartDefinitions from '../components/StoreDaypartDefinitions';
import StoreOperationHours from '../components/StoreOperationHours';
import StationScheduling from './StationScheduling';

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5/-4' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6/-5' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7/-6' },
  { value: 'America/Phoenix', label: 'Mountain Time - Arizona (no DST)', offset: 'UTC-7' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8/-7' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', offset: 'UTC-9/-8' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', offset: 'UTC-10' },
  { value: 'America/Toronto', label: 'Toronto (ET)', offset: 'UTC-5/-4' },
  { value: 'America/Vancouver', label: 'Vancouver (PT)', offset: 'UTC-8/-7' },
  { value: 'Europe/London', label: 'London (GMT/BST)', offset: 'UTC+0/+1' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)', offset: 'UTC+1/+2' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 'UTC+9' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)', offset: 'UTC+10/+11' },
];

interface StoreData {
  id?: number;
  company_id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  locale?: string;
}

interface StoreEditBetaProps {
  storeId?: number;
  companyId: number;
  conceptName?: string;
  companyName?: string;
  storeName?: string;
  onBack: () => void;
  onSave: (store: StoreData) => void;
  onNavigate?: (level: 'wand' | 'concept' | 'company' | 'store') => void;
}

export default function StoreEditBeta({ storeId, companyId, conceptName, companyName, storeName, onBack, onSave, onNavigate }: StoreEditBetaProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<StoreData>({
    company_id: companyId,
    name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    latitude: undefined,
    longitude: undefined,
    timezone: 'America/New_York',
    locale: undefined
  });

  const [conceptId, setConceptId] = useState<number | undefined>(undefined);
  const [companyLanguages, setCompanyLanguages] = useState<Array<{ locale: string; locale_name: string; sort_order: number }>>([]);
  const [activeSection, setActiveSection] = useState('basic-info');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showStationScheduling, setShowStationScheduling] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const originalDataRef = useRef<StoreData | null>(null);

  useEffect(() => {
    loadData();
  }, [storeId]);

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
  }, [storeId]);

  const checkIfDirty = () => {
    if (!originalDataRef.current) {
      return storeId ? false : true;
    }

    return JSON.stringify(formData) !== JSON.stringify(originalDataRef.current);
  };

  useEffect(() => {
    setIsDirty(checkIfDirty());
  }, [formData]);

  const loadCompanyLanguages = async () => {
    const { data, error } = await supabase
      .from('company_languages')
      .select('locale, locale_name, sort_order')
      .eq('company_id', companyId)
      .order('sort_order');

    if (error) {
      console.error('Error loading company languages:', error);
      return;
    }

    if (data && data.length > 0) {
      setCompanyLanguages(data);
    } else {
      setCompanyLanguages([{ locale: 'en', locale_name: 'English', sort_order: 0 }]);
    }
  };

  const loadData = async () => {
    setLoading(true);

    await loadCompanyLanguages();

    const { data: companyData } = await supabase
      .from('companies')
      .select('concept_id')
      .eq('id', companyId)
      .maybeSingle();

    if (companyData) {
      setConceptId(companyData.concept_id);
    }

    if (storeId) {
      const { data, error: fetchError } = await supabase
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error loading store:', fetchError);
        setError('Failed to load store');
      } else if (data) {
        setFormData(data);
        originalDataRef.current = data;
      }
    }

    setLoading(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Store name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (storeId) {
        const { error: updateError } = await supabase
          .from('stores')
          .update(formData)
          .eq('id', storeId);

        if (updateError) throw updateError;
      } else {
        const { data: newStore, error: insertError } = await supabase
          .from('stores')
          .insert([formData])
          .select()
          .single();

        if (insertError) throw insertError;
        formData.id = newStore.id;
      }

      originalDataRef.current = { ...formData };
      setIsDirty(false);
      onSave(formData);
    } catch (err: any) {
      setError(err.message || 'Failed to save store');
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

  const getSections = () => {
    const sections = [
      { id: 'basic-info', label: 'Basic Information', icon: Info },
      { id: 'store-location', label: 'Store Location', icon: MapPin },
      { id: 'language', label: 'Language', icon: Globe },
      { id: 'operation-hours', label: 'Power Save', icon: Calendar },
    ];

    if (storeId) {
      sections.push({ id: 'daypart-definitions', label: 'Daypart Schedules', icon: Clock });
      sections.push({ id: 'station-scheduling', label: 'Station Scheduling', icon: LayoutGrid });
    }

    return sections;
  };

  if (loading && storeId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (showStationScheduling && storeId) {
    return (
      <StationScheduling
        storeId={storeId}
        storeName={formData.name || storeName || 'Store'}
        onBack={() => setShowStationScheduling(false)}
      />
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

      <div>
        <div className="max-w-[1800px] mx-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-8">
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
                      Store Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Downtown Location"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                      Time Zone
                    </label>
                    <select
                      value={formData.timezone || 'America/New_York'}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label} ({tz.offset})
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      Used for power save schedules and daypart scheduling
                    </p>
                  </div>
                </div>
              </div>

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
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Street address"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        City
                      </label>
                      <input
                        type="text"
                        value={formData.city || ''}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="City"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        State
                      </label>
                      <input
                        type="text"
                        value={formData.state || ''}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="State"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        value={formData.zip_code || ''}
                        onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="ZIP"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.latitude || ''}
                        onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || undefined })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., 40.7128"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.longitude || ''}
                        onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || undefined })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., -74.0060"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                id="language"
                ref={(el) => (sectionRefs.current['language'] = el)}
                className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Language</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Store Language
                    </label>
                    <select
                      value={formData.locale || ''}
                      onChange={(e) => setFormData({ ...formData, locale: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Use Company Default</option>
                      {companyLanguages.map((lang) => (
                        <option key={lang.locale} value={lang.locale}>
                          {lang.locale_name} ({lang.locale})
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-slate-500">
                      {formData.locale
                        ? `This store will use ${companyLanguages.find(l => l.locale === formData.locale)?.locale_name || formData.locale}.`
                        : companyLanguages.length > 0
                          ? `This store will inherit the company's default language: ${companyLanguages[0].locale_name}.`
                          : 'No languages configured for this company.'}
                    </p>
                  </div>

                  {companyLanguages.length > 1 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-900 mb-2">Available Company Languages</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        {companyLanguages.map((lang, index) => (
                          <li key={lang.locale} className="flex items-center gap-2">
                            <span className="w-5 h-5 flex items-center justify-center bg-blue-100 rounded-full text-xs font-medium">
                              {index + 1}
                            </span>
                            {lang.locale_name} ({lang.locale})
                            {index === 0 && <span className="text-xs text-blue-600 font-medium">(Company Default)</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div
                id="operation-hours"
                ref={(el) => (sectionRefs.current['operation-hours'] = el)}
                className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
              >
                <StoreOperationHours storeId={storeId} conceptId={conceptId} viewLevel="store" />
              </div>

              {storeId && (
                <div
                  id="daypart-definitions"
                  ref={(el) => (sectionRefs.current['daypart-definitions'] = el)}
                  className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
                >
                  <StoreDaypartDefinitions storeId={storeId} />
                </div>
              )}

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
                          {storeId ? 'Update Store' : 'Create Store'}
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
