function normalizeBasePath(input) {
  const raw = String(input ?? "").trim();
  if (!raw || raw === "/") {
    return "";
  }

  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  // basePath alone does not reach the webpack runtime: framework chunks
  // (webpack-*, main-app-*, polyfills-*) and the CSS <link> are emitted at
  // /_next/... and 404 under a sub-path deploy. assetPrefix fixes them at
  // the source, so no .htaccess Referer rewrite is needed.
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "0.1.4",
    NEXT_PUBLIC_APP_PROFILE: process.env.NEXT_PUBLIC_APP_PROFILE ?? "",
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_AZURE_CLIENT_ID:
      process.env.NEXT_PUBLIC_AZURE_CLIENT_ID ?? process.env.REACT_APP_AZURE_CLIENT_ID ?? "",
    NEXT_PUBLIC_AAD_TENANT_ID:
      process.env.NEXT_PUBLIC_AAD_TENANT_ID ?? process.env.REACT_APP_AAD_TENANT_ID ?? "",
    NEXT_PUBLIC_LOGIN_SCOPES:
      process.env.NEXT_PUBLIC_LOGIN_SCOPES ?? process.env.REACT_APP_LOGIN_SCOPES ?? "",
    NEXT_PUBLIC_SHAREPOINT_SITE_URL:
      process.env.NEXT_PUBLIC_SHAREPOINT_SITE_URL ?? process.env.REACT_APP_SHAREPOINT_SITE_URL ?? "",
    NEXT_PUBLIC_SHAREPOINT_STORAGE_LIST:
      process.env.NEXT_PUBLIC_SHAREPOINT_STORAGE_LIST ?? process.env.REACT_APP_SHAREPOINT_STORAGE_LIST ?? "",
    NEXT_PUBLIC_COMPANION_APP_URL: process.env.NEXT_PUBLIC_COMPANION_APP_URL ?? "",
    NEXT_PUBLIC_COMPANION_APP_LABEL: process.env.NEXT_PUBLIC_COMPANION_APP_LABEL ?? ""
  }
};

export default nextConfig;
