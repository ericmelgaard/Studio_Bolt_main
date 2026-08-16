import { useState, useEffect } from 'react';
import { X, Database, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import QuLocationPicker from './QuLocationPicker';
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
  priority: number;
}

interface IntegrationSourceConfig {
  id: string;
  config_name: string;
  wand_source_id: string;
  application_level: 'concept' | 'company' | 'site';
  concept_id: number | null;
  company_id: number | null;
  site_id: number | null;
  config_params: Record<string, any>;
  credentials: Record<string, any>;
  sync_frequency_minutes: number | null;
  sync_schedule: string | null;
  is_active: boolean;
  priority: number | null;
  wand_integration_sources?: WandIntegrationSource;
}

interface EditWandIntegrationModalProps {
  configId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditWandIntegrationModal({ configId, onClose, onSuccess }: EditWandIntegrationModalProps) {
  const [config, setConfig] = useState<IntegrationSourceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [configForm, setConfigForm] = useState<{
    configName: string;
    configParams: Record<string, string>;
    credentials: Record<string, string>;
    syncFrequency: number;
    syncSchedule: string;
    priority: number | null;
  }>({
    configName: '',
    configParams: {},
    credentials: {},
    syncFrequency: 15,
    syncSchedule: 'Manual',
    priority: null
  });

  const [showQuLocationPicker, setShowQuLocationPicker] = useState(false);
  const [locationDetails, setLocationDetails] = useState<Record<string, any>>({});

  const { brands: inheritedBrands, isInherited, conceptName } = useBrandOptions({ configId });
  const inheritedBrand = inheritedBrands.length > 0 ? inheritedBrands[0] : '';
  const inheritedFrom = conceptName;

  useEffect(() => {
    loadConfig();
  }, [configId]);

  useEffect(() => {
    if (config?.wand_integration_sources?.integration_type === 'qu' && configForm.configParams.establishment) {
      loadLocationDetails(configForm.configParams.establishment);
    }
  }, [config?.wand_integration_sources?.integration_type, configForm.configParams.establishment]);

  const loadConfig = async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('integration_source_configs')
      .select(`
        *,
        wand_integration_sources (*)
      `)
      .eq('id', configId)
      .single();

    if (loadError) {
      setError('Failed to load configuration');
      console.error(loadError);
    } else if (data) {
      setConfig(data);
      setConfigForm({
        configName: data.config_name,
        configParams: data.config_params || {},
        credentials: data.credentials || {},
        syncFrequency: data.sync_frequency_minutes || 15,
        syncSchedule: data.sync_schedule || 'Manual',
        priority: data.priority ?? null
      });
    }
    setLoading(false);
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

  const loadLocationDetails = async (locationId: string) => {
    try {
      const { data, error } = await supabase
        .from('qu_locations')
        .select('*')
        .eq('id', parseInt(locationId))
        .maybeSingle();

      if (data && !error) {
        setLocationDetails(prev => ({ ...prev, [locationId]: data }));
      }
    } catch (err) {
      console.error('Error loading location details:', err);
    }
  };

  const handleQuLocationSelect = (locationId: number) => {
    handleConfigChange('establishment', locationId.toString());
    setShowQuLocationPicker(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    setError('');
    setSaving(true);

    const brand = configForm.configParams.brand?.trim() || inheritedBrand;
    const establishment = configForm.configParams.establishment?.trim();

    // Determine if config should be active based on required fields
    let shouldBeActive = config.is_active;
    let missingFields: string[] = [];

    // Check which required fields are missing
    if (!brand) {
      missingFields.push('brand');
    }
    if (!establishment) {
      missingFields.push('establishment');
    }

    // If any required fields are missing, force inactive
    if (missingFields.length > 0) {
      shouldBeActive = false;
    }

    const { error: saveError } = await supabase
      .from('integration_source_configs')
      .update({
        config_name: configForm.configName,
        config_params: configForm.configParams,
        credentials: configForm.credentials,
        sync_frequency_minutes: configForm.syncFrequency,
        sync_schedule: configForm.syncSchedule,
        is_active: shouldBeActive,
        priority: configForm.priority,
        updated_at: new Date().toISOString()
      })
      .eq('id', configId);

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
    } else {
      if (missingFields.length > 0 && config.is_active) {
        alert(`Configuration saved. Note: Configuration has been marked as inactive because the following fields are missing:\n${missingFields.join(', ')}`);
      }
      onSuccess();
    }
  };

  const source = config?.wand_integration_sources;
  const currentBrand = configForm.configParams.brand?.trim() || '';
  const displayBrand = currentBrand || inheritedBrand;

  return (
    <>
      {showQuLocationPicker && displayBrand && (
        <QuLocationPicker
          brand={displayBrand}
          onSelect={handleQuLocationSelect}
          onClose={() => setShowQuLocationPicker(false)}
        />
      )}
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Edit Configuration</h2>
            {source && (
              <p className="text-sm text-slate-600 mt-1">{source.name}</p>
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

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-slate-600">Loading configuration...</p>
            </div>
          ) : config && source ? (
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

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-1">Read-Only Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Integration Type:</span>
                    <span className="ml-2 font-mono text-slate-900">{source.integration_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Application Level:</span>
                    <span className="ml-2 font-medium text-slate-900">{config.application_level.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              {source.required_config_fields.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Required Configuration Fields</h3>
                  <p className="text-sm text-blue-800 mb-3">
                    {config.application_level === 'concept'
                      ? 'Concept-level configs populate the product catalog for all child locations. Enter brand and establishment to activate and sync products.'
                      : 'Brand inherits from parent configs. Establishment is location-specific. Both are required to activate the configuration.'}
                  </p>
                  <div className="space-y-3">
                    {source.required_config_fields.map(field => {
                      // Special handling for brand field
                      if (field === 'brand') {
                        return (
                          <div key={field}>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              {field}
                              {isInherited && !currentBrand && displayBrand && (
                                <span className="ml-2 text-xs text-blue-600 font-normal">
                                  (inherited from {inheritedFrom})
                                </span>
                              )}
                            </label>
                            <input
                              type="text"
                              value={currentBrand}
                              onChange={(e) => handleConfigChange(field, e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder={displayBrand ? `Leave empty to use: ${displayBrand}` : `Enter ${field}`}
                            />
                            {isInherited && !currentBrand && displayBrand && (
                              <p className="mt-1 text-xs text-slate-500">
                                Using inherited brand. Enter a value to override.
                              </p>
                            )}
                          </div>
                        );
                      }

                      // Regular field rendering
                      return (
                        <div key={field}>
                          <label className="block text-sm font-medium text-slate-700 mb-1">{field}</label>
                          <div className="relative">
                            <input
                              type="text"
                              required={config.application_level !== 'concept'}
                              value={configForm.configParams[field] || ''}
                              onChange={(e) => handleConfigChange(field, e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder={`Enter ${field}`}
                            />
                            {source.integration_type === 'qu' && field === 'establishment' && (
                              <button
                                type="button"
                                onClick={() => setShowQuLocationPicker(true)}
                                disabled={!displayBrand}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title={!displayBrand ? 'Enter or inherit brand first' : 'Browse locations from Qu API'}
                              >
                                <MapPin className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                          {source.integration_type === 'qu' && field === 'establishment' && configForm.configParams[field] && locationDetails[configForm.configParams[field]] && (
                            <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-sm">
                              <div className="font-medium text-slate-700">
                                {locationDetails[configForm.configParams[field]].name}
                              </div>
                              <div className="text-slate-600 text-xs mt-1">
                                {locationDetails[configForm.configParams[field]].city}, {locationDetails[configForm.configParams[field]].state_code}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {source.optional_config_fields.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 mb-2">Optional Configuration Fields</h3>
                  <div className="space-y-3">
                    {source.optional_config_fields.map(field => (
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

              {source.auth_method !== 'none' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-900 mb-2">Authentication</h3>
                  <p className="text-sm text-amber-800 mb-3">This integration requires: {source.auth_method}</p>
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
                      <p className="text-xs text-amber-700 mt-1">Leave empty to keep existing credentials</p>
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

              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-indigo-900">Data Priority</h3>
                  <span className="text-xs text-indigo-600">
                    Template default: {source.priority}
                  </span>
                </div>
                <p className="text-sm text-indigo-800 mb-3">
                  When multiple integrations are active, lower priority numbers win. If a higher-priority source maps an attribute (like name or price), it overrides lower-priority sources for that attribute.
                </p>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Priority override</label>
                  <input
                    type="number"
                    min="1"
                    value={configForm.priority ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setConfigForm({ ...configForm, priority: val === '' ? null : parseInt(val) });
                    }}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder={String(source.priority)}
                  />
                  {configForm.priority !== null && (
                    <button
                      type="button"
                      onClick={() => setConfigForm({ ...configForm, priority: null })}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Reset to template default
                    </button>
                  )}
                  {configForm.priority === null && (
                    <span className="text-xs text-slate-500">Using template default ({source.priority})</span>
                  )}
                </div>
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
                  {saving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
              <p className="text-slate-600">Failed to load configuration</p>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
