import { Users, HelpCircle, FileText, ChevronDown, Layers, Image, BarChart3, Video, FileText as Document, Palette, GripVertical, Building2, Map, UtensilsCrossed } from 'lucide-react';
import { useState, useEffect, lazy, Suspense } from 'react';
import NotificationPanel from '../components/NotificationPanel';
import UserMenu from '../components/UserMenu';
import { supabase } from '../lib/supabase';
import { checkAndApplyPendingPublications } from '../lib/publicationService';
import { UserProvider } from '../contexts/UserContext';

const LocationSelector = lazy(() => import('../components/LocationSelector'));
const HeaderNavigation = lazy(() => import('../components/HeaderNavigation'));
const BrandWorkspace = lazy(() => import('./BrandWorkspace'));

interface UserProfile {
  id: string;
  email: string;
  role: string;
  display_name: string;
  concept_id: number | null;
  company_id: number | null;
  store_id: number | null;
}

interface CreatorDashboardProps {
  onBack: () => void;
  user: UserProfile;
}

type CardType = 'projects' | 'media' | 'analytics' | 'video' | 'templates' | 'brand';
type CreatorView = 'dashboard' | 'brands';

interface DashboardCard {
  id: CardType;
  order: number;
}

interface Concept {
  id: number;
  name: string;
  privilege_level?: number;
  parent_level?: number;
  domain_level?: number;
}

export default function CreatorDashboard({ onBack, user }: CreatorDashboardProps) {
  const [currentView, setCurrentView] = useState<CreatorView>('dashboard');
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<DashboardCard[]>([
    { id: 'projects', order: 0 },
    { id: 'media', order: 1 },
    { id: 'analytics', order: 2 },
    { id: 'video', order: 3 },
    { id: 'templates', order: 4 },
    { id: 'brand', order: 5 },
  ]);
  const [draggedCard, setDraggedCard] = useState<CardType | null>(null);
  const [showLocationSelector, setShowLocationSelector] = useState(false);

  useEffect(() => {
    checkAndApplyPendingPublications().catch(err => {
      console.error('Error checking pending publications:', err);
    });
    loadConcepts();
  }, []);

  const loadConcepts = async () => {
    setLoading(true);

    let conceptsQuery = supabase
      .from('concepts')
      .select('id, name, privilege_level, parent_level, domain_level')
      .order('name');

    if (user.concept_id) {
      conceptsQuery = conceptsQuery.eq('id', user.concept_id);
    }

    const { data: conceptsData, error: conceptsError } = await conceptsQuery;

    if (conceptsError) {
      console.error('Error loading concepts:', conceptsError);
      setConcepts([]);
    } else if (conceptsData) {
      setConcepts(conceptsData);
      if (conceptsData.length > 0) {
        setSelectedConcept(conceptsData[0]);
      }
    }

    setLoading(false);
  };

  const handleDragStart = (cardId: CardType) => {
    setDraggedCard(cardId);
  };

  const handleDragOver = (e: React.DragEvent, targetCardId: CardType) => {
    e.preventDefault();
    if (!draggedCard || draggedCard === targetCardId) return;

    const newCards = [...cards];
    const draggedIndex = newCards.findIndex(c => c.id === draggedCard);
    const targetIndex = newCards.findIndex(c => c.id === targetCardId);

    const [removed] = newCards.splice(draggedIndex, 1);
    newCards.splice(targetIndex, 0, removed);

    newCards.forEach((card, index) => {
      card.order = index;
    });

    setCards(newCards);
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
  };

  const sortedCards = [...cards].sort((a, b) => a.order - b.order);

  const renderCard = (cardId: CardType) => {
    const commonProps = {
      draggable: true,
      onDragStart: () => handleDragStart(cardId),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, cardId),
      onDragEnd: handleDragEnd,
      className: `bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all ${
        draggedCard === cardId ? 'opacity-50' : ''
      }`,
    };

    switch (cardId) {
      case 'projects':
        return (
          <div key={cardId} {...commonProps}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GripVertical className="w-5 h-5 text-slate-400 cursor-grab active:cursor-grabbing" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Content Projects
                </h3>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Layers className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-slate-900">12</div>
                  <div className="text-sm text-slate-600">Active projects</div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <div className="text-sm text-slate-600">
                  Create and manage content projects
                </div>
              </div>
            </div>
          </div>
        );

      case 'media':
        return (
          <div key={cardId} {...commonProps}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GripVertical className="w-5 h-5 text-slate-400 cursor-grab active:cursor-grabbing" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Media Library
                </h3>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Image className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-slate-900">248</div>
                  <div className="text-sm text-slate-600">Media assets</div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <div className="text-sm text-slate-600">
                  Upload and organize media files
                </div>
              </div>
            </div>
          </div>
        );

      case 'analytics':
        return (
          <div key={cardId} {...commonProps}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GripVertical className="w-5 h-5 text-slate-400 cursor-grab active:cursor-grabbing" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Analytics
                </h3>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <BarChart3 className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-slate-900">89%</div>
                  <div className="text-sm text-slate-600">Engagement rate</div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <div className="text-sm text-slate-600">
                  View content performance metrics
                </div>
              </div>
            </div>
          </div>
        );

      case 'video':
        return (
          <div key={cardId} {...commonProps}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GripVertical className="w-5 h-5 text-slate-400 cursor-grab active:cursor-grabbing" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Video Content
                </h3>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-rose-100 rounded-lg">
                  <Video className="w-8 h-8 text-rose-600" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-slate-900">35</div>
                  <div className="text-sm text-slate-600">Video assets</div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <div className="text-sm text-slate-600">
                  Manage video content library
                </div>
              </div>
            </div>
          </div>
        );

      case 'templates':
        return (
          <div key={cardId} {...commonProps}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GripVertical className="w-5 h-5 text-slate-400 cursor-grab active:cursor-grabbing" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Templates
                </h3>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Document className="w-8 h-8 text-amber-600" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-slate-900">18</div>
                  <div className="text-sm text-slate-600">Design templates</div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <div className="text-sm text-slate-600">
                  Browse and use templates
                </div>
              </div>
            </div>
          </div>
        );

      case 'brand':
        return (
          <div key={cardId} {...commonProps} onClick={() => setCurrentView('brands')} style={{ cursor: 'pointer' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GripVertical className="w-5 h-5 text-slate-400 cursor-grab active:cursor-grabbing" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Brands &amp; Menus
                </h3>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-cyan-100 rounded-lg">
                  <UtensilsCrossed className="w-8 h-8 text-cyan-600" />
                </div>
                <div>
                  <div className="text-sm text-slate-900 font-medium">My Brands</div>
                  <div className="text-sm text-slate-600">Menus & schedules</div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <div className="text-sm text-slate-600">
                  View menus, schedules & products
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (currentView === 'brands') {
    return (
      <UserProvider user={user}>
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
          <BrandWorkspace
            userConceptId={user.concept_id}
            userCompanyId={user.company_id}
            userStoreId={user.store_id}
            onBack={() => setCurrentView('dashboard')}
          />
        </Suspense>
      </UserProvider>
    );
  }

  return (
    <UserProvider user={user}>
      <div className="min-h-screen bg-slate-50">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <img
              src="/WAND-Logo_Horizontal_Transp_Full-Color_White.png"
              alt="WAND"
              className="h-8 w-8 object-cover object-left"
            />
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900">WAND Digital</span>
              <span className="text-slate-400">|</span>
              <span className="text-base font-semibold text-slate-700">Studio</span>
            </div>
          </div>
          <Suspense fallback={<div className="w-48 h-10 bg-slate-100 rounded-lg animate-pulse"></div>}>
            <HeaderNavigation
              userId={user.id}
              userConceptId={user.concept_id}
              userCompanyId={user.company_id}
              userStoreId={user.store_id}
              onOpenFullNavigator={() => setShowLocationSelector(true)}
            />
          </Suspense>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Help"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <button
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Documentation"
          >
            <FileText className="w-5 h-5" />
          </button>
          <NotificationPanel />
          <UserMenu role="creator" user={user} onBackToRoles={onBack} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCards.map(card => renderCard(card.id))}
        </div>
      </main>

      {showLocationSelector && (
        <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>}>
          <LocationSelector
            onClose={() => setShowLocationSelector(false)}
            onSelect={(selectedLocation) => {
              setShowLocationSelector(false);
            }}
            selectedLocation={{}}
            userId={user.id}
          />
        </Suspense>
      )}
      </div>
    </UserProvider>
  );
}
