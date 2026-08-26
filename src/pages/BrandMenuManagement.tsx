import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, CreditCard as Edit2, Trash2, GripVertical, ChevronRight, ChevronDown, Package, Clock, Layers, Search, MoreVertical, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BrandMenuManagementProps {
  brandId: number;
  brandName: string;
  onBack: () => void;
}

interface DaypartDefinition {
  id: string;
  daypart_name: string;
  display_label: string;
  color: string;
  icon: string;
}

interface Menu {
  id: string;
  brand_id: number;
  daypart_definition_id: string;
  name: string;
  description: string | null;
  scope: string;
  site_id: number | null;
  status: string;
  created_at: string;
  daypart?: DaypartDefinition;
  item_count?: number;
}

interface MenuZone {
  id: string;
  menu_id: string;
  parent_zone_id: string | null;
  name: string;
  description: string | null;
  sort_order: number;
  icon: string | null;
  color: string | null;
  children?: MenuZone[];
}

interface ScheduledMenuItem {
  id: string;
  menu_id: string;
  zone_id: string | null;
  product_id: string;
  display_name: string | null;
  sort_order: number;
  portion_size: string | null;
  price_override: number | null;
  price_label: string | null;
  is_visible: boolean;
  available_days: number[] | null;
  available_cycle_weeks: number[] | null;
  product?: { id: string; name: string; attributes: Record<string, any> };
}

type ViewLevel = 'menu-list' | 'menu-detail';

export default function BrandMenuManagement({ brandId, brandName, onBack }: BrandMenuManagementProps) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [dayparts, setDayparts] = useState<DaypartDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewLevel, setViewLevel] = useState<ViewLevel>('menu-list');
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [zones, setZones] = useState<MenuZone[]>([]);
  const [menuItems, setMenuItems] = useState<ScheduledMenuItem[]>([]);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showCreateZone, setShowCreateZone] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [newMenuForm, setNewMenuForm] = useState({ name: '', daypart_definition_id: '', description: '' });
  const [newZoneForm, setNewZoneForm] = useState({ name: '', parent_zone_id: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [brandId]);

  const loadData = async () => {
    setLoading(true);
    const [menusRes, daypartsRes] = await Promise.all([
      supabase.from('menus').select('*').eq('brand_id', brandId).order('created_at'),
      supabase.from('daypart_definitions').select('*').order('sort_order')
    ]);

    if (daypartsRes.data) setDayparts(daypartsRes.data);
    if (menusRes.data && daypartsRes.data) {
      const enriched = menusRes.data.map(m => ({
        ...m,
        daypart: daypartsRes.data.find(d => d.id === m.daypart_definition_id)
      }));
      setMenus(enriched);
    }
    setLoading(false);
  };

  const loadMenuDetail = async (menu: Menu) => {
    setSelectedMenu(menu);
    setViewLevel('menu-detail');

    const [zonesRes, itemsRes] = await Promise.all([
      supabase.from('menu_zones').select('*').eq('menu_id', menu.id).order('sort_order'),
      supabase.from('scheduled_menu_items').select('*, product:products(id, name, attributes)').eq('menu_id', menu.id).order('sort_order')
    ]);

    if (zonesRes.data) {
      const flat = zonesRes.data;
      const nested = flat.filter(z => !z.parent_zone_id).map(z => ({
        ...z,
        children: flat.filter(c => c.parent_zone_id === z.id)
      }));
      setZones(nested);
    }
    if (itemsRes.data) setMenuItems(itemsRes.data);
  };

  const handleCreateMenu = async () => {
    if (!newMenuForm.name || !newMenuForm.daypart_definition_id) return;
    setError(null);

    const { error: insertError } = await supabase.from('menus').insert({
      brand_id: brandId,
      name: newMenuForm.name,
      daypart_definition_id: newMenuForm.daypart_definition_id,
      description: newMenuForm.description || null,
      scope: 'enterprise'
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setShowCreateMenu(false);
    setNewMenuForm({ name: '', daypart_definition_id: '', description: '' });
    loadData();
  };

  const handleCreateZone = async () => {
    if (!newZoneForm.name || !selectedMenu) return;

    const { error: insertError } = await supabase.from('menu_zones').insert({
      menu_id: selectedMenu.id,
      name: newZoneForm.name,
      parent_zone_id: newZoneForm.parent_zone_id || null,
      sort_order: zones.length
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setShowCreateZone(false);
    setNewZoneForm({ name: '', parent_zone_id: '' });
    loadMenuDetail(selectedMenu);
  };

  const handleDeleteMenu = async (menuId: string) => {
    const { error: deleteError } = await supabase.from('menus').delete().eq('id', menuId);
    if (!deleteError) loadData();
  };

  const loadAvailableProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, attributes')
      .eq('concept_id', brandId)
      .order('name');
    setAvailableProducts(data || []);
    setShowAddItem(true);
  };

  const handleAddItemToMenu = async (productId: string, zoneId?: string) => {
    if (!selectedMenu) return;

    const { error: insertError } = await supabase.from('scheduled_menu_items').insert({
      menu_id: selectedMenu.id,
      product_id: productId,
      zone_id: zoneId || null,
      sort_order: menuItems.length
    });

    if (!insertError) {
      loadMenuDetail(selectedMenu);
    }
  };

  const handleToggleItemVisibility = async (itemId: string, currentVisible: boolean) => {
    await supabase.from('scheduled_menu_items').update({ is_visible: !currentVisible }).eq('id', itemId);
    if (selectedMenu) loadMenuDetail(selectedMenu);
  };

  const handleDeleteItem = async (itemId: string) => {
    await supabase.from('scheduled_menu_items').delete().eq('id', itemId);
    if (selectedMenu) loadMenuDetail(selectedMenu);
  };

  const getDaypartColor = (daypart?: DaypartDefinition) => {
    if (!daypart) return 'bg-slate-100 text-slate-700';
    return daypart.color || 'bg-slate-100 text-slate-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (viewLevel === 'menu-detail' && selectedMenu) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => { setViewLevel('menu-list'); setSelectedMenu(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedMenu.name}</h1>
                <p className="text-xs text-slate-500">{selectedMenu.daypart?.display_label || 'No daypart'} Menu</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowCreateZone(true)} className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors">
                <Plus className="w-4 h-4 inline mr-1" />Zone
              </button>
              <button onClick={loadAvailableProducts} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="w-4 h-4 inline mr-1" />Add Item
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 max-w-5xl mx-auto space-y-6">
          {zones.length > 0 && (
            <div className="space-y-4">
              {zones.map(zone => (
                <div key={zone.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 dark:bg-slate-750 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-slate-500" />
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{zone.name}</h3>
                      <span className="text-xs text-slate-500 ml-2">
                        {menuItems.filter(i => i.zone_id === zone.id).length} items
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {menuItems.filter(i => i.zone_id === zone.id).map(item => (
                      <div key={item.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                          <div>
                            <p className={`text-sm font-medium ${item.is_visible ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 line-through'}`}>
                              {item.display_name || item.product?.name || 'Unknown'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.portion_size && <span className="text-xs text-slate-500">{item.portion_size}</span>}
                              {item.price_override && <span className="text-xs font-medium text-emerald-600">${item.price_override.toFixed(2)}</span>}
                              {item.available_days && <span className="text-xs text-blue-500">Day-specific</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleToggleItemVisibility(item.id, item.is_visible)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors">
                            {item.is_visible ? <Eye className="w-4 h-4 text-slate-400" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                          </button>
                          <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {menuItems.filter(i => i.zone_id === zone.id).length === 0 && (
                      <div className="px-5 py-6 text-center text-sm text-slate-400">No items in this zone yet</div>
                    )}
                  </div>
                  {zone.children && zone.children.length > 0 && (
                    <div className="ml-6 border-l-2 border-slate-200 dark:border-slate-700">
                      {zone.children.map(child => (
                        <div key={child.id} className="pl-4 py-2">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{child.name}</p>
                          <div className="mt-1 space-y-1">
                            {menuItems.filter(i => i.zone_id === child.id).map(item => (
                              <div key={item.id} className="flex items-center justify-between py-1">
                                <span className="text-sm text-slate-600 dark:text-slate-400">{item.display_name || item.product?.name}</span>
                                <button onClick={() => handleDeleteItem(item.id)} className="p-1 hover:bg-red-50 rounded">
                                  <Trash2 className="w-3 h-3 text-red-400" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Unzoned items */}
          {menuItems.filter(i => !i.zone_id).length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-750 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Unassigned Items</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {menuItems.filter(i => !i.zone_id).map(item => (
                  <div key={item.id} className="px-5 py-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.display_name || item.product?.name}</p>
                    <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {zones.length === 0 && menuItems.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Empty Menu</h3>
              <p className="text-slate-500 mb-6">Add zones to organize items, then add products to this menu.</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setShowCreateZone(true)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors">
                  Create Zone
                </button>
                <button onClick={loadAvailableProducts} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Add Products
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Create Zone Modal */}
        {showCreateZone && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Create Zone</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Zone Name</label>
                  <input type="text" value={newZoneForm.name} onChange={e => setNewZoneForm({ ...newZoneForm, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" placeholder="e.g., Entrees, Sides, Beverages" />
                </div>
                {zones.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Parent Zone (optional)</label>
                    <select value={newZoneForm.parent_zone_id} onChange={e => setNewZoneForm({ ...newZoneForm, parent_zone_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                      <option value="">None (top level)</option>
                      {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowCreateZone(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors">Cancel</button>
                <button onClick={handleCreateZone} disabled={!newZoneForm.name} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">Create</button>
              </div>
            </div>
          </div>
        )}

        {/* Add Item Modal */}
        {showAddItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">Add Products to Menu</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" placeholder="Search products..." />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {availableProducts.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())).map(product => (
                  <button key={product.id} onClick={() => { handleAddItemToMenu(product.id, zones[0]?.id); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-left transition-colors">
                    <Package className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{product.name}</p>
                      {product.attributes?.price && <p className="text-xs text-slate-500">${product.attributes.price}</p>}
                    </div>
                    <Plus className="w-4 h-4 text-blue-500" />
                  </button>
                ))}
                {availableProducts.length === 0 && (
                  <p className="text-center text-sm text-slate-400 py-8">No products found for this brand</p>
                )}
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <button onClick={() => { setShowAddItem(false); setProductSearch(''); }} className="w-full px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors">Done</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Menu List View
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Menus</h1>
              <p className="text-xs text-slate-500">{brandName}</p>
            </div>
          </div>
          <button onClick={() => setShowCreateMenu(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">New Menu</span>
          </button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {menus.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No Menus Yet</h3>
            <p className="text-slate-500 mb-6">Create your first menu for {brandName}. Each menu is tied to a daypart (Breakfast, Lunch, etc.).</p>
            <button onClick={() => setShowCreateMenu(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Create First Menu</button>
          </div>
        ) : (
          <div className="grid gap-4">
            {dayparts.filter(dp => menus.some(m => m.daypart_definition_id === dp.id)).map(dp => (
              <div key={dp.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${dp.color}`}>{dp.display_label}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {menus.filter(m => m.daypart_definition_id === dp.id).map(menu => (
                    <button key={menu.id} onClick={() => loadMenuDetail(menu)} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 text-left hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all group">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{menu.name}</h3>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                      {menu.description && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{menu.description}</p>}
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="capitalize">{menu.scope}</span>
                        <span className={`px-1.5 py-0.5 rounded ${menu.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{menu.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {/* Menus without matching dayparts */}
            {menus.filter(m => !dayparts.find(dp => dp.id === m.daypart_definition_id)).length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-500">Other</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {menus.filter(m => !dayparts.find(dp => dp.id === m.daypart_definition_id)).map(menu => (
                    <button key={menu.id} onClick={() => loadMenuDetail(menu)} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 text-left hover:border-blue-300 hover:shadow-md transition-all">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{menu.name}</h3>
                      <span className="text-xs text-slate-500 capitalize">{menu.scope}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Menu Modal */}
      {showCreateMenu && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Create Menu</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Menu Name *</label>
                <input type="text" value={newMenuForm.name} onChange={e => setNewMenuForm({ ...newMenuForm, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" placeholder="e.g., Grill Breakfast" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Daypart *</label>
                <select value={newMenuForm.daypart_definition_id} onChange={e => setNewMenuForm({ ...newMenuForm, daypart_definition_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                  <option value="">Select a daypart...</option>
                  {dayparts.map(dp => <option key={dp.id} value={dp.id}>{dp.display_label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea value={newMenuForm.description} onChange={e => setNewMenuForm({ ...newMenuForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" placeholder="Optional description..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreateMenu(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors">Cancel</button>
              <button onClick={handleCreateMenu} disabled={!newMenuForm.name || !newMenuForm.daypart_definition_id} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
