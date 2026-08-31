import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Check, Undo2 } from 'lucide-react';

export interface StationSuggestion {
  id: number | string;
  name: string;
  source: 'inherited' | 'feed' | 'local';
  station_id?: number;
}

interface StationComboboxProps {
  suggestions: StationSuggestion[];
  existingNames: string[];
  onAccept: (name: string, suggestion?: StationSuggestion) => void;
  label?: string;
}

export default function StationCombobox({
  suggestions,
  existingNames,
  onAccept,
  label = 'Assign Webtrition Meal Station',
}: StationComboboxProps) {
  const [value, setValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [matchedSuggestion, setMatchedSuggestion] = useState<StationSuggestion | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();

  const filtered = normalized
    ? suggestions.filter(s =>
        s.name.toLowerCase().includes(normalized) &&
        !existingNames.some(e => e.toLowerCase() === s.name.toLowerCase())
      )
    : [];

  const alreadyExists = existingNames.some(n => n.toLowerCase() === normalized);
  const canAccept = trimmed.length > 0 && !alreadyExists;

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value]);

  useEffect(() => {
    const handler = (e: globalThis.MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pickSuggestion = (suggestion: StationSuggestion) => {
    setValue(suggestion.name);
    setMatchedSuggestion(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleAccept = () => {
    if (!canAccept) return;
    onAccept(trimmed, matchedSuggestion && matchedSuggestion.name.toLowerCase() === normalized ? matchedSuggestion : undefined);
    setValue('');
    setMatchedSuggestion(null);
    setShowSuggestions(false);
  };

  const handleUndo = () => {
    setValue('');
    setMatchedSuggestion(null);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filtered.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAccept();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
        pickSuggestion(filtered[highlightedIndex]);
      } else {
        handleAccept();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (newValue: string) => {
    setValue(newValue);
    setMatchedSuggestion(null);
    setShowSuggestions(true);
  };

  const sourceBadge = (source: string) => {
    const styles: Record<string, string> = {
      inherited: 'bg-blue-50 text-blue-600',
      feed: 'bg-amber-50 text-amber-600',
    };
    const labels: Record<string, string> = {
      inherited: 'Concept',
      feed: 'Feed',
    };
    return (
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${styles[source] || 'bg-slate-50 text-slate-500'}`}>
        {labels[source] || source}
      </span>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Label */}
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
      </label>

      {/* Input row */}
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (normalized) setShowSuggestions(true); }}
            onKeyDown={handleKeyDown}
            placeholder="Start typing a station name..."
            className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
          />
        </div>

        {/* Accept */}
        <button
          type="button"
          onClick={handleAccept}
          disabled={!canAccept}
          title="Accept"
          className="px-3.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-500 transition-colors flex items-center gap-1.5 text-sm font-medium"
        >
          <Check className="w-4 h-4" />
          Accept
        </button>

        {/* Undo */}
        <button
          type="button"
          onClick={handleUndo}
          disabled={trimmed.length === 0}
          title="Clear"
          className="px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors flex items-center"
        >
          <Undo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Validation hint */}
      {alreadyExists && trimmed.length > 0 && (
        <p className="mt-1 text-xs text-amber-600">This station is already assigned.</p>
      )}

      {/* Autocomplete suggestions */}
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickSuggestion(suggestion)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                highlightedIndex === index
                  ? 'bg-blue-50 dark:bg-slate-700'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{suggestion.name}</span>
              {sourceBadge(suggestion.source)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


export default StationCombobox