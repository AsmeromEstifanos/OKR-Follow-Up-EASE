"use client";

import { useCallback, useEffect, useState } from "react";
import { apiPath } from "@/lib/base-path";

export type SharePointConnectionStatus = "not-configured" | "checking" | "linked" | "error";

type SharePointConnectionState = {
  status: SharePointConnectionStatus;
  message: string;
  detail: string;
};

const INITIAL_STATE: SharePointConnectionState = {
  status: "checking",
  message: "Checking",
  detail: "Checking SharePoint connection..."
};

type SetupStatus = { enabled: boolean; reason?: string; siteUrl?: string; listName?: string };

/**
 * Reflects the app's actual SharePoint connectivity (the server-side app-only
 * connection that powers all data), not a delegated client probe. The app uses
 * application permissions, so the signed-in user has no delegated Sites access —
 * the old client probe always failed and showed "Offline" even when connected.
 */
export default function useSharePointConnection(enabled: boolean): SharePointConnectionState & { refresh: () => void } {
  const [state, setState] = useState<SharePointConnectionState>(INITIAL_STATE);
  const [refreshToken, setRefreshToken] = useState<number>(0);

  const refresh = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState({
        status: "error",
        message: "Authentication required",
        detail: "Sign in to verify SharePoint connectivity."
      });
      return;
    }

    let cancelled = false;
    setState({ status: "checking", message: "Checking", detail: "Checking SharePoint connection..." });

    fetch(apiPath("/api/sharepoint/setup"), { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<SetupStatus>) : Promise.reject(new Error("Status check failed"))))
      .then((status) => {
        if (cancelled) return;
        if (status.enabled) {
          setState({
            status: "linked",
            message: "Online",
            detail: status.siteUrl ? `Connected to ${status.siteUrl}` : "SharePoint connected"
          });
        } else {
          setState({
            status: "error",
            message: "Offline",
            detail: status.reason || "SharePoint is not configured."
          });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: "Offline",
          detail: error instanceof Error ? error.message : "Failed to check SharePoint connection."
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, refreshToken]);

  return { ...state, refresh };
}
