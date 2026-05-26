# OKR Follow-Up User Manual

## 1. Overview

OKR Follow-Up (Ventures) is used to manage ventures, departments, objectives, key results, KPIs, discussions, and reporting in one place.

The main areas are:

- `OKR Board` — day-to-day venture OKR work
- `Dashboard` — cross-venture reporting
- `Config` — setup and administration (Manager/Admin)
- `Activity` — audit log of changes (Manager/Admin)
- `Help` — searchable user guide (all users)

## 2. Signing In

1. Open the OKR Follow-Up site.
2. Click `Sign In with Microsoft`.
3. Use your Microsoft work account.
4. Wait for the app to load — it connects to SharePoint in the background.

The sidebar shows your signed-in account and SharePoint connection status at the bottom.

## 3. Roles

The app uses four role levels. An admin assigns roles in `Config > Roles`.

| Role | What they can do |
|---|---|
| **Admin** | Everything — including Config, Activity log, and role management |
| **Manager** | Config, Activity log, creating/editing all OKR items |
| **Editor** | Creating and editing OKR items they own |
| **Viewer** | Read-only access to the board and dashboard |

A default role can be set for users not explicitly listed. If no default is set, users who are not listed are treated as Viewers.

## 4. Navigation

The left sidebar links to:

- **OKR Board** — the main board
- **Dashboard** — reporting
- **Config** — configuration (Manager/Admin only)
- **Activity** — change log (Manager/Admin only)
- **Help** — this guide (all users)

The top bar shows:
- App switcher (Ventures / SVH)
- Notification bell (unread discussion count)

## 5. OKR Board Layout

The board is organized as:

1. Venture tabs across the top
2. Position/department sections inside the selected venture
3. Objectives inside each position
4. Key results under each objective
5. KPIs under each key result

## 6. Venture Tabs

Click a venture tab to switch the board to that venture.

Admins and Managers can:
- Add a venture (`Add Venture` button)
- Rename a venture (pen icon on the tab)
- Delete a venture (from the edit form)

## 7. Positions / Departments

Each venture contains one or more positions.

Each position header shows the position name, owner (if set), and objective count.

### 7.1 Adding a Position

1. Open the correct venture tab.
2. Click `Add Position`.
3. Enter the position name and optional owner.
4. Click `Add`.

### 7.2 Editing a Position

1. Hover the position name.
2. Click the pen icon.
3. Update fields and click `Save`.

Admins can also delete the position from the edit area.

## 8. Objectives

Each position shows an objectives table with columns for title, owner, type, health, RAG, progress, cycle, blockers, risks, notes, and last updated.

### 8.1 Adding Objectives

1. Expand the correct position.
2. Click `Add Objective`.
3. Fill in the fields (code is auto-generated).
4. Click `Save All`.

Use `Add More` to queue multiple objectives before saving.

### 8.2 Editing Objectives

1. Hover the objective row.
2. Click the pen icon.
3. Update the fields and click `Save`.

Editable fields: code, title, owner, type, health, progress %, cycle, blockers, risks, notes.

## 9. Key Results

Each objective has a collapsible `Key Results` section.

The key result table includes: title, owner, metric type, baseline, target, current, progress %, status, due date, check-in frequency, blockers, notes, last updated.

### 9.1 Adding Key Results

1. Expand the objective.
2. Open the `Key Results` section.
3. Click `Add Key Result`.
4. Fill in the fields and click `Save All`.

### 9.2 Editing Key Results

1. Hover the key result row.
2. Click the pen icon.
3. Update the fields and click `Save`.

## 10. KPIs

Each key result can have KPIs attached to it, shown as milestone-style rows below the KR.

Each KPI row shows: title, weight, target, current value, and a progress bar.

Click the pencil icon on a KPI row to edit it.

## 11. Discussions

Every objective and key result has a discussion thread. Click the chat icon on a row to open it.

- Type a message and press `Send`.
- Use `@email` to mention a user — they will receive an email notification.
- Messages are stored in SharePoint and visible to all users with board access.

The notification bell in the top bar shows unread discussion counts. Click it to see which items have new messages.

## 12. Dashboard

Open `Dashboard` from the sidebar.

### 12.1 Filters

Filter by venture or department. Click `Clear` to reset.

### 12.2 Summary

At the top: average progress card, objective progress breakdown, key result progress breakdown.

### 12.3 Venture Performance

A table per venture with:
- Objectives row: Count, On Track, At Risk, Off Track, Avg Progress
- Key Results row: same columns

### 12.4 Department Performance

Same structure, broken down by department.

## 13. Config

Visible to Managers and Admins. Contains tabs:

- `Roles` — manage user roles and default role
- `Field Options` — manage dropdown values
- `RAG Definition` — set progress thresholds
- `Ventures` — manage ventures and departments
- `Notifications` — configure reminders and send them manually

### 13.1 Roles Tab

**Assign a role:**
1. Enter the user's email (and optionally display name).
2. Choose a role (Admin / Manager / Editor / Viewer).
3. Click `Assign Role`.

**Remove a role:**
Click the × button next to the user in the list.

**Default role:**
Use the `Default role for unlisted users` dropdown to set a fallback role for anyone not explicitly listed. Choose `(none)` to treat unlisted users as Viewers.

### 13.2 Field Options Tab

Manage the dropdown values used in forms:

- Objective Type, Objective Health, OKR Cycle
- KR Metric Type, KR Status, Check-in Frequency

Add or remove values, then click `Save Dropdown Config`.

### 13.3 RAG Definition Tab

Set the thresholds for the RAG indicator:

- `Green Min (%)` — progress at or above this is Green
- `Amber Min (%)` — progress at or above this (but below Green) is Amber
- Below Amber Min is Red

Click `Save RAG`.

### 13.4 Ventures Tab

Add or delete ventures and their departments from this tab.

### 13.5 Notifications Tab

**Configure reminder rules:**
Each rule has a schedule (e.g., Weekly on Monday), a message template, and an enable/disable toggle. Click `Save Settings` after editing.

**Send reminders manually:**
1. Click `Send Reminders`.
2. Select the rules to apply.
3. Review or adjust recipients.
4. Preview the email content.
5. Click `Send`.

## 14. Activity Log

Visible to Managers and Admins. Shows a timeline of all changes made in the app.

Each entry shows: who made the change, what entity was affected, and when.

Click an entry to open a detail popup showing the current state of that item (title, status, progress, targets, etc.).

**Filters:**
- Period shortcuts: Today, 7 days, 30 days, or custom date range
- Entity type: objectives, key results, KPIs, etc.
- User email

**Insights panel:** shows a bar chart of activity by day, top active users, and entity type breakdown.

## 15. Help

Click the `?` icon in the sidebar to open the Help page.

Use the search box or category chips to find topics. Click a topic in the table of contents to jump to it.

## 16. Tips

- Use the board for daily work and inline updates.
- Use the dashboard for cross-venture reporting.
- Use discussions for context — @mention colleagues to notify them.
- Check the notification bell regularly for new discussion replies.
- Admins should assign roles via Config > Roles rather than sharing credentials.
- Review dropdown values in Config > Field Options before changing reporting expectations.

## 17. Troubleshooting

### 17.1 I cannot see Config or Activity

- You may not have Manager or Admin role.
- Ask an Admin to assign you a role in Config > Roles.

### 17.2 I cannot save changes

- Check the SharePoint status in the sidebar footer.
- Confirm you have the correct role for the action.
- Check that all required fields are filled.

### 17.3 A screen looks stale

1. Refresh the browser tab.
2. Re-open the venture tab.
3. Re-expand the section you were using.

### 17.4 I am not receiving mention notifications

- Confirm the @mention used your exact work email address.
- Check your junk/spam folder.
- Ask an Admin to verify the notification settings in Config > Notifications.

## 18. Quick Start

1. Sign in with Microsoft.
2. Open `OKR Board`.
3. Choose the correct venture tab.
4. Expand a position.
5. Add or edit objectives and key results if your role allows it.
6. Open `Dashboard` for reporting.
7. Open `Config` if you are a Manager or Admin.
8. Open `Help` at any time for guidance.
