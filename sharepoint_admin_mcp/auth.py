from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import sys

import msal

from .config import Settings


class AuthRequiredError(RuntimeError):
    """Raised when the token cache is missing the requested resource token."""


RESERVED_SCOPES = {"openid", "profile", "offline_access"}


@dataclass(slots=True)
class AuthStatus:
    accounts: list[dict]
    token_cache_exists: bool


class MicrosoftAuthClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.settings.require_app_registration()
        self._cache = msal.SerializableTokenCache()
        self._load_cache()
        self._app = msal.PublicClientApplication(
            client_id=self.settings.azure_client_id,
            authority=f"https://login.microsoftonline.com/{self.settings.azure_tenant_id}",
            token_cache=self._cache,
        )

    def _load_cache(self) -> None:
        path = self.settings.token_cache_path
        if path.exists():
            self._cache.deserialize(path.read_text(encoding="utf-8"))

    def _save_cache(self) -> None:
        if not self._cache.has_state_changed:
            return
        path = self.settings.token_cache_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self._cache.serialize(), encoding="utf-8")

    def status(self) -> AuthStatus:
        accounts = self._app.get_accounts()
        return AuthStatus(
            accounts=[
                {
                    "username": account.get("username"),
                    "home_account_id": account.get("home_account_id"),
                    "environment": account.get("environment"),
                }
                for account in accounts
            ],
            token_cache_exists=self.settings.token_cache_path.exists(),
        )

    def login(self, resource: str, hostname: str | None = None) -> dict:
        scopes = self._scopes_for_resource(resource, hostname)
        flow = self._app.initiate_device_flow(scopes=scopes)
        if "user_code" not in flow:
            raise RuntimeError(f"Failed to start device code flow: {flow}")

        print(flow["message"], file=sys.stderr)
        result = self._app.acquire_token_by_device_flow(flow)
        self._save_cache()
        if "access_token" not in result:
            message = result.get("error_description") or result.get("error") or str(result)
            raise RuntimeError(f"Device login failed for {resource}: {message}")
        return {
            "resource": resource,
            "scopes": scopes,
            "account": result.get("id_token_claims", {}).get("preferred_username"),
            "expires_in": result.get("expires_in"),
        }

    def start_login(self, resource: str, hostname: str | None = None) -> dict:
        scopes = self._scopes_for_resource(resource, hostname)
        flow = self._app.initiate_device_flow(scopes=scopes)
        if "user_code" not in flow:
            raise RuntimeError(f"Failed to start device code flow: {flow}")

        flow_path = self._flow_path(resource, hostname)
        flow_path.parent.mkdir(parents=True, exist_ok=True)
        flow_path.write_text(json.dumps(flow, indent=2), encoding="utf-8")

        return {
            "resource": resource,
            "hostname": hostname,
            "scopes": scopes,
            "verification_uri": flow.get("verification_uri"),
            "verification_uri_complete": flow.get("verification_uri_complete"),
            "user_code": flow.get("user_code"),
            "expires_in": flow.get("expires_in"),
            "message": flow.get("message"),
            "flow_cache_path": str(flow_path),
        }

    def finish_login(self, resource: str, hostname: str | None = None) -> dict:
        flow_path = self._flow_path(resource, hostname)
        if not flow_path.exists():
            raise RuntimeError(
                f"No pending device flow found for {resource}. Run the matching "
                f"`start-login` command first."
            )

        flow = json.loads(flow_path.read_text(encoding="utf-8"))
        result = self._app.acquire_token_by_device_flow(flow)
        self._save_cache()
        if "access_token" not in result:
            message = result.get("error_description") or result.get("error") or str(result)
            raise RuntimeError(f"Device login failed for {resource}: {message}")

        flow_path.unlink(missing_ok=True)
        return {
            "resource": resource,
            "hostname": hostname,
            "account": result.get("id_token_claims", {}).get("preferred_username"),
            "expires_in": result.get("expires_in"),
        }

    def acquire_graph_token(self) -> str:
        return self._acquire_token(
            resource="graph",
            scopes=self.settings.graph_scopes,
        )

    def acquire_graph_admin_token(self) -> str:
        return self._acquire_token(
            resource="graph-admin",
            scopes=self.settings.graph_admin_scopes,
        )

    def acquire_sharepoint_token(self, hostname: str) -> str:
        return self._acquire_token(
            resource="sharepoint",
            scopes=self.settings.sharepoint_scopes(hostname),
        )

    def _acquire_token(self, resource: str, scopes: list[str]) -> str:
        scopes = self._normalize_scopes(scopes)
        accounts = self._app.get_accounts()
        result = None
        if accounts:
            result = self._app.acquire_token_silent(scopes, account=accounts[0])
        if result and "access_token" in result:
            self._save_cache()
            return result["access_token"]

        command = "python -m sharepoint_admin_mcp login --resource graph"
        if resource == "graph-admin":
            command = "python -m sharepoint_admin_mcp login --resource graph-admin"
        if resource == "sharepoint":
            command = (
                "python -m sharepoint_admin_mcp login --resource sharepoint "
                "--hostname <your-sharepoint-hostname>"
            )
        raise AuthRequiredError(
            f"No cached {resource} token is available. Run `{command}` first."
        )

    def _flow_path(self, resource: str, hostname: str | None = None) -> Path:
        base_dir = self.settings.token_cache_path.parent / ".device_flows"
        if resource == "sharepoint":
            if not hostname:
                raise RuntimeError("--hostname is required for SharePoint device login.")
            safe_hostname = "".join(
                character if character.isalnum() else "_"
                for character in hostname.lower()
            )
            return base_dir / f"{resource}_{safe_hostname}.json"
        return base_dir / f"{resource}.json"

    def _scopes_for_resource(self, resource: str, hostname: str | None) -> list[str]:
        if resource == "graph":
            return self._normalize_scopes(self.settings.graph_scopes)
        if resource == "graph-admin":
            return self._normalize_scopes(self.settings.graph_admin_scopes)
        if resource == "sharepoint":
            if not hostname:
                raise RuntimeError("--hostname is required for SharePoint device login.")
            return self.settings.sharepoint_scopes(hostname)
        raise RuntimeError(f"Unsupported resource: {resource}")

    @staticmethod
    def _normalize_scopes(scopes: list[str]) -> list[str]:
        return [scope for scope in scopes if scope not in RESERVED_SCOPES]
