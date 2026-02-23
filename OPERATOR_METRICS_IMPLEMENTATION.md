# Operator Dashboard Metrics Implementation

This document explains how to recreate the metrics dashboard shown in your image.

## What Was Created

### 1. **OperatorMetricsBar Component**
**Location:** `src/components/OperatorMetricsBar.tsx`

A reusable metrics bar component that displays 6 key metrics plus a customize button:

- **Smart Labels** - ESL devices (hardware_devices with usage_type = 'label')
- **Groups** - Placement groups
- **Signage** - Media players with player_type = 'signage' (excluding webview kiosks)
- **Products** - All products with active count
- **Webview Kiosks** - Media players with is_webview_kiosk = true
- **Activity** - Recent actions in last 24 hours
- **Customize** - Dashed border card for customization

### 2. **Integration into DisplayManagement**
The metrics bar has been added to the Operator Hub (DisplayManagement page) right above the "Displays" section.

## Key Features

### Visual Design
- Dark theme matching the image (`bg-[#2d3748]` for cards, `bg-[#1a2332]` for background)
- Icons in WAND blue (`#00adf0`)
- Large, bold count numbers
- Subtle gray subtitles
- Hover effects for interactivity
- Responsive grid layout (2 cols mobile → 4 cols tablet → 7 cols desktop)

### Data Sources

```typescript
// Smart Labels
const { data: hardwareDevices } = await supabase
  .from('hardware_devices')
  .select('status, usage_type')
  .eq('store_id', storeId)
  .filter(d => d.usage_type === 'label');

// Groups
const { data: groups } = await supabase
  .from('placement_groups')
  .select('id')
  .eq('store_id', storeId);

// Signage
const { data: mediaPlayers } = await supabase
  .from('media_players')
  .select('status, player_type, is_webview_kiosk')
  .eq('store_id', storeId)
  .filter(p => p.player_type === 'signage' && !p.is_webview_kiosk);

// Products
const { data: products } = await supabase
  .from('products')
  .select('id, status')
  .eq('store_id', storeId);

// Activity (recent changes)
const { count: displayUpdates } = await supabase
  .from('displays')
  .select('id', { count: 'exact', head: true })
  .eq('store_id', storeId)
  .gte('updated_at', yesterday.toISOString());
```

## Usage

The component is automatically shown in the Operator Dashboard when a store is selected:

```tsx
<OperatorMetricsBar
  storeId={storeId}
  onNavigate={(view) => {
    if (view === 'labels') setCurrentPage('devices');
    else if (view === 'groups') setCurrentPage('groups');
    else if (view === 'products') setCurrentPage('products');
  }}
/>
```

## Click Navigation

Each metric card is clickable and navigates to the appropriate section:
- Smart Labels → Label devices view
- Groups → Placement groups view
- Signage → (Can be configured)
- Products → Products view
- Webview Kiosks → (Can be configured)
- Activity → (Can be configured)
- Customize → (Can be configured)

## Color Scheme

The implementation uses a professional dark theme:
- Card background: `#2d3748`
- Icon container: `#1a2332`
- Accent color: `#00adf0` (WAND blue)
- Text: White for numbers, gray for labels
- Border: `#374151`

## Notes

- All metrics update in real-time based on the selected store
- Loading states show skeleton cards
- The layout is fully responsive
- Icons are from lucide-react
- The "Store Status" section is separate and remains above the metrics bar
