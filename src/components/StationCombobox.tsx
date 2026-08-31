import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Search, Plus, Inbox, ArrowDown } from 'lucide-react';

export interface StationSuggestion {
  id: number | string;
  name: string;
  source: 'inherited' | 'feed' | 'local';
  station_id?: number;
}

interface StationComboboxProps {
  suggestions: StationSuggestion[];
  existingNames: string[];
  onSelect: (name: string, suggestion?: StationSuggestion) => void;
  placeholder?: string;
}

export default function StationCombobox({
  suggestions,
  existingNames,
  onSelect,
  placeholder = 'Type a station name to search or create...',
}: StationComboboxProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = normalizedQuery
    ? suggestions.filter(s => s.name.toLowerCase().includes(normalizedQuery))
    : suggestions;

  const exactMatch = suggestions.find(s => s.name.toLowerCase() === normalizedQuery);
  const alreadyExists = existingNames.some(n => n.toLowerCase() === normalizedQuery);
  const canCreate = normalizedQuery.length > 0 && !exactMatch && !alreadyExists;

  const allOptions: StationSuggestion[] = [
    ...filtered,
    ...(canCreate ? [{ id: `create-${Date.now()}`, name: query.trim(), source: 'local' as const }] : []),
  ];

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: globalThis.MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (option: StationSuggestion) => {
    onSelect(option.name, option.source !== 'local' ? option : undefined);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(prev => Math.min(prev + 1, allOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allOptions[highlightedIndex]) {
        handleSelect(allOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const sourceBadge = (source: string) => {
    const styles: Record<string, string> = {
      inherited: 'bg-blue-100 text-blue-700',
      feed: 'bg-amber-100 text-amber-700',
      local: 'bg-slate-100 text-slate-600',
    };
    const labels: Record<string, string> = {
      inherited: 'Inherited',
      feed: 'From Feed',
      local: 'Local',
    };
    return (
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${styles[source] || styles.local}`}>
        {labels[source] || source}
      </span>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {allOptions.length === 0 && normalizedQuery.length === 0 && (
            <div className="px-4 py-6 text-center">
              <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Start typing to search inherited and feed stations.</p>
            </div>
          )}

          {allOptions.length === 0 && normalizedQuery.length > 0 && alreadyExists && (
            <div className="px-4 py-3 text-sm text-slate-500">
              This station is already added.
            </div>
          )}

          {allOptions.map((option, index) => {
            const isCreate = String(option.id).startsWith('create-');
            return (
              <button
                key={option.id}
                type="button"
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => handleSelect(option)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  highlightedIndex === index
                    ? 'bg-blue-50 dark:bg-slate-700'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                {isCreate ? (
                  <>
                    <Plus className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Create <span className="text-blue-600">"{option.name}"</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 flex-1 truncate">
                      {option.name}
                    </span>
                    {sourceBadge(option.source)}
                  </>
                )}
              </button>
            );
          })}

          {allOptions.length > 0 && (
            <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-1 text-[10px] text-slate-400">
              <ArrowDown className="w-3 h-3" />
              <span>Use arrow keys to navigate, Enter to select</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
