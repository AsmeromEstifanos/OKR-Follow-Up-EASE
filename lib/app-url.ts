// The app's public URL is its MSAL redirect URI (the app root, base path included
// in prod, e.g. https://sol-ventures.com/ease-okr). Used to deep-link emails back
// into the app.
export function getAppUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_REDIRECT_URI ?? "").trim().replace(/\/+$/, "");
  if (!base) return "";
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

// A consistent "open the app" button for outgoing emails. Returns "" when no app
// URL is configured (so emails still send without a broken link).
export function emailAppButton(label = "Open in the OKR app", path = ""): string {
  const url = getAppUrl(path);
  if (!url) return "";
  return `<div style="margin:24px 0 8px"><a href="${url}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:0.9rem">${label}</a></div>`;
}
