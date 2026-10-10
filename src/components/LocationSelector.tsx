import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, X, Building2, Layers, MapPin, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStoreAccess } from '../hooks/useStoreAccess';

// Standardized icon mapping for location hierarchy
const getLocationIcon = (level: 'wand' | 'concept' | 'company' | 'store', className = "w-5 h-5") => {
  const colorClass = level === 'wand' ? 'text-purple-600' :
                     level === 'concept' ? 'text-blue-600' :
                     level === 'company' ? 'text-green-600' :
                     'text-red-600 dark:text-red-400';

  switch (level) {
    case 'wand':
      return <Sparkles className={`${className} ${colorClass}`} />;
    case 'concept':
      return <Building2 className={`${className} ${colorClass}`} />;
    case 'company':
      return <Layers className={`${className} ${colorClass}`} />;
    case 'store':
      return <MapPin className={`${className} ${colorClass}`} />;
  }
};

interface Concept {
  id: number;
  name: string;
}

interface Company {
  id: number;
  name: string;
  concept_id: number;
}

interface Store {
  id: number;
  name: string;
  company_id: number;
}

interface LocationSelectorProps {
  onClose: () => void;
  onSelect: (location: {
    concept?: Concept;
    company?: Company;
    store?: Store;
  }) => void;
  selectedLocation?: {
    concept?: Concept;
    company?: Company;
    store?: Store;
  };
  filterByConceptId?: number;
  userId?: string;
}

export default function LocationSelector({ onClose, onSelect, selectedLocation, filterByConceptId, userId }: LocationSelectorProps) {
  const { accessibleStores, loading: storesLoading } = useStoreAccess({ userId });
  const [searchQuery, setSearchQuery] = useState('');
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isMultiStoreUser, setIsMultiStoreUser] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [expandedConcepts, setExpandedConcepts] = useState<Set<number>>(new Set());
  const [expandedCompanies, setExpandedCompanies] = useState<Set<number>>(new Set());

  const [viewContext, setViewContext] = useState<{
    concept?: Concept;
    company?: Company;
    store?: Store;
  }>({});

  const [loading, setLoading] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState<Set<number>>(new Set());
  const [loadingStores, setLoadingStores] = useState<Set<number>>(new Set());

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Prevent scrollbar jump by adding padding
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, []);

  useEffect(() => {
    const initializeData = async () => {
      await loadData();

      // Set view context - if we're at a store, viewContext shows up to company level
      // This filters the tree to show only the relevant concept/company path
      if (selectedLocation?.store) {
        setViewContext({
          concept: selectedLocation.concept,
          company: selectedLocation.company
        });
      } else {
        setViewContext(selectedLocation || {});
      }

      // Auto-expand to the current location in the tree
      if (selectedLocation?.concept) {
        setExpandedConcepts(new Set([selectedLocation.concept.id]));
      }
      if (selectedLocation?.company) {
        setExpandedCompanies(new Set([selectedLocation.company.id]));
        // Auto-load stores for the current company after data is loaded
        await loadStoresForCompany(selectedLocation.company.id);
      }
    };

    initializeData();
  }, [accessibleStores, storesLoading]);

  const loadData = async () => {
    if (storesLoading) return;

    setLoading(true);

    // Check if user has multi-store access via user_store_access table
    let isAdmin = false;
    if (userId) {
      const { data: userAccess } = await supabase
        .from('user_store_access')
        .select('store_id')
        .eq('user_id', userId);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      isAdmin = profile?.role === 'admin';
      setUserRole(profile?.role || null);
      setIsMultiStoreUser((userAccess && userAccess.length > 0) || false);
    }

    // For admin users, load all concepts, companies, AND stores upfront
    if (isAdmin) {
      let conceptsQuery = supabase
        .from('concepts')
        .select('*')
        .order('name');

      let companiesQuery = supabase
        .from('companies')
        .select('*')
        .order('name');

      if (filterByConceptId) {
        conceptsQuery = conceptsQuery.eq('id', filterByConceptId);
        companiesQuery = companiesQuery.eq('concept_id', filterByConceptId);
      }

      const [conceptsData, companiesData] = await Promise.all([conceptsQuery, companiesQuery]);

      if (conceptsData.data) setConcepts(conceptsData.data);
      if (companiesData.data) setCompanies(companiesData.data);

      // Fetch ALL stores using pagination to avoid the 1000 row limit
      const allStores: Store[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        let storesQuery = supabase
          .from('stores')
          .select('id, name, company_id')
          .order('name')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        // Filter by concept if needed
        if (filterByConceptId) {
          const { data: conceptCompanies } = await supabase
            .from('companies')
            .select('id')
            .eq('concept_id', filterByConceptId);

          if (conceptCompanies && conceptCompanies.length > 0) {
            const companyIds = conceptCompanies.map(c => c.id);
            storesQuery = storesQuery.in('company_id', companyIds);
          }
        }

        const { data: storesData } = await storesQuery;

        if (storesData && storesData.length > 0) {
          allStores.push(...storesData);
          hasMore = storesData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      setStores(allStores);
      setLoading(false);
      return;
    }

    // For non-admin users, derive locations from accessibleStores
    const accessibleStoreIds = accessibleStores.map(s => s.id);
    const accessibleCompanyIds = [...new Set(accessibleStores.map(s => s.company_id).filter(id => id !== null))];
    const accessibleConceptIds = [...new Set(accessibleStores.map(s => s.company?.concept_id).filter(Boolean))];

    let conceptsQuery = supabase
      .from('concepts')
      .select('*')
      .in('id', accessibleConceptIds)
      .order('name');

    if (filterByConceptId) {
      conceptsQuery = conceptsQuery.eq('id', filterByConceptId);
    }

    let companiesQuery = supabase
      .from('companies')
      .select('*')
      .in('id', accessibleCompanyIds)
      .order('name');

    if (filterByConceptId) {
      companiesQuery = companiesQuery.eq('concept_id', filterByConceptId);
    }

    const [conceptsData, companiesData] = await Promise.all([conceptsQuery, companiesQuery]);

    const formattedStores: Store[] = accessibleStores.map(s => ({
      id: s.id,
      name: s.name,
      company_id: s.company_id
    }));

    if (conceptsData.data) setConcepts(conceptsData.data);
    if (companiesData.data) setCompanies(companiesData.data);
    setStores(formattedStores);
    setLoading(false);
  };

  const loadCompaniesForConcept = async (conceptId: number) => {
    if (loadingCompanies.has(conceptId)) return;

    setLoadingCompanies(prev => new Set(prev).add(conceptId));

    const { data: companiesData } = await supabase
      .from('companies')
      .select('*')
      .eq('concept_id', conceptId)
      .order('name');

    if (companiesData) {
      setCompanies(prev => {
        const existing = prev.filter(c => c.concept_id !== conceptId);
        return [...existing, ...companiesData];
      });
    }

    setLoadingCompanies(prev => {
      const newSet = new Set(prev);
      newSet.delete(conceptId);
      return newSet;
    });
  };

  const loadStoresForCompany = async (companyId: number) => {
    if (loadingStores.has(companyId)) return;

    setLoadingStores(prev => new Set(prev).add(companyId));

    const { data: storesData } = await supabase
      .from('stores')
      .select('id, name, company_id')
      .eq('company_id', companyId)
      .order('name');

    if (storesData) {
      setStores(prev => {
        const existing = prev.filter(s => s.company_id !== companyId);
        return [...existing, ...storesData];
      });
    }

    setLoadingStores(prev => {
      const newSet = new Set(prev);
      newSet.delete(companyId);
      return newSet;
    });
  };

  const handleExpandConcept = async (conceptId: number) => {
    const isExpanded = expandedConcepts.has(conceptId);
    setExpandedConcepts(prev => {
      const newSet = new Set(prev);
      if (isExpanded) {
        newSet.delete(conceptId);
      } else {
        newSet.add(conceptId);
      }
      return newSet;
    });

    if (!isExpanded && userRole === 'admin') {
      // Get all companies for this concept
      const conceptCompanies = companies.filter(c => c.concept_id === conceptId);
      const companyIds = conceptCompanies.map(c => c.id);

      // Auto-expand all companies
      setExpandedCompanies(new Set(companyIds));

      // Only load stores if they haven't been loaded yet (for backwards compatibility)
      const hasStoresForCompanies = companyIds.some(companyId =>
        stores.some(s => s.company_id === companyId)
      );

      if (companyIds.length > 0 && !hasStoresForCompanies) {
        const storePromises = companyIds.map(companyId =>
          supabase
            .from('stores')
            .select('id, name, company_id')
            .eq('company_id', companyId)
            .order('name')
        );

        const results = await Promise.all(storePromises);
        const allStores = results.flatMap(result => result.data || []);

        setStores(prev => {
          // Remove existing stores for these companies, then add new ones
          const existing = prev.filter(s => !companyIds.includes(s.company_id));
          return [...existing, ...allStores];
        });
      }
    } else if (isExpanded) {
      // Clear expanded companies when collapsing concept
      setExpandedCompanies(new Set());
    }
  };

  const handleExpandCompany = async (companyId: number) => {
    const isExpanded = expandedCompanies.has(companyId);

    setExpandedCompanies(prev => {
      const newSet = new Set(prev);
      if (isExpanded) {
        newSet.delete(companyId);
      } else {
        newSet.add(companyId);
      }
      return newSet;
    });

    // Load stores if expanding, user is admin, and stores not already loaded
    const hasStores = stores.some(s => s.company_id === companyId);
    if (!isExpanded && userRole === 'admin' && !hasStores) {
      await loadStoresForCompany(companyId);
    }
  };

  const searchLower = searchQuery.toLowerCase();

  const getCompaniesForConcept = (conceptId: number) => {
    return companies.filter(c => {
      if (c.concept_id !== conceptId) return false;
      // Filter by viewContext - only show the specific company if in that context
      if (viewContext?.company && c.id !== viewContext.company.id) {
        return false;
      }
      if (searchQuery && !c.name.toLowerCase().includes(searchLower)) {
        const companyStores = stores.filter(s => s.company_id === c.id);
        const hasMatchingStore = companyStores.some(s => s.name.toLowerCase().includes(searchLower));
        if (!hasMatchingStore) return false;
      }
      return true;
    });
  };

  const getStoresForCompany = (companyId: number) => {
    const filtered = stores.filter(s => {
      if (s.company_id !== companyId) return false;
      if (searchQuery && !s.name.toLowerCase().includes(searchLower)) {
        return false;
      }
      return true;
    });
    return filtered;
  };

  // Auto-expand nodes when searching
  useEffect(() => {
    if (searchQuery) {
      // Find all matching concepts
      const matchingConceptIds = new Set<number>();
      const matchingCompanyIds = new Set<number>();

      concepts.forEach(concept => {
        const conceptMatches = concept.name.toLowerCase().includes(searchLower);
        const conceptCompanies = companies.filter(c => c.concept_id === concept.id);

        conceptCompanies.forEach(company => {
          const companyMatches = company.name.toLowerCase().includes(searchLower);
          const companyStores = stores.filter(s => s.company_id === company.id);
          const hasMatchingStore = companyStores.some(s => s.name.toLowerCase().includes(searchLower));

          // If concept, company, or any store matches, expand this branch
          if (conceptMatches || companyMatches || hasMatchingStore) {
            matchingConceptIds.add(concept.id);
            matchingCompanyIds.add(company.id);
          }
        });
      });

      // Expand all matching nodes
      if (matchingConceptIds.size > 0) {
        // Expand all matching concepts
        setExpandedConcepts(matchingConceptIds);
        // Expand all matching companies
        setExpandedCompanies(matchingCompanyIds);
      }
    } else {
      // When search is cleared, collapse all if we weren't previously expanded
      // (don't collapse if we expanded to show current location)
      if (!selectedLocation?.concept) {
        setExpandedConcepts(new Set());
        setExpandedCompanies(new Set());
      }
    }
  }, [searchQuery, concepts, companies, stores, searchLower, selectedLocation]);

  const filteredConcepts = concepts.filter(c => {
    // Filter by viewContext - only show the specific concept if in that context
    if (viewContext?.concept && c.id !== viewContext.concept.id) {
      return false;
    }
    if (searchQuery) {
      const conceptMatches = c.name.toLowerCase().includes(searchLower);
      if (conceptMatches) return true;

      const conceptCompanies = companies.filter(comp => comp.concept_id === c.id);
      const hasMatchingCompany = conceptCompanies.some(comp => {
        const companyMatches = comp.name.toLowerCase().includes(searchLower);
        if (companyMatches) return true;

        const companyStores = stores.filter(s => s.company_id === comp.id);
        return companyStores.some(s => s.name.toLowerCase().includes(searchLower));
      });

      if (!hasMatchingCompany) return false;
    }
    return true;
  });

  const handleSelectConcept = (concept: Concept) => {
    onSelect({ concept });
  };

  const handleSelectCompany = (company: Company, concept: Concept) => {
    onSelect({ concept, company });
  };

  const handleSelectStore = (store: Store, company: Company, concept: Concept) => {
    onSelect({ concept, company, store });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] overflow-hidden">
        <div className="relative z-[201] bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-600"></div>
            <span className="text-gray-700 dark:text-gray-300">Loading locations...</span>
          </div>
        </div>
      </div>
    );
  }

  // For multi-store users (operators), show simplified flat view
  if (isMultiStoreUser && userRole !== 'admin') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] overflow-hidden">
        <div className="relative z-[201] bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Select Store</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search your stores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {accessibleStores
                .filter(store => !searchQuery || store.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(store => {
                  const concept = concepts.find(c => c.id === store.company?.concept_id);
                  const company = companies.find(c => c.id === store.company_id);

                  return (
                    <button
                      key={store.id}
                      onClick={() => {
                        if (concept && company) {
                          handleSelectStore(store, company, concept);
                        }
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-left"
                    >
                      {getLocationIcon('store', 'w-5 h-5')}
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">{store.name}</div>
                        {company && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{company.name}</div>
                        )}
                      </div>
                      {selectedLocation?.store?.id === store.id && (
                        <div className="w-2 h-2 rounded-full bg-sky-600"></div>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] overflow-hidden">
      <div className="relative z-[201] bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Select Location</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          {/* Return to WAND Digital link for admins when in a context */}
          {userRole === 'admin' && (viewContext?.concept || viewContext?.company) && (
            <button
              onClick={() => onSelect({})}
              className="flex items-center gap-2 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 font-medium"
            >
              ← Return to WAND Digital
            </button>
          )}

          {/* Show navigation breadcrumb based on viewContext */}
          {(viewContext?.concept || viewContext?.company) && (
            <div className="flex items-center gap-2 text-sm">
              {/* Only admins can navigate to root concept level */}
              {userRole === 'admin' && (
                <>
                  <button
                    onClick={() => setViewContext({})}
                    className="text-sky-600 dark:text-sky-400 hover:text-sky-700 hover:underline"
                  >
                    WAND Digital
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </>
              )}
              {viewContext?.concept && (
                <>
                  {/* Show concept as clickable if there's a deeper level (company) */}
                  {viewContext.company ? (
                    userRole === 'admin' ? (
                      <button
                        onClick={() => setViewContext({ concept: viewContext.concept })}
                        className="text-sky-600 dark:text-sky-400 hover:text-sky-700 hover:underline"
                      >
                        {viewContext.concept.name}
                      </button>
                    ) : (
                      <span className="text-gray-700 dark:text-gray-300">{viewContext.concept.name}</span>
                    )
                  ) : (
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{viewContext.concept.name}</span>
                  )}
                  {viewContext.company && <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
                </>
              )}
              {viewContext?.company && (
                <span className="text-gray-700 dark:text-gray-300 font-medium">{viewContext.company.name}</span>
              )}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search concepts, companies, or stores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-[400px]">
          {/* Always show full tree hierarchy */}
          {filteredConcepts.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">No locations found</div>
          ) : (
            <div className="space-y-2">
              {filteredConcepts.map((concept) => {
                const conceptCompanies = getCompaniesForConcept(concept.id);
                const isExpanded = expandedConcepts.has(concept.id);

                return (
                  <div key={concept.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center gap-2 p-3 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <button
                        onClick={() => handleExpandConcept(concept.id)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      >
                        {(conceptCompanies.length > 0 || userRole === 'admin') && (
                          isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      {getLocationIcon('concept', "w-5 h-5")}
                      <button
                        onClick={() => handleSelectConcept(concept)}
                        className="flex-1 text-left font-medium text-gray-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400"
                      >
                        {concept.name}
                      </button>
                      {conceptCompanies.length > 0 && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">{conceptCompanies.length} companies</span>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="pl-8 pr-3 pb-2 space-y-1">
                        {conceptCompanies.length === 0 ? (
                          <div className="p-2 text-sm text-gray-500 dark:text-gray-400">No companies found</div>
                        ) : (
                          conceptCompanies.map((company) => {
                          const companyStores = getStoresForCompany(company.id);
                          const isCompanyExpanded = expandedCompanies.has(company.id);

                          return (
                            <div key={company.id} className="border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                              <div className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                                <button
                                  onClick={() => handleExpandCompany(company.id)}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                >
                                  {(companyStores.length > 0 || userRole === 'admin') && (
                                    isCompanyExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                                {getLocationIcon('company', "w-4 h-4")}
                                <button
                                  onClick={() => handleSelectCompany(company, concept)}
                                  className="flex-1 text-left text-gray-700 dark:text-gray-300 hover:text-sky-600 dark:hover:text-sky-400"
                                >
                                  {company.name}
                                </button>
                                {companyStores.length > 0 && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{companyStores.length} stores</span>
                                )}
                              </div>

                              {isCompanyExpanded && (
                                <div className="pl-6 space-y-1">
                                  {loadingStores.has(company.id) && (
                                    <div className="p-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-sky-600"></div>
                                      Loading stores...
                                    </div>
                                  )}
                                  {companyStores.map((store) => (
                                    <button
                                      key={store.id}
                                      onClick={() => handleSelectStore(store, company, concept)}
                                      className="flex items-center gap-2 p-2 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded w-full text-left"
                                    >
                                      {getLocationIcon('store', "w-4 h-4")}
                                      <span className="text-gray-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 text-sm">{store.name}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
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
    </div>
  );
}
