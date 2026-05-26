# Changelog

## [0.3.0] — 2026-05-26

### Added
- Activity Log page (`/activity`): timeline feed grouped by day with per-entry field-change diffs, insights panel (bar chart, top users, entity breakdown), detail popup with current item fields
- `/api/activity` route with period shortcuts, entity type and user email filters, cursor-based pagination — restricted to Manager/Admin
- `queryActivityLog` in server-storage; `getUserRole` and `getActivityLogPage` in store
- Activity nav link in sidebar (visible to Admins)

### Changed
- Ventures tab: venture delete and department delete buttons now use compact × style (config-remove-btn) matching SVH

### Fixed
- Added full activity CSS to globals.css (`act-*` classes, `btn-primary`, `btn-secondary`)

---

## [0.2.9] — 2026-05-26

### Fixed
- Config > Field Options OptionEditor now uses compact `×` remove buttons (`config-option-row` / `config-remove-btn`) matching SVH style
- Added `list-style: none` to `config-option-list` so options don't show browser bullet points
- Added subtitle line to Config page header ("Manage roles, dropdown options, RAG ranges, ventures, departments, and notifications")

---

## [0.2.8] — 2026-05-26

### Added
- Notifications tab in Config page: 5 configurable reminder rules (schedule, message, enable/disable) + manual Send Reminders wizard with rule selection, recipient picker, email preview, and send log
- API routes: `/api/notifications/settings` (GET/PATCH), `/api/notifications/remind` (GET preview/POST send), `/api/notifications/scheduled` (POST scheduler hook), `/api/notifications/log` (GET)
- `lib/notification-settings.ts` and `lib/run-reminders.ts` ported from SVH
- `listActivityLogEntries` added to server-storage for notification log API

### Fixed
- Config page converted from accordion layout to tab layout matching SVH
- Sidebar z-index raised to 50 so it renders on top of the sticky topbar when expanded
- Venture-tabs sticky `top` updated to `calc(48px + 0.65rem)` to account for topbar height — tabs no longer scroll under the topbar

## [0.2.7] — 2026-05-26

### Fixed
- Topbar now stretches edge-to-edge in the main column (negative margin compensates for ln-main side padding)
- Removed top padding from ln-main so topbar is flush at top; content padding preserved via layout div
- Added scroll-padding-top so sticky topbar doesn't obscure jump targets

## [0.2.6] — 2026-05-26

### Fixed
- Revert NEXT_PUBLIC_AZURE_CLIENT_ID back to server app and restore login scopes in workflow — the GitHub Secret was not updated so the client ID change caused a 400 token error in production

## [0.2.5] — 2026-05-26

### Changed
- Move notification bell from sidebar to top-right of the sticky topbar (next to SVH/Ventures tabs)
- Topbar now sticks to the top when scrolling
- Bell popup opens to the left so it stays within the viewport

## [0.2.4] — 2026-05-26

### Fixed
- Signing out of either app now clears the MSAL token cache for both apps (SVH and Ventures share the same origin, so both sessions are wiped together)

## [0.2.3] — 2026-05-26

### Fixed
- Add gap between notification bell and "OKR Follow-Up" title in sidebar header

## [0.2.2] — 2026-05-26

### Fixed
- Bell icon and "OKR Follow-Up" brand title now display side-by-side in the sidebar header
- Replaced the spinner/logo shown to signed-out users with a proper "Sign In with Microsoft" button

## [0.2.1] — 2026-05-26

### Fixed
- Switch `NEXT_PUBLIC_AZURE_CLIENT_ID` to the dedicated client-side app registration (EASE OKR App) so non-admin users are no longer prompted for admin approval at sign-in
- Remove `Sites.Read.All` and `Sites.ReadWrite.All` from login scopes — server uses app-only auth for SharePoint so these delegated scopes are unnecessary and were triggering admin consent requirements

## [0.2.0] — 2026-05-25

### Added
- User-to-user chat threads on objectives and KRs (comment threads stored in SharePoint)
- Notification bell in sidebar header showing unread comment counts
- @mention support in chat with email notifications sent to mentioned users
- TopAppTabs switcher between Ventures (EASE) and SVH classic app

### Fixed
- Isolated Comments SharePoint list from core `ensureAtomicTargets` loop to prevent cascade 500 errors if list creation fails
- Removed duplicate `@` prefix from mention display in chat bubbles
