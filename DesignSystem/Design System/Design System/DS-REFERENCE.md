# Half Lens Design System — Reference

**File:** `admin-panel-ds.html` (~7,188 lines)
**Last updated:** 2026-04-01

---

## Tokens (CSS Variables)

### Colors
| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--bg-base` | `#050d1e` | `#f4f6fb` | Page background |
| `--bg-surface` | `#071428` | `#ffffff` | Surface cards |
| `--bg-elevated` | `#0a1a35` | `#ffffff` | Elevated elements |
| `--bg-overlay` | `#0d2040` | `#eef1f8` | Overlay backgrounds |
| `--bg-card` | `rgba(255,255,255,0.03)` | `rgba(255,255,255,0.9)` | Card backgrounds |
| `--bg-input` | `rgba(255,255,255,0.03)` | `#ffffff` | Input backgrounds |
| `--accent` | `#2563eb` | `#2563eb` | Primary accent |
| `--accent-lighter` | `#60a5fa` | `#1d4ed8` | Accent text |
| `--accent-glow` | `rgba(37,99,235,0.25)` | `rgba(37,99,235,0.15)` | Accent glow |
| `--success` / `--danger` / `--warning` / `--info` / `--purple` | Status colors with `-bg`, `-border`, `-text` variants |

### Stat Card Gradients
| Class | Gradient var | Border var |
|-------|-------------|------------|
| `.sc-blue` | `--sc-blue-grad` | `--sc-blue-border` |
| `.sc-green` | `--sc-green-grad` | `--sc-green-border` |
| `.sc-amber` | `--sc-amber-grad` | `--sc-amber-border` |
| `.sc-purple` | `--sc-purple-grad` | `--sc-purple-border` |

### Radius / Transitions / Fonts
- `--radius-sm: 6px` / `--radius-md: 10px` / `--radius-lg: 14px` / `--radius-xl: 20px` / `--radius-full: 9999px`
- `--transition-fast: 0.15s` / `--transition-normal: 0.25s` (cubic-bezier)
- `--font-main: 'Cairo', sans-serif`
- `--font-mono: 'Cairo', sans-serif` (changed from JetBrains Mono)

---

## Layout Components

### `.app-layout`
Flex container: sidebar (fixed right) + main content.

### `.sidebar`
- Fixed right, 240px width, gradient background `--bg-sidebar`
- Collapses to 64px with `.collapsed` class
- Contains: logo, nav items, theme toggle, user info
- Collapse button: fixed position, toggles via `toggleSidebar()`

### `.main-content`
- `margin-right: 240px` (64px when `.collapsed`)
- Contains page sections

### `.prof-hero`
Gradient header card used on all detail pages:
- Background: `--sc-blue-grad`, border: `--sc-blue-border`
- Contains: `.prof-hero-top` (avatar/logo + info + actions), optional `.prof-tabs`
- Can embed `.stats-grid` inside
- Used on: project detail, client detail, vendor detail, profile page

### `.prof-tabs`
Tab bar inside `.prof-hero`:
- `.prof-tab` — inactive tab
- `.prof-tab.active` — accent underline + accent color
- Each tab has icon + label
- JS: `switchProjTab(el, panelId)` / `switchProfTab(el, panelId)`

### `.prof-tab-content`
Tab panels: `.show` to display, default hidden.

---

## Card Components

### `.card`
Basic card: `--bg-card`, `--border-subtle`, `--radius-lg`, `--shadow-card`, hover lift.

### `.stat-card`
Gradient stat card with color variants:
- `.sc-blue` / `.sc-green` / `.sc-amber` / `.sc-purple`
- Contains: `.stat-icon-box`, `.stat-sub` (label), `.stat-val` (value)

### `.prof-form-section`
Form container card: `--bg-card`, `--border-subtle`, rounded, shadow, padding 24px.

### `.prof-photo-card`
Dashed border card for photo uploads: hover glow effect.

### `.dash-bottom-card` / `.dash-bottom-grid`
Two-column grid layout for dashboard bottom sections.

---

## Form Components

### Inputs
- `.input` — standard input
- `.input.select` — dropdown select
- `.input-group` — label + input wrapper
- `.input-group.full` — spans full width in `.form-grid`
- `.form-grid` — 2-column grid for forms
- `.input-label` — field label
- `.req` — red asterisk for required fields

### Toggle
- `.toggle-wrap` — toggle switch container
- `.toggle-wrap.on` — active state
- `.toggle-row` — row with label + toggle

### Upload
- `.upload-area` — dashed border drag-and-drop area

---

## Table Components

### `.table-wrap`
Scrollable table container.

### Table elements
- `thead th` — white headers (`!important`)
- `.td-primary` — bold primary text cell
- `.actions-cell` — cell with action buttons
- `.actions-btn` — three-dot menu button
- `.actions-dropdown` — dropdown menu
- `.dd-item` / `.dd-item.dd-danger` — dropdown items

### `.tbl-check`
Checkbox column for bulk selection (vendors page).

### Pagination
- `.pagination` — container
- `.pag-btn` — page buttons
- `.pag-info` — page info text
- `.pag-per-page` — per-page selector

---

## Modal System

### Structure
```html
<div class="modal-overlay" id="modalId">
  <div class="modal">
    <div class="modal-hdr">
      <div>
        <div class="modal-ttl">Title</div>
        <div class="modal-sub">Subtitle</div>
      </div>
      <button class="modal-close" onclick="closeModal('modalId')">X</button>
    </div>
    <div class="modal-body">...</div>
    <div class="modal-foot">
      <button class="btn btn-secondary">Cancel</button>
      <button class="btn btn-primary">Submit</button>
    </div>
  </div>
</div>
```

### JS API
- `openModal(id)` — shows modal
- `closeModal(id)` — hides modal
- ESC key and overlay click close modals

### Existing Modals (13 total)
| ID | Purpose |
|----|---------|
| `addClientModal` | Add client |
| `addVendorModal` | Add vendor |
| `addProjectModal` | Add project |
| `addUserModal` | Add user |
| `exportVendorModal` | Export vendors (3-step wizard) |
| `addItemModal` | Add project item |
| `editItemModal` | Edit project item |
| `viewItemModal` | View item details + budget tracking |
| `addItemCatModal` | Add item category (settings) |
| `addEquipCatModal` | Add equipment category (settings) |
| `addBrandModal` | Add brand (settings) |
| `addEquipModal` | Add equipment (settings) |
| `addBankModal` | Add bank (settings) |
| `addStatusModal` | Add project status (settings) |
| `addSpecialtyModal` | Add vendor specialty (settings) |

---

## Toast Notifications

### JS API
```js
showToast('message', 'error');   // red
showToast('message', 'success'); // green
showToast('message', 'warning'); // amber
showToast('message', 'info');    // blue
dismissToast(toastElement);
```

### CSS Classes
- `.toast-container` — fixed top-left container
- `.toast` — base toast
- `.toast-error` / `.toast-success` / `.toast-warning` / `.toast-info` — variants
- `.toast.hiding` — fade-out animation
- Auto-dismiss after 5 seconds

---

## Badge System

| Class | Color |
|-------|-------|
| `.badge-blue` | Blue |
| `.badge-green` | Green |
| `.badge-amber` | Amber/Orange |
| `.badge-red` | Red |
| `.badge-purple` | Purple |
| `.badge-cyan` | Cyan |
| `.badge-gray` | Gray |
| `.badge-dot` | Colored dot inside badge |

---

## Button System

| Class | Style |
|-------|-------|
| `.btn` | Base button |
| `.btn-primary` | Blue solid |
| `.btn-secondary` | Ghost with border |
| `.btn-ghost` | Transparent |
| `.btn-sm` | Small size |
| `.btn-bulk-delete` | Red danger button |

---

## Settings Page

### Accordion Navigation
- `.set-group` — accordion group
- `.set-group-hdr` — clickable header
- `.set-group-items` / `.show` — collapsible items
- `.settings-nav-item` / `.on` — nav item, active state
- JS: `toggleSetGroup(hdr)`, `showSetPanel(id, navItem)`

### Legal Editor (Terms / Privacy)
- `.legal-editor-hdr` / `.legal-editor-title` / `.legal-editor-ver`
- `.legal-section-card` / `.legal-purple` — editable section with dashed border + gradient
- `.legal-textarea` — markdown content editor
- `.legal-add-section` — dashed "add section" button
- `.legal-divider` — gradient horizontal rule
- `.legal-history-title` / `.legal-ver-item` — version history
- JS: `addLegalSection(btn)`

### Vendor Specialty Tree
- `.spec-tree` / `.spec-item` / `.spec-item.open`
- `.spec-item-hdr` — expandable header with arrow
- `.spec-sub-list` — sub-specialty container
- `.spec-sub-chip` — removable tag chip
- `.spec-add-sub` — inline add button
- JS: `addSubSpecInline(btn)`

---

## Profile Page

### Hero
Uses `.prof-hero` with avatar, name, meta, tabs.

### Tabs (7)
الرئيسية, البيانات الشخصية, بيانات السفر, المعدات, البيانات المالية, الفواتير, المستندات

### Photos Section
`.prof-photos` — 3-column grid of `.prof-photo-card`

### Form Fields
Full form with: name, phone, email, field, ID, car info, nationality, city, cost, status, notes.
- `.profile-field` — disabled fields toggled by edit button
- `.prof-notes-area` — textarea for internal notes
- `.prof-check-row` — checkbox row

### Password Section
Expandable password change form: `togglePassEdit()`

---

## Project Detail Page

### Hero
`.prof-hero` with project icon, name, badges (type + status), edit button, 3 stat cards (budget, costs, profit), 6 tabs.

### Tabs (6)
البيانات الأساسية, البنود, المصروفات, الموردين, الفواتير, الملفات

### Items Tab
- "إضافة بند" button aligned left
- 4 stat cards (budget, spent, remaining, consumption %)
- Table: item name, category, qty, unit price, budget, spent, remaining, progress, actions
- Blue total footer bar
- 3 modals: add/edit/view item

### Files Tab
Grid of file cards with type-colored icons (PDF=red, Excel=green, Image=blue, PPT=purple).

---

## Pages (12)

| Page | ID | Description |
|------|----|-------------|
| Dashboard | `page-dashboard` | Welcome bar, stats, quick actions, alerts, activity |
| Clients | `page-clients` | Client cards with logos, actions |
| Projects | `page-projects` | Projects table with filters |
| Vendors | `page-vendors` | Vendor table, bulk select, export |
| Expenses | `page-expenses` | Expenses table with filters |
| Suggestions | `page-suggestions` | Tabs: vendors/financial/equipment suggestions |
| Activity Log | `page-activity` | Filterable activity timeline |
| Users | `page-users` | User management table |
| Settings | `page-settings` | 13 settings sub-panels |
| Profile | `page-profile` | User profile with tabs |
| Client Detail | `page-client-detail` | Client info, stats, projects, contacts |
| Project Detail | `page-project-detail` | Project info with 6 tabs |
| Vendor Detail | `page-vendor-detail` | Vendor info with section tabs |

---

## Assets

- **Logo White:** `/Downloads/Half Lens/Logo_White.png` (dark mode)
- **Logo Blue:** `/Downloads/Half Lens/Logo_Blue.png` (light mode)
- **Saudia Logo:** `/Downloads/Saudia_logo_2023.png` (sample client)
- **Favicon:** `/Design System/favicon/` — icon-512, icon-192, apple-touch-icon, favicon-32, favicon-16

---

## Changelog

### 2026-04-01
- Moved project detail edit button from hero to hero actions area
- Aligned "إضافة بند" button to left side in items tab
- Created DS-REFERENCE.md

### 2026-03-30
- Added toast notification system (`.toast-error/success/warning/info`)
- `showToast(message, type)` JS API with auto-dismiss
- Wired error toasts to add user/client/vendor modals as demos
- Created favicon PNGs from Logo_White.png on blue gradient background (512, 192, 180, 32, 16px)

### 2026-03-28
- Redesigned profile page: hero header, 7 tabs, photos section, full form, password section
- Added project detail tabs (6): info, items, expenses, vendors, invoices, files
- Items tab: stat cards, table, total footer, add/edit/view modals
- Files tab: file cards grid with type-colored icons
- Applied gradient hero (`prof-hero`) to all detail pages (client, project, vendor, profile)
- Removed all `::before` pseudo-element glow orbs across entire file
- Changed `--font-mono` to Cairo font

### 2026-03-27
- Created 8 settings add modals (item, category, equipment, brand, bank, status, specialty)
- Redesigned Terms/Privacy panels as legal editor with section cards, version history
- Redesigned vendor specialties as expandable tree with sub-specialty chips
- Enhanced all new components with DS tokens (gradients, shadows, focus rings, transitions)
