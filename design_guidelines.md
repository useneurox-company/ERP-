# Emerald ERP Design System

## Framework & Principles
**Material Design 3** selected for enterprise ERP requiring high information density and proven usability.

**Core Principles:**
- Clarity over decoration | Consistency across modules | Responsive efficiency | Clear visual hierarchy | Logical spatial organization

---

## Color System

### Light Mode (HSL)
- **Primary:** `160 85% 40%` (Emerald) | **Container:** `160 70% 95%`
- **Secondary:** `200 15% 35%` (Slate)
- **Surface:** `0 0% 100%` | **Variant:** `200 10% 96%` | **Outline:** `200 10% 85%`
- **Status:** Error `0 70% 50%` | Warning `45 95% 55%` | Success `140 75% 45%`

### Dark Mode
- **Primary:** `160 70% 60%` | **Container:** `160 40% 20%`
- **Surface:** `200 10% 12%` | **Variant:** `200 10% 18%` | **Outline:** `200 10% 30%`

---

## Typography

**Fonts:** Inter (UI, Cyrillic support) | JetBrains Mono (codes/IDs)

| Type | Size | Weight | Usage |
|------|------|--------|-------|
| Display | 32px | 600 | Module headers (-0.02em spacing) |
| Headline | 24px | 600 | Section titles |
| Title | 20px | 500 | Card headers |
| Body Large | 16px | 400 | Primary content (1.5 line-height) |
| Body Medium | 14px | 400 | Forms/tables (1.4 line-height) |
| Label | 12px | 500 | UI elements (0.03em, uppercase) |
| Caption | 12px | 400 | Metadata (1.3 line-height) |

---

## Layout & Spacing

**Spacing Scale:** 4px/8px (micro) | 12px/16px/24px (standard) | 32px/48px/64px (sections) | 80px/96px (macro)

**Grid:**
- Desktop (≥1440px): 12-col, max 1400px, 24px gutter
- Tablet (768-1439px): 8-col, 16px gutter
- Mobile (<768px): 4-col, 12px gutter

**Structure:**
```
Nav Bar (64px) → Breadcrumbs (40px) → Module Header (72px) → Content (min-height: calc(100vh - 176px))
```

---

## Components

### Navigation

**Top Bar (64px):** Logo + Module selector | Global search (320px expanded) | Notifications + User avatar | Sticky on scroll

**Sidebar:** 280px expanded / 72px collapsed | Accordion grouping | Active: Primary container bg | Icons 24px

**Breadcrumbs:** Body Medium, Secondary color | "/" separator (8px spacing) | Current page: Primary, non-clickable | Mobile: Back button only

### Data Display

**Tables:**
- Header: Surface Variant bg, 48px, weight 500 | Row: 56px (comfortable) / 40px (compact)
- Alternating rows: Surface Variant | Hover: Primary container 10% | Sticky header
- Mobile: Card stack view

**Kanban:**
- Column: 320px, horizontal scroll mobile | Card: 8px radius, 1dp elevation, 12px gap
- Drag: Grip icon on hover | Status: Pill badge 6px radius

**Gantt:**
- Header: 40px | Task bars: 32px height, 4px radius, Primary color
- Dependencies: 2px Bezier curves | Milestones: 16px diamond | Grid: 1px dashed

**Document Tree:**
- Node: 240px card, 12px padding | Spacing: 16px vertical, 32px horizontal/level
- Connectors: 2px dashed | Status: 8px circle badge | Icons: 20px | Animation: 250ms ease

### Forms

**Inputs (48px):**
- Border: 1px Outline → 2px Primary (focus) | Radius: 4px
- Floating labels | Helper text: 12px Caption | Error: Error color + icon + message

**Dropdowns:** 48px | Menu max-height 320px | Hover: Surface Variant | Multi-select: Chips

**Date Picker:** 320px calendar popup | Range: Primary Container highlight | Quick ranges buttons

**File Upload:** Dashed border zone 200px min-height | Progress bar | Thumbnails 48px | QR display 128px

**Buttons:**
- Primary: Filled Primary, 40px, 8px radius, weight 500
- Secondary: Outlined 1px Primary
- Tertiary: Text only, hover Surface container
- Icon: 40px square, circular
- States: Hover +8%, Active +12%, Disabled 38%

### Containers

**Cards:** 16px padding, 8px radius, 1dp elevation | Header margin 16px | Footer border-top | Interactive: Hover 2dp

**Modals:** Max 600px (forms) / 800px (data) / 95vw (mobile) | 40% black backdrop | 12px radius | Header 24px padding

**Badges/Chips:** 24px height, 12px pill radius | Status colors 10% bg | Label font weight 500 | Close icon 16px

### Specialized

**Timeline:** 2px Primary vertical line @ 40px left | 16px event nodes | Event cards @ 64px | Caption timestamps

**Progress:** Linear 4px rounded | Circular 40px/4px stroke | Stepped numbered circles

**Chat:** Message bubble 12px radius, max 70% width | Own: Right Primary container | Others: Left Surface Variant | Avatar 32px

---

## Responsive Design

**Mobile (<768px):** Tables→Cards | Kanban→Vertical tabs | Forms→Single column | Gantt→Horizontal scroll | Bottom nav (5 modules) + hamburger

**Touch Targets:** Min 44px×44px (WCAG AAA) | 8px spacing | 48px preferred mobile

---

## Animation

**Timing:** 150ms micro | 250ms components | 350ms pages | Ease-out enter, ease-in exit

**Key Patterns:**
- Modal: Fade + scale 0.95→1
- Dropdown: Slide 8px + fade
- Kanban drag: Elevation + scale 1.02
- Loading: Skeleton shimmer 1.5s loop
- Toasts: Slide top-right + fade

**Rules:** Purposeful only | Non-blocking | Respect `prefers-reduced-motion` | Max 2 concurrent

---

## Accessibility & Dark Mode

**WCAG:** 4.5:1 text contrast | 3:1 UI contrast | Focus: 2px Primary outline, 4px offset | Semantic HTML + ARIA

**Dark Mode:** System detect + manual toggle | 200ms transition | Elevated surfaces lighter | Images -20% brightness

---

## Module-Specific

**Sales/CRM:** Kanban primary | Compact deal cards | Floating actions on hover | Left filter sidebar

**Projects:** Gantt primary | Day/Week/Month scale | Critical path Warning color | Vertical stage cards

**Production:** 200px QR code tiles | Distinct status colors | Calendar shift grid

**Warehouse:** Inline table editing | Full-screen mobile QR scanner | Low stock Warning badges

**Finance:** 4-col KPI grid | Minimal charts (line/bar, no 3D) | Sortable/filterable/exportable tables

---

## Icons & Images

**Icons:** Material Symbols Rounded | 20px inline / 24px buttons / 32px headers | Weight 400 | Secondary color

**Illustrations:** 200px empty states | 300px onboarding | No photography

**Placeholders:** Initials on Primary bg | Generic user icon | File icon + type label

---

## Performance

- Code split modules | Virtual scroll >100 rows | Debounce search 300ms | WebP images + srcset | Skeleton screens (no lone spinners) | Pagination: 50 default (25/50/100 options)