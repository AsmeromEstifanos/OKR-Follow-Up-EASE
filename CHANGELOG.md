# Changelog

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
