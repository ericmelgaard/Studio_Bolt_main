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
