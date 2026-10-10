import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Building2, Layers, MapPin, Map, Sparkles, X, Search, ArrowUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { useStoreAccess } from '../hooks/useStoreAccess';

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

interface HeaderNavigationProps {
  userConceptId?: number | null;
  userCompanyId?: number | null;
  userStoreId?: number | null;
  userId?: string | null;
  role?: 'admin' | 'creator' | 'operator';
  onOpenFullNavigator: () => void;
  actionButton?: React.ReactNode;
}

// Standardized icon mapping for location hierarchy
const getLocationIcon = (level: 'wand' | 'concept' | 'company' | 'store', className = "w-4 h-4") => {
  switch (level) {
    case 'wand':
      return <Sparkles className={className} />;
    case 'concept':
      return <Building2 className={className} />;
    case 'company':
      return <Layers className={className} />;
    case 'store':
      return <MapPin className={className} />;
  }
};

export default function HeaderNavigation({
  userConceptId,
  userCompanyId,
  userStoreId,
  userId,
  role,
  onOpenFullNavigator,
  actionButton
}: HeaderNavigationProps) {
  const { location, setLocation } = useLocation(role, userId || undefined);
  const { accessibleStores, hasFullAccess, loading: storesLoading } = useStoreAccess({ userId });
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [filterText, setFilterText] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!storesLoading) {
      loadNavigationData();
    }
  }, [userConceptId, userCompanyId, userStoreId, userId, location, accessibleStores, hasFullAccess, storesLoading]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Click-outside detection for desktop
  useEffect(() => {
    if (!isMobile && isDropdownOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsDropdownOpen(false);
        }
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsDropdownOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isDropdownOpen, isMobile]);

  // Body scroll lock for mobile modal
  useEffect(() => {
    if (isMobile && isDropdownOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMobile, isDropdownOpen]);

  const loadNavigationData = async () => {
    if (storesLoading) return;

    setLoading(true);

    // Determine if user has limited store access (not full access)
    const hasLimitedAccess = !hasFullAccess && accessibleStores.length > 0;

    // Quick nav works like breadcrumb navigation:
    // Root (WAND) -> Concepts (children)
    // Concept -> Companies (children)
    // Company -> Stores (children) - root for store navigation
    // Store -> Stores (siblings in same company)
    //
    // SPECIAL RULE: Users with limited access see ALL accessible stores
    // when at store or company level (not just siblings or children)

    if (location.store) {
      if (hasLimitedAccess) {
        // Limited access: show all accessible stores
        const storesData = accessibleStores.map(store => ({
          id: store.id,
          name: store.name,
          company_id: store.company_id,
        }));

        // Get unique company IDs and load company data
        const companyIds = [...new Set(storesData.map(s => s.company_id))];
        const { data: companiesData } = await supabase
          .from('companies')
          .select('id, name, concept_id')
          .in('id', companyIds)
          .order('name');

        setStores(storesData);
        setCompanies(companiesData || []);
        setConcepts([]);
      } else {
        // Full access: show sibling stores in the same company
        const companyId = location.company?.id;
        if (companyId) {
          const { data: storesData } = await supabase
            .from('stores')
            .select('id, name, company_id')
            .eq('company_id', companyId)
            .order('name');

          if (storesData) {
            setStores(storesData);
            setConcepts([]);
            setCompanies(location.company ? [location.company] : []);
          }
        }
      }
    } else if (location.company) {
      if (hasLimitedAccess) {
        // Limited access: show all accessible stores
        const storesData = accessibleStores.map(store => ({
          id: store.id,
          name: store.name,
          company_id: store.company_id,
        }));

        // Get unique company IDs and load company data
        const companyIds = [...new Set(storesData.map(s => s.company_id))];
        const { data: companiesData } = await supabase
          .from('companies')
          .select('id, name, concept_id')
          .in('id', companyIds)
          .order('name');

        setStores(storesData);
        setCompanies(companiesData || []);
        setConcepts([]);
      } else {
        // Full access: show child stores (acts as root for store navigation)
        const companyId = location.company.id;
        const { data: storesData } = await supabase
          .from('stores')
          .select('id, name, company_id')
          .eq('company_id', companyId)
          .order('name');

        if (storesData) {
          setStores(storesData);
          setConcepts([]);
          setCompanies([location.company]);
        }
      }
    } else if (location.concept) {
      // At a concept: show child companies
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name, concept_id')
        .eq('concept_id', location.concept.id)
        .order('name');

      if (companiesData) {
        setCompanies(companiesData);
        setConcepts([]);
        setStores([]);
      }
    } else {
      // At root (WAND Digital): show child concepts
      const { data: conceptsData } = await supabase
        .from('concepts')
        .select('id, name')
        .order('name');

      if (conceptsData) {
        setConcepts(conceptsData);
        setCompanies([]);
        setStores([]);
      }
    }

    setLoading(false);
  };

  const getCurrentDisplayName = (): string => {
    if (location.store) return location.store.name;
    if (location.company) return location.company.name;
    if (location.concept) return location.concept.name;
    return 'WAND Digital';
  };

  const getCurrentIcon = () => {
    if (location.store) return getLocationIcon('store', "w-4 h-4 text-gray-600 dark:text-gray-400");
    if (location.company) return getLocationIcon('company', "w-4 h-4 text-gray-600 dark:text-gray-400");
    if (location.concept) return getLocationIcon('concept', "w-4 h-4 text-gray-600 dark:text-gray-400");
    return getLocationIcon('wand', "w-4 h-4 text-gray-600 dark:text-gray-400");
  };

  // Quick nav shows different content based on location level
  const showConcepts = concepts.length > 0;
  const showCompanies = companies.length > 0 && stores.length === 0;
  const showStores = stores.length > 0;

  // Show dropdown if we have any content
  const hasLocationContent = showConcepts || showCompanies || showStores;
  const hasDropdownContent = hasLocationContent;

  // Group stores by company for display
  const storesByCompany = stores.reduce((acc, store) => {
    if (!acc[store.company_id]) {
      acc[store.company_id] = [];
    }
    acc[store.company_id].push(store);
    return acc;
  }, {} as Record<number, Store[]>);

  // Get companies in order
  const companiesWithStores = companies
    .filter(c => storesByCompany[c.id])
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleCloseDropdown = () => {
    setIsDropdownOpen(false);
    setFilterText('');
  };

  const handleSelectLocation = async (newLocation: { concept?: Concept; company?: Company; store?: Store }) => {
    // If selecting a company without a concept, fetch the concept data
    if (newLocation.company && !newLocation.concept) {
      const { data: conceptData } = await supabase
        .from('concepts')
        .select('id, name')
        .eq('id', newLocation.company.concept_id)
        .maybeSingle();

      if (conceptData) {
        setLocation({ concept: conceptData, company: newLocation.company, store: newLocation.store });
      } else {
        setLocation(newLocation);
      }
    } else {
      setLocation(newLocation);
    }
    handleCloseDropdown();
  };

  // Parent navigation logic:
  // Store/Company -> Concept
  // Concept -> WAND Digital (root)
  const getParentLocation = () => {
    if (location.store || location.company) {
      // Both store and company go to concept
      return location.concept ? { concept: location.concept } : null;
    }
    if (location.concept) {
      // Concept goes to root (WAND Digital)
      return {};
    }
    // Already at root
    return null;
  };

  const getParentName = () => {
    if (location.store || location.company) {
      return location.concept?.name || 'Parent';
    }
    if (location.concept) {
      return 'WAND Digital';
    }
    return null;
  };

  const parentLocation = getParentLocation();
  const parentName = getParentName();

  // Filter logic
  const filteredConcepts = concepts.filter(c =>
    c.name.toLowerCase().includes(filterText.toLowerCase())
  );

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(filterText.toLowerCase())
  );

  const filteredStores = stores.filter(s =>
    s.name.toLowerCase().includes(filterText.toLowerCase())
  );

  const filteredStoresByCompany = filteredStores.reduce((acc, store) => {
    if (!acc[store.company_id]) {
      acc[store.company_id] = [];
    }
    acc[store.company_id].push(store);
    return acc;
  }, {} as Record<number, Store[]>);

  const filteredCompaniesWithStores = companies
    .filter(c => filteredStoresByCompany[c.id])
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <span className="text-base font-semibold text-gray-900 dark:text-gray-100 max-w-[250px] truncate">
            {loading ? 'Loading...' : getCurrentDisplayName()}
          </span>
          {hasDropdownContent && <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
        </button>

        {/* Desktop Dropdown */}
        {!isMobile && hasDropdownContent && isDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-[360px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transition-all max-h-[32rem] overflow-hidden z-50">
            {/* Go to Parent Link */}
            {parentLocation && parentName && (
              <button
                onClick={() => handleSelectLocation(parentLocation)}
                className="w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700"
              >
                <ArrowUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span className="text-sm font-medium text-sky-600 dark:text-sky-400">Go to {parentName}</span>
              </button>
            )}

            {/* Filter Input */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Filter locations..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {/* Show Concepts (at root) */}
              {showConcepts && (
                <div className="py-1">
                  {filteredConcepts.map((concept) => (
                    <button
                      key={concept.id}
                      onClick={() => handleSelectLocation({ concept })}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                        location.concept?.id === concept.id ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {getLocationIcon('concept', "w-4 h-4 flex-shrink-0")}
                      <span className="truncate">{concept.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Show Companies (at concept level) */}
              {showCompanies && (
                <div className="py-1">
                  {filteredCompanies.map((company) => (
                    <button
                      key={company.id}
                      onClick={async () => {
                        const { data: conceptData } = await supabase
                          .from('concepts')
                          .select('id, name')
                          .eq('id', company.concept_id)
                          .maybeSingle();

                        handleSelectLocation({
                          concept: conceptData || undefined,
                          company
                        });
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                        location.company?.id === company.id ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {getLocationIcon('company', "w-4 h-4 flex-shrink-0")}
                      <span className="truncate">{company.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Show Stores (at company/store level) */}
              {showStores && (
                <>
                  {filteredCompaniesWithStores.map((company) => (
                    <div key={company.id}>
                      {/* Company Header (non-clickable) */}
                      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2">
                          {getLocationIcon('company', "w-4 h-4 text-gray-500 dark:text-gray-400")}
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                            {company.name}
                          </span>
                        </div>
                      </div>

                      {/* Stores in this company */}
                      <div className="py-1">
                        {filteredStoresByCompany[company.id]
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((store) => (
                            <button
                              key={store.id}
                              onClick={async () => {
                                // Fetch concept for this store's company
                                const { data: conceptData } = await supabase
                                  .from('concepts')
                                  .select('id, name')
                                  .eq('id', company.concept_id)
                                  .maybeSingle();

                                handleSelectLocation({
                                  concept: conceptData || undefined,
                                  company,
                                  store
                                });
                              }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                                location.store?.id === store.id ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {getLocationIcon('store', "w-4 h-4 flex-shrink-0")}
                              <span className="truncate">{store.name}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Full-Screen Modal */}
      {isMobile && hasDropdownContent && isDropdownOpen && (
        <div className="fixed inset-0 bg-white dark:bg-gray-800 z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {getCurrentIcon()}
              <span className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                Quick Navigation
              </span>
            </div>
            <button
              onClick={handleCloseDropdown}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Go to Parent Link */}
          {parentLocation && parentName && (
            <button
              onClick={() => handleSelectLocation(parentLocation)}
              className="w-full px-4 py-4 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700"
            >
              <ArrowUp className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              <span className="text-base font-medium text-sky-600 dark:text-sky-400">Go to {parentName}</span>
            </button>
          )}

          {/* Filter Input */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Filter locations..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full pl-10 pr-3 py-3 text-base border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Scrollable Content */}
          {hasLocationContent && (
            <div className="flex-1 overflow-y-auto">
              {/* Show Concepts (at root) */}
              {showConcepts && filteredConcepts.map((concept) => (
                <button
                  key={concept.id}
                  onClick={() => handleSelectLocation({ concept })}
                  className={`w-full min-h-11 text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 ${
                    location.concept?.id === concept.id ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {getLocationIcon('concept', "w-5 h-5 flex-shrink-0")}
                  <span className="text-base">{concept.name}</span>
                </button>
              ))}

              {/* Show Companies (at concept level) */}
              {showCompanies && filteredCompanies.map((company) => (
                <button
                  key={company.id}
                  onClick={async () => {
                    const { data: conceptData } = await supabase
                      .from('concepts')
                      .select('id, name')
                      .eq('id', company.concept_id)
                      .maybeSingle();

                    handleSelectLocation({
                      concept: conceptData || undefined,
                      company
                    });
                  }}
                  className={`w-full min-h-11 text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 ${
                    location.company?.id === company.id ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {getLocationIcon('company', "w-5 h-5 flex-shrink-0")}
                  <span className="text-base">{company.name}</span>
                </button>
              ))}

              {/* Show Stores (at company/store level) */}
              {showStores && filteredCompaniesWithStores.map((company) => (
                <div key={company.id}>
                  {/* Company Header (non-clickable) */}
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 sticky top-0">
                    <div className="flex items-center gap-2">
                      {getLocationIcon('company', "w-5 h-5 text-gray-500 dark:text-gray-400")}
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        {company.name}
                      </span>
                    </div>
                  </div>

                  {/* Stores in this company */}
                  {filteredStoresByCompany[company.id]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((store) => (
                      <button
                        key={store.id}
                        onClick={async () => {
                          // Fetch concept for this store's company
                          const { data: conceptData } = await supabase
                            .from('concepts')
                            .select('id, name')
                            .eq('id', company.concept_id)
                            .maybeSingle();

                          handleSelectLocation({
                            concept: conceptData || undefined,
                            company,
                            store
                          });
                        }}
                        className={`w-full min-h-11 text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 ${
                          location.store?.id === store.id ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {getLocationIcon('store', "w-5 h-5 flex-shrink-0")}
                        <span className="text-base">{store.name}</span>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map Icon Button - Hidden on mobile */}
      <button
        onClick={onOpenFullNavigator}
        className="hidden md:flex items-center justify-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
        title="Open full navigation"
      >
        <Map className="w-4 h-4 text-brand" />
      </button>

      {/* Action Button */}
      {actionButton && actionButton}
    </div>
  );
}
