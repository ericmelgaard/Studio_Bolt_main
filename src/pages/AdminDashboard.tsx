import { useState, useEffect, lazy, Suspense } from 'react';
import { HelpCircle, FileText, Building2, Users, Store, Settings, Monitor, Tag, Package, BarChart3, Layers, Image as ImageIcon, MapPin, Database, Sliders, ChevronDown, Palette, Clock, Cpu, Images, Paintbrush, UtensilsCrossed, Calendar as CalendarIcon } from 'lucide-react';
import NotificationPanel from '../components/NotificationPanel';
import UserMenu from '../components/UserMenu';
import Toast from '../components/Toast';
import { useLocation } from '../hooks/useLocation';
import { UserProvider } from '../contexts/UserContext';

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
  onBack: () => void;
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

type ViewType = 'dashboard' | 'signage' | 'labels' | 'products' | 'resources' | 'themes' | 'themes-beta' | 'theme-builder-beta' | 'integration' | 'integration-dashboard' | 'integration-access' | 'wand-templates' | 'wand-mapper' | 'integration-sources' | 'core-attributes' | 'wand-products' | 'users' | 'edit-user' | 'dayparts' | 'sites-beta' | 'devices-displays' | 'display-types' | 'asset-library' | 'brands' | 'brand-menus' | 'station-scheduling';

export default function AdminDashboard({ onBack, user }: AdminDashboardProps) {
  const { location, setLocation, getLocationDisplay, resetLocation } = useLocation('admin', user.id);
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
  // This allows admins to maintain their location when switching roles
  useEffect(() => {
    if (!user.concept_id && !user.company_id && !user.store_id) {
      // Only reset if no location is currently set
      if (!location.concept && !location.company && !location.store) {
        resetLocation();
      }
    }
  }, []);

  // Force light mode for admin dashboard
  useEffect(() => {
    const root = document.documentElement;
    const hadDarkClass = root.classList.contains('dark');

    root.classList.remove('dark');

    return () => {
      if (hadDarkClass) {
        root.classList.add('dark');
      }
    };
  }, []);

  // Sync local state with global location context on mount and location changes
  useEffect(() => {
    setSelectedConcept(location.concept || null);
    setSelectedCompany(location.company || null);
    setSelectedStore(location.store || null);
  }, [location]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<'setup' | 'control' | 'access' | 'wand' | 'beta' | null>(null);

  const navigationMenus = {
    setup: [
      { id: 'sites-beta' as ViewType, label: 'Location Manager', icon: MapPin },
      { id: 'users' as ViewType, label: 'Users', icon: Users },
      { id: 'devices-displays' as ViewType, label: 'Devices & Displays', icon: Cpu },
      { id: 'display-types' as ViewType, label: 'Display Types', icon: Layers },
    ],
    control: [
      { id: 'brands' as ViewType, label: 'Brands', icon: UtensilsCrossed },
      { id: 'station-scheduling' as ViewType, label: 'Station Scheduling', icon: CalendarIcon },
      { id: 'signage' as ViewType, label: 'Signage', icon: Monitor },
      { id: 'labels' as ViewType, label: 'Labels', icon: Tag },
      { id: 'products' as ViewType, label: 'Products', icon: Package },
      { id: 'resources' as ViewType, label: 'Resources', icon: ImageIcon },
      { id: 'themes' as ViewType, label: 'Display Themes', icon: Palette },
    ],
    access: [
      { id: 'integration-dashboard' as ViewType, label: 'Dashboard', icon: BarChart3 },
      { id: 'integration-access' as ViewType, label: 'Access', icon: Settings },
      { id: 'integration' as ViewType, label: 'Catalog', icon: Layers },
    ],
    wand: [
      { id: 'wand-products' as ViewType, label: 'Product Library', icon: Package },
      { id: 'integration-sources' as ViewType, label: 'Integration Sources', icon: Database },
      { id: 'dayparts' as ViewType, label: 'Daypart Manager', icon: Clock },
      { id: 'core-attributes' as ViewType, label: 'Core Attributes', icon: Sliders },
      { id: 'wand-templates' as ViewType, label: 'Manage Templates', icon: Layers },
      { id: 'wand-mapper' as ViewType, label: 'Map Integration Templates', icon: MapPin },
    ],
    beta: [
      { id: 'asset-library' as ViewType, label: 'Asset Library', icon: Images },
      { id: 'themes-beta' as ViewType, label: 'Display Themes Beta', icon: Palette },
    ],
  };

  return (
    <UserProvider user={user}>
      <div className="min-h-screen bg-slate-50">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="h-full flex items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <img
                src="https://cdn11.bigcommerce.com/s-o1xg0nrulj/images/stencil/175x50/wand-logo_horizontal_transp_full-color_navy_1711647134__61951.original.png"
                alt="WAND"
                className="h-8"
              />
              <div className="flex items-center gap-2">
                <span className="text-slate-400">|</span>
                <span className="text-base font-semibold text-[#002e5e]" style={{ fontFamily: 'Rubik, Arial, Helvetica, sans-serif' }}>Admin</span>
              </div>
            </div>
            <Suspense fallback={<div className="w-48 h-10 bg-slate-100 rounded-lg animate-pulse"></div>}>
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
            <button
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Help"
            >
              <HelpCircle className="w-5 h-5 text-[#00adf0]" />
            </button>
            <button
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Documentation"
            >
              <FileText className="w-5 h-5 text-[#00adf0]" />
            </button>
            <NotificationPanel />
            <UserMenu role="admin" user={user} onBackToRoles={onBack} />
          </div>
        </div>
      </header>

      {/* Horizontal Navigation Menu */}
      <nav className="bg-white border-b border-slate-200 sticky top-16 z-30">
        <div className="px-6 flex items-center gap-1">
          {/* Setup Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'setup' ? null : 'setup')}
              className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1 ${
                activeMenu === 'setup' || ['sites-beta', 'users', 'devices-displays'].includes(currentView)
                  ? 'text-[#00adf0] border-b-2 border-[#00adf0]'
                  : 'text-[#002e5e] hover:text-[#00adf0]'
              }`}
            >
              Setup
              <ChevronDown className="w-4 h-4" />
            </button>
            {activeMenu === 'setup' && (
              <div className="absolute top-full left-0 mt-0 w-64 bg-white rounded-b-lg shadow-lg border border-slate-200 py-1 z-50">
                {navigationMenus.setup.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentView(item.id);
                        setActiveMenu(null);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                        currentView === item.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Control Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'control' ? null : 'control')}
              className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1 ${
                activeMenu === 'control' || ['signage', 'labels', 'products', 'resources', 'themes'].includes(currentView)
                  ? 'text-[#00adf0] border-b-2 border-[#00adf0]'
                  : 'text-[#002e5e] hover:text-[#00adf0]'
              }`}
            >
              Control
              <ChevronDown className="w-4 h-4" />
            </button>
            {activeMenu === 'control' && (
              <div className="absolute top-full left-0 mt-0 w-64 bg-white rounded-b-lg shadow-lg border border-slate-200 py-1 z-50">
                {navigationMenus.control.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentView(item.id);
                        setActiveMenu(null);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                        currentView === item.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Access Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'access' ? null : 'access')}
              className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1 ${
                activeMenu === 'access' || ['integration-dashboard', 'integration-access', 'integration'].includes(currentView)
                  ? 'text-[#00adf0] border-b-2 border-[#00adf0]'
                  : 'text-[#002e5e] hover:text-[#00adf0]'
              }`}
            >
              Access
              <ChevronDown className="w-4 h-4" />
            </button>
            {activeMenu === 'access' && (
              <div className="absolute top-full left-0 mt-0 w-64 bg-white rounded-b-lg shadow-lg border border-slate-200 py-1 z-50">
                {navigationMenus.access.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentView(item.id);
                        setActiveMenu(null);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                        currentView === item.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Wand Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'wand' ? null : 'wand')}
              className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1 ${
                activeMenu === 'wand' || ['wand-products', 'integration-sources', 'dayparts', 'core-attributes', 'wand-templates', 'wand-mapper'].includes(currentView)
                  ? 'text-[#00adf0] border-b-2 border-[#00adf0]'
                  : 'text-[#002e5e] hover:text-[#00adf0]'
              }`}
            >
              Admin
              <ChevronDown className="w-4 h-4" />
            </button>
            {activeMenu === 'wand' && (
              <div className="absolute top-full left-0 mt-0 w-72 bg-white rounded-b-lg shadow-lg border border-slate-200 py-1 z-50">
                {navigationMenus.wand.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentView(item.id);
                        setActiveMenu(null);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                        currentView === item.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Beta Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'beta' ? null : 'beta')}
              className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1 ${
                activeMenu === 'beta' || ['asset-library', 'themes-beta', 'theme-builder-beta'].includes(currentView)
                  ? 'text-[#00adf0] border-b-2 border-[#00adf0]'
                  : 'text-[#002e5e] hover:text-[#00adf0]'
              }`}
            >
              Beta
              <ChevronDown className="w-4 h-4" />
            </button>
            {activeMenu === 'beta' && (
              <div className="absolute top-full left-0 mt-0 w-72 bg-white rounded-b-lg shadow-lg border border-slate-200 py-1 z-50">
                {navigationMenus.beta.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentView(item.id);
                        setActiveMenu(null);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                        currentView === item.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Full-Screen Views (no padding) */}
      {currentView === 'theme-builder-beta' && themeContext && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
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
          <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
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
            {currentView === 'brands' && <BrandWorkspace userConceptId={user.concept_id || location.concept?.id} userCompanyId={user.company_id || location.company?.id} userStoreId={user.store_id || location.store?.id} onBack={() => setCurrentView('dashboard')} />}
            {currentView === 'brand-menus' && brandContext && (
              <BrandMenuManagement brandId={brandContext.id} brandName={brandContext.name} onBack={() => setCurrentView('brands')} />
            )}
            {currentView === 'station-scheduling' && <StationScheduling />}
            {currentView === 'sites-beta' && <SiteConfigurationBeta role="admin" userId={user.id} />}
            {currentView === 'devices-displays' && <DevicesDisplaysDashboard />}
            {currentView === 'display-types' && <DisplayTypesManagement />}
            {currentView === 'asset-library' && <AssetLibrary role="admin" userId={user.id} />}

            {currentView === 'dashboard' && (
              <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
                  <h2 className="text-2xl font-bold text-slate-900 mb-4">
                    System Administration
                  </h2>
                  <p className="text-slate-600 mb-6">
                    Configure system-wide settings and access support features.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                      <h3 className="font-semibold text-slate-900 mb-2">Users & Access</h3>
                      <p className="text-slate-600 text-sm">Manage user accounts and permissions</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                      <h3 className="font-semibold text-slate-900 mb-2">System Config</h3>
                      <p className="text-slate-600 text-sm">Configure global system settings</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                      <h3 className="font-semibold text-slate-900 mb-2">Support Tools</h3>
                      <p className="text-slate-600 text-sm">Access diagnostic and support features</p>
                    </div>
                  </div>

                  {(selectedConcept || selectedCompany || selectedStore) && (
                    <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800">
                        <strong>Current Context:</strong> {selectedStore ? selectedStore.name : selectedCompany ? selectedCompany.name : selectedConcept ? selectedConcept.name : 'All Locations'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Suspense>
        </main>
      )}

      {/* Location Selector Modal */}
      {showLocationSelector && (
        <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>}>
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
