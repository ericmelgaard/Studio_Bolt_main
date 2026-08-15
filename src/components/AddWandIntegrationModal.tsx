import { useState, useEffect } from 'react';
import { X, Database, AlertCircle, ChevronRight, Sparkles, Wrench, FileSpreadsheet, FileJson, Server, Tag, Plus, Lock, Unlock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBrandOptions } from '../hooks/useBrandOptions';

interface WandIntegrationSource {
  id: string;
  name: string;
  integration_type: string;
  description: string;
  base_url_template: string;
  auth_method: string;
  required_config_fields: string[];
  optional_config_fields: string[];
  default_sync_frequency_minutes: number;
  formatter_name: string;
  supports_products: boolean;
  supports_modifiers: boolean;
  supports_discounts: boolean;
  status: string;
}

interface AddWandIntegrationModalProps {
  onClose: () => void;
  onSuccess: () => void;
  conceptId?: number;
  companyId?: number;
  storeId?: number;
}

export default function AddWandIntegrationModal({ onClose, onSuccess, conceptId, companyId, storeId }: AddWandIntegrationModalProps) {
  const [step, setStep] = useState<'choice' | 'wand-select' | 'wand-configure' | 'custom'>('choice');
  const [wandSources, setWandSources] = useState<WandIntegrationSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<WandIntegrationSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [customType, setCustomType] = useState<'api' | 'spreadsheet' | 'json' | 'ftp'>('api');

  const [configForm, setConfigForm] = useState<{
    configName: string;
    configParams: Record<string, string>;
    credentials: Record<string, string>;
    syncFrequency: number;
    syncSchedule: string;
    selectedBrand: string;
    localBrandOptions: string[];
    isBrandInherited: boolean;
    brandLocked: boolean;
  }>({
    configName: '',
    configParams: {},
    credentials: {},
    syncFrequency: 15,
    syncSchedule: 'Manual',
    selectedBrand: '',
    localBrandOptions: [],
    isBrandInherited: true,
    brandLocked: false
  });

  const [showBrandOverride, setShowBrandOverride] = useState(false);
  const [newLocalBrand, setNewLocalBrand] = useState('');

  const brandOptions = useBrandOptions({ conceptId, companyId, siteId: storeId });

  useEffect(() => {
    loadWandSources();
  }, []);

  const loadWandSources = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('wand_integration_sources')
      .select('*')
      .eq('status', 'active')
      .order('name');

    if (error) {
      setError('Failed to load integration sources');
      console.error(error);
    } else if (data) {
      setWandSources(data);
    }
    setLoading(false);
  };

  const handleSelectSource = (source: WandIntegrationSource) => {
    setSelectedSource(source);
    setConfigForm({
      configName: `${source.name} Configuration`,
      configParams: {},
      credentials: {},
      syncFrequency: source.default_sync_frequency_minutes,
      syncSchedule: 'Manual',
      selectedBrand: '',
      localBrandOptions: [],
      isBrandInherited: true,
      brandLocked: false
    });
    setStep('wand-configure');
  };

  const handleConfigChange = (field: string, value: string) => {
    setConfigForm(prev => ({
      ...prev,
      configParams: {
        ...prev.configParams,
        [field]: value
      }
    }));
  };

  const handleCredentialChange = (field: string, value: string) => {
    setConfigForm(prev => ({
      ...prev,
      credentials: {
        ...prev.credentials,
        [field]: value
      }
    }));
  };

  const handleAddLocalBrand = () => {
    const trimmed = newLocalBrand.trim();
    if (trimmed && !configForm.localBrandOptions.includes(trimmed)) {
      setConfigForm(prev => ({
        ...prev,
        localBrandOptions: [...prev.localBrandOptions, trimmed]
      }));
      setNewLocalBrand('');
    }
  };

  const handleRemoveLocalBrand = (brand: string) => {
    setConfigForm(prev => ({
      ...prev,
      localBrandOptions: prev.localBrandOptions.filter(b => b !== brand)
    }));
  };

  const handleToggleBrandOverride = () => {
    if (showBrandOverride) {
      setConfigForm(prev => ({
        ...prev,
        localBrandOptions: [],
        isBrandInherited: true
      }));
    } else {
      setConfigForm(prev => ({
        ...prev,
        isBrandInherited: false
      }));
    }
    setShowBrandOverride(!showBrandOverride);
  };

  const handleToggleBrandLock = () => {
    setConfigForm(prev => ({
      ...prev,
      brandLocked: !prev.brandLocked
    }));
  };

  // Determine application level based on props
  const getApplicationLevel = (): 'concept' | 'company' | 'site' => {
    if (conceptId && !companyId && !storeId) return 'concept';
    if (companyId && !storeId) return 'company';
    return 'site';
  };

  const applicationLevel = getApplicationLevel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSource) return;

    setError('');
    setSaving(true);

    // Prepare config_params with brand field
    const updatedConfigParams = { ...configForm.configParams };
    if (configForm.selectedBrand) {
      updatedConfigParams.brand = configForm.selectedBrand;
    }

    const { error: saveError } = await supabase
      .from('integration_source_configs')
      .insert({
        wand_source_id: selectedSource.id,
        config_name: configForm.configName,
        application_level: applicationLevel,
        concept_id: conceptId || null,
        company_id: companyId || null,
        site_id: storeId || null,
        config_params: updatedConfigParams,
        credentials: configForm.credentials,
        sync_frequency_minutes: configForm.syncFrequency,
        sync_schedule: configForm.syncSchedule,
        brand_options: configForm.localBrandOptions.length > 0 ? configForm.localBrandOptions : null,
        is_brand_inherited: configForm.isBrandInherited,
        brand_locked: configForm.brandLocked,
        is_active: false
      });

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
    } else {
      onSuccess();
    }
  };

  const filteredSources = wandSources.filter(source =>
    source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    source.integration_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    source.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTitle = () => {
    switch (step) {
      case 'choice': return 'Add Integration Source';
      case 'wand-select': return 'Select Preset Integration';
      case 'wand-configure': return `Configure ${selectedSource?.name}`;
      case 'custom': return 'Create Custom Integration';
      default: return 'Add Integration Source';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{getTitle()}</h2>
            {step !== 'choice' && (
              <button
                onClick={() => {
                  if (step === 'wand-configure') setStep('wand-select');
                  else setStep('choice');
                }}
                className="text-sm text-blue-600 hover:text-blue-700 mt-1"
              >
                ← Back
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {step === 'choice' && (
            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => setStep('wand-select')}
                className="p-8 border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <Sparkles className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Preset Integration</h3>
                    <p className="text-sm text-slate-500">Pre-configured sources</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-3">
                  Choose from 12 pre-built integrations like Toast POS, Qu, Revel, and more.
                  Ready to use with minimal configuration.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                  Browse integrations
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>

              <button
                onClick={() => setStep('custom')}
                className="p-8 border-2 border-slate-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group text-left"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                    <Wrench className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Custom Integration</h3>
                    <p className="text-sm text-slate-500">Build your own</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-3">
                  Create a custom integration from scratch. Supports REST API, FTP, spreadsheets,
                  and JSON files.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                  Create custom
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          )}

          {step === 'wand-select' && (
            <>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search integration sources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredSources.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg">
                  <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">No integration sources found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto">
                  {filteredSources.map(source => (
                    <button
                      key={source.id}
                      onClick={() => handleSelectSource(source)}
                      className="text-left p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Database className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900">{source.name}</h3>
                            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {source.integration_type}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{source.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'wand-configure' && selectedSource && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Configuration Name</label>
                <input
                  type="text"
                  required
                  value={configForm.configName}
                  onChange={(e) => setConfigForm({ ...configForm, configName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Toast POS - Main Location"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Required Configuration Fields</h3>
                <p className="text-sm text-blue-800 mb-3">
                  {applicationLevel === 'concept'
                    ? 'For concept-level: Leave fields empty to indicate source availability only. API values should be set at site level.'
                    : 'Enter API configuration values specific to this location. These values will NOT be inherited by child locations.'}
                </p>
                <div className="space-y-3">
                  {selectedSource.required_config_fields.map(field => {
                    // Special handling for brand field
                    if (field === 'brand' && applicationLevel !== 'concept') {
                      const activeBrands = showBrandOverride ? configForm.localBrandOptions : brandOptions.brands;
                      return (
                        <div key={field}>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {field}
                              <span className="text-red-600 ml-1">*</span>
                              {brandOptions.isInherited && !showBrandOverride && (
                                <span className="ml-2 text-xs text-blue-600 font-normal">
                                  (from {brandOptions.conceptName})
                                </span>
                              )}
                              {showBrandOverride && (
                                <span className="ml-2 text-xs text-green-600 font-normal">
                                  (local override)
                                </span>
                              )}
                            </label>
                            <div className="flex items-center gap-2">
                              {configForm.brandLocked ? (
                                <button
                                  type="button"
                                  onClick={handleToggleBrandLock}
                                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                                >
                                  <Lock size={14} />
                                  Locked
                                </button>
                              ) : (
                                <>
                                  {brandOptions.canOverride && !showBrandOverride && (
                                    <button
                                      type="button"
                                      onClick={handleToggleBrandOverride}
                                      className="text-xs text-blue-600 hover:text-blue-700"
                                    >
                                      Override
                                    </button>
                                  )}
                                  {showBrandOverride && (
                                    <button
                                      type="button"
                                      onClick={handleToggleBrandOverride}
                                      className="text-xs text-slate-600 hover:text-slate-700"
                                    >
                                      Use inherited
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={handleToggleBrandLock}
                                    className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-700"
                                  >
                                    <Unlock size={14} />
                                    Lock
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {showBrandOverride ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={newLocalBrand}
                                  onChange={(e) => setNewLocalBrand(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLocalBrand())}
                                  disabled={configForm.brandLocked}
                                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                                  placeholder="Add brand option"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddLocalBrand}
                                  disabled={!newLocalBrand.trim() || configForm.brandLocked}
                                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                  <Plus size={18} />
                                </button>
                              </div>
                              {configForm.localBrandOptions.length > 0 && (
                                <div className="flex flex-wrap gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                                  {configForm.localBrandOptions.map(brand => (
                                    <div key={brand} className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-sm">
                                      <Tag size={12} className="text-blue-600" />
                                      <span>{brand}</span>
                                      {!configForm.brandLocked && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveLocalBrand(brand)}
                                          className="text-slate-400 hover:text-red-600 ml-1"
                                        >
                                          <X size={12} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <select
                                value={configForm.selectedBrand}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, selectedBrand: e.target.value }))}
                                disabled={configForm.brandLocked || configForm.localBrandOptions.length === 0}
                                required
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                              >
                                <option value="">Select brand...</option>
                                {configForm.localBrandOptions.map(brand => (
                                  <option key={brand} value={brand}>{brand}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <select
                              value={configForm.selectedBrand}
                              onChange={(e) => setConfigForm(prev => ({ ...prev, selectedBrand: e.target.value }))}
                              disabled={configForm.brandLocked || activeBrands.length === 0}
                              required
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                            >
                              <option value="">
                                {activeBrands.length === 0 ? 'No brands configured in concept' : 'Select brand...'}
                              </option>
                              {activeBrands.map(brand => (
                                <option key={brand} value={brand}>{brand}</option>
                              ))}
                            </select>
                          )}

                          {activeBrands.length === 0 && !showBrandOverride && (
                            <p className="mt-1 text-xs text-amber-600">
                              No brands configured at concept level. Use override to add local brands.
                            </p>
                          )}
                        </div>
                      );
                    }

                    // Regular field rendering
                    return (
                      <div key={field}>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          {field}
                          {applicationLevel !== 'concept' && <span className="text-red-600 ml-1">*</span>}
                        </label>
                        <input
                          type="text"
                          required={applicationLevel !== 'concept'}
                          value={configForm.configParams[field] || ''}
                          onChange={(e) => handleConfigChange(field, e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={applicationLevel === 'concept' ? `Leave empty for concept level` : `Enter ${field}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedSource.optional_config_fields.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 mb-2">Optional Configuration Fields</h3>
                  <div className="space-y-3">
                    {selectedSource.optional_config_fields.map(field => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{field}</label>
                        <input
                          type="text"
                          value={configForm.configParams[field] || ''}
                          onChange={(e) => handleConfigChange(field, e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={`Enter ${field} (optional)`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedSource.auth_method !== 'none' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-900 mb-2">Authentication</h3>
                  <p className="text-sm text-amber-800 mb-3">This integration requires: {selectedSource.auth_method}</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">API Key / Token</label>
                      <input
                        type="password"
                        value={configForm.credentials.api_key || ''}
                        onChange={(e) => handleCredentialChange('api_key', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter API key or authentication token"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Sync Frequency (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={configForm.syncFrequency}
                    onChange={(e) => setConfigForm({ ...configForm, syncFrequency: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Schedule</label>
                  <select
                    value={configForm.syncSchedule}
                    onChange={(e) => setConfigForm({ ...configForm, syncSchedule: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Manual">Manual</option>
                    <option value="Business hours only">Business hours only</option>
                    <option value="24/7">24/7</option>
                    <option value="Weekdays only">Weekdays only</option>
                    <option value="Weekends only">Weekends only</option>
                    <option value="Night hours only">Night hours only</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-sm text-slate-600 mb-2">
                  <strong>Two-Tier Inheritance Model:</strong>
                </p>
                <ul className="text-sm text-slate-600 list-disc list-inside space-y-1 ml-2">
                  <li><strong>Source Availability:</strong> Concept-level configs indicate which integration sources are available to all child locations</li>
                  <li><strong>API Configuration:</strong> Site/company-level configs contain actual API values (credentials, establishment IDs) that are NOT inherited</li>
                  {applicationLevel === 'concept' && (
                    <li className="text-blue-700"><strong>Concept Level:</strong> Leave API fields empty - they will be configured at each site</li>
                  )}
                  {applicationLevel !== 'concept' && (
                    <li className="text-blue-700"><strong>{applicationLevel === 'site' ? 'Site' : 'Company'} Level:</strong> API values you enter are unique to this location and won't be inherited by child locations</li>
                  )}
                </ul>
                <p className="text-sm text-slate-600 mt-2">
                  <strong>Note:</strong> This configuration will be created as inactive. Activate it when ready to sync.
                </p>
              </div>

              <div className="border-t border-slate-200 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creating Configuration...' : 'Create Configuration'}
                </button>
              </div>
            </form>
          )}

          {step === 'custom' && (
            <div className="space-y-6">
              {/* Source Type Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Source Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setCustomType('api')}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      customType === 'api'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Database className={`w-6 h-6 mb-2 mx-auto ${customType === 'api' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div className={`font-medium ${customType === 'api' ? 'text-blue-900' : 'text-slate-700'}`}>
                      REST API
                    </div>
                  </button>
                  <button
                    onClick={() => setCustomType('spreadsheet')}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      customType === 'spreadsheet'
                        ? 'border-green-500 bg-green-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <FileSpreadsheet className={`w-6 h-6 mb-2 mx-auto ${customType === 'spreadsheet' ? 'text-green-600' : 'text-slate-400'}`} />
                    <div className={`font-medium ${customType === 'spreadsheet' ? 'text-green-900' : 'text-slate-700'}`}>
                      Spreadsheet
                    </div>
                  </button>
                  <button
                    onClick={() => setCustomType('json')}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      customType === 'json'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <FileJson className={`w-6 h-6 mb-2 mx-auto ${customType === 'json' ? 'text-purple-600' : 'text-slate-400'}`} />
                    <div className={`font-medium ${customType === 'json' ? 'text-purple-900' : 'text-slate-700'}`}>
                      JSON File
                    </div>
                  </button>
                  <button
                    onClick={() => setCustomType('ftp')}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      customType === 'ftp'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Server className={`w-6 h-6 mb-2 mx-auto ${customType === 'ftp' ? 'text-orange-600' : 'text-slate-400'}`} />
                    <div className={`font-medium ${customType === 'ftp' ? 'text-orange-900' : 'text-slate-700'}`}>
                      FTP Server
                    </div>
                  </button>
                </div>
              </div>

              {/* Configuration based on type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Source Name</label>
                <input
                  type="text"
                  placeholder="e.g., Production POS System"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {customType === 'api' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">API Endpoint</label>
                    <input
                      type="url"
                      placeholder="https://api.example.com/v1"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">API Key</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {customType === 'ftp' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Server Address</label>
                      <input
                        type="text"
                        placeholder="ftp.example.com"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Port</label>
                      <input
                        type="number"
                        placeholder="21"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">File Path</label>
                    <input
                      type="text"
                      placeholder="/data/products.csv"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {(customType === 'spreadsheet' || customType === 'json') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">File Upload</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors cursor-pointer">
                    <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-600">Click to upload or drag and drop</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {customType === 'spreadsheet' ? 'CSV, XLSX, XLS files' : 'JSON files'}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Sync Frequency</label>
                <select className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="realtime">Real-time (Webhooks)</option>
                  <option value="5min">Every 5 minutes</option>
                  <option value="15min">Every 15 minutes</option>
                  <option value="30min">Every 30 minutes</option>
                  <option value="1hour">Every hour</option>
                  <option value="6hours">Every 6 hours</option>
                  <option value="daily">Daily</option>
                  <option value="manual">Manual only</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" className="w-4 h-4 text-blue-600 rounded" defaultChecked />
                <label htmlFor="active" className="text-sm text-slate-700">Activate immediately after creation</label>
              </div>

              <div className="border-t border-slate-200 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStep('choice')}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Create Source
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
