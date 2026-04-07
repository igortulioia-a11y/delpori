# DeliveryHub Design System

> A food delivery SaaS platform — dashboard for restaurant operators + public digital menu for customers.

---

## 1. Visual Theme & Atmosphere

**Mood:** Professional yet approachable. Clean data-driven dashboard paired with a warm, appetizing public menu.
**Density:** Medium — generous whitespace on the public menu, moderate density on the dashboard for information efficiency.
**Philosophy:** Dark sidebar with warm amber/orange accent. Inspired by Linear/Stripe dashboards. Neutral surfaces let content (food photos, order data, chat messages) be the hero. No visual clutter — every element earns its space.

---

## 2. Color Palette & Roles

### Primary

| Role | HSL (CSS var) | Hex (approx) | Usage |
|------|---------------|--------------|-------|
| Primary | `25 95% 53%` | `#F97316` | CTAs, active nav, links, badges, focus rings |
| Primary Foreground | `0 0% 100%` | `#FFFFFF` | Text on primary backgrounds |
| Primary Hover | primary/90 | — | Hover state (10% transparency) |

### Neutrals (Light Mode)

| Role | HSL (CSS var) | Hex (approx) | Usage |
|------|---------------|--------------|-------|
| Background | `210 20% 98%` | `#F8FAFC` | Page background (slate-50) |
| Foreground | `222 47% 11%` | `#0F172A` | Primary text (slate-900) |
| Card | `0 0% 100%` | `#FFFFFF` | Card surfaces |
| Card Foreground | `222 47% 11%` | `#0F172A` | Card text |
| Muted | `210 20% 96%` | `#F1F5F9` | Subtle backgrounds, zebra rows |
| Muted Foreground | `215 16% 47%` | `#64748B` | Secondary text, placeholders, captions |
| Border | `214 20% 90%` | `#E2E8F0` | Dividers, card borders, input borders |
| Input | `214 20% 90%` | `#E2E8F0` | Input field borders |

### Semantic

| Role | HSL (CSS var) | Hex (approx) | Usage |
|------|---------------|--------------|-------|
| Destructive | `347 77% 50%` | `#F43F5E` | Delete buttons, error states, cancel actions |
| Destructive Foreground | `0 0% 100%` | `#FFFFFF` | Text on destructive backgrounds |
| Secondary | `210 20% 96%` | `#F1F5F9` | Secondary buttons, subtle actions |
| Secondary Foreground | `215 25% 15%` | `#1E293B` | Text on secondary surfaces |
| Accent | `210 20% 96%` | `#F1F5F9` | Hover highlights, selected row |
| Accent Foreground | `215 25% 15%` | `#1E293B` | Text on accent surfaces |
| Ring | `25 95% 53%` | `#F97316` | Focus rings (matches primary — orange) |

### Sidebar

| Role | HSL (CSS var) | Hex (approx) |
|------|---------------|--------------|
| Sidebar Background | `222 47% 11%` | `#0F172A` |
| Sidebar Foreground | `215 20% 75%` | `#A8B8CC` |
| Sidebar Primary | `25 95% 53%` | `#F97316` |
| Sidebar Border | `217 33% 20%` | `#253348` |
| Sidebar Accent | `217 33% 17%` | `#1E293B` |

### Dark Mode

| Role | HSL (CSS var) | Hex (approx) |
|------|---------------|--------------|
| Background | `222 47% 7%` | `#0B1120` |
| Foreground | `210 40% 98%` | `#F8FAFC` |
| Card | `222 47% 10%` | `#111B2E` |
| Primary | `25 95% 53%` | `#F97316` |
| Muted | `217 33% 17%` | `#1E293B` |
| Muted Foreground | `215 20% 60%` | `#8696AB` |
| Border | `217 33% 20%` | `#253348` |

### Domain-Specific Colors (not in CSS vars — used directly)

| Role | Hex | Usage |
|------|-----|-------|
| Order Status: Novo | `#3B82F6` (blue-500) | New order badge |
| Order Status: Confirmado | `#8B5CF6` (violet-500) | Confirmed order |
| Order Status: Em Preparo | `#F59E0B` (amber-500) | Preparing order |
| Order Status: Saiu Entrega | `#F97316` (orange-500) | Out for delivery |
| Order Status: Entregue | `#22C55E` (green-500) | Delivered |
| Order Status: Cancelado | `#EF4444` (red-500) | Cancelled |
| WhatsApp Green | `#25D366` | WA connection status |
| AI Badge | `#8B5CF6` (violet-500) | AI-sent message indicator |

---

## 3. Typography Rules

**Font Family:** Inter (Google Fonts), loaded via `next/font/google` with `latin` subset.
**Fallback:** system-ui, -apple-system, sans-serif.
**OpenType:** Default Inter features (no custom `font-feature-settings` required).

### Type Scale

| Role | Size | Weight | Line Height | Tracking | Usage |
|------|------|--------|-------------|----------|-------|
| Page Title | 30px (text-3xl) | 700 (bold) | 1.2 (leading-tight) | -0.025em (tracking-tight) | Dashboard page headers |
| Section Title | 24px (text-2xl) | 600 (semibold) | 1.33 | -0.025em | Card titles, section heads |
| Subsection | 20px (text-xl) | 600 (semibold) | 1.4 | normal | Sub-headers |
| Large Body | 18px (text-lg) | 400 (normal) | 1.5 | normal | Menu item names, lead text |
| Body | 16px (text-base) | 400 (normal) | 1.5 | normal | Default paragraph, chat messages |
| Body Medium | 14px (text-sm) | 500 (medium) | 1.43 | normal | Button text, labels, nav links |
| Caption | 14px (text-sm) | 400 (normal) | 1.43 | normal | Descriptions, timestamps |
| Small | 12px (text-xs) | 400-500 | 1.33 | normal | Badges, helper text, metadata |
| Micro | 10px | 500 (medium) | 1.2 | 0.05em | Uppercase labels (rare) |

### Weight System

- **400 (normal):** Body text, descriptions, chat messages
- **500 (medium):** Buttons, navigation, form labels, badges
- **600 (semibold):** Card titles, section headers, KPI values
- **700 (bold):** Page titles, hero numbers on dashboard

---

## 4. Component Styling

### Buttons (shadcn/ui `<Button>`)

| Variant | Background | Text | Border | Radius | Padding |
|---------|-----------|------|--------|--------|---------|
| Default (Primary) | `hsl(25 95% 53%)` | `#FFFFFF` | none | 6px (rounded-md) | h-10, px-4, py-2 |
| Destructive | `hsl(347 77% 50%)` | `#FFFFFF` | none | 6px | h-10, px-4, py-2 |
| Outline | `transparent` | foreground | 1px solid border | 6px | h-10, px-4, py-2 |
| Secondary | `hsl(210 20% 96%)` | secondary-foreground | none | 6px | h-10, px-4, py-2 |
| Ghost | `transparent` | foreground | none | 6px | h-10, px-4, py-2 |
| Link | `transparent` | primary | none | — | — |

**Sizes:** `sm` = h-9, px-3 | `default` = h-10, px-4 | `lg` = h-11, px-8 | `icon` = h-10, w-10

**States:** Hover = primary/90 opacity. Focus = 2px ring in `--ring` color with 2px offset. Disabled = 50% opacity.

### Cards (shadcn/ui `<Card>`)

- Background: `hsl(var(--card))`
- Border: 1px solid `hsl(var(--border))`
- Radius: 8px (rounded-lg)
- Shadow: `shadow-sm` (0 1px 2px rgba(0,0,0,0.05))
- Padding: 24px (p-6) for header, content, footer
- Title: text-2xl font-semibold tracking-tight

### KPI Cards (Dashboard)

- Same base `<Card>` styling
- Icon: 40px container with primary/10 background, primary icon color
- Value: text-3xl font-bold
- Delta badge: green/red text-xs with arrow icon

### Inputs (shadcn/ui `<Input>`)

- Height: h-10 (40px)
- Border: 1px solid `hsl(var(--input))`
- Radius: 6px (rounded-md)
- Padding: px-3, py-2
- Focus: ring-2 ring-offset-2 ring-ring
- Placeholder: muted-foreground color
- Font: text-sm (14px)

### Badges (shadcn/ui `<Badge>`)

- Radius: 9999px (fully rounded pill)
- Padding: px-2.5, py-0.5
- Font: text-xs font-semibold
- Variants: default (primary bg), secondary, destructive, outline

### Tables (shadcn/ui `<Table>`)

- Header: muted background, text-sm font-medium muted-foreground
- Row: border-b border, hover:bg-muted/50
- Cell: p-4, text-sm, align-left
- No outer border — clean open edges

### Navigation (Dashboard Sidebar)

- Width: 256px (w-64) expanded, icon-only when collapsed
- Background: sidebar-background
- Active item: sidebar-accent bg, sidebar-primary text
- Inactive: sidebar-foreground text, hover sidebar-accent bg
- Section labels: text-xs uppercase font-semibold muted-foreground
- Divider: sidebar-border

### Chat Interface (/conversas)

- Message bubble (client): muted bg, rounded-lg, left-aligned
- Message bubble (AI): primary/10 bg, rounded-lg, right-aligned with AI badge
- Message bubble (attendant): card bg, border, rounded-lg, right-aligned
- Timestamp: text-xs muted-foreground
- Input: sticky bottom, textarea with send button

### Order Kanban (/pedidos)

- Column: muted bg, rounded-lg, min-w-[280px]
- Column header: font-semibold with colored dot matching order status
- Order card: card bg, border, rounded-lg, shadow-sm, p-4
- Drag handle: muted-foreground grip icon

---

## 5. Layout Principles

### Spacing Scale (Tailwind default, base = 4px)

| Token | Value | Usage |
|-------|-------|-------|
| 0.5 | 2px | Tight internal gaps |
| 1 | 4px | Icon-to-text gap, badge padding-y |
| 1.5 | 6px | Card internal micro-spacing |
| 2 | 8px | Form field gap, badge padding-x |
| 3 | 12px | Between related elements |
| 4 | 16px | Standard component padding, grid gap |
| 5 | 20px | Section internal spacing |
| 6 | 24px | Card padding (p-6), major section gaps |
| 8 | 32px | Between card groups, page section gaps |
| 10 | 40px | Large section separation |
| 12 | 48px | Page-level vertical rhythm |

### Grid System

- **Dashboard layout:** Sidebar (256px fixed) + main content (flex-1, max-w-7xl centered)
- **KPI row:** 4-column grid on desktop, 2-column on tablet, 1-column on mobile
- **Card grids:** gap-4 (16px) between cards, gap-6 (24px) on larger screens
- **Conversas (3-column):** conversation list (320px) + chat (flex-1) + detail drawer (360px)
- **Public menu:** single-column centered, max-w-4xl, category sidebar on desktop

### Whitespace Philosophy

Dashboard pages use moderate whitespace — data density is valued, but never at the cost of readability. The public menu (/cardapio) uses generous whitespace between product cards to let food photography breathe.

---

## 6. Depth & Elevation

| Level | Shadow | Usage |
|-------|--------|-------|
| Flat (0) | none | Page background, sidebar |
| Subtle (1) | `shadow-sm` (0 1px 2px rgba(0,0,0,0.05)) | Cards, table rows on hover |
| Standard (2) | `shadow` (0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)) | Elevated cards, dropdown panels |
| Elevated (3) | `shadow-md` (0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)) | Sheets, drawers |
| Overlay (4) | `shadow-lg` (0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)) | Modals, dialogs, popovers |
| Top (5) | `shadow-xl` | Toast notifications |

**Border radius scale:**
- `--radius`: 0.5rem (8px) — the base
- `rounded-lg`: 8px — cards, sheets, modals
- `rounded-md`: 6px (radius - 2px) — buttons, inputs
- `rounded-sm`: 4px (radius - 4px) — badges inner, small elements
- `rounded-full`: 9999px — avatars, status dots, pill badges

---

## 7. Do's and Don'ts

### Do

- Use the `hsl(var(--...))` CSS variable system for all colors — never hardcode hex in components
- Keep orange/amber primary for interactive elements only (buttons, links, focus rings, active states)
- Use `shadow-sm` for cards and `shadow-md` or higher only for overlays (sheets, dialogs)
- Maintain the Inter font across all text — no secondary display font
- Use muted-foreground (`#64748B`) for secondary text, never light gray that fails contrast
- Apply `tracking-tight` (-0.025em) to headings text-2xl and above
- Use `rounded-lg` for containers (cards, modals), `rounded-md` for interactive elements (buttons, inputs)
- Keep food photography full-width or with 8px radius — let images be the focal point on the menu
- Use consistent order-status colors across kanban, table badges, and detail views

### Don't

- Don't use orange/amber primary for large background areas — it overwhelms. Use it for accents only
- Don't mix border-radius sizes within the same visual group (e.g., rounded-lg card with rounded-sm button inside)
- Don't use `font-bold` (700) for anything below text-xl — stick to semibold (600) for medium headings
- Don't add decorative gradients or background patterns — the design is flat with subtle shadow
- Don't use colored borders — borders are always `hsl(var(--border))` neutral gray
- Don't override shadcn/ui component defaults inline — extend via className or variant
- Don't use more than 2 font weights in a single card (e.g., semibold title + normal body is correct)
- Don't apply dark mode manually with hardcoded dark classes — use the CSS variable system

---

## 8. Responsive Behavior

### Breakpoints (Tailwind defaults)

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | < 640px (sm) | Single column. Sidebar collapses to bottom nav or hamburger. Chat detail becomes a sheet. Kanban single-column scroll. |
| Small Tablet | 640px–767px (sm) | 2-column KPI grid. Cards stack. Menu categories as horizontal scroll. |
| Tablet | 768px–1023px (md) | Sidebar icon-only mode. 2-column grids. Conversas becomes 2-panel (list + chat). |
| Small Desktop | 1024px–1279px (lg) | Full sidebar. 3-column KPI. Conversas 2-panel + detail drawer. |
| Desktop | >= 1280px (xl) | Full 3-column conversas. 4-column KPI grid. All drawers inline. |
| Wide | >= 1536px (2xl) | Content max-width centered. Extra breathing room. |

### Touch Targets

- Minimum 44x44px for all interactive elements on mobile
- Button `h-10` (40px) is the minimum; mobile CTAs should use `h-11` or `h-12`
- Kanban cards: full-card tap target on mobile (no small drag handles)
- Chat send button: at least 44x44px

### Collapse Strategies

- **Sidebar:** Full (xl+) -> Icon-only (md-lg) -> Bottom nav / hamburger (< md)
- **Conversas 3-col:** 3-panel (xl+) -> 2-panel with sheet drawer (md-lg) -> Single panel with back navigation (< md)
- **Pedidos Kanban:** Horizontal scroll columns (lg+) -> Single column vertical stack (< lg)
- **Dashboard KPIs:** 4-col (xl) -> 2-col (sm-lg) -> 1-col (< sm)

---

## 9. Agent Prompt Guide

### Quick Color Reference

```
Primary CTA:        hsl(25, 95%, 53%)  — amber/orange, buttons and links
Destructive:        hsl(347, 77%, 50%)  — rose, delete/cancel
Background:         hsl(210, 20%, 98%)  — off-white (slate-50)
Foreground:         hsl(222, 47%, 11%)  — dark slate text (slate-900)
Muted surface:      hsl(210, 20%, 96%)  — light gray backgrounds
Muted text:         hsl(215, 16%, 47%)  — secondary text gray
Border:             hsl(214, 20%, 90%)  — all borders and dividers
Sidebar bg:         hsl(222, 47%, 11%)  — dark slate (slate-900)
Sidebar fg:         hsl(215, 20%, 75%)  — light gray text
Ring:               hsl(25, 95%, 53%)  — matches primary (orange)
```

### Component Construction Prompts

**Dashboard KPI Card:**
Build a card with `rounded-lg border bg-card shadow-sm p-6`. Top-left: icon in a 40px circle with `bg-primary/10 text-primary`. Right side: value as `text-3xl font-bold`, label as `text-sm text-muted-foreground`. Bottom: delta badge in green or red `text-xs`.

**Order Status Badge:**
Use `<Badge>` with rounded-full. Map status to color: novo=blue-500, confirmado=violet-500, em_preparo=amber-500, saiu_entrega=orange-500, entregue=green-500, cancelado=red-500. White text on solid bg.

**Chat Message Bubble:**
Client messages: `bg-muted rounded-lg p-3 max-w-[75%]` left-aligned. AI messages: `bg-primary/10 rounded-lg p-3 max-w-[75%]` right-aligned with a small violet "IA" badge. Timestamp below in `text-xs text-muted-foreground`.

**Product Card (Public Menu):**
Card with `rounded-lg border overflow-hidden`. Image fills top with `aspect-[4/3] object-cover`. Below: product name `text-lg font-semibold`, description `text-sm text-muted-foreground line-clamp-2`, price `text-lg font-bold text-primary`. Add-to-cart button at bottom using primary variant.

**Data Table Row:**
Each row: `border-b hover:bg-muted/50 transition-colors`. Cells: `p-4 text-sm`. Header cells: `text-sm font-medium text-muted-foreground bg-muted`. No outer table border.

### Anti-Patterns to Avoid (from Anthropic Cookbook)

These are common AI-generated design mistakes. **Never do these:**

1. **Generic fonts**: Never default to Inter for display headings — use it for body only. For a food delivery app, Inter is appropriate as the system font, but consider pairing with a display face for the public menu hero.
2. **Purple gradient syndrome**: No purple-to-blue gradients on white. The DeliveryHub uses orange/amber primary — stay disciplined.
3. **Even color distribution**: One dominant color (orange/amber) with sharp accents (status colors) beats a rainbow palette.
4. **Timid typography**: Use extreme weight contrast — `font-bold` (700) titles vs `font-normal` (400) body. Not `font-medium` (500) vs `font-normal` (400).
5. **Scattered animations**: One well-orchestrated page load with staggered reveals > random hover effects everywhere.
6. **Flat backgrounds**: Layer subtle depth — muted bg cards on off-white pages, dark sidebar contrasts with light content area.
7. **Cookie-cutter components**: Each page section should have visual character that matches its purpose.

### Design Philosophy Principles

- **Dominant + accent** beats evenly-distributed palette
- **Extreme weight/size contrast** (3x+ jumps) beats conservative increments (1.5x)
- **Context-specific character** beats generic safety
- **Deliberate choices** beat default options
- **Cohesive aesthetic** beats scattered decision-making
- **One orchestrated moment** (page load, status transition) beats scattered micro-interactions

### Implementation Notes

- All colors MUST use `hsl(var(--...))` references, not hardcoded values, to support dark mode
- All UI components come from shadcn/ui — import from `@/components/ui/...`
- Utility function `cn()` from `@/lib/utils` merges Tailwind classes (uses clsx + tailwind-merge)
- Font is loaded via `next/font/google` Inter with `latin` subset — applied to `<body>` as `inter.className`
- Base border-radius token `--radius` is `0.5rem` (8px), referenced by all shadcn components
