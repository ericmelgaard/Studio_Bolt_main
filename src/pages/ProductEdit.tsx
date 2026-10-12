import { useState, useEffect, useRef } from 'react';
import { Info, Image, FileText, DollarSign, Link2, Copy, Check, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EditProductModal from '../components/EditProductModal';
import { supabase } from '../lib/supabase';
import { LocationProductService } from '../lib/locationProductService';
import Breadcrumb from '../components/Breadcrumb';

interface ProductEditProps {
  productId: string;
  mode: 'edit' | 'create';
  onBack: () => void;
  onSave: () => void;
}

const SECTIONS = [
  { id: 'basic-info', label: 'Basic information', icon: Info },
  { id: 'integration', label: 'Integration links', icon: Link2 },
  { id: 'images-media', label: 'Images & media', icon: Image },
  { id: 'pricing', label: 'Pricing & options', icon: DollarSign },
  { id: 'description', label: 'Description & details', icon: FileText },
];

export default function ProductEdit({ productId, mode, onBack, onSave }: ProductEditProps) {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('basic-info');
  const [presentSections, setPresentSections] = useState<string[]>([]);
  const [idCopied, setIdCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === 'edit') {
      loadProduct();
    } else {
      setLoading(false);
    }
  }, [productId, mode]);

  // Sections live inside EditProductModal, so discover which ones rendered (in page order)
  // and scroll-spy on the content card, which is the element that actually scrolls.
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const findSections = () => {
      const ids: string[] = [];
      container.querySelectorAll<HTMLElement>('[data-section]').forEach((el) => {
        const id = el.dataset.section;
        if (id && !ids.includes(id) && SECTIONS.some((s) => s.id === id)) ids.push(id);
      });
      setPresentSections((prev) => (prev.join() === ids.join() ? prev : ids));
      return ids;
    };

    const handleScroll = () => {
      const ids = findSections();
      if (ids.length === 0) return;
      const threshold = container.getBoundingClientRect().top + 120;
      let current = ids[0];
      for (const id of ids) {
        const el = container.querySelector(`[data-section="${id}"]`);
        if (el && el.getBoundingClientRect().top <= threshold) current = id;
      }
      setActiveSection(current);
    };

    const observer = new MutationObserver(findSections);
    observer.observe(container, { childList: true, subtree: true });
    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      observer.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [loading]);

  const sections = presentSections
    .map((id) => SECTIONS.find((s) => s.id === id))
    .filter((s): s is (typeof SECTIONS)[number] => Boolean(s));

  const getBreadcrumbItems = () => {
    const items: { label: string; onClick?: () => void }[] = [
      { label: 'Product Management', onClick: onBack }
    ];

    if (mode === 'edit') {
      items.push({ label: 'Edit Product' });
    } else {
      items.push({ label: 'Create Product' });
    }

    return items;
  };

  const scrollToSection = (sectionId: string) => {
    const element = contentRef.current?.querySelector(`[data-section="${sectionId}"]`);
    // Sections carry scroll-mt-20, so the heading lands below the top edge.
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const copyIdToClipboard = async () => {
    if (productId) {
      try {
        await navigator.clipboard.writeText(productId);
        setIdCopied(true);
        setTimeout(() => setIdCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const loadProduct = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        integration_source:wand_integration_sources!products_integration_source_id_fkey(
          id,
          name,
          integration_type
        )
      `)
      .eq('id', productId)
      .maybeSingle();

    if (error) {
      console.error('Error loading product:', error);
      setLoading(false);
      return;
    }

    if (!data) {
      console.error('Product not found');
      setLoading(false);
      return;
    }

    let integrationDataMap: Map<string, any> | undefined;
    if (data.integration_product_id) {
      const { data: integrationData } = await supabase
        .from('integration_products')
        .select('*')
        .eq('id', data.integration_product_id)
        .maybeSingle();

      if (integrationData) {
        integrationDataMap = new Map([[integrationData.id, integrationData]]);
      }
    }

    const resolvedProduct = await LocationProductService.resolveProductWithInheritance(
      data,
      integrationDataMap
    );

    const productWithSource = {
      ...resolvedProduct,
      integration_source_name: data.integration_source?.name || null,
      integration_type: data.integration_source?.integration_type || data.integration_type
    };

    setProduct(productWithSource);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 border-t-sky-500 dark:border-t-sky-400 rounded-full animate-spin" />
      </div>
    );
  }

  const productName = product?.attributes?.name || product?.name || 'Untitled Product';

  return (
    <div className="max-w-[1800px] mx-auto h-[calc(100vh-200px)]">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-brand rounded-lg flex-shrink-0">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                {mode === 'edit' ? `Edit: ${productName.replace(/<[^>]*>/g, '')}` : 'Create product'}
              </h1>
              <Breadcrumb items={getBreadcrumbItems()} />
            </div>
          </div>
          {mode === 'edit' && productId && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyIdToClipboard}
              className="font-mono flex-shrink-0"
              title="Click to copy ID"
            >
              {idCopied ? (
                <>
                  <Check className="text-emerald-600 dark:text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy />
                  <span>ID: {productId.slice(0, 8)}...</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-6 h-[calc(100%-80px)]">
        {sections.length > 0 && (
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-2 uppercase tracking-wide px-2">
                Sections
              </h3>
              <nav className="space-y-0.5">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        activeSection === section.id
                          ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-l-2 border-sky-500 -ml-px pl-1.5'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="text-left">{section.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0 overflow-hidden">
          <div
            ref={contentRef}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full overflow-y-auto"
          >
            <EditProductModal
              isOpen={true}
              onClose={onBack}
              product={product}
              onSuccess={() => {
                onSave();
              }}
              mode={mode}
              renderAsPage={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
