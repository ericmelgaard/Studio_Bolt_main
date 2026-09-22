import { useState } from 'react';
import { X, Star, DollarSign, Package, Tag, Eye } from 'lucide-react';

interface MenuItemEditorProps {
  item: {
    id: string;
    product_id: string | null;
    display_name: string | null;
    price_override: number | null;
    portion_size: string | null;
    is_featured: boolean;
    availability_notes: string | null;
    station_display_name: string | null;
    display_label: string | null;
    sort_order: number;
  };
  sections: Array<{ id: string; name: string }>;
  onSave: (updates: Record<string, any>) => void;
  onClose: () => void;
}

export function MenuItemEditor({
  item,
  sections,
  onSave,
  onClose,
}: MenuItemEditorProps) {
  const [displayName, setDisplayName] = useState(item.display_name ?? '');
  const [displayLabel, setDisplayLabel] = useState(item.display_label ?? '');

  const [priceOverride, setPriceOverride] = useState<string>(
    item.price_override != null ? String(item.price_override) : ''
  );
  const [portionSize, setPortionSize] = useState(item.portion_size ?? '');
  const [isFeatured, setIsFeatured] = useState(item.is_featured);
  const [stationDisplayName, setStationDisplayName] = useState(
    item.station_display_name ?? ''
  );
  const [sortOrder, setSortOrder] = useState(item.sort_order);
  const [availabilityNotes, setAvailabilityNotes] = useState(
    item.availability_notes ?? ''
  );

  const handleSave = () => {
    const updates: Record<string, any> = {
      display_name: displayName.trim() || null,
      display_label: displayLabel.trim() || null,
      price_override: priceOverride !== '' ? parseFloat(priceOverride) : null,
      portion_size: portionSize.trim() || null,
      is_featured: isFeatured,
      station_display_name: stationDisplayName.trim() || null,
      sort_order: sortOrder,
      availability_notes: availabilityNotes.trim() || null,
    };
    onSave(updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative z-10 flex h-full w-96 flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">Edit Item</h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {item.display_name || `Product #${item.product_id}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ── Display Section ── */}
          <section>
            <div className="mb-3 flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Display
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Override product name..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Display Label
                </label>
                <input
                  type="text"
                  value={displayLabel}
                  onChange={(e) => setDisplayLabel(e.target.value)}
                  placeholder='e.g. "NEW", "POPULAR"'
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {displayLabel && (
                  <div className="mt-1.5">
                    <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                      {displayLabel}
                    </span>
                  </div>
                )}
              </div>


            </div>
          </section>

          <hr className="border-slate-200" />

          {/* ── Pricing Section ── */}
          <section>
            <div className="mb-3 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Pricing
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Price Override
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={priceOverride}
                    onChange={(e) => setPriceOverride(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Portion Size
                </label>
                <input
                  type="text"
                  value={portionSize}
                  onChange={(e) => setPortionSize(e.target.value)}
                  placeholder='e.g. "8 oz", "Large"'
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          <hr className="border-slate-200" />

          {/* ── Appearance Section ── */}
          <section>
            <div className="mb-3 flex items-center gap-1.5">
              <Tag className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Appearance
              </h3>
            </div>

            <div className="space-y-4">
              {/* Featured Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star
                    className={`h-4 w-4 ${
                      isFeatured ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                    }`}
                  />
                  <label className="text-sm font-medium text-slate-700">
                    Featured Item
                  </label>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isFeatured}
                  onClick={() => setIsFeatured(!isFeatured)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    isFeatured ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      isFeatured ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Station Display Name
                </label>
                <input
                  type="text"
                  value={stationDisplayName}
                  onChange={(e) => setStationDisplayName(e.target.value)}
                  placeholder="How this item appears at the station"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Sort Order
                </label>
                <input
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Lower numbers appear first
                </p>
              </div>
            </div>
          </section>

          <hr className="border-slate-200" />

          {/* ── Availability Section ── */}
          <section>
            <div className="mb-3 flex items-center gap-1.5">
              <Package className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Availability
              </h3>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Availability Notes
              </label>
              <textarea
                value={availabilityNotes}
                onChange={(e) => setAvailabilityNotes(e.target.value)}
                rows={3}
                placeholder='e.g. "Lunch only", "While supplies last"'
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
          </section>
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
