import { useState, useEffect, useRef } from 'react';
import { Search, Package, PenLine, X, Loader2, Link2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProductResult {
  id: string;
  name: string;
  price: string | null;
  concept_id: number | null;
}

interface AddItemPanelProps {
  sectionId: string;
  menuId: string;
  brandId: number | null;
  onAddProduct: (sectionId: string, product: ProductResult) => void;
  onAddFreeform: (sectionId: string, name: string, price: string) => void;
  onCancel: () => void;
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

export default function AddItemPanel({ sectionId, menuId, brandId, onAddProduct, onAddFreeform, onCancel }: AddItemPanelProps) {
  const [tab, setTab] = useState<'product' | 'custom'>('product');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    searchRef.current?.focus();
  }, [tab]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => searchProducts(query.trim()), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const searchProducts = async (q: string) => {
    setSearching(true);
    let queryBuilder = supabase
      .from('products')
      .select('id, name, attributes, concept_id')
      .ilike('name', `%${q}%`)
      .is('parent_product_id', null)
      .limit(20);

    if (brandId) {
      queryBuilder = queryBuilder.or(`concept_id.eq.${brandId},concept_id.is.null`);
    }

    const { data } = await queryBuilder;
    const mapped: ProductResult[] = (data ?? []).map(p => ({
      id: p.id,
      name: stripHtml(p.name),
      price: p.attributes?.price ?? null,
      concept_id: p.concept_id,
    }));
    setResults(mapped);
    setSearching(false);
    setHasSearched(true);
  };

  return (
    <div className="mx-4 mb-3 mt-1 rounded-lg border border-blue-200 bg-blue-50/40 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-blue-200">
        <button
          onClick={() => setTab('product')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
            tab === 'product'
              ? 'bg-white text-blue-700 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Package className="w-3 h-3" />
          From Products
        </button>
        <button
          onClick={() => setTab('custom')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
            tab === 'custom'
              ? 'bg-white text-blue-700 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <PenLine className="w-3 h-3" />
          Custom Item
        </button>
        <button onClick={onCancel} className="px-2.5 text-slate-400 hover:text-slate-600 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {tab === 'product' ? (
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
              placeholder="Search products by name..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500 animate-spin" />}
          </div>

          {results.length > 0 && (
            <div className="mt-2 max-h-[200px] overflow-y-auto space-y-0.5 rounded-lg border border-slate-200 bg-white">
              {results.map(p => (
                <button
                  key={p.id}
                  onClick={() => onAddProduct(sectionId, p)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between gap-2 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 shrink-0" />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900 truncate">{p.name}</span>
                    {p.concept_id && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-teal-50 text-teal-600 shrink-0">
                        <Link2 className="w-2 h-2" />Brand
                      </span>
                    )}
                  </div>
                  {p.price && (
                    <span className="text-xs text-slate-500 shrink-0">${Number(p.price).toFixed(2)}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {hasSearched && !searching && results.length === 0 && query.trim() && (
            <div className="mt-2 text-center py-4">
              <p className="text-xs text-slate-400">No products found for "{query}"</p>
              <button
                onClick={() => { setTab('custom'); setCustomName(query); }}
                className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Create as custom item instead
              </button>
            </div>
          )}

          {!hasSearched && !query.trim() && (
            <p className="mt-2 text-xs text-slate-400 text-center py-2">
              Type to search your product catalog
            </p>
          )}
        </div>
      ) : (
        <div className="p-3">
          <div className="flex items-center gap-2">
            <input
              ref={searchRef}
              type="text"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && customName.trim()) onAddFreeform(sectionId, customName, customPrice);
                if (e.key === 'Escape') onCancel();
              }}
              placeholder="Item name"
              className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <div className="flex items-center gap-0.5">
              <span className="text-xs text-slate-400">$</span>
              <input
                type="text"
                value={customPrice}
                onChange={e => setCustomPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && customName.trim()) onAddFreeform(sectionId, customName, customPrice);
                }}
                placeholder="0.00"
                className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <button
              onClick={() => { if (customName.trim()) onAddFreeform(sectionId, customName, customPrice); }}
              disabled={!customName.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
