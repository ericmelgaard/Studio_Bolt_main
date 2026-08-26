import { useState, useEffect } from 'react';
import { ArrowLeft, UtensilsCrossed, Calendar, Package, Settings, ChevronRight, Plus, Clock, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Brand {
  id: number;
  name: string;
  brand_type: string | null;
  scheduling_mode: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
}

interface Menu {
  id: string;
  name: string;
  description: string | null;
  status: string;
  daypart_label: string | null;
  zone_count: number;
  item_count: number;
}

interface Station {
  id: number;
  name: string;
  store_name: string;
  days_of_week: number[];
  brand_name: string;
}

interface BrandWorkspaceProps {
  userConceptId?: number | null;
  userCompanyId?: number | null;
  onBack?: () => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TODAY_INDEX = new Date().getDay();

export default function BrandWorkspace({ userConceptId, userCompanyId, onBack }: BrandWorkspaceProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [activeTab, setActiveTab] = useState<'menus' | 'schedule' | 'products' | 'settings'>('menus');
  const [menus, setMenus] = useState<Menu[]>([]);
  const [schedules, setSchedules] = useState<Station[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBrands();
  }, [userConceptId, userCompanyId]);

  useEffect(() => {
    if (selectedBrand) {
      loadBrandData(selectedBrand.id);
    }
  }, [selectedBrand, activeTab]);

  const loadBrands = async () => {
    setLoading(true);
    let brandIds: number[] = [];

    if (userConceptId) {
      brandIds = [userConceptId];
    } else if (userCompanyId) {
      const { data } = await supabase
        .from('company_brands')
        .select('concept_id')
        .eq('company_id', userCompanyId);
      if (data) brandIds = data.map(d => d.concept_id);
    } else {
      const { data } = await supabase
        .from('company_brands')
        .select('concept_id')
        .limit(20);
      if (data) brandIds = [...new Set(data.map(d => d.concept_id))];
    }

    if (brandIds.length > 0) {
      const { data } = await supabase
        .from('concepts')
        .select('id, name, brand_type, scheduling_mode, brand_primary_color, brand_secondary_color')
        .in('id', brandIds)
        .order('name');
      if (data) {
        setBrands(data);
        if (data.length === 1) setSelectedBrand(data[0]);
      }
    }
    setLoading(false);
  };

  const loadBrandData = async (brandId: number) => {
    if (activeTab === 'menus') {
      const { data: menuData } = await supabase
        .from('menus')
        .select(`
          id, name, description, status,
          daypart_definitions(display_label),
          menu_zones(id),
          scheduled_menu_items(id)
        `)
        .eq('brand_id', brandId);

      if (menuData) {
        setMenus(menuData.map(m => ({
          id: m.id,
          name: m.name,
          description: m.description,
          status: m.status,
          daypart_label: (m.daypart_definitions as any)?.display_label || null,
          zone_count: (m.menu_zones as any[])?.length || 0,
          item_count: (m.scheduled_menu_items as any[])?.length || 0,
        })));
      }
    } else if (activeTab === 'schedule') {
      const { data: stationData } = await supabase
        .from('station_schedules')
        .select(`
          id, days_of_week, cycle_week,
          stations(id, name, store_id, stores(name))
        `)
        .eq('brand_id', brandId)
        .eq('is_active', true);

      if (stationData) {
        setSchedules(stationData.map(s => ({
          id: (s.stations as any)?.id,
          name: (s.stations as any)?.name || 'Unknown',
          store_name: (s.stations as any)?.stores?.name || '',
          days_of_week: s.days_of_week || [],
          brand_name: selectedBrand?.name || '',
        })));
      }
    } else if (activeTab === 'products') {
      const { data: productData } = await supabase
        .from('products')
        .select('id, name, sku, status')
        .eq('concept_id', brandId)
        .order('name')
        .limit(50);
      if (productData) setProducts(productData);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!selectedBrand) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Brands</h1>
        </div>
        {brands.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg">No brands assigned to your account yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands.map(brand => (
              <button
                key={brand.id}
                onClick={() => setSelectedBrand(brand)}
                className="text-left bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: brand.brand_primary_color || '#3b82f6' }}
                    >
                      {brand.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                        {brand.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">
                        {brand.brand_type || 'Standard'} &middot; {brand.scheduling_mode || 'Static'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const tabs = [
    { id: 'menus' as const, label: 'Menus', icon: UtensilsCrossed },
    { id: 'schedule' as const, label: 'This Week', icon: Calendar },
    { id: 'products' as const, label: 'Products', icon: Package },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => { if (brands.length > 1) setSelectedBrand(null); else onBack?.(); }}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: selectedBrand.brand_primary_color || '#3b82f6' }}
        >
          {selectedBrand.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{selectedBrand.name}</h1>
          <p className="text-sm text-slate-500 capitalize">
            {selectedBrand.brand_type || 'Standard'} brand &middot; {selectedBrand.scheduling_mode || 'Static'} scheduling
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'menus' && <MenusTab menus={menus} brandColor={selectedBrand.brand_primary_color} />}
      {activeTab === 'schedule' && <ScheduleTab schedules={schedules} />}
      {activeTab === 'products' && <ProductsTab products={products} />}
      {activeTab === 'settings' && <SettingsTab brand={selectedBrand} />}
    </div>
  );
}

function MenusTab({ menus, brandColor }: { menus: Menu[]; brandColor: string | null }) {
  if (menus.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>No menus created yet.</p>
        <button className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Create First Menu
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {menus.map(menu => (
        <div
          key={menu.id}
          className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-2 h-10 rounded-full"
                style={{ backgroundColor: brandColor || '#3b82f6' }}
              />
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{menu.name}</h3>
                <div className="flex items-center gap-3 mt-0.5">
                  {menu.daypart_label && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" /> {menu.daypart_label}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">
                    {menu.zone_count} zone{menu.zone_count !== 1 ? 's' : ''} &middot; {menu.item_count} item{menu.item_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                menu.status === 'active'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
              }`}>
                {menu.status}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleTab({ schedules }: { schedules: Station[] }) {
  if (schedules.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>No station schedules set up yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">This Week's Schedule</h2>
        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
          Cycle Week 1
        </span>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-[180px_repeat(7,1fr)] border-b border-slate-200 dark:border-slate-700">
          <div className="p-3 text-xs font-medium text-slate-500 uppercase">Station</div>
          {DAY_NAMES.map((day, idx) => (
            <div
              key={day}
              className={`p-3 text-xs font-medium text-center uppercase ${
                idx === TODAY_INDEX
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold'
                  : 'text-slate-500'
              }`}
            >
              {day}
              {idx === TODAY_INDEX && (
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mx-auto mt-1"></div>
              )}
            </div>
          ))}
        </div>

        {/* Station rows */}
        {schedules.map(station => (
          <div key={station.id} className="grid grid-cols-[180px_repeat(7,1fr)] border-b last:border-b-0 border-slate-100 dark:border-slate-700">
            <div className="p-3">
              <div className="text-sm font-medium text-slate-900 dark:text-white">{station.name}</div>
              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" /> {station.store_name}
              </div>
            </div>
            {DAY_NAMES.map((_, dayIdx) => {
              const isActive = station.days_of_week.includes(dayIdx);
              const isToday = dayIdx === TODAY_INDEX;
              return (
                <div
                  key={dayIdx}
                  className={`p-2 flex items-center justify-center ${
                    isToday ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                >
                  {isActive ? (
                    <div className={`w-full max-w-[80px] px-2 py-1.5 rounded-md text-center text-xs font-medium ${
                      isToday
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    }`}>
                      {station.brand_name.length > 10 ? station.brand_name.substring(0, 10) + '...' : station.brand_name}
                    </div>
                  ) : (
                    <div className="w-full max-w-[80px] px-2 py-1.5 rounded-md text-center text-xs text-slate-300 dark:text-slate-600">
                      &mdash;
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductsTab({ products }: { products: any[] }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>No products in this brand's pool yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Product Pool</h2>
        <span className="text-sm text-slate-500">{products.length} products</span>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        {products.map(product => (
          <div key={product.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
            <div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{product.name}</span>
              {product.sku && (
                <span className="ml-2 text-xs text-slate-400">SKU: {product.sku}</span>
              )}
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              product.status === 'active'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {product.status || 'draft'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ brand }: { brand: Brand }) {
  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Brand Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Brand Name</label>
            <input
              type="text"
              value={brand.name}
              readOnly
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Brand Type</label>
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white capitalize">
                {brand.brand_type || 'Not set'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Scheduling Mode</label>
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white capitalize">
                {brand.scheduling_mode || 'Not set'}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Brand Colors</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg border border-slate-200"
                  style={{ backgroundColor: brand.brand_primary_color || '#e2e8f0' }}
                />
                <span className="text-xs text-slate-500">Primary</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg border border-slate-200"
                  style={{ backgroundColor: brand.brand_secondary_color || '#e2e8f0' }}
                />
                <span className="text-xs text-slate-500">Secondary</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
