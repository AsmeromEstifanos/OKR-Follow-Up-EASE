from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_ENV_PATH = ROOT_DIR / ".env"


def load_env_file(path: Path = DEFAULT_ENV_PATH) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def parse_csv(value: str) -> list[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


@dataclass(slots=True)
class Settings:
    azure_tenant_id: str | None
    azure_client_id: str | None
    default_hostname: str | None
    default_site_path: str | None
    token_cache_path: Path
    timeout_seconds: int
    graph_scopes: list[str]
    graph_admin_scopes: list[str]
    sharepoint_scope_template: str

    @classmethod
    def load(cls) -> "Settings":
        load_env_file()
        graph_scopes = parse_csv(
            os.getenv(
                "GRAPH_SCOPES",
                "User.Read,Sites.Read.All,Sites.ReadWrite.All,Sites.FullControl.All",
            )
        )
        graph_admin_scopes = parse_csv(
            os.getenv(
                "GRAPH_ADMIN_SCOPES",
                (
                    "User.Read,Directory.Read.All,RoleManagement.Read.Directory,"
                    "Policy.Read.All,UserAuthenticationMethod.Read.All"
                ),
            )
        )
        token_cache_path = Path(
            os.getenv(
                "TOKEN_CACHE_PATH",
                str(ROOT_DIR / "sharepoint_admin_mcp" / ".token_cache.bin"),
            )
        )
        site_path = os.getenv("SHAREPOINT_SITE_PATH")
        if site_path and not site_path.startswith("/"):
            site_path = f"/{site_path}"

        return cls(
            azure_tenant_id=os.getenv("AZURE_TENANT_ID"),
            azure_client_id=os.getenv("AZURE_CLIENT_ID"),
            default_hostname=os.getenv("SHAREPOINT_HOSTNAME"),
            default_site_path=site_path,
            token_cache_path=token_cache_path,
            timeout_seconds=int(os.getenv("HTTP_TIMEOUT_SECONDS", "60")),
            graph_scopes=graph_scopes,
            graph_admin_scopes=graph_admin_scopes,
            sharepoint_scope_template=os.getenv(
                "SHAREPOINT_SCOPE_TEMPLATE",
                "https://{hostname}/AllSites.FullControl",
            ),
        )

    def require_app_registration(self) -> None:
        missing = []
        if not self.azure_tenant_id:
            missing.append("AZURE_TENANT_ID")
        if not self.azure_client_id:
            missing.append("AZURE_CLIENT_ID")
        if missing:
            joined = ", ".join(missing)
            raise RuntimeError(
                f"Missing required configuration: {joined}. "
                "Create .env from .env.example after registering the Azure app."
            )

    def resolve_target(
        self,
        hostname: str | None = None,
        site_path: str | None = None,
    ) -> tuple[str, str]:
        resolved_hostname = hostname or self.default_hostname
        resolved_site_path = site_path or self.default_site_path
        if not resolved_hostname or not resolved_site_path:
            raise RuntimeError(
                "hostname and site_path are required. Pass them explicitly or set "
                "SHAREPOINT_HOSTNAME and SHAREPOINT_SITE_PATH in .env."
            )
        if not resolved_site_path.startswith("/"):
            resolved_site_path = f"/{resolved_site_path}"
        return resolved_hostname, resolved_site_path

    def sharepoint_scopes(self, hostname: str) -> list[str]:
        return [self.sharepoint_scope_template.format(hostname=hostname)]

    def auth_summary(self) -> dict:
        return {
            "azure_tenant_id_configured": bool(self.azure_tenant_id),
            "azure_client_id_configured": bool(self.azure_client_id),
            "default_hostname": self.default_hostname,
            "default_site_path": self.default_site_path,
            "token_cache_path": str(self.token_cache_path),
            "graph_scopes": self.graph_scopes,
            "graph_admin_scopes": self.graph_admin_scopes,
            "sharepoint_scope_template": self.sharepoint_scope_template,
        }
