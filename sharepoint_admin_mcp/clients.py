from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote
import uuid

import requests

from .auth import MicrosoftAuthClient
from .config import Settings


class SharePointRequestError(RuntimeError):
    """Raised when Microsoft Graph or SharePoint REST returns an error."""


def _looks_like_guid(value: str) -> bool:
    try:
        uuid.UUID(value.strip("{}"))
        return True
    except ValueError:
        return False


def _strip_odata(payload: Any) -> Any:
    if isinstance(payload, dict) and "value" in payload:
        return payload["value"]
    return payload


@dataclass(slots=True)
class GraphClient:
    settings: Settings
    auth: MicrosoftAuthClient
    base_url: str = field(init=False)
    session: requests.Session = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self.base_url = "https://graph.microsoft.com/v1.0"
        self.session = requests.Session()

    def resolve_site(self, hostname: str, site_path: str) -> dict:
        path = quote(site_path, safe="/")
        return self._request_json("GET", f"/sites/{hostname}:{path}")

    def list_users(self, top: int = 999) -> list[dict]:
        return self._collect(
            "GET",
            "/users",
            params={
                "$top": str(top),
                "$select": "id,displayName,userPrincipalName,mail,accountEnabled,userType",
            },
            admin_token=True,
        )

    def list_directory_roles(self) -> list[dict]:
        return self._collect(
            "GET",
            "/directoryRoles",
            params={"$select": "id,displayName,description,roleTemplateId"},
            admin_token=True,
        )

    def get_directory_role_members(self, role_id: str) -> list[dict]:
        return self._collect(
            "GET",
            f"/directoryRoles/{role_id}/members",
            params={"$select": "id,displayName,userPrincipalName,mail"},
            admin_token=True,
        )

    def list_directory_role_definitions(self) -> list[dict]:
        return self._collect(
            "GET",
            "/roleManagement/directory/roleDefinitions",
            params={"$select": "id,displayName,description,isBuiltIn,isEnabled"},
            admin_token=True,
        )

    def list_directory_role_assignments(self) -> list[dict]:
        return self._collect(
            "GET",
            "/roleManagement/directory/roleAssignments",
            params={"$select": "id,principalId,roleDefinitionId,directoryScopeId"},
            admin_token=True,
        )

    def list_role_assignment_schedule_requests(self) -> list[dict]:
        return self._collect(
            "GET",
            "/roleManagement/directory/roleAssignmentScheduleRequests",
            admin_token=True,
        )

    def list_role_assignment_schedules(self) -> list[dict]:
        return self._collect(
            "GET",
            "/roleManagement/directory/roleAssignmentSchedules",
            admin_token=True,
        )

    def list_role_assignment_schedule_instances(self) -> list[dict]:
        return self._collect(
            "GET",
            "/roleManagement/directory/roleAssignmentScheduleInstances",
            admin_token=True,
        )

    def list_role_eligibility_schedule_requests(self) -> list[dict]:
        return self._collect(
            "GET",
            "/roleManagement/directory/roleEligibilityScheduleRequests",
            admin_token=True,
        )

    def list_role_eligibility_schedules(self) -> list[dict]:
        return self._collect(
            "GET",
            "/roleManagement/directory/roleEligibilitySchedules",
            admin_token=True,
        )

    def list_role_eligibility_schedule_instances(self) -> list[dict]:
        return self._collect(
            "GET",
            "/roleManagement/directory/roleEligibilityScheduleInstances",
            admin_token=True,
        )

    def list_conditional_access_policies(self) -> list[dict]:
        return self._collect(
            "GET",
            "/identity/conditionalAccess/policies",
            admin_token=True,
        )

    def list_secure_scores(self, top: int = 20) -> list[dict]:
        return self._collect(
            "GET",
            "/security/secureScores",
            params={"$top": str(top)},
            admin_token=True,
        )

    def get_latest_secure_score(self) -> dict:
        payload = self._request_json(
            "GET",
            "/security/secureScores",
            params={"$top": "1"},
            admin_token=True,
        )
        values = _strip_odata(payload)
        if isinstance(values, list):
            return values[0] if values else {}
        return values

    def list_risky_users(self, top: int = 100) -> list[dict]:
        return self._collect(
            "GET",
            "/identityProtection/riskyUsers",
            params={"$top": str(top)},
            admin_token=True,
        )

    def list_risky_service_principals(self, top: int = 100) -> list[dict]:
        return self._collect(
            "GET",
            "/identityProtection/riskyServicePrincipals",
            params={"$top": str(top)},
            admin_token=True,
        )

    def get_user_authentication_methods(self, user_id: str) -> list[dict]:
        return self._collect(
            "GET",
            f"/users/{user_id}/authentication/methods",
            admin_token=True,
        )

    def update_list_item_fields(
        self,
        site_id: str,
        list_id: str,
        item_id: int,
        fields: dict[str, Any],
    ) -> dict:
        endpoint = f"/sites/{site_id}/lists/{list_id}/items/{item_id}/fields"
        return self._request_json("PATCH", endpoint, json=fields)

    def list_drives(self, site_id: str) -> list[dict]:
        return self._collect("GET", f"/sites/{site_id}/drives")

    def list_folder_items(self, site_id: str, folder_path: str | None = None) -> list[dict]:
        if folder_path:
            path = quote(folder_path.strip("/"), safe="/")
            endpoint = f"/sites/{site_id}/drive/root:/{path}:/children"
        else:
            endpoint = f"/sites/{site_id}/drive/root/children"
        return self._collect("GET", endpoint)

    def create_folder(
        self,
        site_id: str,
        folder_name: str,
        parent_folder_path: str | None = None,
        conflict_behavior: str = "rename",
    ) -> dict:
        if parent_folder_path:
            path = quote(parent_folder_path.strip("/"), safe="/")
            endpoint = f"/sites/{site_id}/drive/root:/{path}:/children"
        else:
            endpoint = f"/sites/{site_id}/drive/root/children"
        body = {
            "name": folder_name,
            "folder": {},
            "@microsoft.graph.conflictBehavior": conflict_behavior,
        }
        return self._request_json("POST", endpoint, json=body)

    def get_drive(self, site_id: str, drive_name_or_id: str) -> dict:
        target = drive_name_or_id.strip().casefold()
        for drive in self.list_drives(site_id):
            drive_id = str(drive.get("id", "")).strip().casefold()
            drive_name = str(drive.get("name", "")).strip().casefold()
            if target in {drive_id, drive_name}:
                return drive
        raise SharePointRequestError(
            f"Could not resolve drive '{drive_name_or_id}' for site '{site_id}'."
        )

    def upload_text_file(
        self,
        site_id: str,
        folder_path: str,
        file_name: str,
        content: str,
        drive_name_or_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict:
        relative_path = "/".join(part.strip("/") for part in [folder_path, file_name] if part)
        drive_id: str | None = None
        if drive_name_or_id:
            drive = self.get_drive(site_id, drive_name_or_id)
            drive_id = str(drive.get("id"))
            endpoint = f"/sites/{site_id}/drives/{drive_id}/root:/{quote(relative_path, safe='/')}:/content"
        else:
            endpoint = f"/sites/{site_id}/drive/root:/{quote(relative_path, safe='/')}:/content"
        uploaded = self._request_json(
            "PUT",
            endpoint,
            data=content.encode("utf-8"),
            headers={"Content-Type": "text/plain; charset=utf-8"},
        )
        if metadata:
            resolved_drive_id = drive_id or str(uploaded.get("parentReference", {}).get("driveId", ""))
            item_id = str(uploaded.get("id", ""))
            if not resolved_drive_id or not item_id:
                raise SharePointRequestError(
                    "Upload succeeded but did not return drive/item identifiers for metadata stamping."
                )
            uploaded["metadata_update"] = self.update_drive_item_fields(
                resolved_drive_id,
                item_id,
                metadata,
            )
        return uploaded

    def update_drive_item_fields(
        self,
        drive_id: str,
        item_id: str,
        fields: dict[str, Any],
    ) -> dict:
        endpoint = f"/drives/{drive_id}/items/{item_id}/listItem/fields"
        return self._request_json("PATCH", endpoint, json=fields)

    def get_site_permissions(self, site_id: str) -> dict:
        return self._request_json("GET", f"/sites/{site_id}/permissions")

    def _collect(
        self,
        method: str,
        endpoint: str,
        *,
        params: dict | None = None,
        admin_token: bool = False,
    ) -> list[dict]:
        data = self._request_json(method, endpoint, params=params, admin_token=admin_token)
        items = list(_strip_odata(data))
        next_link = data.get("@odata.nextLink")
        while next_link:
            page = self._request_absolute("GET", next_link, admin_token=admin_token)
            items.extend(_strip_odata(page))
            next_link = page.get("@odata.nextLink")
        return items

    def _request_json(
        self,
        method: str,
        endpoint: str,
        *,
        params: dict | None = None,
        json: dict | None = None,
        data: bytes | None = None,
        headers: dict[str, str] | None = None,
        admin_token: bool = False,
    ) -> dict:
        url = f"{self.base_url}{endpoint}"
        return self._request_absolute(
            method,
            url,
            params=params,
            json=json,
            data=data,
            headers=headers,
            admin_token=admin_token,
        )

    def _request_absolute(
        self,
        method: str,
        url: str,
        *,
        params: dict | None = None,
        json: dict | None = None,
        data: bytes | None = None,
        headers: dict[str, str] | None = None,
        admin_token: bool = False,
    ) -> dict:
        token = (
            self.auth.acquire_graph_admin_token()
            if admin_token
            else self.auth.acquire_graph_token()
        )
        request_headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }
        if headers:
            request_headers.update(headers)
        response = self.session.request(
            method=method,
            url=url,
            params=params,
            json=json,
            data=data,
            headers=request_headers,
            timeout=self.settings.timeout_seconds,
        )
        if response.status_code >= 400:
            raise SharePointRequestError(self._format_error("Microsoft Graph", response))
        if response.status_code == 204:
            return {}
        return response.json()

    @staticmethod
    def _format_error(service: str, response: requests.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            payload = response.text
        return f"{service} {response.status_code}: {payload}"


@dataclass(slots=True)
class SharePointRestClient:
    settings: Settings
    auth: MicrosoftAuthClient
    session: requests.Session = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self.session = requests.Session()

    def get_web_info(self, hostname: str, site_path: str) -> dict:
        return self._request_json(
            hostname,
            site_path,
            "GET",
            "/web",
            params={"$select": "Id,Title,Url,WebTemplate,Language"},
        )

    def list_lists(self, hostname: str, site_path: str, include_hidden: bool = False) -> list[dict]:
        params = {
            "$select": ",".join(
                [
                    "Id",
                    "Title",
                    "Hidden",
                    "BaseTemplate",
                    "ItemCount",
                    "EnableVersioning",
                    "ContentTypesEnabled",
                    "RootFolder/ServerRelativeUrl",
                ]
            ),
            "$expand": "RootFolder",
        }
        if not include_hidden:
            params["$filter"] = "Hidden eq false"
        data = self._request_json(hostname, site_path, "GET", "/web/lists", params=params)
        return _strip_odata(data)

    def get_site_columns(
        self, hostname: str, site_path: str, include_hidden: bool = False
    ) -> list[dict]:
        params = {
            "$select": ",".join(
                [
                    "Id",
                    "Title",
                    "InternalName",
                    "StaticName",
                    "TypeAsString",
                    "Required",
                    "Hidden",
                    "Group",
                    "ReadOnlyField",
                    "Sealed",
                    "FromBaseType",
                ]
            )
        }
        if not include_hidden:
            params["$filter"] = "Hidden eq false and FromBaseType eq false"
        data = self._request_json(hostname, site_path, "GET", "/web/fields", params=params)
        return _strip_odata(data)

    def get_list_columns(self, hostname: str, site_path: str, list_name_or_id: str) -> list[dict]:
        endpoint = f"{self._list_endpoint(list_name_or_id)}/fields"
        params = {
            "$select": ",".join(
                [
                    "Id",
                    "Title",
                    "InternalName",
                    "StaticName",
                    "TypeAsString",
                    "Required",
                    "Hidden",
                    "ReadOnlyField",
                    "Sealed",
                ]
            )
        }
        data = self._request_json(hostname, site_path, "GET", endpoint, params=params)
        return _strip_odata(data)

    def get_site_content_types(self, hostname: str, site_path: str) -> list[dict]:
        params = {"$select": "Name,StringId,Description,Group,Hidden,ReadOnly,Sealed"}
        data = self._request_json(
            hostname, site_path, "GET", "/web/contenttypes", params=params
        )
        return _strip_odata(data)

    def get_list_content_types(
        self, hostname: str, site_path: str, list_name_or_id: str
    ) -> list[dict]:
        endpoint = f"{self._list_endpoint(list_name_or_id)}/contenttypes"
        params = {"$select": "Name,StringId,Description,Group,Hidden,ReadOnly,Sealed"}
        data = self._request_json(hostname, site_path, "GET", endpoint, params=params)
        return _strip_odata(data)

    def list_items(
        self, hostname: str, site_path: str, list_name_or_id: str, top: int = 20
    ) -> list[dict]:
        endpoint = f"{self._list_endpoint(list_name_or_id)}/items"
        params = {"$top": str(top)}
        data = self._request_json(hostname, site_path, "GET", endpoint, params=params)
        return _strip_odata(data)

    def update_list_item_fields(
        self,
        hostname: str,
        site_path: str,
        list_name_or_id: str,
        item_id: int,
        fields: dict[str, Any],
    ) -> dict:
        endpoint = f"{self._list_endpoint(list_name_or_id)}/items({item_id})/ValidateUpdateListItem"
        form_values = [
            {"FieldName": field_name, "FieldValue": field_value}
            for field_name, field_value in fields.items()
        ]
        return self._request_json(
            hostname,
            site_path,
            "POST",
            endpoint,
            json={
                "formValues": form_values,
                "bNewDocumentUpdate": False,
            },
        )

    def get_site_groups(
        self, hostname: str, site_path: str, include_users: bool = True
    ) -> list[dict]:
        params = {
            "$select": "Id,Title,Description,OnlyAllowMembersViewMembership,AllowMembersEditMembership,AllowRequestToJoinLeave"
        }
        if include_users:
            params["$expand"] = "Users"
        data = self._request_json(hostname, site_path, "GET", "/web/sitegroups", params=params)
        return _strip_odata(data)

    def get_site_users(self, hostname: str, site_path: str) -> list[dict]:
        params = {"$select": "Id,Title,Email,LoginName,IsSiteAdmin"}
        data = self._request_json(hostname, site_path, "GET", "/web/siteusers", params=params)
        return _strip_odata(data)

    def resolve_site_user_id(self, hostname: str, site_path: str, user_identifier: str) -> int:
        target = user_identifier.strip().casefold()
        for user in self.get_site_users(hostname, site_path):
            candidates = {
                str(user.get("Email", "")).strip().casefold(),
                str(user.get("LoginName", "")).strip().casefold(),
                str(user.get("Title", "")).strip().casefold(),
            }
            if target in candidates:
                try:
                    return int(user["Id"])
                except (KeyError, TypeError, ValueError) as exc:
                    raise SharePointRequestError(
                        f"Resolved site user '{user_identifier}' but the response did not include a valid Id."
                    ) from exc
        raise SharePointRequestError(
            f"Could not resolve site user '{user_identifier}' in the target site."
        )

    def get_role_assignments(
        self,
        hostname: str,
        site_path: str,
        scope: str = "web",
        list_name_or_id: str | None = None,
    ) -> list[dict]:
        if scope == "web":
            endpoint = "/web/roleassignments"
        elif scope == "list":
            if not list_name_or_id:
                raise RuntimeError("list_name_or_id is required when scope='list'.")
            endpoint = f"{self._list_endpoint(list_name_or_id)}/roleassignments"
        else:
            raise RuntimeError("scope must be 'web' or 'list'.")
        params = {"$expand": "Member,RoleDefinitionBindings"}
        data = self._request_json(hostname, site_path, "GET", endpoint, params=params)
        return _strip_odata(data)

    def _list_endpoint(self, list_name_or_id: str) -> str:
        if _looks_like_guid(list_name_or_id):
            list_id = list_name_or_id.strip("{}")
            return f"/web/lists(guid'{list_id}')"
        escaped = list_name_or_id.replace("'", "''")
        return f"/web/lists/getbytitle('{escaped}')"

    def _request_json(
        self,
        hostname: str,
        site_path: str,
        method: str,
        endpoint: str,
        *,
        params: dict | None = None,
        json: dict | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict:
        token = self.auth.acquire_sharepoint_token(hostname)
        url = f"https://{hostname}{site_path}/_api{endpoint}"
        request_headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json;odata=nometadata",
        }
        if json is not None:
            request_headers["Content-Type"] = "application/json;odata=nometadata"
        if headers:
            request_headers.update(headers)
        response = self.session.request(
            method=method,
            url=url,
            params=params,
            json=json,
            headers=request_headers,
            timeout=self.settings.timeout_seconds,
        )
        if response.status_code >= 400:
            raise SharePointRequestError(
                f"SharePoint REST {response.status_code}: "
                f"{self._response_payload(response)}"
            )
        if response.status_code == 204:
            return {}
        return response.json()

    @staticmethod
    def _response_payload(response: requests.Response) -> str:
        try:
            return str(response.json())
        except ValueError:
            return response.text
