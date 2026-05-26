"use client";

import LoaderImage from "@/app/loader-image";
import { attemptSilentSso, ensureActiveAccount, initializeMsal, loginRequest, msalConfigError } from "@/lib/auth/msal-client";
import { withBasePath } from "@/lib/base-path";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { useEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
};

export default function AuthGate({ children }: Props): JSX.Element {
  const isAuthenticated = useIsAuthenticated();
  const { instance, accounts, inProgress } = useMsal();
  const [isAttemptingSso, setIsAttemptingSso] = useState<boolean>(true);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (accounts.length > 0) {
      ensureActiveAccount();
    }
  }, [accounts]);

  // On first load, if not already signed in, try silent SSO from the shared
  // tenant session (so switching from the companion app doesn't re-prompt).
  useEffect(() => {
    let cancelled = false;
    if (accounts.length > 0) {
      setIsAttemptingSso(false);
      return;
    }
    void attemptSilentSso().finally(() => {
      if (!cancelled) {
        setIsAttemptingSso(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (): Promise<void> => {
    if (isBusy || msalConfigError) return;
    setIsBusy(true);
    setError("");
    try {
      await initializeMsal();
      const response = await instance.loginPopup(loginRequest);
      if (response.account) {
        instance.setActiveAccount(response.account);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setIsBusy(false);
    }
  };

  if (inProgress !== "none" || (isAttemptingSso && !isAuthenticated)) {
    const loaderSrc = inProgress === "logout" ? withBasePath("/svh.gif") : undefined;

    return (
      <div className="auth-loader" aria-live="polite" aria-busy="true">
        <LoaderImage size={320} src={loaderSrc} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-signin-prompt" aria-live="polite">
        <div className="auth-signin-card">
          <p className="auth-signin-message">Sign in to access OKR Follow-Up</p>
          <button
            type="button"
            className="auth-signin-btn"
            onClick={() => void handleLogin()}
            disabled={isBusy || Boolean(msalConfigError)}
          >
            {isBusy ? "Signing in…" : "Sign In with Microsoft"}
          </button>
          {error ? <p className="auth-signin-error">{error}</p> : null}
          {msalConfigError ? <p className="auth-signin-error">{msalConfigError}</p> : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
