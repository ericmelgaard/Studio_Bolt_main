import { useState, useEffect } from 'react';
import { Store, CreditCard as Edit2, Trash2, MapPin, Phone, Globe, Plus, Building2, Building, Layers, Clock, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { UserRole } from '../lib/supabase';
import Breadcrumb from '../components/Breadcrumb';
import MetricsBar from '../components/MetricsBar';
import ConceptsGrid from '../components/ConceptsGrid';
import CompaniesGrid from '../components/CompaniesGrid';
import StoresGrid from '../components/StoresGrid';
import ConceptModal from '../components/ConceptModal';
import CompanyModal from '../components/CompanyModal';
import StoreModal from '../components/StoreModal';
import CycleSettingsCard from '../components/CycleSettingsCard';
import StoreEditBeta from './StoreEditBeta';
import PlacementEditBeta from './PlacementEditBeta';
import CompanyEditBeta from './CompanyEditBeta';
import ConceptEditBeta from './ConceptEditBeta';
import * as Icons from 'lucide-react';

interface PlacementGroup {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  store_id: number | null;
  is_store_root: boolean;
  daypart_hours: Record<string, any>;
  meal_stations: string[];
  templates: Record<string, any>;
  nfc_url: string | null;
  address: string | null;
  timezone: string;
  phone: string | null;
  operating_hours: Record<string, any>;
  created_at: string;
}

interface ConceptData {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  brand_primary_color?: string;
  brand_secondary_color?: string;
}

interface CompanyData {
  id: number;
  concept_id: number;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
}

interface StoreData {
  id: number;
  company_id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
}

interface SiteConfigurationBetaProps {
  role?: UserRole;
  userId?: string;
}

export default function SiteConfigurationBeta({ role, userId }: SiteConfigurationBetaProps = {}) {
  const { location, setLocation, canNavigateBack, getPreviousLocation } = useLocation(role, userId);

  // Navigation state
  const [viewLevel, setViewLevel] = useState<'wand' | 'concept' | 'concept-edit' | 'company' | 'company-edit' | 'store' | 'store-edit' | 'placement-edit'>('wand');
  const [selectedConcept, setSelectedConcept] = useState<ConceptData | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyData | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreData | null>(null);
  const [editingPlacement, setEditingPlacement] = useState<PlacementGroup | null>(null);

  // Data state
  const [concepts, setConcepts] = useState<ConceptData[]>([]);
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [placements, setPlacements] = useState<PlacementGroup[]>([]);
  const [storeRoot, setStoreRoot] = useState<PlacementGroup | null>(null);
  const [operationSchedules, setOperationSchedules] = useState<any[]>([]);

  // Modal state
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [parentForNewPlacement, setParentForNewPlacement] = useState<string | null>(null);

  // Loading state
  const [loading, setLoading] = useState(true);

  // Determine view level and load data based on location context
  useEffect(() => {
    let level: 'wand' | 'concept' | 'company' | 'store' = 'wand';

    if (location.store) {
      level = 'store';
      setSelectedStore(location.store);
      setSelectedCompany(location.company || null);
      setSelectedConcept(location.concept || null);
    } else if (location.company) {
      level = 'company';
      setSelectedCompany(location.company);
      setSelectedConcept(location.concept || null);
      setSelectedStore(null);
    } else if (location.concept) {
      level = 'concept';
      setSelectedConcept(location.concept);
      setSelectedCompany(null);
      setSelectedStore(null);
    } else {
      level = 'wand';
      setSelectedConcept(null);
      setSelectedCompany(null);
      setSelectedStore(null);
    }

    setViewLevel(level);
    loadDataForLevel(level);
  }, [location]);

  const loadDataForLevel = async (level: 'wand' | 'concept' | 'company' | 'store') => {
    setLoading(true);

    if (level === 'wand') {
      await loadWandLevelData();
    } else if (level === 'concept') {
      await loadConceptLevelData();
    } else if (level === 'company') {
      await loadCompanyLevelData();
    } else if (level === 'store') {
      await loadStoreLevelData();
    }

    setLoading(false);
  };

  const loadWandLevelData = async () => {
    // Load all concepts
    const { data: conceptsData, error } = await supabase
      .from('concepts')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading concepts:', error);
      return;
    }

    // Load all companies to count by concept
    const { data: companiesData } = await supabase
      .from('companies')
      .select('id, concept_id');

    // Load all stores to count by concept
    const { data: storesData } = await supabase
      .from('stores')
      .select('id, company_id');

    // Build lookup maps
    const companiesByConceptId: Record<number, number> = {};
    const storesByCompanyId: Record<number, number> = {};

    (companiesData || []).forEach(company => {
      companiesByConceptId[company.concept_id] = (companiesByConceptId[company.concept_id] || 0) + 1;
    });

    (storesData || []).forEach(store => {
      storesByCompanyId[store.company_id] = (storesByCompanyId[store.company_id] || 0) + 1;
    });

    // Calculate store counts per concept
    const storesByConceptId: Record<number, number> = {};
    (companiesData || []).forEach(company => {
      const storeCount = storesByCompanyId[company.id] || 0;
      storesByConceptId[company.concept_id] = (storesByConceptId[company.concept_id] || 0) + storeCount;
    });

    // Attach counts to concepts
    const conceptsWithCounts = (conceptsData || []).map(concept => ({
      ...concept,
      company_count: companiesByConceptId[concept.id] || 0,
      store_count: storesByConceptId[concept.id] || 0
    }));

    setConcepts(conceptsWithCounts);
  };

  const loadConceptLevelData = async () => {
    if (!location.concept && !selectedConcept) return;

    const conceptId = location.concept?.id || selectedConcept?.id;

    // Load companies for this concept
    const { data: companiesData, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .eq('concept_id', conceptId)
      .order('name');

    if (companiesError) {
      console.error('Error loading companies:', companiesError);
      return;
    }

    // Load all stores for companies in this concept
    const companyIds = (companiesData || []).map(c => c.id);

    let allStoresData = [];
    if (companyIds.length > 0) {
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('*')
        .in('company_id', companyIds);

      if (storesError) {
        console.error('Error loading stores:', storesError);
      } else {
        allStoresData = storesData || [];
      }
    }

    // Count stores by company
    const storesByCompanyId: Record<number, number> = {};
    allStoresData.forEach(store => {
      storesByCompanyId[store.company_id] = (storesByCompanyId[store.company_id] || 0) + 1;
    });

    // Attach store counts to companies
    const companiesWithCounts = (companiesData || []).map(company => ({
      ...company,
      store_count: storesByCompanyId[company.id] || 0
    }));

    setCompanies(companiesWithCounts);
    setStores(allStoresData);
  };

  const loadCompanyLevelData = async () => {
    if (!location.company && !selectedCompany) return;

    const companyId = location.company?.id || selectedCompany?.id;

    const { data: storesData, error } = await supabase
      .from('stores')
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    if (error) {
      console.error('Error loading stores:', error);
    } else {
      setStores(storesData || []);
    }
  };

  const loadStoreLevelData = async () => {
    if (!location.store && !selectedStore) return;

    const storeId = location.store?.id || selectedStore?.id;

    const { data: rootData, error: rootError } = await supabase
      .from('placement_groups')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_store_root', true)
      .maybeSingle();

    if (rootError) {
      console.error('Error loading store root:', rootError);
    } else {
      setStoreRoot(rootData);
    }

    const { data: placementsData, error: placementsError } = await supabase
      .from('placement_groups')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_store_root', false)
      .order('name');

    if (placementsError) {
      console.error('Error loading placements:', placementsError);
    } else {
      setPlacements(placementsData || []);
    }

    const { data: scheduleData, error: scheduleError } = await supabase
      .from('store_operation_hours_schedules')
      .select('*')
      .eq('store_id', storeId)
      .eq('schedule_type', 'regular')
      .order('priority_level', { ascending: false });

    if (scheduleError) {
      console.error('Error loading power save schedules:', scheduleError);
    } else {
      setOperationSchedules(scheduleData || []);
    }
  };

  const renderIcon = (iconName?: string) => {
    if (!iconName) return <Building2 size={24} />;
    const IconComponent = Icons[iconName as keyof typeof Icons] as any;
    return IconComponent ? <IconComponent size={24} /> : <Building2 size={24} />;
  };

  const handleEditConcept = () => {
    if (selectedConcept) {
      setViewLevel('concept-edit');
    }
  };

  const handleEditCompany = () => {
    if (selectedCompany) {
      setViewLevel('company-edit');
    }
  };

  const handleEditStore = () => {
    if (storeRoot) {
      setEditingPlacement(storeRoot);
      setViewLevel('placement-edit');
    }
  };

  const handleAddPlacement = (parentId: string | null = null) => {
    setEditingPlacement({
      id: undefined,
      name: '',
      parent_id: parentId,
      store_id: selectedStore?.id || null,
      is_store_root: false,
      daypart_hours: {},
      meal_stations: [],
      templates: {},
      nfc_url: null,
      address: null,
      timezone: 'America/New_York',
      phone: null,
      operating_hours: {},
      description: null,
      created_at: new Date().toISOString()
    } as PlacementGroup);
    setParentForNewPlacement(parentId);
    setViewLevel('placement-edit');
  };

  const handleEditPlacement = (placement: PlacementGroup) => {
    setEditingPlacement(placement);
    setViewLevel('placement-edit');
  };

  const handleDeletePlacement = async (placement: PlacementGroup) => {
    if (placement.is_store_root) {
      alert('Cannot delete store root placement');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${placement.name}"?`)) {
      return;
    }

    const { error } = await supabase
      .from('placement_groups')
      .delete()
      .eq('id', placement.id);

    if (error) {
      console.error('Error deleting placement:', error);
      alert(`Failed to delete placement: ${error.message}`);
    } else {
      loadStoreLevelData();
    }
  };

  const availableParents = placements.filter((p) => p.id !== editingItem?.id);
  if (storeRoot && editingItem?.id !== storeRoot.id) {
    availableParents.unshift(storeRoot);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  const getBreadcrumbItems = () => {
    if (viewLevel === 'store-edit') {
      return [
        { label: 'Site Configuration', onClick: () => setViewLevel('store') },
        { label: 'Edit Store' }
      ];
    }

    if (viewLevel === 'placement-edit') {
      return [
        { label: 'Site Configuration', onClick: () => setViewLevel('store') },
        { label: 'Edit Placement' }
      ];
    }

    const items = [
      { label: 'WAND Digital', onClick: () => setLocation({}) }
    ];

    if (selectedConcept) {
      items.push({
        label: selectedConcept.name,
        onClick: () => setLocation({ concept: selectedConcept })
      });
    }

    if (selectedCompany) {
      items.push({
        label: selectedCompany.name,
        onClick: () => setLocation({
          concept: selectedConcept || location.concept,
          company: selectedCompany
        })
      });
    }

    if (selectedStore) {
      items.push({
        label: selectedStore.name,
        onClick: undefined
      });
    }

    return items;
  };

  // WAND Digital Level View
  if (viewLevel === 'wand' && !location.concept && !location.company && !location.store) {
    const totalConcepts = concepts.length;
    const totalCompanies = concepts.reduce((sum, c) => sum + (c.company_count || 0), 0);
    const totalStores = concepts.reduce((sum, c) => sum + (c.store_count || 0), 0);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-[#00adf0] to-[#0099d6] rounded-lg">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Locations</h1>
                <Breadcrumb items={getBreadcrumbItems()} />
              </div>
            </div>
            <p className="text-slate-600">Manage your organizational hierarchy and locations</p>
          </div>

          <MetricsBar
            metrics={[
              { label: 'Total Brands', value: totalConcepts, icon: Building2, color: 'bg-blue-500' },
              { label: 'Total Companies', value: totalCompanies, icon: Building2, color: 'bg-green-500' },
              { label: 'Total Stores', value: totalStores, icon: Store, color: 'bg-purple-500' }
            ]}
          />

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">Brands</h2>
              <button
                onClick={() => {
                  setSelectedConcept(null);
                  setViewLevel('concept-edit');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} />
                Add Concept
              </button>
            </div>

            <ConceptsGrid
              concepts={concepts}
              onEdit={(concept) => {
                setSelectedConcept(concept);
                setViewLevel('concept-edit');
              }}
              onSelect={(concept) => {
                setLocation({ concept });
              }}
            />
          </div>
        </div>

        {showConceptModal && (
          <ConceptModal
            concept={editingItem}
            onClose={() => {
              setShowConceptModal(false);
              setEditingItem(null);
            }}
            onSave={() => {
              setShowConceptModal(false);
              setEditingItem(null);
              loadWandLevelData();
            }}
          />
        )}
      </div>
    );
  }

  // Concept Edit View
  if (viewLevel === 'concept-edit') {
    return (
      <ConceptEditBeta
        conceptId={selectedConcept?.id}
        conceptName={selectedConcept?.name}
        onBack={() => {
          if (selectedConcept) {
            setViewLevel('concept');
          } else {
            setViewLevel('wand');
          }
        }}
        onSave={(concept) => {
          if (concept.id) {
            setSelectedConcept(concept);
            setViewLevel('concept');
            loadConceptLevelData();
          } else {
            setViewLevel('wand');
            loadWandLevelData();
          }
        }}
        onDelete={() => {
          setSelectedConcept(null);
          setViewLevel('wand');
          loadWandLevelData();
        }}
      />
    );
  }

  // Concept Level View
  if (viewLevel === 'concept' && selectedConcept) {
    const totalCompanies = companies.length;
    const totalStores = companies.reduce((sum, c) => sum + (c.store_count || 0), 0);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[#00adf0] to-[#0099d6] rounded-lg">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Brand Configuration</h1>
                  <Breadcrumb items={getBreadcrumbItems()} />
                </div>
              </div>
              <button
                onClick={handleEditConcept}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit Concept
              </button>
            </div>
            <p className="text-slate-600">Manage companies and settings</p>
          </div>

          <MetricsBar
            metrics={[
              { label: 'Companies', value: totalCompanies, icon: Building2, color: 'bg-green-500' },
              { label: 'Total Stores', value: totalStores, icon: Store, color: 'bg-purple-500' }
            ]}
          />

          <div className="mb-6">
            <CycleSettingsCard conceptId={selectedConcept.id} />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">Companies</h2>
              <button
                onClick={() => {
                  setSelectedCompany(null);
                  setViewLevel('company-edit');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} />
                Add Company
              </button>
            </div>

            <CompaniesGrid
              companies={companies}
              onEdit={(company) => {
                setSelectedCompany(company);
                setViewLevel('company-edit');
              }}
              onSelect={(company) => {
                setLocation({
                  concept: selectedConcept || location.concept,
                  company
                });
              }}
            />
          </div>
        </div>

        {showConceptModal && (
          <ConceptModal
            concept={editingItem}
            onClose={() => {
              setShowConceptModal(false);
              setEditingItem(null);
            }}
            onSave={() => {
              setShowConceptModal(false);
              setEditingItem(null);
              loadConceptLevelData();
            }}
          />
        )}

        {showCompanyModal && (
          <CompanyModal
            company={editingItem}
            conceptId={selectedConcept.id}
            onClose={() => {
              setShowCompanyModal(false);
              setEditingItem(null);
            }}
            onSave={() => {
              setShowCompanyModal(false);
              setEditingItem(null);
              loadConceptLevelData();
            }}
          />
        )}
      </div>
    );
  }

  // Company Edit View
  if (viewLevel === 'company-edit') {
    return (
      <CompanyEditBeta
        companyId={selectedCompany?.id}
        conceptId={selectedConcept?.id || location.concept?.id || 0}
        conceptName={selectedConcept?.name || location.concept?.name}
        companyName={selectedCompany?.name}
        onBack={() => {
          if (selectedCompany) {
            setViewLevel('company');
          } else {
            setViewLevel('concept');
          }
        }}
        onSave={(company) => {
          if (company.id) {
            setSelectedCompany(company);
            setViewLevel('company');
            loadCompanyLevelData();
          } else {
            setViewLevel('concept');
            loadConceptLevelData();
          }
        }}
        onDelete={() => {
          setSelectedCompany(null);
          setViewLevel('concept');
          loadConceptLevelData();
        }}
      />
    );
  }

  // Company Level View
  if (viewLevel === 'company' && selectedCompany) {
    const totalStores = stores.length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[#00adf0] to-[#0099d6] rounded-lg">
                  <Building className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Company Configuration</h1>
                  <Breadcrumb items={getBreadcrumbItems()} />
                </div>
              </div>
              <button
                onClick={handleEditCompany}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit Company
              </button>
            </div>
            <p className="text-slate-600">Manage stores and settings</p>
          </div>

          <MetricsBar
            metrics={[
              { label: 'Total Stores', value: totalStores, icon: Store, color: 'bg-purple-500' }
            ]}
          />

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">Stores</h2>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setShowStoreModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} />
                Add Store
              </button>
            </div>

            <StoresGrid
              stores={stores}
              onEdit={(store) => {
                setEditingItem(store);
                setShowStoreModal(true);
              }}
              onSelect={(store) => {
                setLocation({
                  concept: selectedConcept || location.concept,
                  company: selectedCompany || location.company,
                  store
                });
              }}
            />
          </div>
        </div>

        {showCompanyModal && (
          <CompanyModal
            company={editingItem}
            conceptId={selectedCompany.concept_id}
            onClose={() => {
              setShowCompanyModal(false);
              setEditingItem(null);
            }}
            onSave={() => {
              setShowCompanyModal(false);
              setEditingItem(null);
              loadCompanyLevelData();
            }}
          />
        )}

        {showStoreModal && (
          <StoreModal
            store={editingItem}
            companyId={selectedCompany.id}
            onClose={() => {
              setShowStoreModal(false);
              setEditingItem(null);
            }}
            onSave={() => {
              setShowStoreModal(false);
              setEditingItem(null);
              loadCompanyLevelData();
            }}
          />
        )}
      </div>
    );
  }

  // Store Level View (existing placement configuration)
  const hasStoreContext = location.store || selectedStore;
  const currentStore = location.store || selectedStore;

  const previousLocation = getPreviousLocation();
  const cameFromCompanyLevel = previousLocation?.company && !previousLocation?.store;

  const getHeaderContent = () => {
    if (viewLevel === 'store-edit') {
      return {
        icon: Store,
        title: selectedStore?.name || 'Store Settings',
        subtitle: 'Configure store details, operating hours, and daypart schedules'
      };
    } else if (viewLevel === 'placement-edit') {
      return {
        icon: MapPin,
        title: editingPlacement?.name || 'Placement Configuration',
        subtitle: 'Configure placement settings and menu assignments'
      };
    } else {
      return {
        icon: Store,
        title: 'Store Configuration',
        subtitle: 'Manage store settings and placement groups'
      };
    }
  };

  const headerContent = getHeaderContent();
  const HeaderIcon = headerContent.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-[#00adf0] to-[#0099d6] rounded-lg">
              <HeaderIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{headerContent.title}</h1>
              <Breadcrumb items={getBreadcrumbItems()} />
            </div>
          </div>
          <p className="text-slate-600">{headerContent.subtitle}</p>
        </div>

        {viewLevel === 'placement-edit' ? (
          <PlacementEditBeta
            placementId={editingPlacement?.id}
            storeId={editingPlacement?.store_id || selectedStore?.id || undefined}
            parentId={parentForNewPlacement || editingPlacement?.parent_id}
            conceptName={selectedConcept?.name}
            companyName={selectedCompany?.name}
            storeName={selectedStore?.name}
            placementName={editingPlacement?.name}
            onBack={() => {
              setViewLevel('store');
              setEditingPlacement(null);
              setParentForNewPlacement(null);
            }}
            onSave={async () => {
              setViewLevel('store');
              setEditingPlacement(null);
              setParentForNewPlacement(null);
              await loadStoreLevelData();
            }}
            onDelete={editingPlacement?.id && !editingPlacement?.is_store_root ? async () => {
              await handleDeletePlacement(editingPlacement);
              setViewLevel('store');
              setEditingPlacement(null);
              setParentForNewPlacement(null);
            } : undefined}
            onNavigate={(level) => {
              if (level === 'wand') {
                setLocation({});
              } else if (level === 'concept' && selectedConcept) {
                setLocation({ concept: selectedConcept });
              } else if (level === 'company' && selectedConcept && selectedCompany) {
                setLocation({ concept: selectedConcept, company: selectedCompany });
              } else if (level === 'store' && selectedConcept && selectedCompany && selectedStore) {
                setLocation({ concept: selectedConcept, company: selectedCompany, store: selectedStore });
              }
              setViewLevel('store');
              setEditingPlacement(null);
              setParentForNewPlacement(null);
            }}
          />
        ) : viewLevel === 'store-edit' && selectedStore && selectedCompany ? (
          <StoreEditBeta
            storeId={selectedStore.id}
            companyId={selectedCompany.id}
            conceptName={selectedConcept?.name}
            companyName={selectedCompany?.name}
            storeName={selectedStore?.name}
            onBack={() => setViewLevel('store')}
            onSave={async () => {
              setViewLevel('store');
              await loadStoreLevelData();
            }}
            onNavigate={(level) => {
              if (level === 'wand') {
                setLocation({});
              } else if (level === 'concept' && selectedConcept) {
                setLocation({ concept: selectedConcept });
              } else if (level === 'company' && selectedConcept && selectedCompany) {
                setLocation({ concept: selectedConcept, company: selectedCompany });
              } else if (level === 'store' && selectedConcept && selectedCompany && selectedStore) {
                setLocation({ concept: selectedConcept, company: selectedCompany, store: selectedStore });
              }
              setViewLevel('store');
            }}
          />
        ) : hasStoreContext ? (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">Store Configuration</h2>
                    <p className="text-sm text-slate-600">
                      Manage location details, hours, and store-level settings
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewLevel('store-edit')}
                      disabled={!storeRoot}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit Store
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {storeRoot ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">Location Information</h3>
                      <div className="space-y-3">
                        {storeRoot.address ? (
                          <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                            <div>
                              <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Address</div>
                              <div className="text-sm text-slate-900">{storeRoot.address}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400 italic">No address configured</div>
                        )}
                        {storeRoot.phone && (
                          <div className="flex items-start gap-3">
                            <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
                            <div>
                              <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Phone</div>
                              <div className="text-sm text-slate-900">{storeRoot.phone}</div>
                            </div>
                          </div>
                        )}
                        {storeRoot.timezone && (
                          <div className="flex items-start gap-3">
                            <Globe className="w-5 h-5 text-slate-400 mt-0.5" />
                            <div>
                              <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Timezone</div>
                              <div className="text-sm text-slate-900">{storeRoot.timezone}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">Power Save Schedules</h3>
                      {operationSchedules.length > 0 ? (
                        <div className="space-y-2">
                          {operationSchedules.map((schedule) => {
                            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                            const sortedDays = [...(schedule.days_of_week || [])].sort((a, b) => a - b);
                            const dayLabels = sortedDays.map(d => dayNames[d]);

                            let dayRange = '';
                            if (dayLabels.length === 7) {
                              dayRange = 'Every Day';
                            } else if (dayLabels.length === 5 && sortedDays.every((d, i) => d === i + 1)) {
                              dayRange = 'Weekdays';
                            } else if (dayLabels.length === 2 && sortedDays.includes(0) && sortedDays.includes(6)) {
                              dayRange = 'Weekends';
                            } else if (sortedDays.length > 2 && sortedDays[sortedDays.length - 1] - sortedDays[0] === sortedDays.length - 1) {
                              dayRange = `${dayLabels[0]}-${dayLabels[dayLabels.length - 1]}`;
                            } else {
                              dayRange = dayLabels.join(', ');
                            }

                            return (
                              <div key={schedule.id} className="flex items-center justify-between text-sm">
                                <span className="text-slate-600 font-medium">
                                  {schedule.schedule_name || dayRange}
                                  {schedule.schedule_name && <span className="text-slate-400 text-xs ml-1">({dayRange})</span>}
                                </span>
                                {schedule.is_closed ? (
                                  <span className="text-slate-400 italic">Power Save</span>
                                ) : (
                                  <span className="text-slate-900 font-mono">
                                    {schedule.open_time?.substring(0, 5)} - {schedule.close_time?.substring(0, 5)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400 italic">No power save schedules configured</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 mb-4">Store configuration not initialized</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">Placements</h2>
                    <p className="text-sm text-slate-600">
                      Organize areas within the store with hierarchical placements
                    </p>
                  </div>
                  <button
                    onClick={() => handleAddPlacement(storeRoot?.id || null)}
                    disabled={!storeRoot}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    Add Placement Group
                  </button>
                </div>
              </div>

              <div className="p-6">
                {placements.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Store className="w-8 h-8 text-amber-600" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 mb-2">No placements yet</h3>
                    <p className="text-slate-600 mb-4 text-sm">
                      Create placements to organize different areas within the store
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const calculateDepth = (placementId: string, visited = new Set<string>()): number => {
                        if (visited.has(placementId)) return 0;
                        visited.add(placementId);

                        const placement = placements.find(p => p.id === placementId);
                        if (!placement || !placement.parent_id || placement.parent_id === storeRoot?.id) {
                          return 0;
                        }
                        return 1 + calculateDepth(placement.parent_id, visited);
                      };

                      const buildHierarchy = (parentId: string | null | undefined): PlacementGroup[] => {
                        const children = placements
                          .filter(p => {
                            if (parentId === storeRoot?.id) {
                              return p.parent_id === parentId || p.parent_id === null;
                            }
                            return p.parent_id === parentId;
                          })
                          .sort((a, b) => a.name.localeCompare(b.name));

                        const result: PlacementGroup[] = [];
                        for (const child of children) {
                          result.push(child);
                          const descendants = buildHierarchy(child.id);
                          result.push(...descendants);
                        }
                        return result;
                      };

                      return buildHierarchy(storeRoot?.id).map((placement) => {
                        const parentName = placement.parent_id
                          ? (placements.find(p => p.id === placement.parent_id)?.name || storeRoot?.name || 'Unknown')
                          : storeRoot?.name || 'Store Root';

                        const depth = calculateDepth(placement.id);
                        const childCount = placements.filter(p => p.parent_id === placement.id).length;

                        return (
                          <div key={placement.id} style={{ marginLeft: `${depth * 2.5}rem` }}>
                            <button
                              onClick={() => handleEditPlacement(placement)}
                              className="w-full flex items-center gap-4 p-4 border border-slate-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 transition-all group text-left hover:shadow-sm"
                            >
                              <div className="w-1 h-10 bg-amber-400 rounded-full" />
                              <Layers className="w-5 h-5 text-amber-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-slate-900">{placement.name}</h3>
                                {placement.description && (
                                  <p className="text-sm text-slate-600">{placement.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                  <span>Parent: {parentName}</span>
                                  {childCount > 0 && (
                                    <>
                                      <span>•</span>
                                      <span>{childCount} child placement{childCount !== 1 ? 's' : ''}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddPlacement(placement.id);
                                  }}
                                  className="px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors flex items-center gap-2 opacity-0 group-hover:opacity-100"
                                >
                                  <Plus className="w-4 h-4" />
                                  Add
                                </button>
                                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-600 transition-colors" />
                              </div>
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <MapPin className="w-6 h-6 text-amber-600" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">Site Selection Required</h3>
                <p className="text-sm text-amber-800">
                  Please select a site to view and manage its configuration.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
