# WAND Digital — AI Style Guide

Rules for any AI (or person) adding or changing UI in WAND Digital prototypes. The goal is that
new screens look like they were always part of the app. **When in doubt, find the closest
existing component and copy its patterns.**

## Rules for AI
- Copy the closest existing pattern before creating anything new.
- Use the colors, components, icons, and daypart colors defined below.
- Stay within the spacing, icon sizes, and type sizes already used in the app.
- Never invent brand names, product names, or marketing terms. Use the terms already in the
  UI, or ask.
- **Ask before deviating.** If something new is needed (a color, component, pattern, or term),
  stop and propose it with a reason. Don't just add it.
- When a deviation is approved, add it to this guide so it becomes the standard.

Stack: React + TypeScript + Vite, Tailwind CSS, shadcn/ui (`src/components/ui/`), Lucide icons.
Do not add other UI kits, icon sets, or CSS frameworks.

## Components
- Use the shadcn/ui components in `src/components/ui/` first (`Button`, `Card`, `Badge`, `Input`,
  `Select`, `Label`, `Textarea`). Don't hand-style a `<button>` when `Button` fits.
- Need a component that doesn't exist yet? Add it from shadcn/ui (new-york style) into
  `src/components/ui/` and restyle it to the colors below.
- Mobile-first. Modals go full screen under `md` using the `.modal-*` classes in `src/index.css`.
  Respect safe areas (`.safe-area-top` / `.safe-area-bottom`).

## Layout patterns
Reuse these instead of inventing new layouts. Each one has a reference implementation to copy.

### Filters → side panel
Reference: `src/components/FilterSidebar.tsx` (Products page), opened from the toolbar in
`src/components/MenuFilters.tsx`. Every list or grid that needs filtering uses this pattern.
- **Trigger:** an outline `Button` labeled "Filters" in the toolbar, with
  `PanelLeftOpen` / `PanelLeftClose` icons. Show a `sky-500` count pill when filters are active,
  and a sky selected state while the panel is open.
- **Panel:** docks on the left beside the content (`flex gap-6`, content `flex-1 min-w-0`), so
  results update live while it's open. Width `w-80` (`md:w-72 lg:w-80`); it collapses to `w-0`.
  Under `md` it becomes a full-screen overlay with a `bg-black/40` backdrop and a sticky
  "Show results" button in the footer.
- **Header:** `Filter` icon + "Filters" title + active count pill, "Clear all", and a close (`X`).
- **Results count:** "Showing X of Y items" under the header, with a thin `sky-500` progress bar
  when the results are narrowed.
- **Active filter chips:** one removable chip per active filter (soft `sky` fill). Summarize
  multi-selects ("3 stations") instead of listing every value.
- **Sections:** one collapsible section per filter dimension, each with a Lucide icon, a
  `sky-500` dot when that section has a selection, and its own "Clear" link. Open the most-used
  sections by default; collapse the rest.
- **Show every option that makes sense.** Build the choices from the data (e.g. distinct
  dayparts/stations in the items) instead of a hard-coded list. Use checkboxes for multi-select.
  When a list is longer than ~8, add a search input and a "Select all", and cap the list
  height (`max-h-48 overflow-y-auto`).
- **Free text** (name, ID) filters use an `Input` with a 300ms debounce. Dates offer quick picks
  (Today, days of the week) plus a date input, with a single / range toggle.
- Filters apply immediately; there is no "Apply" step (except a date range, which needs both ends).
- Remember open/closed state per user (`localStorage`, as `filterSidebarOpen` in `App.tsx`).

### Long detail pages → section bookmark nav
Reference: the "Sections" sidebar in `src/pages/ProductEdit.tsx` (viewing/editing a product).
Any full detail or edit page long enough to scroll past a couple of screens gets a left-side
bookmark nav so people can jump to what they're looking for.
- **When:** the page has roughly 4+ distinct sections or scrolls well past one screen. Short
  pages and modals don't need it.
- **Layout:** `aside` on the left beside the content (`flex gap-6`, content `flex-1 min-w-0`),
  `w-56 flex-shrink-0`, with a `sticky top-4` card inside so it stays in view while scrolling.
  Hidden under `lg` (`hidden lg:block`).
- **Header:** small uppercase "Sections" label (`text-xs font-semibold uppercase tracking-wide`).
- **Items:** one button per section, each with a Lucide icon (`h-4 w-4`) and a short sentence-case
  label that matches the section's heading. Clicking smooth-scrolls to the section, offset so the
  heading isn't hidden under the top bar.
- **Active state:** highlight the section currently in view as you scroll (scroll-spy) with the
  sky selected style: `bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300` and a
  `border-l-2 border-sky-500` marker. Others are `text-gray-600 dark:text-gray-400` with a gray hover.
- **Sections:** mark each target with a stable id (`data-section="..."`) and build the nav list
  from the same array that renders the sections, so they never drift apart.

## Color
Use Tailwind's palette. Every color has a job — don't pick one for looks.

| Role | Tailwind | Used for |
|---|---|---|
| **Primary action** | `bg-brand hover:bg-brand-dark` (`#00ADF0`) | Filled primary buttons — the `Button` default variant already does this |
| **Primary / accent** | `sky` (600/400 text, 50/900 soft bg, 500 ring) | Links, selected state, focus, "in progress", info |
| Brand navy | `brand-navy` (`#002E5E`) | Brand headers only |
| Neutrals | `gray` | Surfaces, borders, body text |
| Success | `emerald` | Synced, done, complete, "New" |
| Warning | `amber` | Pending, partial, substitution, "Updated", needs attention |
| Error / destructive | `red` | Failed, delete, errors |
| Auto Fill | `teal` | System-generated / auto-filled content only |

**Dayparts** (category colors — only on daypart chips, bars, and labels):
Breakfast `amber` · Lunch `emerald` · Dinner `blue` · Late Night `violet` · All Day / Custom `gray`.
Always get them from `daypartColor()` in `src/lib/daypartColors.ts` — never redefine them.

Don't use `indigo`, `purple`, `cyan`, `green`, or `yellow` — use the roles above. `blue` is
reserved for the Dinner daypart. The only exceptions are deliberate categorical palettes: brand
avatars (`getBrandColor` in `GroupsPage.tsx`) and quick-action icon colors in `App.tsx`.
Never use inline `style={{ color }}` or arbitrary values like `bg-[rgb(...)]` for theme colors.

**Light / dark mode:** every color needs a `dark:` pair. Defaults:
- Page `bg-gray-50 dark:bg-gray-900` · Card/panel `bg-white dark:bg-gray-800`
- Border `border-gray-200 dark:border-gray-700`
- Text `text-gray-900 dark:text-white` · secondary `text-gray-500 dark:text-gray-400`
- Soft status fill: `bg-{color}-50 dark:bg-{color}-900/30 text-{color}-700 dark:text-{color}-300 border-{color}-200 dark:border-{color}-800`
  (see `src/components/SyncStatus.tsx`)

## Shape, type, spacing
- Corners: `rounded-lg` by default; `rounded-full` for pills, dots, avatars, toggles;
  `rounded-xl` only for large sheets/cards.
- Type: system font (no web fonts). Sizes `text-xs`, `text-sm` (default), `text-lg` for headings;
  `text-xl`/`2xl` only for page titles. `font-medium` / `font-semibold` for emphasis.
- Tiny labels (`text-[10px]`/`[11px]`) are fine for dense chips and counters only.
- Use Tailwind spacing steps; no arbitrary pixel values unless matching an existing pattern.

## Icons & logos
- Icons: `lucide-react` only. Default `h-4 w-4` inline, `h-5 w-5` in buttons/headers.
  No hand-drawn SVGs, emoji, or other icon libraries.
- Logos live in `public/` (`wand-level.webp` mark, `wand-digital-41-years-and-counting_(1).png`).
  Don't recreate, recolor, or stretch them.

## Motion
- Keep it short (150–450ms) and purposeful: feedback, state change, entering sheets.
- Put keyframes in `src/index.css` and add every new animation to a
  `prefers-reduced-motion: reduce` block.

## Writing
- Short, plain labels in sentence case ("Add items", not "Add Items To Page").
- Status text says what's happening and what's next ("Waiting · label is full").
