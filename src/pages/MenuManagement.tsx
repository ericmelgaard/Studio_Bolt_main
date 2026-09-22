import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Plus, Search, Calendar, Clock, Layers, Star,
  ChevronRight, ChevronDown, MapPin, CreditCard as Edit3,
  CheckCircle, AlertCircle, Trash2, X, Link2, PenLine,
  Package, MoreVertical, ArrowUp, ArrowDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatScheduleDescription } from '../lib/menuScheduleService';
import { MenuItemEditor } from '../components/MenuItemEditor';
import MenuScheduleBuilder from '../components/MenuScheduleBuilder';
import type { MenuSchedule, CreateScheduleForm } from '../types/menuScheduling';

interface MenuManagementProps {
  storeId?: number | null;
  brandId?: number | null;
  brandName?: string | null;
  onBack: () => void;
  onNavigateToCalendar?: () => void;
}

interface MenuRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  brand_id: number | null;
  daypart_definition_id: string | null;
  placement_group_id: string | null;
  menu_type: string | null;
  scope: string | null;
  created_at: string;
}

interface DaypartDef {
  id: string;
  daypart_name: string;
  display_label: string;
  color: string;
  sort_order: number;
}

interface Placement {
  id: string;
  name: string;
  is_store_root: boolean;
}

interface MenuSection {
  id: string;
  menu_id: string;
  name: string;
  sort_order: number;
  source_type: string;
  brand_section_id: string | null;
}

interface BrandSection {
  id: string;
  brand_id: number;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

interface MenuItem {
  id: string;
  zone_id: string;
  product_id: string | null;
  display_name: string | null;
  price_override: number | null;
  portion_size: string | null;
  is_featured: boolean;
  availability_notes: string | null;
  station_display_name: string | null;
  display_label: string | null;
  sort_order: number;
  menu_id: string;
}

type StatusFilter = 'all' | 'active' | 'draft' | 'archived';
type ViewLevel = 'list' | 'detail';

export default function MenuManagement({ storeId, brandId, brandName, onBack, onNavigateToCalendar }: MenuManagementProps) {
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [dayparts, setDayparts] = useState<DaypartDef[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewLevel, setViewLevel] = useState<ViewLevel>('list');
  const [selectedMenu, setSelectedMenu] = useState<MenuRow | null>(null);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [schedules, setSchedules] = useState<MenuSchedule[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleBuilder, setShowScheduleBuilder] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<MenuSchedule | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [scheduleCounts, setScheduleCounts] = useState<Record<string, number>>({});
  const [showAddSection, setShowAddSection] = useState(false);
  const [brandSections, setBrandSections] = useState<BrandSection[]>([]);
  const [addingItemToSection, setAddingItemToSection] = useState<string | null>(null);
  const [sectionMenuOpen, setSectionMenuOpen] = useState<string | null>(null);
  const [renamingSection, setRenamingSection] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => { loadData(); }, [storeId, brandId]);

  const loadData = async () => {
    setLoading(true);
    const [menusRes, dpRes, plRes] = await Promise.all([
      brandId
        ? supabase.from('menus').select('*').eq('brand_id', brandId).order('name')
        : supabase.from('menus').select('*').order('name'),
      supabase.from('daypart_definitions').select('*').order('sort_order'),
      storeId
        ? supabase.from('placement_groups').select('id, name, is_store_root').eq('store_id', storeId)
        : supabase.from('placement_groups').select('id, name, is_store_root').limit(100),
    ]);
    if (menusRes.data) setMenus(menusRes.data);
    if (dpRes.data) setDayparts(dpRes.data);
    if (plRes.data) setPlacements(plRes.data);

    if (menusRes.data && menusRes.data.length > 0) {
      const ids = menusRes.data.map(m => m.id);
      const { data: schData } = await supabase
        .from('menu_schedules').select('menu_id').in('menu_id', ids).eq('is_active', true);
      if (schData) {
        const counts: Record<string, number> = {};
        schData.forEach(s => { counts[s.menu_id] = (counts[s.menu_id] || 0) + 1; });
        setScheduleCounts(counts);
      }
    }
    setLoading(false);
  };

  const loadMenuDetail = async (menu: MenuRow) => {
    setSelectedMenu(menu);
    setViewLevel('detail');
    const queries: Promise<unknown>[] = [
      supabase.from('menu_zones').select('*').eq('menu_id', menu.id).order('sort_order'),
      supabase.from('menu_schedules').select('*').eq('menu_id', menu.id).order('priority', { ascending: false }),
    ];
    if (menu.brand_id) {
      queries.push(supabase.from('brand_menu_sections').select('*').eq('brand_id', menu.brand_id).order('sort_order'));
    }

    const results = await Promise.all(queries);
    const secRes = results[0] as { data: MenuSection[] | null };
    const schRes = results[1] as { data: MenuSchedule[] | null };

    const secs = secRes.data ?? [];
    setSections(secs);
    setSchedules(schRes.data ?? []);
    setExpandedSections(new Set(secs.map(s => s.id)));

    if (menu.brand_id && results[2]) {
      const bsRes = results[2] as { data: BrandSection[] | null };
      setBrandSections(bsRes.data ?? []);
    } else {
      setBrandSections([]);
    }

    if (secs.length > 0) {
      const { data: itemsData } = await supabase
        .from('scheduled_menu_items').select('*')
        .in('zone_id', secs.map(s => s.id)).order('sort_order');
      setItems(itemsData ?? []);
    } else {
      setItems([]);
    }
  };

  const filteredMenus = useMemo(() => {
    let result = menus;
    if (statusFilter !== 'all') result = result.filter(m => m.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => m.name.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q));
    }
    return result;
  }, [menus, statusFilter, searchQuery]);

  const nonRootPlacements = useMemo(() => placements.filter(p => !p.is_store_root), [placements]);

  const getDaypartLabel = (id: string | null) => {
    if (!id) return null;
    return dayparts.find(d => d.id === id);
  };

  const getPlacementName = (id: string | null) => {
    if (!id) return null;
    return placements.find(p => p.id === id)?.name ?? null;
  };

  const availableBrandSections = useMemo(() => {
    const usedIds = new Set(sections.filter(s => s.brand_section_id).map(s => s.brand_section_id));
    return brandSections.filter(bs => !usedIds.has(bs.id));
  }, [brandSections, sections]);

  // ── Section handlers ──
  const handleAddCustomSection = async (name: string) => {
    if (!selectedMenu || !name.trim()) return;
    const maxOrder = sections.reduce((max, s) => Math.max(max, s.sort_order), -1);
    const { data } = await supabase.from('menu_zones').insert({
      menu_id: selectedMenu.id,
      name: name.trim(),
      sort_order: maxOrder + 1,
      source_type: 'custom',
    }).select().maybeSingle();
    if (data) {
      setSections(prev => [...prev, data]);
      setExpandedSections(prev => new Set([...prev, data.id]));
    }
    setShowAddSection(false);
  };

  const handleInheritSection = async (bs: BrandSection) => {
    if (!selectedMenu) return;
    const maxOrder = sections.reduce((max, s) => Math.max(max, s.sort_order), -1);
    const { data } = await supabase.from('menu_zones').insert({
      menu_id: selectedMenu.id,
      name: bs.name,
      sort_order: maxOrder + 1,
      source_type: 'inherited',
      brand_section_id: bs.id,
      icon: bs.icon,
      color: bs.color,
    }).select().maybeSingle();
    if (data) {
      setSections(prev => [...prev, data]);
      setExpandedSections(prev => new Set([...prev, data.id]));
    }
    setShowAddSection(false);
  };

  const handleDeleteSection = async (secId: string) => {
    await supabase.from('scheduled_menu_items').delete().eq('zone_id', secId);
    await supabase.from('menu_zones').delete().eq('id', secId);
    setSections(prev => prev.filter(s => s.id !== secId));
    setItems(prev => prev.filter(i => i.zone_id !== secId));
    setSectionMenuOpen(null);
  };

  const handleRenameSection = async (secId: string, newName: string) => {
    if (!newName.trim()) return;
    await supabase.from('menu_zones').update({ name: newName.trim() }).eq('id', secId);
    setSections(prev => prev.map(s => s.id === secId ? { ...s, name: newName.trim() } : s));
    setRenamingSection(null);
  };

  const handleMoveSection = async (secId: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex(s => s.id === secId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sections.length) return;
    const a = sections[idx];
    const b = sections[swapIdx];
    await Promise.all([
      supabase.from('menu_zones').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('menu_zones').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    const updated = [...sections];
    updated[idx] = { ...b, sort_order: a.sort_order };
    updated[swapIdx] = { ...a, sort_order: b.sort_order };
    updated.sort((x, y) => x.sort_order - y.sort_order);
    setSections(updated);
    setSectionMenuOpen(null);
  };

  // ── Item handlers ──
  const handleAddFreeformItem = async (sectionId: string, name: string, price: string) => {
    if (!selectedMenu || !name.trim()) return;
    const secItems = items.filter(i => i.zone_id === sectionId);
    const maxOrder = secItems.reduce((max, i) => Math.max(max, i.sort_order), -1);
    const { data } = await supabase.from('scheduled_menu_items').insert({
      menu_id: selectedMenu.id,
      zone_id: sectionId,
      product_id: null,
      display_name: name.trim(),
      sort_order: maxOrder + 1,
      price_override: price ? parseFloat(price) : null,
      is_featured: false,
    }).select().maybeSingle();
    if (data) {
      setItems(prev => [...prev, data]);
    }
    setAddingItemToSection(null);
  };

  const handleSaveSchedule = async (form: CreateScheduleForm) => {
    if (!selectedMenu) return;
    const payload: Record<string, unknown> = {
      menu_id: selectedMenu.id,
      schedule_type: form.schedule_type,
      priority: form.priority,
      is_active: true,
      notes: form.notes || null,
    };
    if (form.schedule_type === 'one_time') {
      payload.start_date = form.start_date || null;
    } else {
      payload.recurrence_pattern = form.recurrence_pattern;
      payload.recurrence_days_of_week = form.recurrence_days_of_week.length > 0 ? form.recurrence_days_of_week : null;
      payload.recurrence_interval = form.recurrence_interval || null;
      payload.recurrence_week_of_month = form.recurrence_week_of_month || null;
      payload.start_date = form.start_date || null;
      payload.end_date = form.end_date || null;
    }
    if (form.placement_group_id) payload.placement_group_id = form.placement_group_id;
    if (form.daypart_definition_id) payload.daypart_definition_id = form.daypart_definition_id;
    if (form.custom_start_time) payload.custom_start_time = form.custom_start_time;
    if (form.custom_end_time) payload.custom_end_time = form.custom_end_time;
    if (editingSchedule) {
      await supabase.from('menu_schedules').update(payload).eq('id', editingSchedule.id);
    } else {
      await supabase.from('menu_schedules').insert(payload);
    }
    setShowScheduleBuilder(false);
    setEditingSchedule(null);
    const { data } = await supabase.from('menu_schedules').select('*').eq('menu_id', selectedMenu.id).order('priority', { ascending: false });
    setSchedules(data ?? []);
  };

  const handleDeleteSchedule = async (id: string) => {
    await supabase.from('menu_schedules').delete().eq('id', id);
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const handleSaveItem = async (updates: Record<string, unknown>) => {
    if (!editingItem) return;
    await supabase.from('scheduled_menu_items').update(updates).eq('id', editingItem.id);
    setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...updates } as MenuItem : i));
    setEditingItem(null);
  };

  const handleDeleteItem = async (itemId: string) => {
    await supabase.from('scheduled_menu_items').delete().eq('id', itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const handleStatusChange = async (menu: MenuRow, status: string) => {
    await supabase.from('menus').update({ status }).eq('id', menu.id);
    setMenus(prev => prev.map(m => m.id === menu.id ? { ...m, status } : m));
    if (selectedMenu?.id === menu.id) setSelectedMenu({ ...menu, status });
  };

  const handleCreateMenu = async (form: { name: string; description: string; menu_type: string; placement_group_id: string; daypart_definition_id: string }) => {
    const payload: Record<string, unknown> = {
      name: form.name,
      description: form.description || null,
      status: 'draft',
      menu_type: form.menu_type || null,
    };
    if (brandId) payload.brand_id = brandId;
    if (form.placement_group_id) payload.placement_group_id = form.placement_group_id;
    if (form.daypart_definition_id) payload.daypart_definition_id = form.daypart_definition_id;
    const { data } = await supabase.from('menus').insert(payload).select().maybeSingle();
    if (data) {
      setMenus(prev => [...prev, data]);
      setShowCreateModal(false);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-700',
      draft: 'bg-amber-100 text-amber-700',
      archived: 'bg-slate-100 text-slate-500',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? 'bg-slate-100 text-slate-500'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  // ── Detail View ──
  if (viewLevel === 'detail' && selectedMenu) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { setViewLevel('list'); setSelectedMenu(null); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{selectedMenu.name}</h1>
              {brandName && <p className="text-sm text-slate-500">{brandName}</p>}
            </div>
            <StatusDropdown status={selectedMenu.status} onChange={(s) => handleStatusChange(selectedMenu, s)} />
          </div>
          {onNavigateToCalendar && (
            <button onClick={onNavigateToCalendar} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Calendar className="w-4 h-4" />
              View Calendar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: sections + items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Sections & Items</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{sections.length} sections, {items.length} items</span>
                  <button
                    onClick={() => setShowAddSection(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Section
                  </button>
                </div>
              </div>

              {sections.length === 0 ? (
                <div className="p-10 text-center">
                  <Layers className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm font-medium text-slate-500 mb-1">No sections yet</p>
                  <p className="text-xs text-slate-400 mb-4">
                    {brandId ? 'Inherit sections from the brand or create your own.' : 'Create sections to organize your menu items.'}
                  </p>
                  <button
                    onClick={() => setShowAddSection(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Your First Section
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sections.map((sec, secIdx) => {
                    const secItems = items.filter(i => i.zone_id === sec.id);
                    const isExpanded = expandedSections.has(sec.id);
                    const isInherited = sec.source_type === 'inherited';

                    return (
                      <div key={sec.id}>
                        {/* Section header */}
                        <div className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                          <button
                            onClick={() => setExpandedSections(prev => {
                              const next = new Set(prev);
                              isExpanded ? next.delete(sec.id) : next.add(sec.id);
                              return next;
                            })}
                            className="flex items-center gap-3 flex-1 text-left"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            {renamingSection === sec.id ? (
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onBlur={() => { handleRenameSection(sec.id, renameValue); }}
                                onKeyDown={e => { if (e.key === 'Enter') handleRenameSection(sec.id, renameValue); if (e.key === 'Escape') setRenamingSection(null); }}
                                onClick={e => e.stopPropagation()}
                                className="px-2 py-0.5 text-sm font-medium border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="font-medium text-slate-800">{sec.name}</span>
                            )}
                            {isInherited && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700">
                                <Link2 className="w-2.5 h-2.5" />Brand
                              </span>
                            )}
                            {!isInherited && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                <PenLine className="w-2.5 h-2.5" />Custom
                              </span>
                            )}
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{secItems.length}</span>
                          </button>

                          {/* Section action menu */}
                          <div className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSectionMenuOpen(sectionMenuOpen === sec.id ? null : sec.id); }}
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {sectionMenuOpen === sec.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setSectionMenuOpen(null)} />
                                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 min-w-[160px]">
                                  {!isInherited && (
                                    <button onClick={() => { setRenamingSection(sec.id); setRenameValue(sec.name); setSectionMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                                      <PenLine className="w-3.5 h-3.5 text-slate-400" />Rename
                                    </button>
                                  )}
                                  {secIdx > 0 && (
                                    <button onClick={() => handleMoveSection(sec.id, 'up')} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                                      <ArrowUp className="w-3.5 h-3.5 text-slate-400" />Move Up
                                    </button>
                                  )}
                                  {secIdx < sections.length - 1 && (
                                    <button onClick={() => handleMoveSection(sec.id, 'down')} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2">
                                      <ArrowDown className="w-3.5 h-3.5 text-slate-400" />Move Down
                                    </button>
                                  )}
                                  <div className="border-t border-slate-100 my-1" />
                                  <button onClick={() => handleDeleteSection(sec.id)} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                    <Trash2 className="w-3.5 h-3.5" />Remove Section
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Section items */}
                        {isExpanded && (
                          <div className="pb-2">
                            {secItems.length === 0 ? (
                              <p className="px-12 py-3 text-sm text-slate-400 italic">No items in this section</p>
                            ) : (
                              secItems.map(item => (
                                <div key={item.id} className="flex items-center group">
                                  <button
                                    onClick={() => setEditingItem(item)}
                                    className="flex-1 flex items-center gap-4 px-12 py-2.5 hover:bg-blue-50/50 transition-colors text-left"
                                  >
                                    <span className="flex-1 text-sm text-slate-700 group-hover:text-slate-900">
                                      {item.display_name ?? `Item #${item.sort_order}`}
                                    </span>
                                    {item.is_featured && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                                    {item.price_override != null && (
                                      <span className="text-xs text-slate-500">${Number(item.price_override).toFixed(2)}</span>
                                    )}
                                    {item.portion_size && (
                                      <span className="text-xs text-slate-400">{item.portion_size}</span>
                                    )}
                                    <Edit3 className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="p-1.5 mr-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))
                            )}

                            {/* Add Item inline form or button */}
                            {addingItemToSection === sec.id ? (
                              <AddItemInline
                                onAdd={(name, price) => handleAddFreeformItem(sec.id, name, price)}
                                onCancel={() => setAddingItemToSection(null)}
                              />
                            ) : (
                              <button
                                onClick={() => setAddingItemToSection(sec.id)}
                                className="flex items-center gap-2 px-12 py-2 text-xs font-medium text-slate-400 hover:text-blue-600 transition-colors w-full text-left"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add Item
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: schedules sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Schedules</h2>
                <button
                  onClick={() => { setEditingSchedule(null); setShowScheduleBuilder(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
              {schedules.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  <Clock className="w-7 h-7 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No schedules configured</p>
                  <p className="text-xs mt-1">Add a schedule to control when this menu is active</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {schedules.map(sch => {
                    const dp = getDaypartLabel(sch.daypart_definition_id);
                    const pl = getPlacementName(sch.placement_group_id);
                    return (
                      <div key={sch.id} className="p-3 hover:bg-slate-50 transition-colors group">
                        <div className="flex items-start justify-between gap-2">
                          <button onClick={() => { setEditingSchedule(sch); setShowScheduleBuilder(true); }} className="flex-1 text-left">
                            <p className="text-sm font-medium text-slate-800">{formatScheduleDescription(sch)}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${sch.schedule_type === 'one_time' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                {sch.schedule_type === 'one_time' ? 'One-time' : 'Recurring'}
                              </span>
                              {dp && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">{dp.display_label}</span>}
                              {pl && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600"><MapPin className="w-2.5 h-2.5 inline mr-0.5" />{pl}</span>}
                            </div>
                          </button>
                          <button onClick={() => handleDeleteSchedule(sch.id)} className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Menu info card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Menu Info</h3>
              <div className="space-y-2 text-sm">
                {selectedMenu.menu_type && (
                  <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="text-slate-800">{selectedMenu.menu_type}</span></div>
                )}
                {selectedMenu.daypart_definition_id && (
                  <div className="flex justify-between"><span className="text-slate-500">Default Daypart</span><span className="text-slate-800">{getDaypartLabel(selectedMenu.daypart_definition_id)?.display_label ?? '—'}</span></div>
                )}
                {selectedMenu.placement_group_id && (
                  <div className="flex justify-between"><span className="text-slate-500">Station</span><span className="text-slate-800">{getPlacementName(selectedMenu.placement_group_id) ?? '—'}</span></div>
                )}
                <div className="flex justify-between"><span className="text-slate-500">Created</span><span className="text-slate-800">{new Date(selectedMenu.created_at).toLocaleDateString()}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Section Dialog */}
        {showAddSection && (
          <AddSectionDialog
            brandSections={availableBrandSections}
            hasBrand={!!brandId}
            onAddCustom={handleAddCustomSection}
            onInherit={handleInheritSection}
            onClose={() => setShowAddSection(false)}
          />
        )}

        {showScheduleBuilder && selectedMenu && (
          <MenuScheduleBuilder
            menuId={selectedMenu.id}
            menuName={selectedMenu.name}
            existingSchedule={editingSchedule}
            placements={nonRootPlacements}
            dayparts={dayparts}
            onSave={handleSaveSchedule}
            onClose={() => { setShowScheduleBuilder(false); setEditingSchedule(null); }}
          />
        )}

        {editingItem && (
          <MenuItemEditor
            item={editingItem}
            sections={sections}
            onSave={handleSaveItem}
            onClose={() => setEditingItem(null)}
          />
        )}
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-xl font-bold text-slate-900">
            {brandName ? `Menus for ${brandName}` : 'Menu Management'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {onNavigateToCalendar && (
            <button onClick={onNavigateToCalendar} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <Calendar className="w-4 h-4" />
              Calendar
            </button>
          )}
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Create Menu
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search menus..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['all', 'active', 'draft', 'archived'] as StatusFilter[]).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${statusFilter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filteredMenus.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <Layers className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">No menus found</p>
          <p className="text-sm text-slate-400 mt-1">Create a menu to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMenus.map(menu => {
            const dp = getDaypartLabel(menu.daypart_definition_id);
            const pl = getPlacementName(menu.placement_group_id);
            const schCount = scheduleCounts[menu.id] ?? 0;
            return (
              <button key={menu.id} onClick={() => loadMenuDetail(menu)} className="w-full bg-white rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all text-left group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{menu.name}</h3>
                    {statusBadge(menu.status)}
                    {menu.menu_type && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">{menu.menu_type}</span>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {dp && <span className="flex items-center gap-1 text-xs text-slate-500"><Clock className="w-3 h-3" />{dp.display_label}</span>}
                  {pl && <span className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="w-3 h-3" />{pl}</span>}
                  <span className={`flex items-center gap-1 text-xs ${schCount > 0 ? 'text-emerald-600' : 'text-amber-500'}`}>
                    {schCount > 0 ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {schCount > 0 ? `${schCount} schedule${schCount > 1 ? 's' : ''}` : 'No schedules'}
                  </span>
                </div>
                {menu.description && <p className="text-xs text-slate-400 mt-1.5 truncate">{menu.description}</p>}
              </button>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateMenuModal brandId={brandId} dayparts={dayparts} placements={nonRootPlacements} onSave={handleCreateMenu} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

// ── Sub-components ──

function StatusDropdown({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const opts = ['active', 'draft', 'archived'];
  const colors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
    draft: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
    archived: 'bg-slate-100 text-slate-500 hover:bg-slate-200',
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${colors[status] ?? colors.draft}`}>
        {status} <ChevronDown className="w-3 h-3 inline ml-0.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 min-w-[120px]">
            {opts.map(o => (
              <button key={o} onClick={() => { onChange(o); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors capitalize">{o}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AddSectionDialog({ brandSections, hasBrand, onAddCustom, onInherit, onClose }: {
  brandSections: { id: string; brand_id: number; name: string; description: string | null; icon: string | null; color: string | null; sort_order: number }[];
  hasBrand: boolean;
  onAddCustom: (name: string) => void;
  onInherit: (bs: { id: string; brand_id: number; name: string; description: string | null; icon: string | null; color: string | null; sort_order: number }) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'inherit' | 'custom'>(hasBrand && brandSections.length > 0 ? 'inherit' : 'custom');
  const [customName, setCustomName] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Add Section</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {hasBrand && (
          <div className="flex border-b border-slate-100">
            <button onClick={() => setTab('inherit')} className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'inherit' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Link2 className="w-3.5 h-3.5 inline mr-1.5" />Inherit from Brand
            </button>
            <button onClick={() => setTab('custom')} className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'custom' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <PenLine className="w-3.5 h-3.5 inline mr-1.5" />Create Custom
            </button>
          </div>
        )}

        <div className="p-5">
          {tab === 'inherit' ? (
            brandSections.length === 0 ? (
              <div className="text-center py-6">
                <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-500">No brand sections available</p>
                <p className="text-xs text-slate-400 mt-1">All brand sections are already in this menu, or none have been created yet.</p>
                <button onClick={() => setTab('custom')} className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium">
                  Create a custom section instead
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {brandSections.map(bs => (
                  <button
                    key={bs.id}
                    onClick={() => onInherit(bs)}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50/30 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800 group-hover:text-teal-800">{bs.name}</span>
                      <Link2 className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-500" />
                    </div>
                    {bs.description && <p className="text-xs text-slate-400 mt-1">{bs.description}</p>}
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Section Name *</label>
                <input
                  autoFocus
                  type="text"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && customName.trim()) onAddCustom(customName); }}
                  placeholder="e.g. Entrees, Sides, Beverages"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button onClick={() => onAddCustom(customName)} disabled={!customName.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors">
                  Add Section
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddItemInline({ onAdd, onCancel }: { onAdd: (name: string, price: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  return (
    <div className="flex items-center gap-2 px-12 py-2 bg-blue-50/30 border-t border-blue-100">
      <Package className="w-3.5 h-3.5 text-blue-400 shrink-0" />
      <input
        autoFocus
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onAdd(name, price); if (e.key === 'Escape') onCancel(); }}
        placeholder="Item name"
        className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      />
      <div className="flex items-center gap-0.5">
        <span className="text-xs text-slate-400">$</span>
        <input
          type="text"
          value={price}
          onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onAdd(name, price); }}
          placeholder="0.00"
          className="w-16 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>
      <button onClick={() => { if (name.trim()) onAdd(name, price); }} disabled={!name.trim()} className="px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors">
        Add
      </button>
      <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-600">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function CreateMenuModal({ brandId, dayparts, placements, onSave, onClose }: {
  brandId?: number | null;
  dayparts: { id: string; display_label: string }[];
  placements: { id: string; name: string }[];
  onSave: (form: { name: string; description: string; menu_type: string; placement_group_id: string; daypart_definition_id: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [menuType, setMenuType] = useState('');
  const [placementId, setPlacementId] = useState('');
  const [daypartId, setDaypartId] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Create Menu</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Lunch Specials" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Menu Type</label>
            <input type="text" value={menuType} onChange={e => setMenuType(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Cycle, Daily Special" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Station</label>
              <select value={placementId} onChange={e => setPlacementId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Location-wide</option>
                {placements.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Daypart</label>
              <select value={daypartId} onChange={e => setDaypartId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Day</option>
                {dayparts.map(d => <option key={d.id} value={d.id}>{d.display_label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={() => onSave({ name, description, menu_type: menuType, placement_group_id: placementId, daypart_definition_id: daypartId })} disabled={!name.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors">
            Create Menu
          </button>
        </div>
      </div>
    </div>
  );
}
