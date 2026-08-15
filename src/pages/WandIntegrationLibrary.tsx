import { useState, useEffect } from 'react';
import { Database, Server, Info, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WandIntegrationLibraryProps {
  onBack: () => void;
  onApplyConfig?: (source: WandIntegrationSource) => void;
}

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
  metadata: Record<string, any>;
  documentation_url?: string;
}

export default function WandIntegrationLibrary({ onBack, onApplyConfig }: WandIntegrationLibraryProps) {
  const [sources, setSources] = useState<WandIntegrationSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<WandIntegrationSource | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('wand_integration_sources')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading WAND integration sources:', error);
    } else if (data) {
      setSources(data);
    }
    setLoading(false);
  };

  const filteredSources = sources.filter(source =>
    source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    source.integration_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    source.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      beta: 'bg-blue-100 text-blue-800',
      inactive: 'bg-slate-100 text-slate-600',
      deprecated: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.inactive}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Preset Integration Library</h1>
        <p className="text-slate-600">
          Browse available integration sources at the WAND level. Apply configurations to concepts, companies, or sites.
        </p>
      </div>

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
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">No integration sources found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredSources.map(source => (
            <div
              key={source.id}
              className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedSource(source)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Database className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">{source.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {source.integration_type}
                      </span>
                      {getStatusBadge(source.status)}
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{source.description}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                <div className="text-center">
                  {source.supports_products ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  ) : (
                    <XCircle className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                  )}
                  <div className="text-xs text-slate-600">Products</div>
                </div>
                <div className="text-center">
                  {source.supports_modifiers ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  ) : (
                    <XCircle className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                  )}
                  <div className="text-xs text-slate-600">Modifiers</div>
                </div>
                <div className="text-center">
                  {source.supports_discounts ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  ) : (
                    <XCircle className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                  )}
                  <div className="text-xs text-slate-600">Discounts</div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onApplyConfig) onApplyConfig(source);
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  Apply to Location
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSource && (
        <SourceDetailModal
          source={selectedSource}
          onClose={() => setSelectedSource(null)}
          onApply={() => {
            if (onApplyConfig) onApplyConfig(selectedSource);
            setSelectedSource(null);
          }}
        />
      )}

      <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">About Preset Integration Library</h3>
            <p className="text-sm text-blue-800 mb-3">
              The Preset Integration Library contains all available integration sources at the WAND level (global templates).
              To use an integration, you need to apply it to a specific concept, company, or site with appropriate configuration.
            </p>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Integration sources are read-only templates managed at WAND level</li>
              <li>Click "Apply to Location" to configure for your specific locations</li>
              <li>Required fields vary by integration type (brand, establishment, credentials, etc.)</li>
              <li>Configuration can be set at concept, company, or site level with inheritance</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceDetailModal({ source, onClose, onApply }: {
  source: WandIntegrationSource;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{source.name}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Description</h3>
            <p className="text-slate-600">{source.description}</p>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Integration Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-slate-500">Type</div>
                <div className="text-sm font-mono text-slate-900 bg-slate-100 px-2 py-1 rounded">
                  {source.integration_type}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Auth Method</div>
                <div className="text-sm font-mono text-slate-900 bg-slate-100 px-2 py-1 rounded">
                  {source.auth_method}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Sync Frequency</div>
                <div className="text-sm text-slate-900">{source.default_sync_frequency_minutes} minutes</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Formatter</div>
                <div className="text-sm font-mono text-slate-900">{source.formatter_name}</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Required Configuration Fields</h3>
            <div className="flex flex-wrap gap-2">
              {source.required_config_fields.map(field => (
                <span key={field} className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full">
                  {field}
                </span>
              ))}
            </div>
          </div>

          {source.optional_config_fields.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Optional Configuration Fields</h3>
              <div className="flex flex-wrap gap-2">
                {source.optional_config_fields.map(field => (
                  <span key={field} className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Capabilities</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className={`p-3 rounded-lg text-center ${source.supports_products ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
                <CheckCircle className={`w-6 h-6 mx-auto mb-1 ${source.supports_products ? 'text-green-600' : 'text-slate-300'}`} />
                <div className="text-sm font-medium">Products</div>
              </div>
              <div className={`p-3 rounded-lg text-center ${source.supports_modifiers ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
                <CheckCircle className={`w-6 h-6 mx-auto mb-1 ${source.supports_modifiers ? 'text-green-600' : 'text-slate-300'}`} />
                <div className="text-sm font-medium">Modifiers</div>
              </div>
              <div className={`p-3 rounded-lg text-center ${source.supports_discounts ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
                <CheckCircle className={`w-6 h-6 mx-auto mb-1 ${source.supports_discounts ? 'text-green-600' : 'text-slate-300'}`} />
                <div className="text-sm font-medium">Discounts</div>
              </div>
            </div>
          </div>

          {source.documentation_url && (
            <div>
              <a
                href={source.documentation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-2"
              >
                <Server className="w-4 h-4" />
                View Documentation
              </a>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200">
            <button
              onClick={onApply}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
            >
              Apply This Integration to Location
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
