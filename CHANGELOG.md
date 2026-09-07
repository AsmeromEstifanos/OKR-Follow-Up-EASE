# Changelog

## [0.6.1] - 2026-09-07

### Fixed
- **The deploy workflow's restart step has failed every single run since it was written** (17 Aug), on both remotes, before and after the NPROC backlog was cleared. It died silently right after printing `Restarting application` - `Process exited with status 1`, with none of the block's own diagnostic echoes reaching the log, so there was nothing to debug from. The restart block is now fork-free and instrumented:
  - `touch tmp/restart.txt` is replaced by `: > tmp/restart.txt`, a shell redirection that spawns no process (`touch` is an external binary, so it forks - and a failed fork kills the SSH shell outright, before any error can print).
  - `mkdir -p tmp` (also a fork) now runs only when `tmp/` is actually missing, tested with the `[ -d ]` builtin. On a normal deploy `tmp/` already exists, so the restart costs zero processes.
  - A `tmp` that exists but is not a directory is detected and removed rather than making `mkdir -p` fail.
  - Every branch echoes what it did and its exit code, including the shell pid and cwd, so the next failure names itself.
  - The step now exits non-zero when the restart signal genuinely could not be written, instead of warning and reporting success.

### Notes
- v0.6.0 reached production despite its failed deploy: everything before the restart (extract, copy into `APP_DIR`, `.env` merge) had completed, and Passenger respawned from the new on-disk build on its own. Verified by the live help chunk containing v0.6.0 text. Do not rely on that - a failed run leaves the served version unknown, so check a served string.

---

## [0.6.0] - 2026-09-07

### Fixed
- **Key results without KPIs could never record progress.** Departments that track at key-result level (no KPIs underneath) had no way to move a KR off 0%: the recalculation forced `progressPct = 0`, `currentValue = 0`, `targetValue = 100` whenever a KR had no child KPIs, the KR card's Current Value field was permanently read-only ("Auto-computed from KPIs"), `updateKeyResult` silently dropped any `targetValue`/`currentValue` patch, and a KR-level check-in had its value overwritten by the same reset. Those KRs - and the objectives above them - stayed stuck at zero.

  A key result is now scored one of two ways, decided by whether it has KPIs:
  - **With KPIs** - unchanged: progress is the weighted roll-up of its KPIs, Current Value stays read-only, and direct value edits are ignored.
  - **Without KPIs** - the KR is scored directly from its own Target and Current values (`progress = current / target`). Current Value is editable on the KR card (inline and in the details popup), the Progress % preview updates live while editing, and the KR-level check-in page (`/krs/[krKey]/checkin`) now actually persists its Current Value.

  Adding the first KPI to a directly-scored KR switches it back to roll-up; deleting the last KPI keeps the rolled-up value as the KR's own starting Current Value instead of resetting it to 0.

- An explicitly chosen key-result status is no longer overwritten by the derived status during the recalculation cascade (`recalcObjectiveInStore` re-recalculated every KR of the objective without preserving it).

### Changed
- The empty-KPI message under a key result now explains that progress is tracked on the key result itself.
- Help > "Updating your progress" documents the two scoring modes.

### Notes
- Existing KRs with no KPIs keep their stored `currentValue` (0 for ones the old reset had zeroed), so nothing changes until someone enters a value - no retro-active progress appears.
- **Mirror to the SVH twin** (`Solstice-Ventures/OKR-Follow-Up-SVH`): this is a functional change and applies there too.

---

## [0.5.8] — 2026-08-17

### Fixed
- `app.js` stripped the `/ease-okr` prefix before handing the request to Next. That was only correct while the runtime config had **no** `basePath` — i.e. while `NEXT_PUBLIC_BASE_PATH` was missing from the server `.env`, which is also what caused the v0.5.7 asset 404s (the config is re-evaluated at boot, so without the variable Next emitted `<head>` asset URLs with no prefix). Once the variable is set, Next expects the prefix and the stripped `/` 404'd the whole app. `app.js` now **ensures** the prefix is present instead of removing it, which is correct whether or not Passenger forwards `PassengerBaseURI`. This matches the SVH twin, whose `app.js` never stripped.

### Required server configuration
- `NEXT_PUBLIC_BASE_PATH=/ease-okr` must be present in the server `.env` (or the Node Selector environment variables). The deploy workflow sets it only for the **build**; it is also needed at **runtime**, or the CSS and framework chunks lose the prefix.

---

## [0.5.7] — 2026-08-17

### Fixed
- Under the `/ease-okr` sub-path deploy, the CSS `<link>` and the framework/runtime chunks (`webpack-*`, `main-app-*`, `polyfills-*`, and the shared vendor chunk) were emitted at `/_next/...` instead of `/ease-okr/_next/...` and returned 404, leaving the page unstyled and non-interactive. Next.js applies `basePath` to route chunks but not to the webpack runtime's asset URLs. Setting `assetPrefix` to the same value as `basePath` in `next.config.mjs` prefixes every asset at build time. This replaces the Referer-scoped `.htaccess` rewrite documented in `README.md`, which cPanel's "Setup Node.js App" wipes whenever it regenerates `.htaccess`.

---

## [0.5.6] — 2026-06-16

### Fixed
- Sidebar SharePoint status always showed **Offline**. It ran a client-side *delegated* `Sites.Read.All` probe, but the app authenticates to SharePoint with *application* permissions — the signed-in user has no delegated Sites access, so the probe always failed. The status now reflects the real server-side app connection via `/api/sharepoint/setup` (`enabled` → Online), and shows the connected site URL on hover.

### Added
- Every outgoing email (change alerts, reminder digests) now includes an "Open in the OKR app" button linking back to the app (`lib/app-url.ts`, driven by `NEXT_PUBLIC_REDIRECT_URI`). Mention emails already deep-linked to the discussion.

---

## [0.5.5] — 2026-06-16

### Fixed
- Liquid glass on the OKR AI assistant (and any overlay-less panel) showed the board sharply instead of frosted. Two causes: (1) the modal pop animation used `animation-fill-mode: both`, leaving a `scale` on the panel — a lingering transform makes the panel a backdrop-root and silently disables the child `backdrop-filter` blur; switched to `backwards` so no transform is retained at rest. (2) The glass blur and SVG displacement shared one element, but an element with `filter` can drop its own `backdrop-filter` in Chromium; split into a dedicated frost layer (always composites) plus the refraction layer.

### Changed
- The AI assistant panel reads as see-through glass: lower white tint (new `tint` prop on the glass backdrop), stronger blur, and translucent message bubbles + header bar so the frosted board shows through.

---

## [0.5.4] — 2026-06-16

### Added
- Open/close animations for modals: overlay fades and panels pop (scale + fade) on open, and reverse on close. A small `useModalTransition` hook intercepts close so portal-rendered modals (chat, AI-summary, activity-detail, OKR AI assistant) play their exit before unmounting; native detail dialogs use CSS `@starting-style` + `allow-discrete`. Respects `prefers-reduced-motion`.

---

## [0.5.3] — 2026-06-15

### Changed
- Upgraded the "liquid glass" look to real Apple-style refraction, adapted from rdev/liquid-glass-react (MIT, vendored in `app/liquid-glass/` — no npm dependency, React-18/App-Router safe). A new `LiquidGlassBackdrop` renders the effect as a behind-content layer (so each surface keeps its own layout/typography), applied to the venture header toolbar, the chat / AI-summary / Objective-KR-KPI detail / activity-detail modals, and the floating OKR AI assistant panel. Refraction/displacement renders in Chromium; Safari/Firefox fall back to blur + specular shine.

---

## [0.5.2] — 2026-06-12

### Changed
- iOS-style "liquid glass" styling on the venture header toolbar and all modal surfaces (Objective/KR/KPI detail dialogs, chat, AI-summary, activity-detail): translucent gradient fill with `backdrop-filter` blur + saturation, bright specular rim, soft depth shadow, and blurred modal backdrops.

---

## [0.5.1] — 2026-06-12

### Fixed
- Modal forms now fully block background interaction. Detail dialogs (Objective/KR/KPI) and the chat, AI-summary, and activity-detail modals are portaled to `document.body` so their backdrop reliably covers the viewport, and the new shared `ModalPortal` stops event propagation at the portal boundary — fixing a case where clicking inside a modal toggled controls (e.g. the KPI section) behind it. Background scroll is locked while any modal is open.

---

## [0.5.0] — 2026-06-12

### Added
- KPI/milestone-level discussion threads (chat) with unread badges and notification-bell integration.
- Activity Log: filter by venture (resolves each entry to its objective's venture, pagination-safe).
- Change alert emails now include the owner email of the changed Objective, KR, or KPI in addition to configured recipients.

### Changed
- Notification bell now only surfaces a thread when the signed-in user is an owner of the Objective/KR/KPI, a participant in the chat, or was mentioned. Mentioned emails are now persisted on comments and participants are aggregated from comment authors.
- "Assigned To Me" board filter now shows only the Objectives/KRs/KPIs the user is assigned to or participates in — owning a parent no longer reveals unassigned children.
- KR Current Value and Progress % are now read-only (auto-computed from KPIs) and no longer sent in the KR edit payload.

### Removed
- Metric Type removed entirely from Objectives, KRs, and KPIs — edit/quick-create UI, the KR Metric Type config option, API patch fields, storage column usage, activity-log labels, and AI context.

### Fixed
- Collapse/Expand All now works while the search box has text (previously search forced everything open).
- Objective, KR, and KPI detail dialogs now lock background page scrolling while open.

---

## [0.4.16] — 2026-05-29

### Fixed
- Cascade impact not showing in change alert emails: parent KR and Objective progress were both read after the update (when the store had already recalculated them), so before === after. Now snapshots are taken before calling updateKpi/updateKeyResult.

---

## [0.4.15] — 2026-05-29

### Added
- Change alert emails now include a "Cascade Impact" section when a KPI or KR is updated: shows the parent KR progress (before → after) and parent Objective progress (before → after) with colour-coded progress bars — only shown when those values actually changed

---

## [0.4.14] — 2026-05-29

### Fixed
- Change Alerts settings not loading on page open: GET to /api/notifications/settings was missing x-user-email header, causing a 401 that silently returned empty data — recipients and enabled state now load correctly on every visit

---

## [0.4.13] — 2026-05-29

### Changed
- Notifications page: compact list layout — all 5 rules visible at once as rows with toggle + name + schedule; click ▼ to expand a rule for schedule/message editing
- Toggle on/off auto-saves immediately (no need to click Save for enable/disable changes)

---

## [0.4.12] — 2026-05-29

### Fixed
- "Cannot convert argument to a ByteString" error: entity titles with em-dashes or other non-ASCII characters are now stripped before being set as HTTP response headers (`x-activity-label`) via new `toAsciiHeader()` helper
- Notification reminder rules now default to enabled (were defaulting to Off)

---

## [0.4.11] — 2026-05-29

### Fixed
- Change Alerts: fixed "Missing signed-in user email" error — PATCH was missing x-user-email header; restored OwnerInput (people search) for recipient field

---

## [0.4.10] — 2026-05-29

### Fixed
- Change Alerts: reverted trigger back to dropdown (radio layout was broken), replaced OwnerInput with plain email input (OwnerInput requires signed-in user context and was throwing "Missing signed-in user email" error)

---

## [0.4.9] — 2026-05-29

### Fixed
- Change Alerts section: fixed checkbox+label alignment, replaced trigger dropdown with radio buttons, replaced plain email input with OwnerInput (people search with suggestions)

---

## [0.4.8] — 2026-05-29

### Added
- Change alert emails: when an objective, KR, or KPI is updated, an email is sent to a configurable recipient list showing what changed (before/after diff), who made the change, and when
- Config > Notifications > "Change Alert Emails" section: enable toggle, trigger selector (All updates / Status & progress only / New items only), recipient list with add/remove
- `lib/change-alerts.ts`: `sendChangeAlert()` helper (best-effort, never throws) wired into objective, KR, and KPI PATCH routes

---

## [0.4.7] — 2026-05-29

### Changed
- KRs reverted to always-measurable — removed the Type toggle, binary mode, and Done/Not Done from KR create and edit forms. KRs always require numeric target and current values. Non-measurable (binary) mode remains on KPIs only.

---

## [0.4.6] — 2026-05-29

### Fixed
- KR/KPI type toggle: replaced `<select>` with Measurable/Non-measurable button pair (same Done/Not Done pattern) — `<select>` onChange was being swallowed by parent event handlers in the card layout

---

## [0.4.5] — 2026-05-29

### Fixed
- KR/KPI add forms: `stopPropagation` on form click so parent section toggle doesn't intercept select interactions and prevent mode from changing
- Removed "(Done/Not Done)" suffix from Non-measurable option label in all forms

---

## [0.4.4] — 2026-05-29

### Fixed
- KPI rows: removed pencil edit button (click title to open details instead)
- KPI create: non-measurable mode now saves correctly — `createKpi` in dummy-store now preserves null target/current instead of defaulting to 100/0
- KR create: added measurable/non-measurable Type selector and target/current fields to the Add Key Result form (was only in edit)
- KR create: `createKeyResult` now uses target/current from input (with null support) instead of always defaulting to 100/0

---

## [0.4.3] — 2026-05-26

### Added
- KRs and KPIs now support **measurable vs non-measurable** mode
  - Measurable: target + current numeric fields with calculated progress %
  - Non-measurable (binary): Done / Not Done toggle; progress is 0% or 100%
  - Mode is inferred from whether `targetValue` is null (stored in SharePoint, no schema change)
  - Available in the KPI add form, KR/KPI inline edit, and KR/KPI detail dialog

---

## [0.4.2] — 2026-05-26

### Fixed
- Remove `Sites.Read.All` from `DEFAULT_SCOPES` fallback in `msal-client.ts` — this was the remaining source of admin-consent prompts when the env var wasn't baked in correctly

---

## [0.4.1] — 2026-05-26

### Fixed
- Deploy workflow: switch `NEXT_PUBLIC_AZURE_CLIENT_ID` back to the client-side app registration (`99756659`) and remove `Sites.Read.All` / `Sites.ReadWrite.All` from login scopes — these caused "Need admin approval" for non-admin users (same fix as v0.2.1, re-broken when the workflow was updated)

---

## [0.4.0] — 2026-05-26

### Changed
- Replaced `loader-ring.svg` with a clean CSS thin-arc spinner (`loader-spinner`) — no image file, scales to any size, works on any background

---

## [0.3.9] — 2026-05-26

### Fixed
- Reminder recipient names: compound "A; B" display-name fields are now split positionally alongside emails so each individual gets their own name in the preview list (no more "Biruk Gossaye; Ep..." entries)

---

## [0.3.8] — 2026-05-26

### Fixed
- Reminder emails: objectives/KRs with multiple owners (semicolon-separated) now send to each owner individually — previously the full "A; B" string was treated as one recipient

---

## [0.3.7] — 2026-05-26

### Changed
- Activity log detail popup now fetches and displays current item fields (title, status, progress, targets, etc.) instead of re-listing the change description — matching SVH popup behaviour

---

## [0.3.6] — 2026-05-26

### Changed
- Sidebar nav: Config and Activity swapped — Config now appears before Activity

---

## [0.3.5] — 2026-05-26

### Added
- Help page (`/help`): searchable user guide with category filters and sticky table of contents
- 19 topics covering getting started, OKR board, KPIs, discussions, mentions, reminders, AI assistant, activity log, config, roles, ventures structure, and FAQ — tailored for Ventures
- Help nav link (question-mark icon) visible to all signed-in users
- All `help-*` CSS classes added to globals.css

---

## [0.3.4] — 2026-05-26

### Fixed
- Activity feed: added `kpis` → "KPI" and `roles` → "role" to entity type word map
- Added `kpiCode`, `kpiKey`, `krKey`, `lastCheckinAt`, `weight` to field label / skip sets so KPI changes display correctly
- `kpiKey` added to SKIP_FIELDS (internal identifier, not a meaningful diff value)

---

## [0.3.3] — 2026-05-26

### Fixed
- Activity log now records field-change diffs for objective, KR, and KPI updates (before/after values shown in the feed)
- Added `buildActivityDiff` to EASE's `user-activity-log.ts` (was missing; SVH had it)
- `logSuccessfulRequestActivity` now reads `x-activity-details` and `x-activity-label` response headers
- Objective, KR, and KPI PATCH routes now attach diff JSON and entity label to their response headers

---

## [0.3.2] — 2026-05-26

### Changed
- Config page "Admin Users" tab replaced with full "Roles" tab: Admin/Manager/Editor/Viewer assignments, default-role-for-unlisted-users selector, assign role form (email + role dropdown), user list with compact × remove buttons
- `authz/me` endpoint now returns `isAdmin: true` for Manager role as well (so Managers see the Activity nav link)
- Added `AppRole`, `RoleUser` types and `ROLE_HIERARCHY` to `lib/types.ts`
- Added `getDefaultRoleAssignment`, `setDefaultRoleAssignment`, `deleteDefaultRoleAssignment` to server-storage; added `listRoleUsers`, `setUserRole`, `removeUserRole`, `getDefaultRole`, `setDefaultRole` to store
- New API routes: `/api/roles` (GET/POST), `/api/roles/[email]` (DELETE), `/api/roles/default` (GET/PUT)
- Added `config-subsection` / `config-subsection-heading` CSS to globals.css

---

## [0.3.1] — 2026-05-26

### Changed
- KPI cards redesigned to flat milestone-style rows: bold title, muted metadata line (Weight | Target | Current), thin horizontal progress bar with %, pencil edit icon — replacing the old expand/collapse layout with circular progress ring

---

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
