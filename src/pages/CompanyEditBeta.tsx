import { useState, useEffect, FormEvent, useRef } from 'react';
import { Save, AlertCircle, Info, MapPin, Phone, Globe, Plus, GripVertical, Copy, Check, Trash2, Building } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Breadcrumb from '../components/Breadcrumb';
import LanguagePickerModal from '../components/LanguagePickerModal';

interface CompanyData {
  id?: number;
  concept_id: number;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
}

interface CompanyEditBetaProps {
  companyId?: number;
  conceptId: number;
  conceptName?: string;
  companyName?: string;
  onBack: () => void;
  onSave: (company: CompanyData) => void;
  onDelete?: () => void;
}

export default function CompanyEditBeta({ companyId, conceptId, conceptName, companyName, onBack, onSave, onDelete }: CompanyEditBetaProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CompanyData>({
    concept_id: conceptId,
    name: '',
    description: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: ''
  });

  const [languages, setLanguages] = useState<Array<{ id?: string; locale: string; locale_name: string; sort_order: number }>>([]);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [activeSection, setActiveSection] = useState('basic-info');
  const [idCopied, setIdCopied] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const originalDataRef = useRef<{
    formData: typeof formData;
    languages: typeof languages;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [companyId]);

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
  }, [companyId]);

  const checkIfDirty = () => {
    if (!originalDataRef.current) {
      return companyId ? false : true;
    }

    const original = originalDataRef.current;
    const formChanged = JSON.stringify(formData) !== JSON.stringify(original.formData);
    const languagesChanged = JSON.stringify(languages) !== JSON.stringify(original.languages);

    return formChanged || languagesChanged;
  };

  useEffect(() => {
    setIsDirty(checkIfDirty());
  }, [formData, languages]);

  const loadData = async () => {
    setLoading(true);

    if (companyId) {
      const { data, error: fetchError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error loading company:', fetchError);
        setError('Failed to load company');
      } else if (data) {
        const loadedFormData = {
          id: data.id,
          concept_id: data.concept_id,
          name: data.name || '',
          description: data.description || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          zip_code: data.zip_code || '',
          phone: data.phone || '',
          email: data.email || ''
        };
        setFormData(loadedFormData);

        const loadedLanguages = await loadLanguages();

        originalDataRef.current = {
          formData: loadedFormData,
          languages: loadedLanguages
        };
      }
    } else {
      setLanguages([{ locale: 'en', locale_name: 'English', sort_order: 0 }]);
      originalDataRef.current = {
        formData,
        languages: [{ locale: 'en', locale_name: 'English', sort_order: 0 }]
      };
    }

    setLoading(false);
  };

  const loadLanguages = async () => {
    if (!companyId) return [];

    const { data, error } = await supabase
      .from('company_languages')
      .select('*')
      .eq('company_id', companyId)
      .order('sort_order');

    if (error) {
      console.error('Error loading languages:', error);
      return [];
    }

    if (data && data.length > 0) {
      setLanguages(data);
      return data;
    } else {
      const defaultLangs = [{ locale: 'en', locale_name: 'English', sort_order: 0 }];
      setLanguages(defaultLangs);
      return defaultLangs;
    }
  };

  const saveLanguages = async (companyIdToSave: number) => {
    const { error: deleteError } = await supabase
      .from('company_languages')
      .delete()
      .eq('company_id', companyIdToSave);

    if (deleteError) throw deleteError;

    const languageData = languages.map((lang, index) => ({
      company_id: companyIdToSave,
      locale: lang.locale,
      locale_name: lang.locale_name,
      sort_order: index
    }));

    const { error: insertError } = await supabase
      .from('company_languages')
      .insert(languageData);

    if (insertError) throw insertError;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Company name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const companyData = {
        concept_id: conceptId,
        name: formData.name,
        description: formData.description || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        zip_code: formData.zip_code || null,
        phone: formData.phone || null,
        email: formData.email || null
      };

      let companyIdToSave = companyId;

      if (companyId) {
        const { error: updateError } = await supabase
          .from('companies')
          .update(companyData)
          .eq('id', companyId);

        if (updateError) throw updateError;
      } else {
        const { data: newCompany, error: insertError } = await supabase
          .from('companies')
          .insert([companyData])
          .select()
          .single();

        if (insertError) throw insertError;
        companyIdToSave = newCompany.id;
        formData.id = newCompany.id;
      }

      if (companyIdToSave) {
        await saveLanguages(companyIdToSave);
      }

      originalDataRef.current = {
        formData: { ...formData },
        languages: [...languages]
      };
      setIsDirty(false);
      onSave(formData);
    } catch (err: any) {
      setError(err.message || 'Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!companyId) return;

    setSaving(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);

      if (deleteError) throw deleteError;

      if (onDelete) {
        onDelete();
      } else {
        onBack();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete company');
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleBack = () => {
    if (isDirty) {
      setShowExitConfirm(true);
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

  const handleAddLanguages = (newLanguages: { locale: string; locale_name: string }[]) => {
    const updatedLanguages = [...languages];
    newLanguages.forEach(newLang => {
      if (!updatedLanguages.find(l => l.locale === newLang.locale)) {
        updatedLanguages.push({
          locale: newLang.locale,
          locale_name: newLang.locale_name,
          sort_order: updatedLanguages.length
        });
      }
    });
    setLanguages(updatedLanguages);
  };

  const handleRemoveLanguage = (locale: string) => {
    if (locale === 'en') {
      alert('English cannot be removed as it is the default language.');
      return;
    }
    setLanguages(languages.filter(l => l.locale !== locale));
  };

  const moveLanguage = (index: number, direction: 'up' | 'down') => {
    const newLanguages = [...languages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newLanguages.length) return;

    [newLanguages[index], newLanguages[targetIndex]] = [newLanguages[targetIndex], newLanguages[index]];
    setLanguages(newLanguages);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showExitConfirm && !showDeleteConfirm) {
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, showExitConfirm, showDeleteConfirm]);

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

  const copyIdToClipboard = async () => {
    if (companyId) {
      try {
        await navigator.clipboard.writeText(companyId.toString());
        setIdCopied(true);
        setTimeout(() => setIdCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const getSections = () => {
    return [
      { id: 'basic-info', label: 'Basic Information', icon: Info },
      { id: 'contact-info', label: 'Contact Information', icon: Phone },
      { id: 'location-details', label: 'Location Details', icon: MapPin },
      { id: 'brand-subscriptions', label: 'Brand Subscriptions', icon: Building2 },
      { id: 'languages', label: 'Languages', icon: Globe }
    ];
  };

  const getBreadcrumbItems = () => {
    const items = [
      { label: 'Location Manager (Beta)', onClick: onBack }
    ];

    if (conceptName) {
      items.push({ label: conceptName });
    }

    if (companyId) {
      items.push({ label: 'Edit Company' });
    } else {
      items.push({ label: 'Create Company' });
    }

    return items;
  };

  if (loading && companyId) {
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

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    Delete Company
                  </h3>
                  <p className="text-slate-600 text-sm">
                    Are you sure you want to delete this company? This will affect all related stores. This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Delete Company'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[#00adf0] to-[#0099d6] rounded-lg">
                  <Building className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">
                    {companyId ? (companyName || 'Edit Company') : 'Create Company'}
                  </h1>
                  <Breadcrumb items={getBreadcrumbItems()} />
                </div>
              </div>
              {companyId && (
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
                      <span>ID: {companyId}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

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
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter company name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter company description"
                    />
                  </div>
                </div>
              </div>

              <div
                id="contact-info"
                ref={(el) => (sectionRefs.current['contact-info'] = el)}
                className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Phone className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Contact Information</h3>
                </div>
                <div className="space-y-4">
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
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="contact@example.com"
                    />
                  </div>
                </div>
              </div>

              <div
                id="location-details"
                ref={(el) => (sectionRefs.current['location-details'] = el)}
                className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
              >
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Location Details</h3>
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
                        maxLength={2}
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
                </div>
              </div>

              <div
                id="languages"
                ref={(el) => (sectionRefs.current['languages'] = el)}
                className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-slate-900">Languages</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLanguagePicker(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                  >
                    <Plus size={16} />
                    Add Language
                  </button>
                </div>

                <div className="space-y-2">
                  {languages.map((lang, index) => (
                    <div
                      key={lang.locale}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => moveLanguage(index, 'up')}
                            disabled={index === 0}
                            className="text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <GripVertical size={14} />
                          </button>
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{lang.locale_name}</div>
                          <div className="text-xs text-slate-500">{lang.locale}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLanguage(lang.locale)}
                        disabled={lang.locale === 'en'}
                        className={`text-sm px-3 py-1 rounded transition-colors ${
                          lang.locale === 'en'
                            ? 'text-slate-400 cursor-not-allowed'
                            : 'text-red-600 hover:bg-red-50'
                        }`}
                      >
                        {lang.locale === 'en' ? 'Default' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-500 mt-3">
                  {languages.length} language{languages.length !== 1 ? 's' : ''} configured. English is the default language and cannot be removed.
                </p>
              </div>

              {companyId && (
                <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Danger Zone</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Delete this company and all associated data. This action cannot be undone.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium"
                  >
                    <Trash2 size={18} />
                    Delete Company
                  </button>
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
                          {companyId ? 'Update Company' : 'Create Company'}
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

      {showLanguagePicker && (
        <LanguagePickerModal
          existingLanguages={languages.map(l => l.locale)}
          onClose={() => setShowLanguagePicker(false)}
          onAdd={handleAddLanguages}
        />
      )}
    </>
  );
}
