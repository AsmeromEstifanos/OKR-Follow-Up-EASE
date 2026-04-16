# SharePoint Admin MCP

Local MCP server for SharePoint governance inspection. It uses:

- Microsoft Graph for site resolution and default document library file operations
- Microsoft Graph for Microsoft Entra role, user, authentication-method, and Conditional Access reads
- SharePoint REST for lists, columns, content types, site groups, and role assignments
- MSAL device-code login with a local token cache

## What It Can Do

- Resolve a site and list document libraries
- Browse, create folders, and upload text files in the default `Documents` drive or a named drive, with optional metadata stamping
- Upload control evidence through a standard template that pre-fills required metadata
- List Entra users, activated directory roles, role assignments, and role members
- Read PIM role assignment and eligibility schedules and requests
- Read Secure Score snapshots
- Read risky users and risky service principals
- Read Conditional Access policies
- Read a user's registered authentication methods
- List SharePoint lists
- Read site columns and list columns
- Read site and list content types
- Read site groups and role assignments
- Read site permission objects from Microsoft Graph

## Azure App Registration

Create a single-tenant Microsoft Entra app registration and configure it like this:

1. Name: `SharePoint Admin MCP`
2. Supported account types: single tenant
3. Authentication:
   - Enable `Allow public client flows`
4. API permissions:
   - Microsoft Graph delegated:
     - `User.Read`
     - `Sites.Read.All`
     - `Sites.ReadWrite.All`
     - `Sites.FullControl.All`
     - `Directory.Read.All`
     - `RoleManagement.Read.Directory`
     - `RoleManagement.ReadWrite.Directory`
     - `RoleAssignmentSchedule.ReadWrite.Directory`
     - `RoleAssignmentSchedule.Remove.Directory`
     - `Policy.Read.All`
     - `UserAuthenticationMethod.Read.All`
     - `SecurityEvents.Read.All`
     - `IdentityRiskyUser.Read.All`
     - `IdentityRiskyServicePrincipal.Read.All`
   - SharePoint delegated:
     - `AllSites.FullControl`
5. Grant admin consent after adding the permissions.

These defaults are intentionally broad because you asked for full access. If you later want a read-only profile, reduce the scopes in `.env`. The MCP omits reserved scopes like `offline_access` from runtime token requests.

## Configuration

Copy `.env.example` to `.env` and fill in your values.

Example:

```env
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SHAREPOINT_HOSTNAME=easeint1.sharepoint.com
SHAREPOINT_SITE_PATH=/sites/svh-governance
GRAPH_ADMIN_SCOPES=User.Read,Directory.Read.All,RoleManagement.Read.Directory,RoleManagement.ReadWrite.Directory,RoleAssignmentSchedule.ReadWrite.Directory,RoleAssignmentSchedule.Remove.Directory,Policy.Read.All,UserAuthenticationMethod.Read.All,SecurityEvents.Read.All,IdentityRiskyUser.Read.All,IdentityRiskyServicePrincipal.Read.All
```

## Login

Run these commands from the workspace root:

```powershell
python -m sharepoint_admin_mcp login --resource graph
python -m sharepoint_admin_mcp login --resource graph-admin
python -m sharepoint_admin_mcp login --resource sharepoint --hostname easeint1.sharepoint.com
```

The device-code flow prints a code and verification URL in the terminal. Complete both sign-ins once. Tokens are cached in `sharepoint_admin_mcp/.token_cache.bin`.

## Run The MCP Server

```powershell
python -m sharepoint_admin_mcp serve
```

## Useful Commands

Show config and cache status:

```powershell
python -m sharepoint_admin_mcp status
```

Install dependencies explicitly if needed:

```powershell
python -m pip install -r sharepoint_admin_mcp/requirements.txt
```

## MCP Client Snippet

Use this pattern in an MCP client config:

```json
{
  "mcpServers": {
    "sharepoint-admin": {
      "command": "python",
      "args": ["-m", "sharepoint_admin_mcp", "serve"],
      "cwd": "d:\\EASE\\Microsoft Ownership"
    }
  }
}
```

## Implemented Tools

- `auth_status`
- `resolve_site`
- `list_users`
- `list_directory_roles`
- `get_directory_role_members`
- `list_directory_role_definitions`
- `list_directory_role_assignments`
- `list_role_assignment_schedule_requests`
- `list_role_assignment_schedules`
- `list_role_assignment_schedule_instances`
- `list_role_eligibility_schedule_requests`
- `list_role_eligibility_schedules`
- `list_role_eligibility_schedule_instances`
- `list_secure_scores`
- `list_risky_users`
- `list_risky_service_principals`
- `list_conditional_access_policies`
- `get_user_authentication_methods`
- `list_drives`
- `list_folder_items`
- `create_folder`
- `upload_text_file` with optional `drive_name_or_id` and `metadata`
- `upload_control_evidence_file`
- `get_web_info`
- `list_lists`
- `get_site_columns`
- `get_list_columns`
- `get_content_types`
- `get_list_items`
- `get_sharepoint_groups`
- `get_role_assignments`
- `get_site_permissions`
