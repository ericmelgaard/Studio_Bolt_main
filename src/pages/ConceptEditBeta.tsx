import { useState, useEffect, FormEvent, useRef } from 'react';
import { Save, AlertCircle, Info, Palette, Image, Copy, Check, Trash2, Building2, UtensilsCrossed } from 'lucide-react';
import * as Icons from 'lucide-react';
import { supabase } from '../lib/supabase';
import Breadcrumb from '../components/Breadcrumb';
import IconPicker from '../components/IconPicker';
import ColorPicker from '../components/ColorPicker';
import BrandMenuManagement from './BrandMenuManagement';

interface ConceptData {
  id?: number;
  name: string;
  description?: string;
  icon?: string;
  brand_primary_color?: string;
  brand_secondary_color?: string;
  brand_type?: string;
  scheduling_mode?: string;
}

interface ConceptEditBetaProps {
  conceptId?: number;
  conceptName?: string;
  onBack: () => void;
  onSave: (concept: ConceptData) => void;
  onDelete?: () => void;
}

export default function ConceptEditBeta({ conceptId, conceptName, onBack, onSave, onDelete }: ConceptEditBetaProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ConceptData>({
    name: '',
    description: '',
    icon: undefined,
    brand_primary_color: undefined,
    brand_secondary_color: undefined,
    brand_type: 'enterprise',
    scheduling_mode: 'cycle'
  });

  const [showIconPicker, setShowIconPicker] = useState(false);
  const [activeSection, setActiveSection] = useState('basic-info');
  const [idCopied, setIdCopied] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showMenuManagement, setShowMenuManagement] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const originalDataRef = useRef<ConceptData | null>(null);

  useEffect(() => {
    loadData();
  }, [conceptId]);

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
  }, [conceptId]);

  const checkIfDirty = () => {
    if (!originalDataRef.current) {
      return conceptId ? false : true;
    }

    return JSON.stringify(formData) !== JSON.stringify(originalDataRef.current);
  };

  useEffect(() => {
    setIsDirty(checkIfDirty());
  }, [formData]);

  const loadData = async () => {
    setLoading(true);

    if (conceptId) {
      const { data, error: fetchError } = await supabase
        .from('concepts')
        .select('*')
        .eq('id', conceptId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error loading concept:', fetchError);
        setError('Failed to load concept');
      } else if (data) {
        const loadedFormData = {
          id: data.id,
          name: data.name || '',
          description: data.description || '',
          icon: data.icon || undefined,
          brand_primary_color: data.brand_primary_color || undefined,
          brand_secondary_color: data.brand_secondary_color || undefined,
          brand_type: data.brand_type || 'enterprise',
          scheduling_mode: data.scheduling_mode || 'cycle'
        };
        setFormData(loadedFormData);
        originalDataRef.current = loadedFormData;
      }
    } else {
      originalDataRef.current = { ...formData };
    }

    setLoading(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Concept name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const conceptData = {
        name: formData.name,
        description: formData.description || null,
        icon: formData.icon || null,
        brand_primary_color: formData.brand_primary_color || null,
        brand_secondary_color: formData.brand_secondary_color || null,
        brand_type: formData.brand_type || 'enterprise',
        scheduling_mode: formData.scheduling_mode || 'cycle'
      };

      if (conceptId) {
        const { error: updateError } = await supabase
          .from('concepts')
          .update(conceptData)
          .eq('id', conceptId);

        if (updateError) throw updateError;
      } else {
        const { data: newConcept, error: insertError } = await supabase
          .from('concepts')
          .insert([conceptData])
          .select()
          .single();

        if (insertError) throw insertError;
        formData.id = newConcept.id;
      }

      originalDataRef.current = { ...formData };
      setIsDirty(false);
      onSave(formData);
    } catch (err: any) {
      setError(err.message || 'Failed to save concept');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!conceptId) return;

    setSaving(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('concepts')
        .delete()
        .eq('id', conceptId);

      if (deleteError) throw deleteError;

      if (onDelete) {
        onDelete();
      } else {
        onBack();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete concept');
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showExitConfirm && !showDeleteConfirm && !showIconPicker) {
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, showExitConfirm, showDeleteConfirm, showIconPicker]);

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
    if (conceptId) {
      try {
        await navigator.clipboard.writeText(conceptId.toString());
        setIdCopied(true);
        setTimeout(() => setIdCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const renderIcon = () => {
    if (!formData.icon) return <Icons.Building2 size={24} />;
    const IconComponent = Icons[formData.icon as keyof typeof Icons] as any;
    return IconComponent ? <IconComponent size={24} /> : <Icons.Building2 size={24} />;
  };

  const getSections = () => {
    return [
      { id: 'basic-info', label: 'Basic Information', icon: Info },
      { id: 'brand-settings', label: 'Brand Settings', icon: Info },
      { id: 'visual-identity', label: 'Visual Identity', icon: Image },
      { id: 'brand-colors', label: 'Brand Colors', icon: Palette }
    ];
  };

  const getBreadcrumbItems = () => {
    const items = [
      { label: 'Location Manager (Beta)', onClick: onBack }
    ];

    if (conceptId) {
      items.push({ label: 'Edit Concept' });
    } else {
      items.push({ label: 'Create Concept' });
    }

    return items;
  };

  if (loading && conceptId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (showMenuManagement && conceptId) {
    return (
      <BrandMenuManagement
        brandId={conceptId}
        brandName={formData.name || conceptName || 'Brand'}
        onBack={() => setShowMenuManagement(false)}
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
                    Delete Concept
                  </h3>
                  <p className="text-slate-600 text-sm">
                    Are you sure you want to delete this concept? This will affect all related companies and stores. This action cannot be undone.
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
                {saving ? 'Deleting...' : 'Delete Concept'}
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
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">
                    {conceptId ? (conceptName || 'Edit Concept') : 'Create Concept'}
                  </h1>
                  <Breadcrumb items={getBreadcrumbItems()} />
                </div>
              </div>
              {conceptId && (
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
                      <span>ID: {conceptId}</span>
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
                      Concept Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter concept name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter concept description"
                    />
                  </div>
                </div>
              </div>

              <div
                id="brand-settings"
                ref={(el) => (sectionRefs.current['brand-settings'] = el)}
                className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
              >
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Brand Settings</h2>
                {conceptId && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-blue-900">Menus</h4>
                        <p className="text-xs text-blue-700 mt-0.5">Manage daypart menus, zones, and items for this brand</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowMenuManagement(true)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        Manage Menus
                      </button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Brand Type</label>
                    <select
                      value={formData.brand_type || 'enterprise'}
                      onChange={(e) => setFormData({ ...formData, brand_type: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="enterprise">Enterprise (shared across all locations)</option>
                      <option value="localized">Localized (custom per-location)</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Enterprise brands share menus org-wide. Localized brands create unique menus per site.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Scheduling Mode</label>
                    <select
                      value={formData.scheduling_mode || 'cycle'}
                      onChange={(e) => setFormData({ ...formData, scheduling_mode: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="cycle">Cycle (rotates through the location's cycle weeks)</option>
                      <option value="static">Static (same every day, like a franchise brand)</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Cycle brands rotate per the location's multi-week schedule. Static brands show the same brand every day.</p>
                  </div>
                </div>
              </div>

              <div
                id="visual-identity"
                ref={(el) => (sectionRefs.current['visual-identity'] = el)}
                className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Image className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Visual Identity</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Icon
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowIconPicker(true)}
                      className="flex items-center gap-3 px-4 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors w-full"
                    >
                      <div className="text-slate-700">
                        {renderIcon()}
                      </div>
                      <span className="text-slate-700">
                        {formData.icon || 'Select an icon'}
                      </span>
                    </button>
                    <p className="mt-2 text-xs text-slate-500">
                      Choose an icon to represent this concept
                    </p>
                  </div>
                </div>
              </div>

              <div
                id="brand-colors"
                ref={(el) => (sectionRefs.current['brand-colors'] = el)}
                className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm scroll-mt-20"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Brand Colors</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ColorPicker
                      label="Primary Brand Color"
                      value={formData.brand_primary_color || null}
                      onChange={(value) => setFormData({ ...formData, brand_primary_color: value || undefined })}
                    />
                    <ColorPicker
                      label="Secondary Brand Color"
                      value={formData.brand_secondary_color || null}
                      onChange={(value) => setFormData({ ...formData, brand_secondary_color: value || undefined })}
                    />
                  </div>

                  {(formData.brand_primary_color || formData.brand_secondary_color) && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-slate-700 mb-3">Brand Color Preview</h4>
                      <div className="flex gap-3">
                        {formData.brand_primary_color && (
                          <div className="flex-1">
                            <div
                              className="h-16 rounded-lg border border-slate-300 shadow-sm"
                              style={{ backgroundColor: formData.brand_primary_color }}
                            />
                            <p className="text-xs text-slate-600 mt-2 text-center font-medium">Primary</p>
                            <p className="text-xs text-slate-500 mt-1 text-center font-mono">{formData.brand_primary_color}</p>
                          </div>
                        )}
                        {formData.brand_secondary_color && (
                          <div className="flex-1">
                            <div
                              className="h-16 rounded-lg border border-slate-300 shadow-sm"
                              style={{ backgroundColor: formData.brand_secondary_color }}
                            />
                            <p className="text-xs text-slate-600 mt-2 text-center font-medium">Secondary</p>
                            <p className="text-xs text-slate-500 mt-1 text-center font-mono">{formData.brand_secondary_color}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {conceptId && (
                <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Danger Zone</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Delete this concept and all associated data. This action cannot be undone.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium"
                  >
                    <Trash2 size={18} />
                    Delete Concept
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
                          {conceptId ? 'Update Concept' : 'Create Concept'}
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

      {showIconPicker && (
        <IconPicker
          selectedIcon={formData.icon || null}
          onChange={(icon) => setFormData({ ...formData, icon: icon || undefined })}
          onClose={() => setShowIconPicker(false)}
        />
      )}
    </>
  );
}
