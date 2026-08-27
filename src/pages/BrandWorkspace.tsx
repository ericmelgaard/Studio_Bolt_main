import { useState, useEffect, useRef } from 'react';
import {
  UtensilsCrossed, Plus, Search, Globe, Layers, X, Share2,
  ChevronRight, Calendar, Package, Palette, Image, Check,
  ArrowRight, Unlink, Building2, Info, Settings
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import BrandScheduleEditor from '../components/BrandScheduleEditor';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';

interface Brand {
  id: number;
  name: string;
  brand_type: string | null;
  scheduling_mode: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  visibility: string;
  parent_brand_id: number | null;
  is_wrapper: boolean;
  created_by_store_id: number | null;
  description: string | null;
  logo_path: string | null;
  brand_palette: string[] | null;
  menu_type_settings: Record<string, any> | null;
  design_notes: string | null;
}

interface BrandScheduleDays {
  [brandId: number]: number[];
}

interface BrandWorkspaceProps {
  userConceptId?: number | null;
  userCompanyId?: number | null;
  userStoreId?: number | null;
  isAdmin?: boolean;
  onBack?: () => void;
  onNavigateToBrandMenus?: (brandId: number, brandName: string) => void;
  onNavigateToScheduling?: () => void;
  onNavigateToProducts?: () => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0];

export default function BrandWorkspace({
  userConceptId, userCompanyId, userStoreId, isAdmin,
  onBack, onNavigateToBrandMenus, onNavigateToScheduling, onNavigateToProducts
}: BrandWorkspaceProps) {
  const { location, setLocation } = useLocation();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [scheduleDays, setScheduleDays] = useState<BrandScheduleDays>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateSubBrand, setShowCreateSubBrand] = useState(false);
  const [showLinkNationalBrand, setShowLinkNationalBrand] = useState(false);

  useEffect(() => { loadBrands(); }, [userConceptId, userCompanyId]);

  const loadBrands = async () => {
    setLoading(true);
    let brandIds: number[] = [];

    if (userConceptId) {
      brandIds = [userConceptId];
    } else if (userCompanyId) {
      const { data } = await supabase.from('company_brands').select('concept_id').eq('company_id', userCompanyId);
      if (data) brandIds = data.map(d => d.concept_id);
    } else if (userStoreId) {
      const { data: storeData } = await supabase.from('stores').select('company_id').eq('id', userStoreId).single();
      if (storeData?.company_id) {
        const { data } = await supabase.from('company_brands').select('concept_id').eq('company_id', storeData.company_id);
        if (data) brandIds = data.map(d => d.concept_id);
      }
    } else {
      const { data } = await supabase.from('company_brands').select('concept_id').limit(50);
      if (data) brandIds = [...new Set(data.map(d => d.concept_id))];
    }

    if (brandIds.length > 0) {
      const { data } = await supabase
        .from('concepts')
        .select('id, name, brand_type, scheduling_mode, brand_primary_color, brand_secondary_color, visibility, parent_brand_id, is_wrapper, created_by_store_id, description, logo_path, brand_palette, menu_type_settings, design_notes')
        .in('id', brandIds)
        .order('name');
      if (data) {
        setBrands(data);
        loadScheduleDays(data.map(b => b.id));
      }
    }
    setLoading(false);
  };

  const loadScheduleDays = async (brandIds: number[]) => {
    const { data } = await supabase.from('station_schedules').select('brand_id, days_of_week').in('brand_id', brandIds).eq('is_active', true);
    if (data) {
      const map: BrandScheduleDays = {};
      data.forEach(s => {
        if (!map[s.brand_id]) map[s.brand_id] = [];
        (s.days_of_week || []).forEach((d: number) => {
          if (!map[s.brand_id].includes(d)) map[s.brand_id].push(d);
        });
      });
      setScheduleDays(map);
    }
  };

  const handleCreateSubBrand = async (name: string, parentId: number | null, color: string) => {
    const companyId = userCompanyId || await resolveCompanyId();
    const { data, error } = await supabase
      .from('concepts')
      .insert({ name, visibility: 'local', parent_brand_id: parentId, created_by_store_id: userStoreId || null, is_wrapper: false, brand_type: 'localized', scheduling_mode: 'static', brand_primary_color: color })
      .select().maybeSingle();
    if (error) { console.error('Error creating sub-brand:', error); return; }
    if (data && companyId) {
      await supabase.from('company_brands').insert({ company_id: companyId, concept_id: data.id });
    }
    setShowCreateSubBrand(false);
    loadBrands();
  };

  const resolveCompanyId = async (): Promise<number | null> => {
    if (userCompanyId) return userCompanyId;
    if (userStoreId) {
      const { data } = await supabase.from('stores').select('company_id').eq('id', userStoreId).single();
      return data?.company_id || null;
    }
    return null;
  };

  const handleLinkNationalBrand = async (conceptId: number) => {
    const companyId = userCompanyId || await resolveCompanyId();
    if (!companyId) return;
    await supabase.from('company_brands').insert({ company_id: companyId, concept_id: conceptId });
    setShowLinkNationalBrand(false);
    loadBrands();
  };

  const handleUnlinkBrand = async (conceptId: number) => {
    const companyId = userCompanyId || await resolveCompanyId();
    if (!companyId) return;
    await supabase.from('company_brands').delete().eq('company_id', companyId).eq('concept_id', conceptId);
    if (selectedBrand?.id === conceptId) setSelectedBrand(null);
    loadBrands();
  };

  const getBreadcrumbItems = () => {
    const items = [{ label: 'WAND Digital', onClick: () => setLocation({}) }];
    if (location.concept) items.push({ label: location.concept.name, onClick: () => setLocation({ concept: location.concept }) });
    if (location.company) items.push({ label: location.company.name, onClick: () => setLocation({ concept: location.concept, company: location.company }) });
    if (location.store) items.push({ label: location.store.name });
    else if (!location.concept && !location.company) items.push({ label: 'All Locations' });
    return items;
  };

  const nationalBrands = brands.filter(b => b.visibility === 'national' && !b.is_wrapper);
  const wrapperBrands = brands.filter(b => b.is_wrapper);
  const localBrands = brands.filter(b => b.visibility === 'local');
  const filteredNational = searchQuery ? nationalBrands.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase())) : nationalBrands;
  const filteredLocal = searchQuery ? localBrands.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase())) : localBrands;
  const filteredWrappers = searchQuery
    ? wrapperBrands.filter(w => {
        const children = localBrands.filter(b => b.parent_brand_id === w.id);
        return w.name.toLowerCase().includes(searchQuery.toLowerCase()) || children.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
      })
    : wrapperBrands;

  if (selectedBrand) {
    return (
      <BrandDetailPanel
        brand={selectedBrand}
        userStoreId={userStoreId}
        isAdmin={isAdmin}
        onBack={() => setSelectedBrand(null)}
        onUnlink={isAdmin ? () => handleUnlinkBrand(selectedBrand.id) : undefined}
        onNavigateToBrandMenus={onNavigateToBrandMenus}
        onNavigateToScheduling={onNavigateToScheduling}
        onNavigateToProducts={onNavigateToProducts}
        onBrandUpdated={loadBrands}
      />
    );
  }

  return (
    <div className="max-w-[1800px] mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-[#00adf0] to-[#0099d6] rounded-lg">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Brand Management</h1>
              <Breadcrumb items={getBreadcrumbItems()} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button onClick={() => setShowLinkNationalBrand(true)} className="px-4 py-2 border-2 border-[#00adf0] bg-white hover:bg-slate-50 text-[#00adf0] rounded-lg transition-colors flex items-center gap-2">
                <Share2 className="w-4 h-4" /> Link National Brand
              </button>
            )}
            <button onClick={() => setShowCreateSubBrand(true)} className="px-4 py-2 bg-[#00adf0] text-white rounded-lg hover:bg-[#0099d6] transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Local Brand
            </button>
          </div>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>{brands.length} brand{brands.length !== 1 ? 's' : ''}</strong> linked to this location. Manage brand identities, design resources, and subscriptions.
          </p>
        </div>
      </div>

      {/* Station Schedule Overview */}
      {!loading && brands.length > 0 && (
        <StationScheduleOverview brands={brands} onSelectBrand={setSelectedBrand} />
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" placeholder="Search brands..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00adf0]"></div></div>
        ) : brands.length === 0 ? (
          <div className="text-center py-24">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-600">No brands linked yet</p>
            <p className="text-sm text-slate-400 mt-1 mb-6">Link a national brand or create a local one to get started.</p>
            <div className="flex items-center justify-center gap-3">
              {isAdmin && (
                <button onClick={() => setShowLinkNationalBrand(true)} className="px-4 py-2 border-2 border-[#00adf0] text-[#00adf0] rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2">
                  <Share2 className="w-4 h-4" /> Link National Brand
                </button>
              )}
              <button onClick={() => setShowCreateSubBrand(true)} className="px-4 py-2 bg-[#00adf0] text-white rounded-lg hover:bg-[#0099d6] transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create Local Brand
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-8">
            {filteredNational.length > 0 && (
              <BrandSection icon={<Globe className="w-4 h-4 text-[#00adf0]" />} title="National Brands" count={filteredNational.length} badgeColor="bg-blue-100 text-blue-700">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredNational.map(brand => (
                    <BrandOverviewCard key={brand.id} brand={brand} activeDays={scheduleDays[brand.id] || []} onSelect={() => setSelectedBrand(brand)} onUnlink={isAdmin ? () => handleUnlinkBrand(brand.id) : undefined} />
                  ))}
                </div>
              </BrandSection>
            )}
            {(filteredWrappers.length > 0 || filteredLocal.length > 0) && (
              <BrandSection icon={<Layers className="w-4 h-4 text-emerald-600" />} title="Sub-Brands" count={filteredLocal.length} badgeColor="bg-emerald-100 text-emerald-700">
                {filteredWrappers.map(wrapper => {
                  const children = filteredLocal.filter(b => b.parent_brand_id === wrapper.id);
                  if (children.length === 0) return null;
                  return (
                    <div key={wrapper.id} className="mb-6 last:mb-0">
                      <div className="flex items-center gap-2 mb-3 ml-1">
                        <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center"><Layers className="w-3.5 h-3.5 text-slate-500" /></div>
                        <span className="text-sm font-medium text-slate-600">{wrapper.name}</span>
                        <span className="text-xs text-slate-400">({children.length})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 ml-8">
                        {children.map(brand => (<BrandOverviewCard key={brand.id} brand={brand} activeDays={scheduleDays[brand.id] || []} onSelect={() => setSelectedBrand(brand)} isSubBrand />))}
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const orphans = filteredLocal.filter(b => !b.parent_brand_id || !wrapperBrands.find(w => w.id === b.parent_brand_id));
                  if (orphans.length === 0) return null;
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {orphans.map(brand => (<BrandOverviewCard key={brand.id} brand={brand} activeDays={scheduleDays[brand.id] || []} onSelect={() => setSelectedBrand(brand)} isSubBrand />))}
                    </div>
                  );
                })()}
              </BrandSection>
            )}
          </div>
        )}
      </div>

      {showCreateSubBrand && <CreateSubBrandModal wrapperBrands={wrapperBrands} onClose={() => setShowCreateSubBrand(false)} onCreate={handleCreateSubBrand} />}
      {showLinkNationalBrand && <LinkNationalBrandModal existingBrandIds={brands.map(b => b.id)} onClose={() => setShowLinkNationalBrand(false)} onLink={handleLinkNationalBrand} />}
    </div>
  );
}

/* ─── Section Wrapper ─── */

function BrandSection({ icon, title, count, badgeColor, children }: { icon: React.ReactNode; title: string; count: number; badgeColor: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h2>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{count}</span>
      </div>
      {children}
    </section>
  );
}

/* ─── Brand Card ─── */

function BrandOverviewCard({ brand, activeDays, onSelect, onUnlink, isSubBrand }: { brand: Brand; activeDays: number[]; onSelect: () => void; onUnlink?: () => void; isSubBrand?: boolean }) {
  const primaryColor = brand.brand_primary_color || '#64748b';
  const secondaryColor = brand.brand_secondary_color || '#94a3b8';

  return (
    <div onClick={onSelect} className="relative group bg-white rounded-xl border border-slate-200 hover:border-[#00adf0] hover:shadow-lg transition-all cursor-pointer overflow-hidden">
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${isSubBrand ? 'rounded-full' : 'rounded-lg'} flex items-center justify-center text-white font-bold text-lg shrink-0`} style={{ backgroundColor: primaryColor }}>{brand.name.charAt(0)}</div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 group-hover:text-[#00adf0] transition-colors truncate">{brand.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${brand.visibility === 'national' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {brand.visibility === 'national' ? 'National' : 'Local'}
                </span>
                <span className="text-xs text-slate-400 capitalize">{brand.scheduling_mode || 'static'}</span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#00adf0] transition-colors shrink-0 mt-1" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded border border-slate-200" style={{ backgroundColor: primaryColor }} title="Primary" />
            <div className="w-5 h-5 rounded border border-slate-200" style={{ backgroundColor: secondaryColor }} title="Secondary" />
            {brand.brand_palette && Array.isArray(brand.brand_palette) && brand.brand_palette.slice(0, 3).map((c, i) => (
              <div key={i} className="w-5 h-5 rounded border border-slate-200" style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="flex items-center gap-0.5">
            {DAY_LABELS.map((label, idx) => {
              const dayIndex = DAY_INDICES[idx];
              const isActive = activeDays.includes(dayIndex);
              return (
                <div key={idx} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${isActive ? 'text-white' : 'bg-slate-100 text-slate-300'}`} style={isActive ? { backgroundColor: primaryColor } : undefined}>
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {onUnlink && (
        <button onClick={(e) => { e.stopPropagation(); onUnlink(); }} className="absolute top-4 right-3 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition-all z-10" title="Unlink brand">
          <Unlink className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
        </button>
      )}
    </div>
  );
}

/* ─── Brand Detail Panel (bookmark nav + cycle schedule) ─── */

const DETAIL_SECTIONS = [
  { id: 'identity', label: 'Identity', icon: Info },
  { id: 'colors', label: 'Colors', icon: Palette },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'actions', label: 'Quick Actions', icon: ArrowRight },
  { id: 'companies', label: 'Linked Companies', icon: Building2 },
];

function BrandDetailPanel({ brand, userStoreId, isAdmin, onBack, onUnlink,
  onNavigateToBrandMenus, onNavigateToScheduling, onNavigateToProducts, onBrandUpdated
}: {
  brand: Brand;
  userStoreId?: number | null;
  isAdmin?: boolean;
  onBack: () => void;
  onUnlink?: () => void;
  onNavigateToBrandMenus?: (brandId: number, brandName: string) => void;
  onNavigateToScheduling?: () => void;
  onNavigateToProducts?: () => void;
  onBrandUpdated: () => void;
}) {
  const [activeSection, setActiveSection] = useState('identity');
  const contentRef = useRef<HTMLDivElement>(null);

  // Colors
  const [editingColors, setEditingColors] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(brand.brand_primary_color || '#64748b');
  const [secondaryColor, setSecondaryColor] = useState(brand.brand_secondary_color || '#94a3b8');
  const [savingColors, setSavingColors] = useState(false);

  // Companies
  const [linkedCompanies, setLinkedCompanies] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    loadLinkedCompanies();
  }, [brand.id]);

  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;
      const scrollPosition = window.scrollY + 200;
      for (let i = DETAIL_SECTIONS.length - 1; i >= 0; i--) {
        const el = document.querySelector(`[data-section="${DETAIL_SECTIONS[i].id}"]`);
        if (el && scrollPosition >= (el as HTMLElement).offsetTop) {
          setActiveSection(DETAIL_SECTIONS[i].id);
          return;
        }
      }
      setActiveSection(DETAIL_SECTIONS[0].id);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const el = document.querySelector(`[data-section="${sectionId}"]`);
    if (el) {
      const offset = 100;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - offset, behavior: 'smooth' });
    }
  };

  const loadLinkedCompanies = async () => {
    const { data } = await supabase.from('company_brands').select('company_id, companies(id, name)').eq('concept_id', brand.id);
    if (data) {
      setLinkedCompanies(data.map(d => ({ id: (d.companies as any)?.id, name: (d.companies as any)?.name || 'Unknown' })).filter(c => c.id));
    }
  };

  const handleSaveColors = async () => {
    setSavingColors(true);
    await supabase.from('concepts').update({ brand_primary_color: primaryColor, brand_secondary_color: secondaryColor }).eq('id', brand.id);
    setSavingColors(false);
    setEditingColors(false);
    onBrandUpdated();
  };

  const brandColor = brand.brand_primary_color || '#00adf0';

  return (
    <div className="max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-[#00adf0] to-[#0099d6] rounded-lg">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <button onClick={onBack} className="text-xl font-bold text-slate-400 hover:text-[#00adf0] transition-colors">Brands</button>
                <ChevronRight className="w-4 h-4 text-slate-400" />
                <h1 className="text-xl font-bold text-slate-900">{brand.name}</h1>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${brand.visibility === 'national' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {brand.visibility === 'national' ? <Globe className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                  {brand.visibility === 'national' ? 'National' : 'Local'}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5 capitalize">{brand.brand_type || 'Standard'} brand</p>
            </div>
          </div>
          {onUnlink && (
            <button onClick={onUnlink} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2 text-sm">
              <Unlink className="w-4 h-4" /> Unlink Brand
            </button>
          )}
        </div>
      </div>

      {/* Layout: Bookmark sidebar + Content */}
      <div className="flex gap-6">
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <div className="sticky top-4 space-y-3">
            <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
              <h3 className="text-xs font-semibold text-slate-900 mb-2 uppercase tracking-wide px-2">Sections</h3>
              <nav className="space-y-0.5">
                {DETAIL_SECTIONS.map(section => {
                  const Icon = section.icon;
                  return (
                    <button key={section.id} type="button" onClick={() => scrollToSection(section.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all ${
                        activeSection === section.id
                          ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600 -ml-px pl-1.5'
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

            {/* Design Resources -- Coming Soon link */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Image className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Design Resources</h3>
              </div>
              <p className="text-xs text-slate-400 mb-2">Fonts, logos, and brand images will be managed in the Asset Library.</p>
              <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-center">
                <p className="text-xs font-medium text-amber-700">Coming Soon</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div ref={contentRef} className="flex-1 min-w-0 space-y-6">

          {/* Identity Section */}
          <div data-section="identity" className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${brand.brand_primary_color || '#64748b'}, ${brand.brand_secondary_color || '#94a3b8'})` }} />
            <div className="p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Brand Identity</h2>
              <div className="flex items-start gap-6">
                <div className="w-24 h-24 rounded-xl flex items-center justify-center text-white font-bold text-3xl shrink-0 shadow-inner" style={{ backgroundColor: brandColor }}>
                  {brand.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900">{brand.name}</h3>
                  {brand.description && <p className="text-sm text-slate-500 mt-1">{brand.description}</p>}
                  <div className="flex flex-wrap gap-4 mt-3">
                    <div className="text-sm"><span className="text-slate-400">Type:</span> <span className="text-slate-700 font-medium capitalize">{brand.brand_type || 'Standard'}</span></div>
                  </div>
                  {brand.design_notes && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-medium text-amber-700 mb-0.5">Design Notes</p>
                      <p className="text-sm text-amber-900">{brand.design_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Colors Section */}
          <div data-section="colors" className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#00adf0]" /> Colors
              </h2>
              {!editingColors && (
                <button onClick={() => setEditingColors(true)} className="text-xs text-[#00adf0] hover:text-[#0099d6] font-medium transition-colors">Edit Colors</button>
              )}
            </div>
            {editingColors ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                      <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Secondary Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                      <input type="text" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setEditingColors(false); setPrimaryColor(brand.brand_primary_color || '#64748b'); setSecondaryColor(brand.brand_secondary_color || '#94a3b8'); }} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                  <button onClick={handleSaveColors} disabled={savingColors} className="px-4 py-1.5 text-sm bg-[#00adf0] text-white rounded-lg hover:bg-[#0099d6] disabled:opacity-50 transition-colors">{savingColors ? 'Saving...' : 'Save Colors'}</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <ColorSwatch color={brand.brand_primary_color || '#64748b'} label="Primary" />
                <ColorSwatch color={brand.brand_secondary_color || '#94a3b8'} label="Secondary" />
                {brand.brand_palette && Array.isArray(brand.brand_palette) && brand.brand_palette.map((c, i) => (
                  <ColorSwatch key={i} color={c} label={`Palette ${i + 1}`} />
                ))}
              </div>
            )}
          </div>

          {/* Schedule Section -- now a standalone component */}
          <BrandScheduleEditor
            brandId={brand.id}
            brandColor={brandColor}
            userStoreId={userStoreId}
            onNavigateToScheduling={onNavigateToScheduling}
          />

          {/* Quick Actions Section */}
          <div data-section="actions" className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {onNavigateToBrandMenus && (
                <button onClick={() => onNavigateToBrandMenus(brand.id, brand.name)} className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-[#00adf0] hover:bg-blue-50/50 transition-all group text-left">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-[#00adf0]/10 flex items-center justify-center text-slate-500 group-hover:text-[#00adf0] transition-colors shrink-0">
                    <UtensilsCrossed className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 group-hover:text-[#00adf0] transition-colors">Manage Menus</p>
                    <p className="text-xs text-slate-400">Menu zones and items</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#00adf0] transition-colors shrink-0" />
                </button>
              )}
              {onNavigateToScheduling && (
                <button onClick={onNavigateToScheduling} className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-[#00adf0] hover:bg-blue-50/50 transition-all group text-left">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-[#00adf0]/10 flex items-center justify-center text-slate-500 group-hover:text-[#00adf0] transition-colors shrink-0">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 group-hover:text-[#00adf0] transition-colors">Location Configuration</p>
                    <p className="text-xs text-slate-400">Dayparts and station setup</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#00adf0] transition-colors shrink-0" />
                </button>
              )}
              {onNavigateToProducts && (
                <button onClick={onNavigateToProducts} className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-[#00adf0] hover:bg-blue-50/50 transition-all group text-left">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-[#00adf0]/10 flex items-center justify-center text-slate-500 group-hover:text-[#00adf0] transition-colors shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 group-hover:text-[#00adf0] transition-colors">View Products</p>
                    <p className="text-xs text-slate-400">Product pool for this brand</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#00adf0] transition-colors shrink-0" />
                </button>
              )}
              {!onNavigateToBrandMenus && !onNavigateToScheduling && !onNavigateToProducts && (
                <p className="text-sm text-slate-400 col-span-3 text-center py-3">Navigation actions will appear once connected from your dashboard.</p>
              )}
            </div>
          </div>

          {/* Linked Companies Section */}
          <div data-section="companies" className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-[#00adf0]" /> Linked Companies
            </h2>
            {linkedCompanies.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {linkedCompanies.map(company => (
                  <div key={company.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-bold">{company.name.charAt(0)}</div>
                    <span className="text-sm font-medium text-slate-700">{company.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">No companies linked to this brand</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Small Components ─── */

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg border border-slate-200 shadow-inner" style={{ backgroundColor: color }} />
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xs font-mono text-slate-600">{color}</p>
      </div>
    </div>
  );
}

/* ─── Create Sub-Brand Modal ─── */

function CreateSubBrandModal({ wrapperBrands, onClose, onCreate }: { wrapperBrands: Brand[]; onClose: () => void; onCreate: (name: string, parentId: number | null, color: string) => void }) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<number | null>(wrapperBrands.length > 0 ? wrapperBrands[0].id : null);
  const [color, setColor] = useState('#3b82f6');
  const [saving, setSaving] = useState(false);
  const colorOptions = ['#3b82f6', '#6B4226', '#2D8B4E', '#dc2626', '#f59e0b', '#06b6d4', '#ec4899', '#14b8a6'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim(), parentId, color);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Create Local Brand</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Brand Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Coffee-764, Fresh Bowls" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" autoFocus />
          </div>
          {wrapperBrands.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Parent Brand Group</label>
              <select value={parentId || ''} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">None (standalone)</option>
                {wrapperBrands.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Brand Color</label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-lg border-2 transition-all ${color === c ? 'border-slate-900 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={!name.trim() || saving} className="px-4 py-2 text-sm font-medium text-white bg-[#00adf0] rounded-lg hover:bg-[#0099d6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{saving ? 'Creating...' : 'Create Brand'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Link National Brand Modal ─── */

function LinkNationalBrandModal({ existingBrandIds, onClose, onLink }: { existingBrandIds: number[]; onClose: () => void; onLink: (conceptId: number) => void }) {
  const [search, setSearch] = useState('');
  const [availableBrands, setAvailableBrands] = useState<Array<{ id: number; name: string; brand_primary_color: string | null; brand_type: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<number | null>(null);

  useEffect(() => { loadAvailableBrands(); }, []);

  const loadAvailableBrands = async () => {
    const { data } = await supabase.from('concepts').select('id, name, brand_primary_color, brand_type').eq('visibility', 'national').eq('is_wrapper', false).order('name');
    if (data) setAvailableBrands(data.filter(b => !existingBrandIds.includes(b.id)));
    setLoading(false);
  };

  const filtered = search.trim() ? availableBrands.filter(b => b.name.toLowerCase().includes(search.toLowerCase())) : availableBrands;

  const handleLink = async (id: number) => {
    setLinking(id);
    await onLink(id);
    setLinking(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Link National Brand</h2>
            <p className="text-sm text-slate-500 mt-0.5">Add an existing brand to this location</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="px-6 pt-4">
          <div className="relative">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brands..." className="w-full px-3 py-2.5 pl-9 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" autoFocus />
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00adf0]"></div></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{search ? 'No brands match your search' : 'All national brands are already linked'}</p>
            </div>
          ) : (
            filtered.map(brand => (
              <div key={brand.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: brand.brand_primary_color || '#3b82f6' }}>{brand.name.charAt(0)}</div>
                  <div>
                    <span className="text-sm font-medium text-slate-900">{brand.name}</span>
                    <span className="text-xs text-slate-500 ml-2 capitalize">{brand.brand_type || 'Standard'}</span>
                  </div>
                </div>
                <button onClick={() => handleLink(brand.id)} disabled={linking === brand.id} className="px-3 py-1.5 text-xs font-medium text-[#00adf0] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors">
                  {linking === brand.id ? 'Linking...' : 'Link'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Station Schedule Overview ─── */

interface ScheduleCell {
  brandId: number;
  brandName: string;
  brandColor: string;
  scheduleName: string;
  daypartLabel: string | null;
}

interface StationRow {
  stationId: number;
  stationName: string;
  daypartId: string | null;
  daypartLabel: string | null;
  daypartColor: string | null;
  cells: (ScheduleCell | null)[];
}

function StationScheduleOverview({ brands, onSelectBrand }: { brands: Brand[]; onSelectBrand: (b: Brand) => void }) {
  const [stations, setStations] = useState<Array<{ id: number; name: string; store_id: number | null }>>([]);
  const [groups, setGroups] = useState<Array<{ id: string; brand_id: number; start_date: string; end_date: string | null; recurrence_weeks: number | null; is_base: boolean; name: string | null }>>([]);
  const [entries, setEntries] = useState<Array<{ id: string; group_id: string; station_id: number; days_of_week: number[]; daypart_id: string | null }>>([]);
  const [daypartDefs, setDaypartDefs] = useState<Array<{ id: string; daypart_name: string; display_label: string; color: string }>>([]);
  const [expanded, setExpanded] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0];

  useEffect(() => { loadData(); }, [brands]);

  const loadData = async () => {
    const brandIds = brands.map(b => b.id);
    if (brandIds.length === 0) return;

    const [stationsRes, groupsRes, daypartsRes] = await Promise.all([
      supabase.from('stations').select('id, name, store_id').eq('status', 'active'),
      supabase.from('brand_schedule_groups').select('*').in('brand_id', brandIds),
      supabase.from('daypart_definitions').select('*'),
    ]);

    const loadedStations = (stationsRes.data || []) as typeof stations;
    const loadedGroups = (groupsRes.data || []) as typeof groups;
    setStations(loadedStations);
    setGroups(loadedGroups);
    setDaypartDefs((daypartsRes.data || []) as typeof daypartDefs);

    if (loadedGroups.length > 0) {
      const groupIds = loadedGroups.map(g => g.id);
      const { data: entriesData } = await supabase.from('brand_schedule_group_entries').select('*').in('group_id', groupIds);
      setEntries((entriesData || []) as typeof entries);
    } else {
      setEntries([]);
    }
  };

  const getMonday = (d: Date): Date => {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(mon.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  };

  const baseMonday = getMonday(new Date());
  const currentMonday = new Date(baseMonday);
  currentMonday.setDate(currentMonday.getDate() + weekOffset * 7);

  const resolveActiveGroup = (brandId: number, weekStart: Date) => {
    const brandGroups = groups.filter(g => g.brand_id === brandId);
    if (brandGroups.length === 0) return null;

    const weekMs = weekStart.getTime();
    const weekEnd = weekMs + 6 * 86400000;

    let bestOverride: typeof groups[0] | null = null;
    let bestStart = 0;

    for (const g of brandGroups) {
      if (g.is_base) continue;
      const gStart = new Date(g.start_date + 'T00:00:00').getTime();
      const gEnd = g.end_date ? new Date(g.end_date + 'T00:00:00').getTime() : null;

      let matches = false;
      if (g.recurrence_weeks && g.recurrence_weeks > 0) {
        const weeksBetween = Math.round((weekMs - gStart) / (7 * 86400000));
        if (weeksBetween >= 0 && weeksBetween % g.recurrence_weeks === 0) {
          if (!gEnd || weekMs <= gEnd) matches = true;
        }
      } else {
        if (gStart <= weekEnd && (!gEnd || gEnd >= weekMs)) matches = true;
      }

      if (matches && gStart >= bestStart) {
        bestOverride = g;
        bestStart = gStart;
      }
    }

    if (bestOverride) return bestOverride;
    return brandGroups.find(g => g.is_base) || null;
  };

  const buildRows = (): StationRow[] => {
    const rows: StationRow[] = [];
    const brandMap = new Map(brands.map(b => [b.id, b]));

    for (const station of stations) {
      const stationEntries = entries.filter(e => e.station_id === station.id);
      if (stationEntries.length === 0) {
        rows.push({
          stationId: station.id,
          stationName: station.name,
          daypartId: null,
          daypartLabel: null,
          daypartColor: null,
          cells: DAY_INDICES.map(() => null),
        });
        continue;
      }

      const daypartIds = [...new Set(stationEntries.map(e => e.daypart_id))];
      const hasMixedDayparts = daypartIds.length > 1 || (daypartIds.length === 1 && daypartIds[0] !== null);

      if (!hasMixedDayparts) {
        const cells = DAY_INDICES.map(dayIdx => {
          for (const brand of brands) {
            const activeGroup = resolveActiveGroup(brand.id, currentMonday);
            if (!activeGroup) continue;
            const matching = stationEntries.find(e => {
              if (e.group_id !== activeGroup.id) return false;
              return e.days_of_week.includes(dayIdx);
            });
            if (matching) {
              return {
                brandId: brand.id,
                brandName: brand.name,
                brandColor: brand.brand_primary_color || '#64748b',
                scheduleName: activeGroup.name || 'Default',
                daypartLabel: null,
              };
            }
          }
          return null;
        });
        rows.push({
          stationId: station.id,
          stationName: station.name,
          daypartId: null,
          daypartLabel: null,
          daypartColor: null,
          cells,
        });
      } else {
        for (const dpId of daypartIds) {
          const dpDef = dpId ? daypartDefs.find(d => d.id === dpId) : null;
          const dpEntries = stationEntries.filter(e => e.daypart_id === dpId);
          const cells = DAY_INDICES.map(dayIdx => {
            for (const brand of brands) {
              const activeGroup = resolveActiveGroup(brand.id, currentMonday);
              if (!activeGroup) continue;
              const matching = dpEntries.find(e => {
                if (e.group_id !== activeGroup.id) return false;
                return e.days_of_week.includes(dayIdx);
              });
              if (matching) {
                return {
                  brandId: brand.id,
                  brandName: brand.name,
                  brandColor: brand.brand_primary_color || '#64748b',
                  scheduleName: activeGroup.name || 'Default',
                  daypartLabel: dpDef?.display_label || null,
                };
              }
            }
            return null;
          });
          rows.push({
            stationId: station.id,
            stationName: dpId === daypartIds[0] ? station.name : '',
            daypartId: dpId,
            daypartLabel: dpDef?.display_label || 'All Day',
            daypartColor: dpDef?.color || null,
            cells,
          });
        }
      }
    }
    return rows;
  };

  const rows = buildRows();
  const gapCount = rows.reduce((count, row) => count + row.cells.filter(c => c === null).length, 0);
  const stationsWithGaps = new Set(rows.filter(r => r.cells.some(c => c === null)).map(r => r.stationId)).size;

  const todayDow = new Date().getDay();
  const todayColIdx = todayDow === 0 ? 6 : todayDow - 1;
  const isCurrentWeek = weekOffset === 0;

  const formatWeekRange = () => {
    const end = new Date(currentMonday);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
    return `${fmt(currentMonday)} - ${fmt(end)}`;
  };

  if (stations.length === 0 && groups.length === 0) return null;

  return (
    <div className="mb-4 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* Header - always visible */}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#00adf0]" />
          <span className="text-sm font-semibold text-slate-800">Station Schedule</span>
          <span className="text-xs text-slate-400">({stations.length} stations)</span>
        </div>
        <div className="flex items-center gap-3">
          {stationsWithGaps > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              {stationsWithGaps} station{stationsWithGaps !== 1 ? 's' : ''} with gaps
            </span>
          )}
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-slate-100">
          {/* Week navigation */}
          <div className="flex items-center justify-between py-3">
            <button onClick={() => setWeekOffset(w => w - 1)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">{formatWeekRange()}</span>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)}
                  className="text-[10px] text-[#00adf0] hover:text-[#0099d6] font-medium px-1.5 py-0.5 rounded bg-blue-50">
                  This Week
                </button>
              )}
            </div>
            <button onClick={() => setWeekOffset(w => w + 1)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[550px]">
              {/* Day headers */}
              <div className="grid grid-cols-[160px_repeat(7,1fr)] gap-px mb-1">
                <div />
                {DAY_LABELS.map((label, i) => (
                  <div key={i} className={`text-center text-[10px] font-semibold py-1 rounded-t ${
                    isCurrentWeek && i === todayColIdx
                      ? 'text-blue-700 bg-blue-50'
                      : 'text-slate-500'
                  }`}>
                    {label}
                    {isCurrentWeek && i === todayColIdx && (
                      <div className="w-1 h-1 rounded-full bg-blue-500 mx-auto mt-0.5" />
                    )}
                  </div>
                ))}
              </div>

              {/* Station rows */}
              {rows.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-400">No stations configured</div>
              ) : (
                rows.map((row, rowIdx) => (
                  <div key={`${row.stationId}-${row.daypartId || 'all'}`}
                    className={`grid grid-cols-[160px_repeat(7,1fr)] gap-px ${
                      row.stationName ? 'mt-0.5' : ''
                    }`}>
                    {/* Station label */}
                    <div className="flex items-center gap-2 pr-2 py-1.5">
                      {row.stationName ? (
                        <span className="text-xs font-medium text-slate-700 truncate">{row.stationName}</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 pl-3 truncate flex items-center gap-1">
                          {row.daypartColor && <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: row.daypartColor }} />}
                          {row.daypartLabel}
                        </span>
                      )}
                      {row.stationName && row.daypartLabel && (
                        <span className="text-[9px] text-slate-400 shrink-0 flex items-center gap-0.5">
                          {row.daypartColor && <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: row.daypartColor }} />}
                          {row.daypartLabel}
                        </span>
                      )}
                    </div>

                    {/* Day cells */}
                    {row.cells.map((cell, colIdx) => {
                      const isToday = isCurrentWeek && colIdx === todayColIdx;
                      const isHovered = hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx;
                      return (
                        <div key={colIdx}
                          className={`relative flex items-center justify-center py-1.5 rounded-sm transition-all ${
                            isToday ? 'bg-blue-50/50' : ''
                          }`}
                          onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx })}
                          onMouseLeave={() => setHoveredCell(null)}>
                          {cell ? (
                            <button
                              onClick={() => {
                                const brand = brands.find(b => b.id === cell.brandId);
                                if (brand) onSelectBrand(brand);
                              }}
                              className="w-full h-5 rounded-sm mx-0.5 transition-all hover:scale-y-125 hover:shadow-sm cursor-pointer"
                              style={{ backgroundColor: cell.brandColor, opacity: 0.85 }}
                              title={`${cell.brandName} — ${cell.scheduleName}`}
                            />
                          ) : (
                            <div className="w-full h-5 rounded-sm mx-0.5 bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" />
                              </svg>
                            </div>
                          )}

                          {/* Hover tooltip */}
                          {isHovered && cell && (
                            <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-white text-[10px] rounded shadow-lg whitespace-nowrap pointer-events-none">
                              <div className="font-medium">{cell.brandName}</div>
                              <div className="text-slate-300">{cell.scheduleName}</div>
                            </div>
                          )}
                          {isHovered && !cell && (
                            <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-amber-700 text-white text-[10px] rounded shadow-lg whitespace-nowrap pointer-events-none">
                              No schedule
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-3 rounded-sm bg-slate-500 opacity-85" />
                  <span className="text-[9px] text-slate-500">Brand assigned</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-3 rounded-sm bg-slate-50 border border-dashed border-slate-200" />
                  <span className="text-[9px] text-slate-500">Unscheduled</span>
                </div>
                <div className="flex-1" />
                <span className="text-[9px] text-slate-400">Click a cell to view brand</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
