# OKR Follow-Up EASE

## Project Notes

- This is the Ventures/EASE variant of the OKR Follow-Up app.
- The sibling app is `D:\_Agents\Projects\OKR-Follow-Up`.
- Functional changes should normally be mirrored to the sibling app, while preserving variant-specific branding, base paths, remotes, SharePoint config, and labels.

## Decisions Log

### 2026-06-12 - Codex follow-up to Claude work

- Completed the remaining EASE-side metric-type removal by clearing stale UI and API references from quick-create, objective detail edit, KR detail edit, activity field ordering, and PATCH parsers.
- Added a reusable body scroll lock hook for native detail dialogs so opening Objective/KR/KPI modal forms prevents background page scrolling.
- Updated change alert emails so the changed item's `ownerEmail` is included in recipients in addition to configured change-alert recipients, with email dedupe.
- Left package version unchanged; `AGENTS.md` says version must be updated before push, not for every local edit.

## Open Follow-Ups

- Reproduce the same intent in `D:\_Agents\Projects\OKR-Follow-Up`. That app still has the older metric-type model in more places than EASE did, so porting is not a direct patch copy.
- Before pushing either repo, update `package.json` version and keep `CHANGELOG.md` current.
