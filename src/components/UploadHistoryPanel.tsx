import { useState, useEffect } from 'react';
import { History, CheckCircle, AlertCircle, Clock, Upload, Link2, Server, TrendingUp, Package, DollarSign, Minus } from 'lucide-react';
import { IntegrationMagicLinkService, UploadHistoryEntry } from '../lib/integrationMagicLinkService';

interface UploadHistoryPanelProps {
  configId: string;
}

export default function UploadHistoryPanel({ configId }: UploadHistoryPanelProps) {
  const [history, setHistory] = useState<UploadHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [configId]);

  const load = async () => {
    setLoading(true);
    const data = await IntegrationMagicLinkService.getUploadHistory(configId);
    setHistory(data);
    setLoading(false);
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'magic_link': return Link2;
      case 'endpoint': return Server;
      default: return Upload;
    }
  };

  const getSourceLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'magic_link': return 'Magic Link';
      case 'endpoint': return 'Endpoint';
      default: return 'In-App';
    }
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)} hr ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-600 mb-1">No upload history yet</p>
        <p className="text-sm text-slate-500">Uploads via magic link, in-app, or endpoint will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map(entry => {
        const SourceIcon = getSourceIcon(entry.source_type);
        return (
          <div key={entry.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  entry.source_type === 'magic_link' ? 'bg-purple-100' :
                  entry.source_type === 'endpoint' ? 'bg-orange-100' : 'bg-blue-100'
                }`}>
                  <SourceIcon className={`w-4 h-4 ${
                    entry.source_type === 'magic_link' ? 'text-purple-600' :
                    entry.source_type === 'endpoint' ? 'text-orange-600' : 'text-blue-600'
                  }`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{entry.file_name}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      entry.source_type === 'magic_link' ? 'bg-purple-100 text-purple-700' :
                      entry.source_type === 'endpoint' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {getSourceLabel(entry.source_type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(entry.created_at)}
                    {entry.uploader_email && (
                      <>
                        <span>·</span>
                        <span>{entry.uploader_email}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {entry.status === 'success' ? (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                    <CheckCircle className="w-3 h-3" />
                    Success
                  </span>
                ) : entry.status === 'partial' ? (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                    <AlertCircle className="w-3 h-3" />
                    Partial
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                    <AlertCircle className="w-3 h-3" />
                    Failed
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 pt-3 border-t border-slate-100">
              <div>
                <div className="text-xs text-slate-500">Rows</div>
                <div className="text-sm font-semibold text-slate-900">{entry.rows_processed}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Price Changes
                </div>
                <div className="text-sm font-semibold text-amber-600">{entry.price_changes ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Updated
                </div>
                <div className="text-sm font-semibold text-green-600">{entry.products_updated}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  New
                </div>
                <div className="text-sm font-semibold text-blue-600">{entry.new_products_added}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Minus className="w-3 h-3" />
                  Unchanged
                </div>
                <div className="text-sm font-semibold text-slate-400">{entry.products_unchanged ?? 0}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
