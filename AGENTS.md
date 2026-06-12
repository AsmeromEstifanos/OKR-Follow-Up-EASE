# AGENTS.md

## Workspace conventions

This project lives in the `D:\_Agents` workspace (imported from `D:\EASE\OKR\OKR_Follow_Up_EASE`); it keeps its own git history and remote (`Solstice-Ventures/OKR-Follow-Up-Ventures`, branch `main`). It is the EASE/Ventures variant of the OKR app — a sibling of `Projects\OKR-Follow-Up\` (remote `-SVH`); they are separate repos, do not cross-push. Follow the workspace rules in `D:\_Agents\CLAUDE.md` / `AGENTS.md` in addition to this file:

- **Keep in sync with the SVH sibling** — `Projects\OKR-Follow-Up\` and this app are mirror twins. Every functional/code change (anything in `app/`, `lib/`, `public/`, shared logic) must be applied to **both**. Keep variant-specific bits separate: base path (`/okr` vs `/ease-okr`), git remotes, branding (SVH vs Ventures/EASE), `COMPANION_APP_URL`, redirect URIs, SharePoint site/list, version numbers. After changing one, port the change to the other and commit each to its own remote.

- **Mobile-first / responsive** — every UI view must be mobile-friendly and verified at a mobile viewport before UI work is called done.
- **cPanel deploys** — before deploying this SSR Next app to cPanel + CloudLinux, read `D:\_Agents\_playbooks\cpanel-nodejs-deploy.md` (Windows-zip backslash trap, no `node_modules`, NPROC cap, Cloudflare DNS). Complements the project's own `DEPLOYMENT.md`.
- **Governance** is already in place: SemVer (`package.json`), `CHANGELOG.md`, and user/deployment manuals.
- Note: `.git` history is large (~106 MB) due to binaries committed in the past; `.tgz` deploy tarballs are gitignored and were not imported.

## Repository Rules

- Update the application version before every `git push`.
