# Repo conventions

## Design System is the first reference

Before adding any color, gradient, shadow, radius, spacing, or typography
in JSX, inline `style={…}`, or CSS, reach for an existing Half Lens DS
token. The DS catalogue and component classes are documented in
`DesignSystem/Design System/Design System/DS-REFERENCE.md`; the canonical
source is `admin-panel-ds.html`.

Concretely:

- **Tokens live in `src/styles/half-lens-ds.css`.** Every `--*` is
  declared in *both* `:root, [data-theme="dark"]` and `[data-theme="light"]`.
  When you need a new token, declare it in BOTH blocks; never add a
  one-sided token.
- **Tailwind exposes the tokens** via `ds-*` utilities in
  `tailwind.config.js` (`bg-ds-overlay`, `text-ds-text`, `text-ds-muted`,
  `text-ds-faint`, `border-ds-border-subtle`, `bg-ds-track`, etc.).
  Prefer these over `bg-gray-*` / `text-gray-*` / `bg-white` / `bg-black`
  — those break under theme flip.
- **Components use DS classes.** New cards: `.card`, headers:
  `.card-header`, modals: `.modal/.modal-hdr/.modal-body/.modal-foot`,
  buttons: `.btn .btn-primary` (etc.), badges: `.badge-*`, stat tiles:
  `.stat-card .sc-blue|sc-green|sc-amber|sc-purple`. Match what
  `Button.tsx`, `Card.tsx`, `Modal.tsx`, `Badge.tsx` already do.
- **Theme toggle.** The app supports light/dark via `[data-theme]` on
  `<html>`. Persistence is through `localStorage.hl_theme`; the inline
  pre-hydration script in `index.html` sets the attribute before React
  mounts to prevent FOUC. Toggle UI lives in the sidebar. Anything you
  add must read from CSS tokens so it themes itself.

If you find an existing component with hardcoded hex codes or
`text-gray-*` Tailwind classes, replace them with DS tokens as part of
your edit instead of leaving them.
