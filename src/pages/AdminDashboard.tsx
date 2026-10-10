import { useState, useEffect, lazy, Suspense } from 'react';
import { HelpCircle, FileText, Users, Settings, Monitor, Tag, Package, BarChart3, Layers, Image as ImageIcon, MapPin, Database, Sliders, ChevronDown, Palette, Clock, Cpu, Images, UtensilsCrossed, Calendar as CalendarIcon } from 'lucide-react';
import NotificationPanel from '../components/NotificationPanel';
import UserMenu from '../components/UserMenu';
import Toast from '../components/Toast';
import { useLocation } from '../hooks/useLocation';
import { UserProvider } from '../contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { setDarkAllowed } from '@/lib/theme';
import wandMark from '../../public/wandlogo.png';

const SignageManagement = lazy(() => import('./SignageManagement'));
const ShelfLabelManagement = lazy(() => import('./ShelfLabelManagement'));
const ProductManagement = lazy(() => import('./ProductManagement'));
const ThemeManagement = lazy(() => import('./ThemeManagement'));
const DisplayThemesBeta = lazy(() => import('./DisplayThemesBeta'));
const IntegrationCatalog = lazy(() => import('./IntegrationCatalog'));
const IntegrationDashboard = lazy(() => import('./IntegrationDashboard'));
const IntegrationAccess = lazy(() => import('./IntegrationAccess'));
const ResourceManagement = lazy(() => import('./ResourceManagement'));
const WandTemplateManager = lazy(() => import('./WandTemplateManager'));
const WandIntegrationMapper = lazy(() => import('./WandIntegrationMapper'));
const WandIntegrationLibrary = lazy(() => import('./WandIntegrationLibrary'));
const CoreAttributes = lazy(() => import('./CoreAttributes'));
const WandProducts = lazy(() => import('./WandProducts'));
const UserManagement = lazy(() => import('./UserManagement'));
const SiteConfigurationBeta = lazy(() => import('./SiteConfigurationBeta'));
const DaypartManagement = lazy(() => import('./DaypartManagement'));
const DevicesDisplaysDashboard = lazy(() => import('./DevicesDisplaysDashboard'));
const DisplayTypesManagement = lazy(() => import('./DisplayTypesManagement'));
const AssetLibrary = lazy(() => import('./AssetLibrary'));
const ThemeBuilderBeta = lazy(() => import('./ThemeBuilderBeta'));
const BrandWorkspace = lazy(() => import('./BrandWorkspace'));
const BrandMenuManagement = lazy(() => import('./BrandMenuManagement'));
const MenuManagement = lazy(() => import('./MenuManagement'));
const MenuCalendarView = lazy(() => import('./MenuCalendarView'));
const StationCoverageView = lazy(() => import('./StationCoverageView'));
const StationScheduling = lazy(() => import('./StationScheduling'));
const LocationSelector = lazy(() => import('../components/LocationSelector'));
const HeaderNavigation = lazy(() => import('../components/HeaderNavigation'));
const AddUserModal = lazy(() => import('../components/AddUserModal'));
const UserEdit = lazy(() => import('./UserEdit'));

interface UserProfile {
  id: string;
  email: string;
  role: string;
  display_name: string;
  concept_id: number | null;
  company_id: number | null;
  store_id: number | null;
  status: string;
  last_login_at?: string | null;
  created_at: string;
}

interface AdminDashboardProps {
  user: UserProfile;
}

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

type ViewType = 'dashboard' | 'signage' | 'labels' | 'products' | 'resources' | 'themes' | 'themes-beta' | 'theme-builder-beta' | 'integration' | 'integration-dashboard' | 'integration-access' | 'wand-templates' | 'wand-mapper' | 'integration-sources' | 'core-attributes' | 'wand-products' | 'users' | 'edit-user' | 'dayparts' | 'sites-beta' | 'devices-displays' | 'display-types' | 'asset-library' | 'brands' | 'brand-menus' | 'menu-management' | 'menu-calendar' | 'station-coverage' | 'station-scheduling';

type MenuId = 'setup' | 'control' | 'access' | 'wand' | 'beta';

// Views restyled for dark mode; every other view renders light until it's rebuilt
const DARK_READY_VIEWS: ViewType[] = ['dashboard'];

function Spinner() {
  return <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 dark:border-sky-400"></div>;
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const { location, setLocation, resetLocation } = useLocation('admin', user.id);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [themeContext, setThemeContext] = useState<{ themeId: string; themeName: string } | null>(null);
  const [brandContext, setBrandContext] = useState<{ id: number; name: string } | null>(null);

  // Local state synced with global location context
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // Clear location on mount for unrestricted admin users ONLY if no location is set
  useEffect(() => {
    if (!user.concept_id && !user.company_id && !user.store_id) {
      // Only reset if no location is currently set
      if (!location.concept && !location.company && !location.store) {
        resetLocation();
      }
    }
  }, []);

  // Only allow dark mode on views that have dark styles
  useEffect(() => {
    setDarkAllowed(DARK_READY_VIEWS.includes(currentView));
  }, [currentView]);

  // Sync local state with global location context on mount and location changes
  useEffect(() => {
    setSelectedConcept(location.concept || null);
    setSelectedCompany(location.company || null);
    setSelectedStore(location.store || null);
  }, [location]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<MenuId | null>(null);

  const navigationMenus: { id: MenuId; label: string; width: string; extraViews?: ViewType[]; items: { id: ViewType; label: string; icon: typeof Users }[] }[] = [
    {
      id: 'setup',
      label: 'Setup',
      width: 'w-64',
      items: [
        { id: 'sites-beta', label: 'Location Manager', icon: MapPin },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'devices-displays', label: 'Devices & Displays', icon: Cpu },
        { id: 'display-types', label: 'Display Types', icon: Layers },
      ],
    },
    {
      id: 'control',
      label: 'Control',
      width: 'w-64',
      items: [
        { id: 'brands', label: 'Brands', icon: UtensilsCrossed },
        { id: 'menu-management', label: 'Menu Management', icon: Layers },
        { id: 'menu-calendar', label: 'Schedule Calendar', icon: CalendarIcon },
        { id: 'station-coverage', label: 'Station Coverage', icon: MapPin },
        { id: 'station-scheduling', label: 'Station Scheduling', icon: CalendarIcon },
        { id: 'signage', label: 'Signage', icon: Monitor },
        { id: 'labels', label: 'Labels', icon: Tag },
        { id: 'products', label: 'Products', icon: Package },
        { id: 'resources', label: 'Resources', icon: ImageIcon },
        { id: 'themes', label: 'Display Themes', icon: Palette },
      ],
    },
    {
      id: 'access',
      label: 'Access',
      width: 'w-64',
      items: [
        { id: 'integration-dashboard', label: 'Dashboard', icon: BarChart3 },
        { id: 'integration-access', label: 'Access', icon: Settings },
        { id: 'integration', label: 'Catalog', icon: Layers },
      ],
    },
    {
      id: 'wand',
      label: 'Admin',
      width: 'w-72',
      items: [
        { id: 'wand-products', label: 'Product Library', icon: Package },
        { id: 'integration-sources', label: 'Integration Sources', icon: Database },
        { id: 'dayparts', label: 'Daypart Manager', icon: Clock },
        { id: 'core-attributes', label: 'Core Attributes', icon: Sliders },
        { id: 'wand-templates', label: 'Manage Templates', icon: Layers },
        { id: 'wand-mapper', label: 'Map Integration Templates', icon: MapPin },
      ],
    },
    {
      id: 'beta',
      label: 'Beta',
      width: 'w-72',
      extraViews: ['theme-builder-beta'],
      items: [
        { id: 'asset-library', label: 'Asset Library', icon: Images },
        { id: 'themes-beta', label: 'Display Themes Beta', icon: Palette },
      ],
    },
  ];

  const currentContext = selectedStore?.name ?? selectedCompany?.name ?? selectedConcept?.name;

  return (
    <UserProvider user={user}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Header */}
      <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="h-full flex items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <img
                src="https://cdn11.bigcommerce.com/s-o1xg0nrulj/images/stencil/175x50/wand-logo_horizontal_transp_full-color_navy_1711647134__61951.original.png"
                alt="WAND"
                className="h-8 dark:hidden"
              />
              {/* No white wordmark yet; the mark reads on dark backgrounds */}
              <img
                src={wandMark}
                alt="WAND"
                className="h-8 hidden dark:block"
              />
              <div className="flex items-center gap-2">
                <span className="text-gray-400 dark:text-gray-500">|</span>
                <span className="text-base font-semibold text-brand-navy dark:text-white">Admin</span>
              </div>
            </div>
            <Suspense fallback={<div className="w-48 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse"></div>}>
              <HeaderNavigation
                userId={user.id}
                role="admin"
                userConceptId={null}
                userCompanyId={null}
                userStoreId={null}
                onOpenFullNavigator={() => setShowLocationSelector(true)}
              />
            </Suspense>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" title="Help" aria-label="Help">
              <HelpCircle className="!h-5 !w-5 text-brand" />
            </Button>
            <Button variant="ghost" size="icon" title="Documentation" aria-label="Documentation">
              <FileText className="!h-5 !w-5 text-brand" />
            </Button>
            <NotificationPanel />
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      {/* Horizontal Navigation Menu */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-16 z-30">
        <div className="px-6 flex items-center gap-1">
          {navigationMenus.map((menu) => {
            const isOpen = activeMenu === menu.id;
            const isCurrent =
              menu.items.some((item) => item.id === currentView) || !!menu.extraViews?.includes(currentView);
            return (
              <div key={menu.id} className="relative">
                <button
                  onClick={() => setActiveMenu(isOpen ? null : menu.id)}
                  aria-expanded={isOpen}
                  className={cn(
                    'px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500',
                    isOpen || isCurrent
                      ? 'text-sky-600 border-sky-600 dark:text-sky-400 dark:border-sky-400'
                      : 'text-brand-navy border-transparent hover:text-sky-600 dark:text-gray-300 dark:hover:text-sky-400'
                  )}
                >
                  {menu.label}
                  <ChevronDown className="h-4 w-4" />
                </button>
                {isOpen && (
                  <div className={cn('absolute top-full left-0 mt-0 bg-white dark:bg-gray-800 rounded-b-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50', menu.width)}>
                    {menu.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setCurrentView(item.id);
                            setActiveMenu(null);
                          }}
                          className={cn(
                            'w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-3',
                            currentView === item.id
                              ? 'bg-sky-50 text-sky-700 font-medium dark:bg-sky-900/30 dark:text-sky-300'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Full-Screen Views (no padding) */}
      {currentView === 'theme-builder-beta' && themeContext && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Spinner /></div>}>
          <ThemeBuilderBeta
            themeId={themeContext.themeId}
            themeName={themeContext.themeName}
            onBack={() => {
              setCurrentView('themes-beta');
              setThemeContext(null);
            }}
          />
        </Suspense>
      )}

      {/* Main Content Area (with padding) */}
      {currentView !== 'theme-builder-beta' && (
        <main className="p-6">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner /></div>}>
            {currentView === 'signage' && <SignageManagement onBack={() => setCurrentView('dashboard')} />}
            {currentView === 'labels' && <ShelfLabelManagement onBack={() => setCurrentView('dashboard')} />}
            {currentView === 'products' && <ProductManagement showBackButton={false} />}
            {currentView === 'resources' && <ResourceManagement onBack={() => setCurrentView('dashboard')} />}
            {currentView === 'themes' && (
              <ThemeManagement
                onBack={() => setCurrentView('dashboard')}
                onEditContent={(themeId, themeName) => {
                  setThemeContext({ themeId, themeName });
                  setCurrentView('theme-builder-beta');
                }}
              />
            )}
            {currentView === 'themes-beta' && (
              <DisplayThemesBeta
                onBack={() => setCurrentView('dashboard')}
                onEditContent={(themeId, themeName) => {
                  setThemeContext({ themeId, themeName });
                  setCurrentView('theme-builder-beta');
                }}
                conceptId={selectedConcept?.id}
              />
            )}
            {currentView === 'wand-products' && <WandProducts />}
            {currentView === 'integration-sources' && <WandIntegrationLibrary onBack={() => setCurrentView('dashboard')} />}
            {currentView === 'dayparts' && <DaypartManagement />}
            {currentView === 'core-attributes' && <CoreAttributes onBack={() => setCurrentView('dashboard')} />}
            {currentView === 'wand-templates' && <WandTemplateManager onBack={() => setCurrentView('dashboard')} />}
            {currentView === 'wand-mapper' && <WandIntegrationMapper onBack={() => setCurrentView('dashboard')} />}
            {currentView === 'integration-dashboard' && (
              <IntegrationDashboard
                onNavigate={(page) => setCurrentView(page === 'access' ? 'integration-access' : 'integration')}
              />
            )}
            {currentView === 'integration-access' && <IntegrationAccess />}
            {currentView === 'integration' && <IntegrationCatalog />}
            {currentView === 'users' && (
              <UserManagement
                onAddUser={() => setShowAddUserModal(true)}
                onEditUser={(user) => {
                  setEditingUserId(user.id);
                  setCurrentView('edit-user');
                }}
              />
            )}
            {currentView === 'edit-user' && editingUserId && (
              <UserEdit
                userId={editingUserId}
                onBack={() => {
                  setCurrentView('users');
                  setEditingUserId(null);
                }}
                onSuccess={() => {
                  setCurrentView('users');
                  setEditingUserId(null);
                  setToastMessage('User updated successfully');
                }}
              />
            )}
            {currentView === 'brands' && <BrandWorkspace userConceptId={user.concept_id || location.concept?.id} userCompanyId={user.company_id || location.company?.id} userStoreId={user.store_id || location.store?.id} isAdmin={true} onBack={() => setCurrentView('dashboard')} onNavigateToBrandMenus={(id, name) => { setBrandContext({ id, name }); setCurrentView('brand-menus'); }} onNavigateToScheduling={() => setCurrentView('station-scheduling')} onNavigateToProducts={() => setCurrentView('products')} />}
            {currentView === 'brand-menus' && brandContext && (
              <MenuManagement brandId={brandContext.id} brandName={brandContext.name} storeId={user.store_id || location.store?.id} onBack={() => { setBrandContext(null); setCurrentView('brands'); }} onNavigateToCalendar={() => setCurrentView('menu-calendar')} />
            )}
            {currentView === 'menu-management' && (
              <MenuManagement storeId={user.store_id || location.store?.id} brandId={brandContext?.id} brandName={brandContext?.name} onBack={() => { setBrandContext(null); setCurrentView('dashboard'); }} onNavigateToCalendar={() => setCurrentView('menu-calendar')} />
            )}
            {currentView === 'menu-calendar' && (
              <MenuCalendarView storeId={user.store_id || location.store?.id} brandId={brandContext?.id} onBack={() => setCurrentView('menu-management')} onNavigateToMenu={() => setCurrentView('menu-management')} />
            )}
            {currentView === 'station-coverage' && (
              <StationCoverageView storeId={user.store_id || location.store?.id} onBack={() => setCurrentView('menu-management')} onNavigateToMenu={() => setCurrentView('menu-management')} />
            )}
            {currentView === 'station-scheduling' && <StationScheduling />}
            {currentView === 'sites-beta' && <SiteConfigurationBeta role="admin" userId={user.id} />}
            {currentView === 'devices-displays' && <DevicesDisplaysDashboard />}
            {currentView === 'display-types' && <DisplayTypesManagement />}
            {currentView === 'asset-library' && <AssetLibrary role="admin" userId={user.id} />}

            {currentView === 'dashboard' && (
              <div className="max-w-7xl mx-auto">
                <Card>
                  <CardHeader className="p-8 pb-6">
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">System administration</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Configure system-wide settings and access support features.
                    </p>
                  </CardHeader>
                  <CardContent className="p-8 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { title: 'Users & access', description: 'Manage user accounts and permissions' },
                        { title: 'System config', description: 'Configure global system settings' },
                        { title: 'Support tools', description: 'Access diagnostic and support features' },
                      ].map((tile) => (
                        <Card
                          key={tile.title}
                          className="rounded-lg shadow-none bg-gray-50 dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                        >
                          <CardHeader>
                            <CardTitle className="text-base">{tile.title}</CardTitle>
                            <CardDescription>{tile.description}</CardDescription>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>

                    {currentContext && (
                      <div className="mt-8 p-4 rounded-lg border bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800">
                        <p className="text-sm">
                          <span className="font-semibold">Current context:</span> {currentContext}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </Suspense>
        </main>
      )}

      {/* Location Selector Modal */}
      {showLocationSelector && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>}>
          <LocationSelector
            onClose={() => setShowLocationSelector(false)}
            onSelect={(selectedLocation) => {
              // Update global location context (which handles localStorage and events)
              setLocation(selectedLocation);

              // Determine location name for toast
              let locationName = 'WAND Digital';
              if (selectedLocation.store) {
                locationName = selectedLocation.store.name;
              } else if (selectedLocation.company) {
                locationName = selectedLocation.company.name;
              } else if (selectedLocation.concept) {
                locationName = selectedLocation.concept.name;
              }

              setToastMessage(`Taking you to ${locationName} now`);
              setShowLocationSelector(false);
            }}
            selectedLocation={{
              concept: selectedConcept || undefined,
              company: selectedCompany || undefined,
              store: selectedStore || undefined,
            }}
            userId={user.id}
          />
        </Suspense>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <Suspense fallback={null}>
          <AddUserModal
            onClose={() => setShowAddUserModal(false)}
            onSuccess={() => {
              setShowAddUserModal(false);
              setToastMessage('User created successfully');
            }}
          />
        </Suspense>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
          duration={2000}
        />
      )}
      </div>
    </UserProvider>
  );
}
