from __future__ import annotations

from datetime import date, timedelta
import re
from typing import Any, Literal

from mcp.server.fastmcp import FastMCP

from .auth import MicrosoftAuthClient
from .clients import GraphClient, SharePointRestClient
from .config import Settings


def build_server() -> FastMCP:
    settings = Settings.load()
    auth = MicrosoftAuthClient(settings)
    graph = GraphClient(settings, auth)
    sp = SharePointRestClient(settings, auth)

    mcp = FastMCP(
        name="sharepoint-admin-mcp",
        instructions=(
            "Use this server to inspect SharePoint sites, lists, columns, content types, "
            "folders, permissions, and site groups through Microsoft Graph and SharePoint REST."
        ),
    )

    def resolve_target(hostname: str | None, site_path: str | None) -> tuple[str, str]:
        return settings.resolve_target(hostname, site_path)

    def resolve_site_record(hostname: str, site_path: str) -> dict:
        return graph.resolve_site(hostname, site_path)

    @mcp.tool(description="Show configuration and cached-auth status for the local SharePoint MCP.")
    def auth_status(hostname: str | None = None) -> dict:
        status = auth.status()
        sharepoint_scope_preview = settings.sharepoint_scopes(
            hostname or settings.default_hostname or "<hostname-required>"
        )
        return {
            "configuration": settings.auth_summary(),
            "cached_accounts": status.accounts,
            "token_cache_exists": status.token_cache_exists,
            "effective_sharepoint_scopes": sharepoint_scope_preview,
            "login_commands": {
                "graph": "python -m sharepoint_admin_mcp login --resource graph",
                "graph_admin": "python -m sharepoint_admin_mcp login --resource graph-admin",
                "sharepoint": (
                    "python -m sharepoint_admin_mcp login --resource sharepoint "
                    "--hostname <your-sharepoint-hostname>"
                ),
            },
        }

    @mcp.tool(description="List Microsoft Entra users with basic identity properties.")
    def list_users(top: int = 999) -> list[dict]:
        return graph.list_users(top=top)

    @mcp.tool(description="List activated Microsoft Entra directory roles.")
    def list_directory_roles() -> list[dict]:
        return graph.list_directory_roles()

    @mcp.tool(description="List members assigned to an activated Microsoft Entra directory role.")
    def get_directory_role_members(role_id: str) -> list[dict]:
        return graph.get_directory_role_members(role_id)

    @mcp.tool(description="List Microsoft Entra role definitions for directory roles.")
    def list_directory_role_definitions() -> list[dict]:
        return graph.list_directory_role_definitions()

    @mcp.tool(description="List Microsoft Entra directory role assignments.")
    def list_directory_role_assignments() -> list[dict]:
        return graph.list_directory_role_assignments()

    @mcp.tool(description="List Microsoft Entra role assignment schedule requests.")
    def list_role_assignment_schedule_requests() -> list[dict]:
        return graph.list_role_assignment_schedule_requests()

    @mcp.tool(description="List Microsoft Entra active role assignment schedules.")
    def list_role_assignment_schedules() -> list[dict]:
        return graph.list_role_assignment_schedules()

    @mcp.tool(description="List Microsoft Entra active role assignment schedule instances.")
    def list_role_assignment_schedule_instances() -> list[dict]:
        return graph.list_role_assignment_schedule_instances()

    @mcp.tool(description="List Microsoft Entra role eligibility schedule requests.")
    def list_role_eligibility_schedule_requests() -> list[dict]:
        return graph.list_role_eligibility_schedule_requests()

    @mcp.tool(description="List Microsoft Entra role eligibility schedules.")
    def list_role_eligibility_schedules() -> list[dict]:
        return graph.list_role_eligibility_schedules()

    @mcp.tool(description="List Microsoft Entra role eligibility schedule instances.")
    def list_role_eligibility_schedule_instances() -> list[dict]:
        return graph.list_role_eligibility_schedule_instances()

    @mcp.tool(description="List Conditional Access policies from Microsoft Entra.")
    def list_conditional_access_policies() -> list[dict]:
        return graph.list_conditional_access_policies()

    @mcp.tool(description="List Microsoft Secure Score snapshots.")
    def list_secure_scores(top: int = 20) -> list[dict]:
        return graph.list_secure_scores(top=top)

    @mcp.tool(description="Get the latest Microsoft Secure Score snapshot.")
    def get_latest_secure_score() -> dict:
        return graph.get_latest_secure_score()

    @mcp.tool(description="List risky users from Microsoft Entra identity protection.")
    def list_risky_users(top: int = 100) -> list[dict]:
        return graph.list_risky_users(top=top)

    @mcp.tool(description="List risky service principals from Microsoft Entra identity protection.")
    def list_risky_service_principals(top: int = 100) -> list[dict]:
        return graph.list_risky_service_principals(top=top)

    @mcp.tool(description="List authentication methods registered for a user.")
    def get_user_authentication_methods(user_id: str) -> list[dict]:
        return graph.get_user_authentication_methods(user_id)

    @mcp.tool(description="Resolve a SharePoint site to canonical metadata and site id.")
    def resolve_site(hostname: str | None = None, site_path: str | None = None) -> dict:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        return resolve_site_record(resolved_hostname, resolved_site_path)

    @mcp.tool(description="List document libraries for a SharePoint site.")
    def list_drives(hostname: str | None = None, site_path: str | None = None) -> list[dict]:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        site = resolve_site_record(resolved_hostname, resolved_site_path)
        return graph.list_drives(site["id"])

    @mcp.tool(description="List items in the default Documents drive for a SharePoint site.")
    def list_folder_items(
        hostname: str | None = None,
        site_path: str | None = None,
        folder_path: str | None = None,
    ) -> list[dict]:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        site = resolve_site_record(resolved_hostname, resolved_site_path)
        return graph.list_folder_items(site["id"], folder_path)

    @mcp.tool(description="Create a folder in the site's default Documents drive.")
    def create_folder(
        folder_name: str,
        hostname: str | None = None,
        site_path: str | None = None,
        parent_folder_path: str | None = None,
        conflict_behavior: Literal["rename", "replace", "fail"] = "rename",
    ) -> dict:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        site = resolve_site_record(resolved_hostname, resolved_site_path)
        return graph.create_folder(
            site_id=site["id"],
            folder_name=folder_name,
            parent_folder_path=parent_folder_path,
            conflict_behavior=conflict_behavior,
        )

    @mcp.tool(
        description=(
            "Upload a UTF-8 text file to a SharePoint drive and optionally stamp item metadata."
        )
    )
    def upload_text_file(
        file_name: str,
        text_content: str,
        folder_path: str,
        hostname: str | None = None,
        site_path: str | None = None,
        drive_name_or_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        site = resolve_site_record(resolved_hostname, resolved_site_path)
        return graph.upload_text_file(
            site_id=site["id"],
            folder_path=folder_path,
            file_name=file_name,
            content=text_content,
            drive_name_or_id=drive_name_or_id,
            metadata=metadata,
        )

    @mcp.tool(
        description=(
            "Upload a control evidence file to the canonical Control Evidence library "
            "with required metadata prefilled."
        )
    )
    def upload_control_evidence_file(
        file_name: str,
        text_content: str,
        folder_path: str,
        governance_domain: str,
        control_family: str,
        hostname: str | None = None,
        site_path: str | None = None,
        control_owner_identifier: str | None = None,
        data_classification: Literal["Public", "Internal", "Confidential", "Restricted"] = "Internal",
        document_type: str = "Evidence",
        review_frequency: Literal["Monthly", "Quarterly", "Semi-Annual", "Annual"] = "Monthly",
        record_status: Literal["Draft", "Active", "Superseded", "Archived"] = "Draft",
        effective_date: str | None = None,
        next_review_date: str | None = None,
        drive_name_or_id: str = "Control Evidence",
    ) -> dict:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        site = resolve_site_record(resolved_hostname, resolved_site_path)
        owner_identifier = control_owner_identifier
        if not owner_identifier:
            accounts = auth.status().accounts
            if not accounts or not accounts[0].get("username"):
                raise RuntimeError(
                    "control_owner_identifier is required when no cached account username is available."
                )
            owner_identifier = accounts[0]["username"]

        if not effective_date:
            # Accept any ISO date embedded in the folder path so evidence-set names
            # do not need to follow the old project-phase convention.
            match = re.search(r"(20\d{2}-\d{2}-\d{2})", folder_path)
            effective_date = match.group(1) if match else date.today().isoformat()
        if not next_review_date:
            interval_days = {
                "Monthly": 30,
                "Quarterly": 90,
                "Semi-Annual": 182,
                "Annual": 365,
            }[review_frequency]
            next_review_date = (date.fromisoformat(effective_date) + timedelta(days=interval_days)).isoformat()

        owner_lookup_id = sp.resolve_site_user_id(
            resolved_hostname,
            resolved_site_path,
            owner_identifier,
        )
        metadata = {
            "Control_x0020_Family": control_family,
            "Control_x0020_OwnerLookupId": owner_lookup_id,
            "Data_x0020_Classification": data_classification,
            "Document_x0020_Type": document_type,
            "Effective_x0020_Date": effective_date,
            "Governance_x0020_Domain": governance_domain,
            "Next_x0020_Review_x0020_Date": next_review_date,
            "Record_x0020_Status": record_status,
            "Review_x0020_Frequency": review_frequency,
        }
        return graph.upload_text_file(
            site_id=site["id"],
            folder_path=folder_path,
            file_name=file_name,
            content=text_content,
            drive_name_or_id=drive_name_or_id,
            metadata=metadata,
        )

    @mcp.tool(description="Read SharePoint web metadata through the SharePoint REST API.")
    def get_web_info(hostname: str | None = None, site_path: str | None = None) -> dict:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        return sp.get_web_info(resolved_hostname, resolved_site_path)

    @mcp.tool(description="List SharePoint lists in the target site.")
    def list_lists(
        hostname: str | None = None,
        site_path: str | None = None,
        include_hidden: bool = False,
    ) -> list[dict]:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        return sp.list_lists(
            resolved_hostname,
            resolved_site_path,
            include_hidden=include_hidden,
        )

    @mcp.tool(description="List custom site columns defined on the SharePoint site.")
    def get_site_columns(
        hostname: str | None = None,
        site_path: str | None = None,
        include_hidden: bool = False,
    ) -> list[dict]:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        return sp.get_site_columns(
            resolved_hostname,
            resolved_site_path,
            include_hidden=include_hidden,
        )

    @mcp.tool(description="List columns for a specific SharePoint list by title or GUID.")
    def get_list_columns(
        list_name_or_id: str,
        hostname: str | None = None,
        site_path: str | None = None,
    ) -> list[dict]:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        return sp.get_list_columns(resolved_hostname, resolved_site_path, list_name_or_id)

    @mcp.tool(description="List site or list content types from SharePoint REST.")
    def get_content_types(
        scope: Literal["site", "list"] = "site",
        list_name_or_id: str | None = None,
        hostname: str | None = None,
        site_path: str | None = None,
    ) -> list[dict]:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        if scope == "site":
            return sp.get_site_content_types(resolved_hostname, resolved_site_path)
        if not list_name_or_id:
            raise RuntimeError("list_name_or_id is required when scope='list'.")
        return sp.get_list_content_types(
            resolved_hostname,
            resolved_site_path,
            list_name_or_id,
        )

    @mcp.tool(description="List items from a SharePoint list by title or GUID.")
    def get_list_items(
        list_name_or_id: str,
        top: int = 20,
        hostname: str | None = None,
        site_path: str | None = None,
    ) -> list[dict]:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        return sp.list_items(resolved_hostname, resolved_site_path, list_name_or_id, top=top)

    @mcp.tool(description="Update fields on a SharePoint list item by title or GUID.")
    def update_list_item_fields(
        list_name_or_id: str,
        item_id: int,
        fields: dict[str, Any],
        hostname: str | None = None,
        site_path: str | None = None,
    ) -> dict:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        return sp.update_list_item_fields(
            resolved_hostname,
            resolved_site_path,
            list_name_or_id,
            item_id,
            fields,
        )

    @mcp.tool(description="List SharePoint site groups and optionally expand user membership.")
    def get_sharepoint_groups(
        hostname: str | None = None,
        site_path: str | None = None,
        include_users: bool = True,
    ) -> list[dict]:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        return sp.get_site_groups(
            resolved_hostname,
            resolved_site_path,
            include_users=include_users,
        )

    @mcp.tool(description="List SharePoint role assignments for the site or for a specific list.")
    def get_role_assignments(
        scope: Literal["web", "list"] = "web",
        list_name_or_id: str | None = None,
        hostname: str | None = None,
        site_path: str | None = None,
    ) -> list[dict]:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        return sp.get_role_assignments(
            resolved_hostname,
            resolved_site_path,
            scope=scope,
            list_name_or_id=list_name_or_id,
        )

    @mcp.tool(description="List Microsoft Graph site permission objects for the resolved site.")
    def get_site_permissions(
        hostname: str | None = None,
        site_path: str | None = None,
    ) -> dict:
        resolved_hostname, resolved_site_path = resolve_target(hostname, site_path)
        site = resolve_site_record(resolved_hostname, resolved_site_path)
        return graph.get_site_permissions(site["id"])

    return mcp


def run_server() -> None:
    build_server().run("stdio")
