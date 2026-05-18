# OKR Follow-Up (EASE)

Internal OKR follow-up app built with Next.js 14 (App Router) and SharePoint list-backed persistence. Authenticates with Azure AD via MSAL.

Production URL: https://sol-ventures.com/ease-okr

## Documentation

- User manual: [`USER_MANUAL.md`](./USER_MANUAL.md)
- Auth flow diagram: [`AUTH_FLOW.md`](./AUTH_FLOW.md)

---

## Quick start (local development)

### Prerequisites

- Node.js 20.x
- An Azure AD app registration (SPA + delegated permissions) with `http://localhost:3000` as a redirect URI
- An Azure AD app registration (daemon + application permissions) with admin-consented `Sites.ReadWrite.All`
- A SharePoint site the daemon app can access

### Setup

```bash
git clone <repo>
cd OKR_Follow_Up_EASE
npm install
cp .env.example .env
# edit .env with the values from Azure portal — see "Environment variables" below
npm run dev
```

Open http://localhost:3000

### Environment variables

Copy `.env.example` to `.env` and fill in:

```env
# Public client (MSAL popup login)
NEXT_PUBLIC_AZURE_CLIENT_ID=<public-app-client-id>
NEXT_PUBLIC_AAD_TENANT_ID=<tenant-id>
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000
NEXT_PUBLIC_POST_LOGOUT_REDIRECT_URI=http://localhost:3000
NEXT_PUBLIC_LOGIN_SCOPES=openid profile email User.Read Sites.Read.All Sites.ReadWrite.All
NEXT_PUBLIC_SHAREPOINT_SITE_URL=https://<tenant>.sharepoint.com/sites/<SiteName>
NEXT_PUBLIC_SHAREPOINT_STORAGE_LIST=EASE OKR Store

# Server daemon (SharePoint reads/writes via Microsoft Graph)
AZURE_APP_TENANT_ID=<tenant-id>
AZURE_APP_CLIENT_ID=<server-app-client-id>
AZURE_APP_CLIENT_SECRET=<server-app-secret>
SHAREPOINT_SITE_URL=https://<tenant>.sharepoint.com/sites/<SiteName>
SHAREPOINT_STORAGE_LIST=EASE OKR Store
```

Notes:
- `NEXT_PUBLIC_*` vars are read at **build time** and baked into the JS bundle.
- Server-side vars (`AZURE_APP_*`, `SHAREPOINT_*` without `NEXT_PUBLIC_`) are read at **runtime** by Node.
- Do not commit `.env`. Use `.env.example` to share variable names.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js dev server (port 3000, 3001 if busy) |
| `npm run build` | Production build into `.next/` |
| `npm start` | Run the production build (`next start`) |
| `npm run start:cpanel` | Run via the custom `app.js` entry (used by cPanel/Passenger) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

---

## Tech stack

- **Framework**: Next.js 14 (App Router, React Server Components)
- **Auth**: Azure AD via `@azure/msal-browser` + `@azure/msal-react`
- **Persistence**: Microsoft Graph → SharePoint Lists (server-side app-only auth)
- **Styling**: CSS (global `app/globals.css`)
- **Runtime**: Node 20 on CloudLinux/Passenger (cPanel) in production

---

## Project structure

```
app/                          # Next.js App Router (pages, layouts, API routes)
  api/                        # Route handlers
  dashboard/                  # Dashboard page
  objectives/[objectiveKey]/  # Objective detail page
  krs/[krKey]/checkin/        # KR check-in page
  config/                     # Admin config page
  dashboard-ease-*.tsx        # EASE-style cards (Objective / KR / KPI)
  error.tsx                   # Root error boundary
  dashboard/error.tsx         # Dashboard error boundary
lib/
  store.ts                    # Async store API (hydrates from SharePoint)
  dummy-store.ts              # Pure business logic (no I/O)
  sharepoint/server-storage.ts # Microsoft Graph + SharePoint integration
  auth/msal-client.ts         # MSAL configuration
  types.ts                    # Domain types
app.js                        # Custom Node entry (production, behind Passenger)
next.config.mjs               # basePath + skipTrailingSlashRedirect
.github/workflows/deploy-cpanel.yml  # CI/CD to cPanel
```

---

## Data model & SharePoint lists

Lists are created with the prefix from `SHAREPOINT_STORAGE_LIST` (default `OKR Follow Up Store`):

- `<prefix> Ventures`
- `<prefix> Departments`
- `<prefix> Periods`
- `<prefix> Objectives`
- `<prefix> Key Results`
- `<prefix> KPIs`
- `<prefix> Check-Ins`
- `<prefix> Config`
- `<prefix> Roles`
- `<prefix> Auth Logs`
- `<prefix> Activity Logs`

On first run (if no data exists), seed data is written automatically.

---

## API routes

- `GET/POST /api/periods` · `PATCH /api/periods/:periodKey`
- `GET/POST /api/objectives` · `GET/PATCH/DELETE /api/objectives/:objectiveKey`
- `POST /api/objectives/weights` · `POST /api/objectives/:objectiveKey/key-results/weights`
- `GET/POST /api/krs` · `GET/PATCH/DELETE /api/krs/:krKey` · `POST /api/krs/:krKey/kpis/weights`
- `GET/POST /api/kpis` · `GET/PATCH/DELETE /api/kpis/:kpiKey`
- `GET/POST /api/checkins`
- `GET /api/dashboard/me`
- `GET /api/config` · `PATCH /api/config/rag` · `PATCH /api/config/field-options` · `PATCH /api/config/board-card-colors`
- `GET/POST /api/config/admins` · `DELETE /api/config/admins/:email`
- `GET/POST /api/config/ventures` · `PATCH/DELETE /api/config/ventures/:ventureKey`
- `POST /api/config/ventures/:ventureKey/departments` · `PATCH/DELETE /api/config/ventures/:ventureKey/departments/:departmentKey`
- `GET /api/codes/objective` · `GET /api/codes/kr` · `GET /api/codes/kpi`
- `GET /api/operation-progress/:operationId`
- `POST /api/sharepoint/setup` (creates SharePoint lists + seeds data)
- `POST /api/auth/logins` · `GET /api/authz/me`
- `GET /api/users/suggest`

---

## Business rules

- KR progress is computed and clamped to `0..100`
- Objective progress is the weighted average of child KR progress values
- Missing check-in logic uses a 7-day threshold for active periods
- Objective RAG derives from configurable thresholds (`/api/config/rag`)

---

## Pushing changes & CI/CD

### Deployment pipeline

A push to `main` triggers `.github/workflows/deploy-cpanel.yml`:

1. `npm ci` + `tsc --noEmit`
2. `npm run build` with the GitHub-secret env vars injected
3. Tar up `.next`, `app`, `lib`, `public`, `app.js`, `next.config.mjs`, `package.json`, `package-lock.json`
4. SCP to the server, extract to `$CPANEL_APP_DIR`
5. `npm ci --omit=dev` on the server
6. Restart the app via Passenger (`touch tmp/restart.txt` or `passenger-config restart-app`)

The deploy preserves: `.env`, `.htaccess`, `node_modules` (symlink), `tmp`, `logs`.

### Typical workflow

```bash
# make changes
git add -A
git commit -m "your message"
git push
# Wait ~3-5 min, watch GitHub Actions, then verify https://sol-ventures.com/ease-okr
```

### Required GitHub Secrets

Repository → Settings → Secrets and variables → Actions:

| Secret | Purpose |
|---|---|
| `CPANEL_HOST` | SSH host, e.g. `s4377.lon1.stableserver.net` |
| `CPANEL_USERNAME` | cPanel SSH username |
| `CPANEL_SSH_KEY` | Private SSH key (PEM, including BEGIN/END lines) |
| `CPANEL_PORT` | SSH port (optional, default `22`) |
| `CPANEL_APP_DIR` | App directory, e.g. `/home/solvenwk/public_html/ease-okr` |
| `CPANEL_APP_PORT` | Optional — Passenger sets it automatically |
| `CPANEL_RESTART_COMMAND` | Optional — custom restart script |
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | Public MSAL app client ID |
| `AZURE_APP_TENANT_ID` | Azure AD tenant ID (also used as `NEXT_PUBLIC_AAD_TENANT_ID`) |

The workflow currently hardcodes:
- `NEXT_PUBLIC_BASE_PATH=/ease-okr`
- `NEXT_PUBLIC_APP_PROFILE=ease-okr`
- `NEXT_PUBLIC_REDIRECT_URI=https://sol-ventures.com/ease-okr`
- `NEXT_PUBLIC_POST_LOGOUT_REDIRECT_URI=https://sol-ventures.com/ease-okr`
- `NEXT_PUBLIC_SHAREPOINT_SITE_URL=https://easeint1.sharepoint.com/sites/OKRFollowUp`
- `NEXT_PUBLIC_SHAREPOINT_STORAGE_LIST=EASE OKR Store`

Edit `.github/workflows/deploy-cpanel.yml` to change these.

---

## Production server configuration (cPanel)

The deploy pipeline assumes the cPanel Node.js app is already set up. One-time setup:

### 1. cPanel → Setup Node.js App → Create Application

- **Node.js version**: 20.x
- **Application mode**: Production
- **Application root**: `public_html/ease-okr`
- **Application URL**: `sol-ventures.com` / `ease-okr`
- **Startup file**: `app.js`

This creates the `node_modules` symlink → `~/nodevenv/public_html/ease-okr/20/lib/node_modules` and writes `.htaccess` with the Passenger config.

### 2. Server `.env` file

Create `/home/<user>/public_html/ease-okr/.env`:

```env
AZURE_APP_TENANT_ID=...
AZURE_APP_CLIENT_ID=...
AZURE_APP_CLIENT_SECRET=...
SHAREPOINT_SITE_URL=https://<tenant>.sharepoint.com/sites/<SiteName>
SHAREPOINT_STORAGE_LIST=EASE OKR Store
```

This file is NOT touched by the deploy script.

### 3. Root-level rewrite (`public_html/.htaccess`)

Required because Next.js's webpack runtime emits framework chunks (e.g. `main-app-*.js`, `polyfills-*.js`) without the configured `basePath`. The browser requests them at `/_next/...` instead of `/ease-okr/_next/...`. This rule rewrites them, scoped by Referer so it never touches other sites on the same domain:

```apache
RewriteEngine On
# Next.js framework chunks lose the /ease-okr basePath in webpack runtime.
# Only redirect if the request originated from an /ease-okr/ page.
RewriteCond %{HTTP_REFERER} sol-ventures\.com/ease-okr(/|$) [NC]
RewriteRule ^_next/(.*)$ /ease-okr/_next/$1 [L,R=302]
```

This file is NOT touched by the deploy script.

### 4. App-level `.htaccess` (auto-generated)

cPanel writes this when you create/save the Node.js app:

```apache
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot "/home/<user>/public_html/ease-okr"
PassengerBaseURI "/ease-okr"
PassengerNodejs "/home/<user>/nodevenv/public_html/ease-okr/20/bin/node"
PassengerAppType node
PassengerStartupFile app.js
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END
```

If accidentally deleted, click **Save** on the Node.js app page in cPanel to regenerate.

---

## Why `app.js` is custom (not `next start`)

CloudLinux Passenger does **not** strip `PassengerBaseURI` before forwarding to Node, contrary to common assumption. Since Next.js is built with `basePath: /ease-okr` and expects requests without that prefix, `app.js` strips it manually:

```js
if (req.url === basePath) req.url = "/";
else if (req.url.startsWith(basePath + "/")) req.url = req.url.slice(basePath.length);
```

`app.js` also writes a `debug.log` next to itself, capturing incoming request URLs and any startup errors — useful for diagnosing 404s or crashes after a deploy.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `https://sol-ventures.com/ease-okr` returns 404 with `x-powered-by: Next.js` | `app.js` not stripping basePath | Check `~/public_html/ease-okr/app.js` has the basePath-stripping logic |
| 404 from Apache/LiteSpeed (no `x-powered-by`) | `.htaccess` missing/broken | cPanel → Node.js App → Save (regenerates app-level `.htaccess`) |
| `Cannot find module 'next'` in `debug.log` | Broken `node_modules` symlink | `cd ~/public_html/ease-okr && rm -rf node_modules && ln -s ~/nodevenv/public_html/ease-okr/20/lib/node_modules node_modules && source ~/nodevenv/public_html/ease-okr/20/bin/activate && npm install --production` |
| Page loads but shows "Something went wrong" error boundary | Server `.env` missing/invalid SharePoint credentials | Recreate `~/public_html/ease-okr/.env` with the 5 server vars |
| Assets 404 (only main-app, webpack, polyfills) | Missing root `public_html/.htaccess` referrer rewrite | See "Root-level rewrite" section above |
| AADSTS500113 "No reply address" during login | Redirect URI not registered in Azure | Azure portal → App registration → Authentication → add the URL as SPA redirect |
| AADSTS700016 "Application not found in directory" | Wrong tenant ID or app registered in different tenant | Verify `AZURE_APP_TENANT_ID` matches the tenant where the app is registered |
| SCP timeout in GitHub Actions (`dial tcp: lookup ***`) | DNS hiccup on Actions runner | Re-run the workflow |

To check the production app logs in real time:

```bash
tail -f ~/public_html/ease-okr/debug.log
```

To force-restart the app:

```bash
touch ~/public_html/ease-okr/tmp/restart.txt
```

Or click **RESTART** on the cPanel Node.js App page.

---

## License

Internal — Solstice Ventures Holding Limited.
