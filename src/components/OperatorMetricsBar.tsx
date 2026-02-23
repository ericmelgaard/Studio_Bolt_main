import React, { useEffect, useState } from 'react';
import { Tag, Layers, Monitor, Package, Globe, Activity, Edit3 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  subtitle: string;
  onClick?: () => void;
}

function MetricCard({ icon: Icon, label, count, subtitle, onClick }: MetricCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-[#2d3748] rounded-lg p-4 text-left hover:bg-[#374151] transition-colors border border-[#374151]"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-[#1a2332] rounded-lg">
          <Icon className="w-5 h-5 text-[#00adf0]" />
        </div>
        <span className="text-sm text-gray-400 pt-1">{label}</span>
      </div>
      <div className="text-3xl font-semibold text-white mb-1">{count}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </button>
  );
}

function CustomizeCard({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-transparent rounded-lg p-4 text-left hover:bg-[#2d3748] transition-colors border-2 border-dashed border-[#4b5563]"
    >
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <Edit3 className="w-6 h-6 text-gray-500" />
        <span className="text-sm text-gray-500">Customize</span>
      </div>
    </button>
  );
}

interface OperatorMetricsBarProps {
  storeId: number;
  onNavigate?: (view: string) => void;
}

export default function OperatorMetricsBar({ storeId, onNavigate }: OperatorMetricsBarProps) {
  const [metrics, setMetrics] = useState({
    smartLabels: { total: 0, online: 0 },
    groups: { total: 0 },
    signage: { total: 0, online: 0 },
    products: { total: 0, active: 0 },
    webviewKiosks: { total: 0, online: 0 },
    activity: { total: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [storeId]);

  const loadMetrics = async () => {
    try {
      // Smart Labels (ESL devices)
      const { data: hardwareDevices } = await supabase
        .from('hardware_devices')
        .select('status, usage_type')
        .eq('store_id', storeId);

      const smartLabelsDevices = hardwareDevices?.filter(d => d.usage_type === 'label') || [];
      const smartLabelsOnline = smartLabelsDevices.filter(d => d.status === 'online').length;

      // Placement Groups
      const { data: groups } = await supabase
        .from('placement_groups')
        .select('id')
        .eq('store_id', storeId);

      // Signage (media players with player_type = 'signage')
      const { data: mediaPlayers } = await supabase
        .from('media_players')
        .select('status, player_type, is_webview_kiosk')
        .eq('store_id', storeId);

      const signagePlayers = mediaPlayers?.filter(p => p.player_type === 'signage' && !p.is_webview_kiosk) || [];
      const signageOnline = signagePlayers.filter(p => p.status === 'online').length;

      const webviewPlayers = mediaPlayers?.filter(p => p.is_webview_kiosk) || [];
      const webviewOnline = webviewPlayers.filter(p => p.status === 'online').length;

      // Products
      const { data: products } = await supabase
        .from('products')
        .select('id, status')
        .eq('store_id', storeId);

      const productsActive = products?.filter(p => p.status === 'active').length || 0;

      // Activity (recent changes in last 24 hours - simplified count)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Count recent updates to displays, media players, and products
      const { count: displayUpdates } = await supabase
        .from('displays')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .gte('updated_at', yesterday.toISOString());

      const { count: playerUpdates } = await supabase
        .from('media_players')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .gte('updated_at', yesterday.toISOString());

      const recentActivity = (displayUpdates || 0) + (playerUpdates || 0);

      setMetrics({
        smartLabels: { total: smartLabelsDevices.length, online: smartLabelsOnline },
        groups: { total: groups?.length || 0 },
        signage: { total: signagePlayers.length, online: signageOnline },
        products: { total: products?.length || 0, active: productsActive },
        webviewKiosks: { total: webviewPlayers.length, online: webviewOnline },
        activity: { total: recentActivity }
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="bg-[#2d3748] rounded-lg p-4 h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
      <MetricCard
        icon={Tag}
        label="Smart Labels"
        count={metrics.smartLabels.total}
        subtitle={`${metrics.smartLabels.online} online`}
        onClick={() => onNavigate?.('labels')}
      />
      <MetricCard
        icon={Layers}
        label="Groups"
        count={metrics.groups.total}
        subtitle="placement groups"
        onClick={() => onNavigate?.('groups')}
      />
      <MetricCard
        icon={Monitor}
        label="Signage"
        count={metrics.signage.total}
        subtitle={`${metrics.signage.online} online`}
        onClick={() => onNavigate?.('signage')}
      />
      <MetricCard
        icon={Package}
        label="Products"
        count={metrics.products.total}
        subtitle={`${metrics.products.active} active`}
        onClick={() => onNavigate?.('products')}
      />
      <MetricCard
        icon={Globe}
        label="Webview Kiosks"
        count={metrics.webviewKiosks.total}
        subtitle={`${metrics.webviewKiosks.online} online`}
        onClick={() => onNavigate?.('kiosks')}
      />
      <MetricCard
        icon={Activity}
        label="Activity"
        count={metrics.activity.total}
        subtitle="recent actions"
        onClick={() => onNavigate?.('activity')}
      />
      <CustomizeCard onClick={() => onNavigate?.('customize')} />
    </div>
  );
}
