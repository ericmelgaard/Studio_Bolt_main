import { useState, useEffect, lazy, Suspense } from 'react';
import { Monitor, HelpCircle, FileText, Menu, ShoppingCart } from 'lucide-react';
import NotificationPanel from '../components/NotificationPanel';
import UserMenu from '../components/UserMenu';
import OperatorMobileNav from '../components/OperatorMobileNav';
import { supabase } from '../lib/supabase';
import { checkAndApplyPendingPublications } from '../lib/publicationService';
import { useLocation } from '../hooks/useLocation';
import { useStoreAccess } from '../hooks/useStoreAccess';
import { UserProvider } from '../contexts/UserContext';

const SignageManagement = lazy(() => import('./SignageManagement'));
const ShelfLabelManagement = lazy(() => import('./ShelfLabelManagement'));
const StoreManagement = lazy(() => import('./StoreManagement'));
const ProductManagement = lazy(() => import('./ProductManagement'));
const DisplayManagement = lazy(() => import('./DisplayManagement'));
const BrandWorkspace = lazy(() => import('./BrandWorkspace'));
const LocationSelector = lazy(() => import('../components/LocationSelector'));
const HeaderNavigation = lazy(() => import('../components/HeaderNavigation'));

type DashboardView = 'displays' | 'signage' | 'labels' | 'store' | 'products' | 'brands';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  display_name: string;
  concept_id: number | null;
  company_id: number | null;
  store_id: number | null;
}

interface OperatorDashboardProps {
  onBack: () => void;
  user: UserProfile;
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

export default function OperatorDashboard({ onBack, user }: OperatorDashboardProps) {
  const [currentView, setCurrentView] = useState<DashboardView>('displays');
  const { location, setLocation, clearHistory } = useLocation('operator', user.id);
  const { accessibleStores, loading: storesLoading } = useStoreAccess({ userId: user.id });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [storesByCompany, setStoresByCompany] = useState<Record<number, Store[]>>({});
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (currentView === 'displays') {
      clearHistory();
    }
    checkAndApplyPendingPublications().catch(err => {
      console.error('Error checking pending publications:', err);
    });
  }, [location, currentView]);

  useEffect(() => {
    if (!storesLoading) {
      loadCompaniesAndStores();
    }
  }, [accessibleStores, storesLoading]);

  // Sync local state with location changes from HeaderNavigation dropdown
  useEffect(() => {
    if (location.store && location.store.id !== selectedStore?.id) {
      setSelectedStore(location.store);
    }
    if (location.company && location.company.id !== selectedCompany?.id) {
      setSelectedCompany(location.company);
    }
  }, [location.store, location.company]);

  const loadCompaniesAndStores = async () => {
    if (storesLoading) return;

    setLoading(true);

    // Get unique company IDs from accessible stores
    const companyIds = [...new Set(accessibleStores.map(s => s.company_id))];

    if (companyIds.length === 0) {
      setLoading(false);
      return;
    }

    // Load companies for the accessible stores
    const { data: companiesData, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, concept_id')
      .in('id', companyIds)
      .order('name');

    if (companiesError) {
      console.error('Error loading companies:', companiesError);
      setLoading(false);
      return;
    }

    setCompanies(companiesData || []);

    // Use accessible stores from useStoreAccess
    const storesData = accessibleStores.map(store => ({
      id: store.id,
      name: store.name,
      company_id: store.company_id,
    }));

    // Group stores by company
    const grouped: Record<number, Store[]> = {};
    storesData.forEach(store => {
      if (!grouped[store.company_id]) {
        grouped[store.company_id] = [];
      }
      grouped[store.company_id].push(store);
    });
    setStoresByCompany(grouped);

    // Set initial selection
    if (location.store && storesData.find(s => s.id === location.store?.id)) {
      // Restore saved location
      setSelectedStore(location.store);
      const company = companiesData.find(c => c.id === location.store?.company_id);
      if (company) setSelectedCompany(company);
    } else if (location.company && companiesData.find(c => c.id === location.company?.id)) {
      // Restore saved company
      setSelectedCompany(location.company);
    } else if (!hasInitialized && companiesData.length > 0) {
      // First time initialization - auto navigate to first accessible store
      setSelectedCompany(companiesData[0]);
      if (grouped[companiesData[0].id]?.length > 0) {
        const firstStore = grouped[companiesData[0].id][0];
        setSelectedStore(firstStore);
        setLocation({ company: companiesData[0], store: firstStore });
      }
      setHasInitialized(true);
    }

    setLoading(false);
  };

  const handleCompanySelect = (company: Company) => {
    setSelectedCompany(company);
    setSelectedStore(null);
    setLocation({ company, store: undefined, concept: location.concept });
  };

  const handleStoreSelect = (store: Store) => {
    const company = companies.find(c => c.id === store.company_id);
    if (company) {
      setSelectedCompany(company);
      setSelectedStore(store);
      setLocation({ company, store, concept: location.concept });
    }
  };


  if (currentView === 'brands') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
        <BrandWorkspace
          userConceptId={user.concept_id}
          userCompanyId={user.company_id}
          onBack={() => setCurrentView('displays')}
        />
      </Suspense>
    );
  }

  if (currentView === 'signage') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
        <SignageManagement onBack={() => setCurrentView('displays')} />
      </Suspense>
    );
  }

  if (currentView === 'labels') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
        <ShelfLabelManagement onBack={() => setCurrentView('displays')} />
      </Suspense>
    );
  }

  if (currentView === 'store') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
        <StoreManagement onBack={() => setCurrentView('displays')} />
      </Suspense>
    );
  }

  if (currentView === 'products') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
        <ProductManagement onBack={() => setCurrentView('displays')} />
      </Suspense>
    );
  }

  // Default view is displays (Operator Hub)
  if (!selectedStore) {
    return (
      <UserProvider user={user}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
          <OperatorMobileNav
            isOpen={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
            currentView={currentView}
            onNavigate={(view) => setCurrentView(view as DashboardView)}
            userName={user.display_name}
            userRole="Store Operator"
            locationName={selectedCompany?.name}
            onBackToRoles={onBack}
          />

          <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40">
            <div className="flex items-center gap-2 md:gap-6 flex-1 min-w-0">
              <button
                onClick={() => setMobileNavOpen(true)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors touch-manipulation flex-shrink-0"
                aria-label="Open navigation menu"
              >
                <Menu className="w-6 h-6" style={{ color: '#00adf0' }} />
              </button>
              <Suspense fallback={<div className="w-48 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse"></div>}>
                <HeaderNavigation
                  userId={user.id}
                  role="operator"
                  onOpenFullNavigator={() => setShowLocationSelector(true)}
                />
              </Suspense>
            </div>
            <div className="flex items-center gap-1">
              <a
                href="https://shop.wanddigital.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors touch-manipulation"
                title="WAND Digital Shop"
              >
                <ShoppingCart className="w-5 h-5" style={{ color: '#00adf0' }} />
              </a>
              <div className="hidden md:flex items-center gap-1">
                <NotificationPanel />
                <button
                  className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Help"
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
                <button
                  className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Documentation"
                >
                  <FileText className="w-5 h-5" />
                </button>
                <UserMenu role="operator" user={user} onBackToRoles={onBack} />
              </div>
            </div>
          </header>

          <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
            <div className="text-center px-4">
              <Monitor className="w-16 h-16 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
              <p className="text-lg text-slate-900 dark:text-slate-100 mb-2">Please select a store to view Operator Hub</p>
              <button
                onClick={() => setShowLocationSelector(true)}
                className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                Select Store
              </button>
            </div>
          </main>

          {showLocationSelector && (
            <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>}>
              <LocationSelector
                onClose={() => setShowLocationSelector(false)}
                onSelect={(selectedLocation) => {
                  if (selectedLocation.company) {
                    setSelectedCompany(selectedLocation.company);
                  }
                  if (selectedLocation.store) {
                    setSelectedStore(selectedLocation.store);
                  }
                  setShowLocationSelector(false);
                }}
                selectedLocation={{
                  concept: location.concept,
                  company: selectedCompany || undefined,
                  store: selectedStore || undefined
                }}
                filterByConceptId={209}
                userId={user.id}
              />
            </Suspense>
          )}
        </div>
      </UserProvider>
    );
  }

  // Render Operator Hub (DisplayManagement) as the default home view
  return (
    <UserProvider user={user}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <OperatorMobileNav
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view as DashboardView)}
          userName={user.display_name}
          userRole="Store Operator"
          locationName={selectedStore?.name || selectedCompany?.name}
          onBackToRoles={onBack}
        />

        <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40">
          <div className="flex items-center gap-2 md:gap-6 flex-1 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors touch-manipulation flex-shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-6 h-6" style={{ color: '#00adf0' }} />
            </button>
            <Suspense fallback={<div className="w-48 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse"></div>}>
              <HeaderNavigation
                userId={user.id}
                role="operator"
                onOpenFullNavigator={() => setShowLocationSelector(true)}
              />
            </Suspense>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="https://shop.wanddigital.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors touch-manipulation"
              title="WAND Digital Shop"
            >
              <ShoppingCart className="w-5 h-5" style={{ color: '#00adf0' }} />
            </a>
            <div className="hidden md:flex items-center gap-1">
              <NotificationPanel />
              <button
                className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="Help"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
              <button
                className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="Documentation"
              >
                <FileText className="w-5 h-5" />
              </button>
              <UserMenu role="operator" user={user} onBackToRoles={onBack} />
            </div>
          </div>
        </header>

        <Suspense fallback={<div className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
          <DisplayManagement
            storeId={selectedStore.id}
            storeName={selectedStore.name}
            isHomePage={true}
          />
        </Suspense>

        {showLocationSelector && (
          <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>}>
            <LocationSelector
              onClose={() => setShowLocationSelector(false)}
              onSelect={(selectedLocation) => {
                if (selectedLocation.company) {
                  setSelectedCompany(selectedLocation.company);
                }
                if (selectedLocation.store) {
                  setSelectedStore(selectedLocation.store);
                }
                setShowLocationSelector(false);
              }}
              selectedLocation={{
                concept: location.concept,
                company: selectedCompany || undefined,
                store: selectedStore || undefined
              }}
              filterByConceptId={209}
              userId={user.id}
            />
          </Suspense>
        )}
      </div>
    </UserProvider>
  );
}
