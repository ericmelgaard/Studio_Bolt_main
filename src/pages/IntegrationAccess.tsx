import { useState, useEffect } from 'react';
import { Plus, Database, FileSpreadsheet, FileJson, Server, Calendar, Clock, Zap, Link, CreditCard as Edit2, Trash2, ToggleLeft, ToggleRight, Send, ChevronDown, ChevronRight, MapPin, RefreshCw, Check, AlertCircle, Link2, Upload, History as HistoryIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AddWandIntegrationModal from '../components/AddWandIntegrationModal';
import EditWandIntegrationModal from '../components/EditWandIntegrationModal';
import LocationRequired from '../components/LocationRequired';
import MagicLinkManager from '../components/MagicLinkManager';
import DataUploadModal from '../components/DataUploadModal';
import UploadHistoryPanel from '../components/UploadHistoryPanel';
import { useLocation } from '../hooks/useLocation';

interface IntegrationSourceConfig {
  id: string;
  config_name: string;
  wand_source_id: string;
  application_level: 'concept' | 'company' | 'site';
  concept_id: number | null;
  company_id: number | null;
  site_id: number | null;
  config_params: Record<string, any>;
  sync_frequency_minutes: number | null;
  sync_schedule: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
  wand_integration_sources?: {
    name: string;
    integration_type: string;
    description: string;
    required_config_fields: string[];
  };
}

interface IntegrationDestination {
  id: string;
  name: string;
  type: 'api' | 'webhook' | 'ftp' | 'database';
  status: 'active' | 'inactive';
  syncFrequency: string;
  lastSync: string;
  endpoint?: string;
  schedule?: string;
}


const mockDestinations: IntegrationDestination[] = [
  {
    id: '1',
    name: 'Digital Menu Board System',
    type: 'api',
    status: 'active',
    syncFrequency: 'Real-time',
    lastSync: '30 seconds ago',
    endpoint: 'https://menuboards.example.com/api',
    schedule: 'On product update'
  }
];

const SOURCE_TYPES = [
  { value: 'api', label: 'REST API', icon: Database, color: 'blue' },
  { value: 'spreadsheet', label: 'Spreadsheet', icon: FileSpreadsheet, color: 'green' },
  { value: 'json', label: 'JSON File', icon: FileJson, color: 'purple' },
  { value: 'ftp', label: 'FTP Server', icon: Server, color: 'orange' }
];

const DESTINATION_TYPES = [
  { value: 'api', label: 'REST API', icon: Database, color: 'blue' },
  { value: 'webhook', label: 'Webhook', icon: Zap, color: 'purple' },
  { value: 'ftp', label: 'FTP Server', icon: Server, color: 'orange' },
  { value: 'database', label: 'Database', icon: Database, color: 'green' }
];

const SYNC_FREQUENCIES = [
  { value: 'realtime', label: 'Real-time (Webhooks)' },
  { value: '5min', label: 'Every 5 minutes' },
  { value: '15min', label: 'Every 15 minutes' },
  { value: '30min', label: 'Every 30 minutes' },
  { value: '1hour', label: 'Every hour' },
  { value: '6hours', label: 'Every 6 hours' },
  { value: 'daily', label: 'Daily' },
  { value: 'manual', label: 'Manual only' }
];

export default function IntegrationAccess() {
  const { location } = useLocation();
  const [sourceConfigs, setSourceConfigs] = useState<IntegrationSourceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [destinations] = useState<IntegrationDestination[]>(mockDestinations);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [showAddDestinationModal, setShowAddDestinationModal] = useState(false);
  const [expandedDestinations, setExpandedDestinations] = useState<Record<string, boolean>>({});
  const [syncingConfigs, setSyncingConfigs] = useState<Set<string>>(new Set());
  const [locationDetails, setLocationDetails] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<Record<string, 'magic-link' | 'upload-history'>>({});
  const [showUploadModal, setShowUploadModal] = useState<string | null>(null);

  const hasLocation = location.concept || location.company || location.store;

  useEffect(() => {
    loadSourceConfigs();
  }, [location]);

  useEffect(() => {
    // Load location details for all Qu configs
    sourceConfigs.forEach(config => {
      if (config.wand_integration_sources?.integration_type === 'qu' && config.config_params?.establishment) {
        loadLocationDetails(config.config_params.establishment);
      }
    });
  }, [sourceConfigs]);

  const loadSourceConfigs = async () => {
    setLoading(true);

    // Load all configs to show both concept-level (available) and site-level (configured)
    const { data } = await supabase
      .from('integration_source_configs')
      .select(`
        *,
        wand_integration_sources (
          name,
          integration_type,
          description,
          required_config_fields
        )
      `)
      .order('config_name');

    if (data) {
      // Filter to show:
      // 1. Concept-level configs for current concept (shows availability)
      // 2. Site-level configs for current site (shows full configuration)
      const filteredConfigs = data.filter(config => {
        if (config.application_level === 'concept' && location.concept) {
          return config.concept_id === location.concept.id;
        }
        if (config.application_level === 'site' && location.store) {
          return config.site_id === location.store.id;
        }
        if (config.application_level === 'company' && location.company) {
          return config.company_id === location.company.id;
        }
        return false;
      });

      setSourceConfigs(filteredConfigs);
    }
    setLoading(false);
  };

  const loadLocationDetails = async (locationId: string) => {
    if (locationDetails[locationId]) return; // Already loaded

    try {
      const { data, error } = await supabase
        .from('qu_locations')
        .select('*')
        .eq('id', parseInt(locationId))
        .maybeSingle();

      if (data && !error) {
        setLocationDetails(prev => ({ ...prev, [locationId]: data }));
      } else if (error) {
        console.error('Error loading location details:', error);
      } else {
        // Location not found in database, fetch from API
        fetchLocationFromApi(locationId);
      }
    } catch (err) {
      console.error('Error loading location details:', err);
    }
  };

  const fetchLocationFromApi = async (locationId: string) => {
    // Find the config with this location to get the brand
    const config = sourceConfigs.find(c =>
      c.wand_integration_sources?.integration_type === 'qu' &&
      c.config_params?.establishment === locationId
    );

    if (!config?.config_params?.brand) return;

    try {
      const apiUrl = `https://qubeyond-api.wanddigital.com/integration?concept=${encodeURIComponent(config.config_params.brand)}&locations=true`;
      const response = await fetch(apiUrl);

      if (!response.ok) return;

      const locations = await response.json();
      const location = locations.find((loc: any) => loc.id === parseInt(locationId));

      if (location) {
        // Store in database for future use
        await supabase.from('qu_locations').upsert({
          id: location.id,
          name: location.name,
          address_line1: location.address.address1,
          address_line2: location.address.address2 || '',
          city: location.address.city,
          state_code: location.address.stateCode,
          postal_code: location.address.postalCode,
          country_code: location.address.countryCode,
          phone: location.phone,
          latitude: location.address.latitude,
          longitude: location.address.longitude,
          brand: config.config_params.brand,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

        setLocationDetails(prev => ({ ...prev, [locationId]: {
          id: location.id,
          name: location.name,
          city: location.address.city,
          state_code: location.address.stateCode,
          address_line1: location.address.address1
        }}));
      }
    } catch (err) {
      console.error('Error fetching location from API:', err);
    }
  };

  const handleToggleActive = async (configId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;

    // If activating, validate that required fields are filled
    if (newStatus) {
      const config = sourceConfigs.find(c => c.id === configId);

      if (config?.wand_integration_sources) {
        const source = config.wand_integration_sources;
        const missingFields: string[] = [];

        // Check all required fields
        source.required_config_fields?.forEach((field: string) => {
          const value = config.config_params?.[field];

          if (!value || value.trim() === '') {
            missingFields.push(field);
          }
        });

        if (missingFields.length > 0) {
          alert(`Cannot activate: Missing required fields:\n${missingFields.join(', ')}\n\nPlease edit the configuration and fill in all required fields.`);
          return;
        }
      }
    }

    const { error } = await supabase
      .from('integration_source_configs')
      .update({ is_active: newStatus })
      .eq('id', configId);

    if (error) {
      console.error('Failed to toggle active status:', error);
      alert(`Failed to ${newStatus ? 'activate' : 'deactivate'} configuration: ${error.message}`);
    } else {
      setSourceConfigs(prev =>
        prev.map(config =>
          config.id === configId
            ? { ...config, is_active: newStatus }
            : config
        )
      );
    }
  };

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff} minutes ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  function getSourceIcon(type: string) {
    const sourceType = SOURCE_TYPES.find(t => t.value === type);
    return sourceType?.icon || Database;
  }

  function getSourceColor(type: string) {
    const sourceType = SOURCE_TYPES.find(t => t.value === type);
    return sourceType?.color || 'blue';
  }

  function getDestinationIcon(type: string) {
    const destType = DESTINATION_TYPES.find(t => t.value === type);
    return destType?.icon || Database;
  }

  function getDestinationColor(type: string) {
    const destType = DESTINATION_TYPES.find(t => t.value === type);
    return destType?.color || 'blue';
  }

  function toggleDestinationExpand(id: string) {
    setExpandedDestinations(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }

  const handleManualSync = async (configId: string) => {
    const config = sourceConfigs.find(c => c.id === configId);

    // Check if config has required API parameters
    if (!config?.config_params || Object.keys(config.config_params).length === 0) {
      alert('Cannot sync: This configuration is missing API parameters.\n\nPlease edit the configuration and add required fields like establishment ID, brand, and credentials.');
      return;
    }

    // Validate required fields are filled
    const brand = config.config_params.brand?.trim();
    const establishment = config.config_params.establishment?.trim();

    if (!brand || !establishment) {
      alert('Cannot sync: Missing required fields.\n\nBoth brand and establishment must be configured. Please edit the configuration.');
      return;
    }

    const syncMessage = config.application_level === 'concept'
      ? 'Start manual sync now? This will populate the product catalog for all child locations.'
      : 'Start manual sync now? This will fetch data from the integration source.';

    if (!confirm(syncMessage)) {
      return;
    }

    setSyncingConfigs(prev => new Set(prev).add(configId));

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-orchestrator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config_id: configId })
      });

      const result = await response.json();

      console.log('Sync orchestrator result:', JSON.stringify(result, null, 2));

      if (result.success) {
        alert(`Sync completed successfully!\n\nProducts: ${result.counts?.products || 0}\nModifiers: ${result.counts?.modifiers || 0}\nDiscounts: ${result.counts?.discounts || 0}\nTotal: ${result.counts?.total || 0}\n\nDuration: ${result.duration_ms}ms`);
        loadSourceConfigs();
      } else {
        alert(`Sync failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Manual sync error:', error);
      alert('Failed to start sync. Check console for details.');
    } finally {
      setSyncingConfigs(prev => {
        const newSet = new Set(prev);
        newSet.delete(configId);
        return newSet;
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-6 py-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-slate-900">Integration Access</h1>
            <button
              onClick={() => setShowAddModal(true)}
              disabled={!hasLocation}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={!hasLocation ? 'Select a location first' : ''}
            >
              <Plus className="w-5 h-5" />
              Add Source
            </button>
          </div>
          <p className="text-slate-600">Configure data sources and sync schedules</p>
        </div>

        {/* Location Required Message */}
        {!hasLocation && (
          <LocationRequired action="adding integration sources" className="mb-6" />
        )}

        {/* Active Source Configurations */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : sourceConfigs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 mb-2">No integration source configurations</p>
            <p className="text-sm text-slate-500">Click "Add Source" to configure a preset integration source</p>
          </div>
        ) : (
        <div className="space-y-4">
          {sourceConfigs.map(config => {
            const Icon = Database;
            const color = 'blue';

            return (
              <div key={config.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 bg-${color}-100 rounded-lg`}>
                        <Icon className={`w-6 h-6 text-${color}-600`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">{config.config_name}</h3>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <Database className="w-4 h-4" />
                            {config.wand_integration_sources?.name || 'Unknown'}
                          </span>
                          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                            {config.wand_integration_sources?.integration_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded font-medium">
                            {config.application_level.toUpperCase()}
                          </span>
                          {config.application_level === 'concept' && (
                            <>
                              {config.config_params && Object.keys(config.config_params).length > 0 ? (
                                <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded font-medium flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  Catalog Source Configured
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded font-medium flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  Not Configured
                                </span>
                              )}
                            </>
                          )}
                          {(config.application_level === 'site' || config.application_level === 'company') && (
                            <>
                              {config.config_params && Object.keys(config.config_params).length > 0 ? (
                                <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded font-medium flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  Fully Configured
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded font-medium flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  Missing API Configuration
                                </span>
                              )}
                            </>
                          )}
                          {config.wand_integration_sources?.integration_type === 'qu' && config.config_params?.brand && (
                            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded font-medium">
                              Brand: {config.config_params.brand}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {config.is_active ? (
                        <button
                          onClick={() => handleToggleActive(config.id, config.is_active)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                        >
                          <ToggleRight className="w-4 h-4" />
                          Active
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleActive(config.id, config.is_active)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                        >
                          <ToggleLeft className="w-4 h-4" />
                          Inactive
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingConfigId(config.id);
                          setShowEditModal(true);
                        }}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit configuration"
                      >
                        <Edit2 className="w-4 h-4 text-slate-600" />
                      </button>
                      <button
                        onClick={() => handleManualSync(config.id)}
                        disabled={!config.is_active || syncingConfigs.has(config.id)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={config.is_active ? 'Sync now' : 'Activate to sync'}
                      >
                        <RefreshCw className={`w-4 h-4 text-blue-600 ${syncingConfigs.has(config.id) ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => setShowUploadModal(config.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Data
                      </button>
                      <button className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>

                  {config.wand_integration_sources?.integration_type === 'qu' ? (
                    <div className="grid grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                      {/* Assigned Establishment - Prominent Display */}
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg">
                          <MapPin className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 font-medium">Assigned Establishment</div>
                          {config.config_params?.establishment && locationDetails[config.config_params.establishment] ? (
                            <div className="text-sm font-semibold text-slate-900">
                              {locationDetails[config.config_params.establishment].name}
                              <div className="text-xs font-normal text-slate-600 mt-0.5">
                                {locationDetails[config.config_params.establishment].city}, {locationDetails[config.config_params.establishment].state_code}
                              </div>
                            </div>
                          ) : config.config_params?.establishment ? (
                            <div className="text-sm font-medium text-slate-900">
                              ID: {config.config_params.establishment}
                              <div className="text-xs text-slate-500 mt-0.5">Loading details...</div>
                            </div>
                          ) : (
                            <div className="text-sm font-medium text-slate-500">Not configured</div>
                          )}
                        </div>
                      </div>

                      {/* Sync Frequency */}
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Zap className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 font-medium">Sync Frequency</div>
                          <div className="text-sm font-semibold text-slate-900">
                            {config.sync_frequency_minutes ? `Every ${config.sync_frequency_minutes} min` : 'Not configured'}
                          </div>
                        </div>
                      </div>

                      {/* Last Sync */}
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-lg">
                          <Clock className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 font-medium">Last Sync</div>
                          <div className="text-sm font-semibold text-slate-900">{formatLastSync(config.last_sync_at)}</div>
                        </div>
                      </div>

                      {/* Schedule */}
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-lg">
                          <Calendar className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 font-medium">Schedule</div>
                          <div className="text-sm font-semibold text-slate-900">{config.sync_schedule || 'Manual'}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Zap className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Sync Frequency</div>
                          <div className="text-sm font-medium text-slate-900">
                            {config.sync_frequency_minutes ? `Every ${config.sync_frequency_minutes} min` : 'Not configured'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-lg">
                          <Clock className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Last Sync</div>
                          <div className="text-sm font-medium text-slate-900">{formatLastSync(config.last_sync_at)}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-lg">
                          <Calendar className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Schedule</div>
                          <div className="text-sm font-medium text-slate-900">{config.sync_schedule || 'Manual'}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Data Source Tabs */}
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-1 mb-4">
                      <button
                        onClick={() => setActiveTab(prev => ({ ...prev, [config.id]: 'magic-link' }))}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          (activeTab[config.id] || 'magic-link') === 'magic-link'
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        <Link2 className="w-4 h-4" />
                        Magic Link & Endpoint
                      </button>
                      <button
                        onClick={() => setActiveTab(prev => ({ ...prev, [config.id]: 'upload-history' }))}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activeTab[config.id] === 'upload-history'
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        <HistoryIcon className="w-4 h-4" />
                        Upload History
                      </button>
                    </div>

                    {(activeTab[config.id] || 'magic-link') === 'magic-link' && (
                      <MagicLinkManager configId={config.id} />
                    )}
                    {activeTab[config.id] === 'upload-history' && (
                      <UploadHistoryPanel configId={config.id} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Info Box */}
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="font-semibold text-blue-900 mb-2">About Integration Access</h3>
          <p className="text-sm text-blue-800 mb-3">
            Configure how your system connects to external data sources. Use preset integrations like PAR POS for instant setup with pre-built mappings, or create custom integrations with your own field mappings. Each source supports magic links for external uploads, automated endpoints for software-driven updates, and in-app uploads for logged-in users.
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <strong>Supported Sources:</strong>
              <ul className="list-disc list-inside ml-2 mt-1">
                <li>REST APIs with authentication</li>
                <li>Excel/CSV spreadsheets</li>
                <li>JSON data files</li>
                <li>FTP/SFTP servers</li>
              </ul>
            </div>
            <div>
              <strong>Sync Options:</strong>
              <ul className="list-disc list-inside ml-2 mt-1">
                <li>Real-time webhooks</li>
                <li>Scheduled polling (5min - daily)</li>
                <li>Manual sync on-demand</li>
                <li>Business hours scheduling</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Integration Forwarding Section */}
        <div className="mt-12">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold text-slate-900">Integration Forwarding</h2>
              <button
                onClick={() => setShowAddDestinationModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Destination
              </button>
            </div>
            <p className="text-slate-600">Send product data to external systems and applications</p>
          </div>

          {/* Active Destinations */}
          <div className="space-y-4">
            {destinations.map(destination => {
              const Icon = getDestinationIcon(destination.type);
              const color = getDestinationColor(destination.type);
              const isExpanded = expandedDestinations[destination.id];

              return (
                <div key={destination.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-3 bg-${color}-100 rounded-lg`}>
                          <Send className={`w-6 h-6 text-${color}-600`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-900 mb-1">{destination.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Link className="w-4 h-4" />
                              {DESTINATION_TYPES.find(t => t.value === destination.type)?.label}
                            </span>
                            {destination.endpoint && (
                              <span className="flex items-center gap-1">
                                <Server className="w-4 h-4" />
                                {destination.endpoint}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {destination.status === 'active' ? (
                          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors">
                            <ToggleRight className="w-4 h-4" />
                            Active
                          </button>
                        ) : (
                          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
                            <ToggleLeft className="w-4 h-4" />
                            Inactive
                          </button>
                        )}
                        <button
                          onClick={() => toggleDestinationExpand(destination.id)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4 text-slate-600" />
                        </button>
                        <button className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-lg">
                          <Zap className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Sync Frequency</div>
                          <div className="text-sm font-medium text-slate-900">{destination.syncFrequency}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-lg">
                          <Clock className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Last Sync</div>
                          <div className="text-sm font-medium text-slate-900">{destination.lastSync}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Calendar className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Schedule</div>
                          <div className="text-sm font-medium text-slate-900">{destination.schedule}</div>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Mapping Section */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-semibold text-slate-900 mb-3">Field Mapping</h4>
                        <div className="bg-slate-50 rounded-lg p-4 text-center text-slate-500">
                          <p className="text-sm">Field mapping configuration will be available here</p>
                          <p className="text-xs mt-1">TBD - Coming soon</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info Box for Forwarding */}
          <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-xl">
            <h3 className="font-semibold text-green-900 mb-2">About Integration Forwarding</h3>
            <p className="text-sm text-green-800 mb-3">
              Automatically send product data to external systems when changes occur. Configure destinations to keep your digital menu boards, mobile apps, and other systems up-to-date.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm text-green-800">
              <div>
                <strong>Supported Destinations:</strong>
                <ul className="list-disc list-inside ml-2 mt-1">
                  <li>REST APIs with webhooks</li>
                  <li>Real-time event streaming</li>
                  <li>FTP/SFTP file exports</li>
                  <li>Direct database connections</li>
                </ul>
              </div>
              <div>
                <strong>Forwarding Options:</strong>
                <ul className="list-disc list-inside ml-2 mt-1">
                  <li>Real-time on product updates</li>
                  <li>Scheduled batch exports</li>
                  <li>Custom field mapping</li>
                  <li>Conditional forwarding rules</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Source Modal */}
      {showAddModal && hasLocation && (
        <AddWandIntegrationModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadSourceConfigs();
          }}
          conceptId={location.concept?.id}
          companyId={location.company?.id}
          storeId={location.store?.id}
        />
      )}

      {/* Edit Source Modal */}
      {showEditModal && editingConfigId && (
        <EditWandIntegrationModal
          configId={editingConfigId}
          onClose={() => {
            setShowEditModal(false);
            setEditingConfigId(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditingConfigId(null);
            loadSourceConfigs();
          }}
        />
      )}

      {showUploadModal && (
        <DataUploadModal
          isOpen={true}
          onClose={() => setShowUploadModal(null)}
          configId={showUploadModal}
          configName={sourceConfigs.find(c => c.id === showUploadModal)?.config_name || 'Integration'}
          sourceType="in_app"
        />
      )}

      {/* OLD MODAL PLACEHOLDER - Delete everything from here to Add Destination Modal */}
      {false && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">OLD MODAL</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Source Type Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Source Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {SOURCE_TYPES.map(type => {
                    const Icon = type.icon;
                    const isSelected = selectedType === type.value;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setSelectedType(type.value)}
                        className={`p-4 border-2 rounded-lg transition-all ${
                          isSelected
                            ? `border-${type.color}-500 bg-${type.color}-50`
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`w-6 h-6 mb-2 ${isSelected ? `text-${type.color}-600` : 'text-slate-400'}`} />
                        <div className={`font-medium ${isSelected ? `text-${type.color}-900` : 'text-slate-700'}`}>
                          {type.label}
                        </div>
                      </button>
                    );
                  })}
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

              {selectedType === 'api' && (
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

              {selectedType === 'ftp' && (
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

              {(selectedType === 'spreadsheet' || selectedType === 'json') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">File Upload</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors cursor-pointer">
                    <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-600">Click to upload or drag and drop</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedType === 'spreadsheet' ? 'CSV, XLSX, XLS files' : 'JSON files'}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Sync Frequency</label>
                <select className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  {SYNC_FREQUENCIES.map(freq => (
                    <option key={freq.value} value={freq.value}>{freq.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" className="w-4 h-4 text-blue-600 rounded" defaultChecked />
                <label htmlFor="active" className="text-sm text-slate-700">Activate immediately after creation</label>
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                Create Source
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Destination Modal */}
      {showAddDestinationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Add Integration Destination</h2>
              <button
                onClick={() => setShowAddDestinationModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Destination Type Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Destination Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {DESTINATION_TYPES.map(type => {
                    const Icon = type.icon;
                    const isSelected = selectedDestType === type.value;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setSelectedDestType(type.value)}
                        className={`p-4 border-2 rounded-lg transition-all ${
                          isSelected
                            ? `border-${type.color}-500 bg-${type.color}-50`
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`w-6 h-6 mb-2 ${isSelected ? `text-${type.color}-600` : 'text-slate-400'}`} />
                        <div className={`font-medium ${isSelected ? `text-${type.color}-900` : 'text-slate-700'}`}>
                          {type.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Configuration based on type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Destination Name</label>
                <input
                  type="text"
                  placeholder="e.g., Digital Menu Board System"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {(selectedDestType === 'api' || selectedDestType === 'webhook') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {selectedDestType === 'webhook' ? 'Webhook URL' : 'API Endpoint'}
                    </label>
                    <input
                      type="url"
                      placeholder="https://api.example.com/v1/products"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Authentication</label>
                    <select className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent mb-2">
                      <option>API Key</option>
                      <option>Bearer Token</option>
                      <option>Basic Auth</option>
                      <option>OAuth 2.0</option>
                    </select>
                    <input
                      type="password"
                      placeholder="API Key or Token"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {selectedDestType === 'ftp' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Server Address</label>
                      <input
                        type="text"
                        placeholder="ftp.example.com"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Port</label>
                      <input
                        type="number"
                        placeholder="21"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Export Path</label>
                    <input
                      type="text"
                      placeholder="/exports/products.json"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {selectedDestType === 'database' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Database Type</label>
                    <select className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                      <option>PostgreSQL</option>
                      <option>MySQL</option>
                      <option>SQL Server</option>
                      <option>MongoDB</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Connection String</label>
                    <input
                      type="password"
                      placeholder="postgresql://user:password@host:port/database"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Sync Trigger</label>
                <select className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
                  <option value="realtime">Real-time (on product update)</option>
                  <option value="5min">Every 5 minutes</option>
                  <option value="15min">Every 15 minutes</option>
                  <option value="30min">Every 30 minutes</option>
                  <option value="1hour">Every hour</option>
                  <option value="daily">Daily</option>
                  <option value="manual">Manual only</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="activeDest" className="w-4 h-4 text-green-600 rounded" defaultChecked />
                <label htmlFor="activeDest" className="text-sm text-slate-700">Activate immediately after creation</label>
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowAddDestinationModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                Create Destination
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
