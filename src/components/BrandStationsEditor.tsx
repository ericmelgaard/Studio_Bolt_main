import { useState, useEffect, useRef } from 'react';
import { Utensils, X, ChevronDown, Search, Plus, List, ClipboardPaste, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DaypartOption {
  id: string | null;
  label: string;
  color: string;
  sortOrder: number;
}

interface LinkedStation {
  rowId: string;
  stationId: number;
  stationName: string;
  daypartId: string | null;
  daypartLabel: string;
  daypartColor: string;
}

interface StationRecord {
  id: number;
  name: string;
}

const ALL_DAYPARTS_OPTION: DaypartOption = {
  id: null,
  label: 'All Dayparts',
  color: 'bg-slate-100 text-slate-700 border-slate-300',
  sortOrder: 0,
};

const DAYPART_COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  breakfast: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  lunch: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-400' },
  dinner: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
  late_night: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-400' },
};

const ALL_COLORS = { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };

function getDaypartColors(daypartName: string | null) {
  if (!daypartName) return ALL_COLORS;
  return DAYPART_COLOR_MAP[daypartName] || ALL_COLORS;
}

interface Props {
  brandId: number;
}

export default function BrandStationsEditor({ brandId }: Props) {
  const [dayparts, setDayparts] = useState<DaypartOption[]>([ALL_DAYPARTS_OPTION]);
  const [linkedStations, setLinkedStations] = useState<LinkedStation[]>([]);
  const [allStations, setAllStations] = useState<StationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDaypart, setSelectedDaypart] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'type' | 'paste' | 'browse'>('type');

  // Type mode
  const [searchValue, setSearchValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Paste mode
  const [pasteValue, setPasteValue] = useState('');

  // Browse mode
  const [browseSearch, setBrowseSearch] = useState('');
  const [browseSelected, setBrowseSelected] = useState<Set<number>>(new Set());
  const [showBrowse, setShowBrowse] = useState(false);

  // Editing daypart on existing row
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, [brandId]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadDayparts(), loadLinkedStations(), loadAllStations()]);
    setLoading(false);
  };

  const loadDayparts = async () => {
    const { data } = await supabase
      .from('daypart_definitions')
      .select('id, daypart_name, display_label, color, sort_order')
      .is('store_id', null)
      .is('concept_id', null)
      .eq('is_active', true)
      .in('daypart_name', ['breakfast', 'lunch', 'dinner', 'late_night'])
      .order('sort_order');
    if (data) {
      const opts: DaypartOption[] = [
        ALL_DAYPARTS_OPTION,
        ...data.map(d => ({
          id: d.id,
          label: d.display_label,
          color: d.color,
          sortOrder: d.sort_order,
        })),
      ];
      setDayparts(opts);
    }
  };

  const loadLinkedStations = async () => {
    const { data } = await supabase
      .from('brand_stations')
      .select('id, station_id, daypart_id, stations(id, name), daypart_definitions(daypart_name, display_label, color)')
      .eq('brand_id', brandId);
    if (data) {
      const stations: LinkedStation[] = data.map((d: any) => ({
        rowId: d.id,
        stationId: d.stations?.id ?? d.station_id,
        stationName: d.stations?.name || 'Unknown',
        daypartId: d.daypart_id,
        daypartLabel: d.daypart_definitions?.display_label || 'All Dayparts',
        daypartColor: d.daypart_definitions?.daypart_name || null,
      }));
      setLinkedStations(stations);
    }
  };

  const loadAllStations = async () => {
    const { data } = await supabase
      .from('stations')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (data) setAllStations(data);
  };

  // Group stations by daypart for display
  const groupedStations = (() => {
    const groups: Record<string, { label: string; daypartName: string | null; stations: LinkedStation[] }> = {};
    groups['all'] = { label: 'All Dayparts', daypartName: null, stations: [] };

    for (const s of linkedStations) {
      const key = s.daypartId || 'all';
      if (!groups[key]) {
        groups[key] = { label: s.daypartLabel, daypartName: s.daypartColor, stations: [] };
      }
      groups[key].stations.push(s);
    }

    // Sort: specific dayparts first (by their sort order), "All Dayparts" last
    const daypartOrder: Record<string, number> = { breakfast: 10, lunch: 20, dinner: 30, late_night: 40 };
    return Object.entries(groups)
      .filter(([, g]) => g.stations.length > 0)
      .sort(([keyA, gA], [keyB, gB]) => {
        const orderA = keyA === 'all' ? 999 : (daypartOrder[gA.daypartName || ''] ?? 50);
        const orderB = keyB === 'all' ? 999 : (daypartOrder[gB.daypartName || ''] ?? 50);
        return orderA - orderB;
      });
  })();

  // --- Add station logic ---
  const findOrCreateStation = async (name: string): Promise<number | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = allStations.find(s => s.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;
    const { data: newStation } = await supabase
      .from('stations')
      .insert({ name: trimmed, source: 'manual', is_active: true, uses_cycle: true })
      .select('id')
      .maybeSingle();
    if (newStation) {
      setAllStations(prev => [...prev, { id: newStation.id, name: trimmed }].sort((a, b) => a.name.localeCompare(b.name)));
      return newStation.id;
    }
    return null;
  };

  const addStation = async (stationId: number, daypartId: string | null) => {
    await supabase.from('brand_stations').insert({
      brand_id: brandId,
      station_id: stationId,
      daypart_id: daypartId,
    });
    await loadLinkedStations();
  };

  const handleTypeAccept = async () => {
    const trimmed = searchValue.trim();
    if (!trimmed) return;
    const stationId = await findOrCreateStation(trimmed);
    if (stationId) {
      await addStation(stationId, selectedDaypart);
      setSearchValue('');
      setShowSuggestions(false);
    }
  };

  const handlePasteAccept = async () => {
    const lines = pasteValue
      .split(/[\n,]/)
      .map(l => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    for (const line of lines) {
      const stationId = await findOrCreateStation(line);
      if (stationId) {
        await supabase.from('brand_stations').insert({
          brand_id: brandId,
          station_id: stationId,
          daypart_id: selectedDaypart,
        });
      }
    }
    await loadLinkedStations();
    setPasteValue('');
  };

  const handleBrowseAccept = async () => {
    for (const stationId of browseSelected) {
      await supabase.from('brand_stations').insert({
        brand_id: brandId,
        station_id: stationId,
        daypart_id: selectedDaypart,
      });
    }
    await loadLinkedStations();
    setBrowseSelected(new Set());
    setShowBrowse(false);
  };

  const handleRemove = async (rowId: string) => {
    await supabase.from('brand_stations').delete().eq('id', rowId);
    setLinkedStations(prev => prev.filter(s => s.rowId !== rowId));
  };

  const handleUpdateDaypart = async (rowId: string, newDaypartId: string | null) => {
    await supabase.from('brand_stations').update({ daypart_id: newDaypartId }).eq('id', rowId);
    setEditingRowId(null);
    await loadLinkedStations();
  };

  // Autocomplete filtering
  const filteredSuggestions = searchValue.trim()
    ? allStations.filter(s => s.name.toLowerCase().includes(searchValue.trim().toLowerCase())).slice(0, 20)
    : [];

  // Browse filtering
  const filteredBrowse = browseSearch.trim()
    ? allStations.filter(s => s.name.toLowerCase().includes(browseSearch.trim().toLowerCase()))
    : allStations;

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setHighlightedIndex(-1); }, [searchValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredSuggestions.length === 0) {
      if (e.key === 'Enter') { e.preventDefault(); handleTypeAccept(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
        setSearchValue(filteredSuggestions[highlightedIndex].name);
        setShowSuggestions(false);
      } else {
        handleTypeAccept();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  if (loading) {
    return (
      <div data-section="stations" className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Utensils className="w-4 h-4 text-[#00adf0]" />
          <h2 className="text-base font-semibold text-slate-900">Webtrition Stations</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#00adf0]"></div>
        </div>
      </div>
    );
  }

  return (
    <div data-section="stations" className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Utensils className="w-4 h-4 text-[#00adf0]" />
          <h2 className="text-base font-semibold text-slate-900">Webtrition Stations</h2>
          <span className="text-xs text-slate-400 ml-1">{linkedStations.length} assigned</span>
        </div>
      </div>

      {/* Input area */}
      <div className="mb-5 space-y-3">
        {/* Daypart selector + mode tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Target Daypart</label>
            <DaypartSelector
              dayparts={dayparts}
              value={selectedDaypart}
              onChange={setSelectedDaypart}
            />
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {([
              { mode: 'type' as const, icon: Search, label: 'Type' },
              { mode: 'paste' as const, icon: ClipboardPaste, label: 'Paste' },
              { mode: 'browse' as const, icon: List, label: 'Browse All' },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => { setInputMode(mode); if (mode === 'browse') setShowBrowse(true); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  inputMode === mode
                    ? 'bg-[#00adf0] text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Type mode */}
        {inputMode === 'type' && (
          <div className="relative">
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => { setSearchValue(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => { if (searchValue.trim()) setShowSuggestions(true); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Start typing a station name..."
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00adf0]/30 focus:border-[#00adf0] text-sm outline-none"
                />
              </div>
              <button
                onClick={handleTypeAccept}
                disabled={!searchValue.trim()}
                className="px-4 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors flex items-center gap-1.5 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div ref={suggestionsRef} className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {filteredSuggestions.map((station, index) => (
                  <button
                    key={station.id}
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setSearchValue(station.name); setShowSuggestions(false); inputRef.current?.focus(); }}
                    className={`w-full flex items-center px-3 py-2.5 text-left text-sm transition-colors ${
                      highlightedIndex === index ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-medium text-slate-900 truncate">{station.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Paste mode */}
        {inputMode === 'paste' && (
          <div className="space-y-2">
            <textarea
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder="Paste station names here (one per line, or comma-separated)..."
              rows={4}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00adf0]/30 focus:border-[#00adf0] text-sm outline-none resize-none font-mono"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {pasteValue.split(/[\n,]/).map(l => l.trim()).filter(Boolean).length} station(s) detected
              </span>
              <button
                onClick={handlePasteAccept}
                disabled={!pasteValue.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors flex items-center gap-1.5 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Browse All Modal */}
      {showBrowse && (
        <BrowseStationsModal
          stations={allStations}
          selected={browseSelected}
          onToggle={(id) => {
            setBrowseSelected(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          }}
          search={browseSearch}
          onSearchChange={setBrowseSearch}
          dayparts={dayparts}
          selectedDaypart={selectedDaypart}
          onDaypartChange={setSelectedDaypart}
          onAccept={handleBrowseAccept}
          onClose={() => { setShowBrowse(false); setInputMode('type'); setBrowseSelected(new Set()); setBrowseSearch(''); }}
        />
      )}

      {/* Grouped station list */}
      {groupedStations.length > 0 ? (
        <div className="space-y-4">
          {groupedStations.map(([key, group]) => {
            const colors = getDaypartColors(group.daypartName);
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <h3 className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>
                    {group.label}
                  </h3>
                  <span className="text-xs text-slate-400">{group.stations.length}</span>
                </div>
                <div className="space-y-1">
                  {group.stations.map(station => (
                    <StationRow
                      key={station.rowId}
                      station={station}
                      dayparts={dayparts}
                      isEditing={editingRowId === station.rowId}
                      onEditDaypart={() => setEditingRowId(station.rowId)}
                      onUpdateDaypart={(dpId) => handleUpdateDaypart(station.rowId, dpId)}
                      onCancelEdit={() => setEditingRowId(null)}
                      onRemove={() => handleRemove(station.rowId)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <Utensils className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No stations assigned to this brand yet</p>
          <p className="text-xs text-slate-300 mt-1">Use the controls above to add Webtrition meal stations</p>
        </div>
      )}
    </div>
  );
}

/* --- Sub-components --- */

function DaypartSelector({ dayparts, value, onChange }: {
  dayparts: DaypartOption[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = dayparts.find(d => d.id === value) || dayparts[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition-colors min-w-[140px]"
      >
        <DaypartDot daypartName={getDaypartNameFromOption(current)} />
        <span className="font-medium text-slate-700">{current.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          {dayparts.map(dp => (
            <button
              key={dp.id || 'all'}
              onClick={() => { onChange(dp.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                dp.id === value ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <DaypartDot daypartName={getDaypartNameFromOption(dp)} />
              <span className="font-medium">{dp.label}</span>
              {dp.id === value && <Check className="w-3.5 h-3.5 ml-auto text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getDaypartNameFromOption(dp: DaypartOption): string | null {
  if (!dp.id) return null;
  const labelMap: Record<string, string> = { Breakfast: 'breakfast', Lunch: 'lunch', Dinner: 'dinner', 'Late Night': 'late_night' };
  return labelMap[dp.label] || null;
}

function DaypartDot({ daypartName }: { daypartName: string | null }) {
  const colors = getDaypartColors(daypartName);
  return <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />;
}

function StationRow({ station, dayparts, isEditing, onEditDaypart, onUpdateDaypart, onCancelEdit, onRemove }: {
  station: LinkedStation;
  dayparts: DaypartOption[];
  isEditing: boolean;
  onEditDaypart: () => void;
  onUpdateDaypart: (dpId: string | null) => void;
  onCancelEdit: () => void;
  onRemove: () => void;
}) {
  const colors = getDaypartColors(station.daypartColor);

  return (
    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg group hover:bg-slate-100 transition-colors">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className={`w-7 h-7 rounded-md ${colors.bg} ${colors.border} border flex items-center justify-center flex-shrink-0`}>
          <Utensils className={`w-3.5 h-3.5 ${colors.text}`} />
        </div>
        <span className="text-sm font-medium text-slate-700 truncate">{station.stationName}</span>

        {/* Daypart tag */}
        {isEditing ? (
          <div className="flex items-center gap-1 ml-2">
            {dayparts.map(dp => (
              <button
                key={dp.id || 'all'}
                onClick={() => onUpdateDaypart(dp.id)}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                  dp.id === station.daypartId
                    ? 'bg-[#00adf0] text-white border-[#00adf0]'
                    : 'bg-white text-slate-500 border-slate-300 hover:border-[#00adf0] hover:text-[#00adf0]'
                }`}
              >
                {dp.label}
              </button>
            ))}
            <button onClick={onCancelEdit} className="ml-1 text-slate-400 hover:text-slate-600">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={onEditDaypart}
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border} hover:opacity-80 transition-opacity ml-1 flex-shrink-0`}
          >
            {station.daypartLabel}
          </button>
        )}
      </div>

      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all flex-shrink-0 ml-2"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function BrowseStationsModal({ stations, selected, onToggle, search, onSearchChange, dayparts, selectedDaypart, onDaypartChange, onAccept, onClose }: {
  stations: StationRecord[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  search: string;
  onSearchChange: (v: string) => void;
  dayparts: DaypartOption[];
  selectedDaypart: string | null;
  onDaypartChange: (id: string | null) => void;
  onAccept: () => void;
  onClose: () => void;
}) {
  const filtered = search.trim()
    ? stations.filter(s => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    : stations;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">Browse All Stations</h3>
            <p className="text-xs text-slate-500 mt-0.5">{stations.length} stations available</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-5 pt-4 space-y-3">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search stations..."
              className="w-full px-3 py-2.5 pl-9 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00adf0]/30 focus:border-[#00adf0] outline-none"
              autoFocus
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Assign to:</label>
            <DaypartSelector dayparts={dayparts} value={selectedDaypart} onChange={onDaypartChange} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No stations match your search</p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map(station => (
                <button
                  key={station.id}
                  onClick={() => onToggle(station.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                    selected.has(station.id) ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    selected.has(station.id) ? 'bg-[#00adf0] border-[#00adf0]' : 'border-slate-300'
                  }`}>
                    {selected.has(station.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`font-medium truncate ${selected.has(station.id) ? 'text-blue-700' : 'text-slate-700'}`}>
                    {station.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-5 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <span className="text-sm text-slate-500">{selected.size} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={onAccept}
              disabled={selected.size === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-[#00adf0] rounded-lg hover:bg-[#0099d6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add {selected.size} Station{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
