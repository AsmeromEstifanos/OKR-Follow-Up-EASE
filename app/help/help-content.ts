export type HelpSection = {
  id: string;
  title: string;
  category: string;
  // Plain-text body. Newlines separate paragraphs; "- " lines render as bullets.
  body: string;
};

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "what-is-this",
    title: "What is this app for?",
    category: "Getting started",
    body: `OKR Follow-Up (Ventures) helps your organisation set goals and track progress toward them. "OKR" stands for Objectives and Key Results.

An Objective is something you want to achieve (e.g., "Grow the venture's customer base").
A Key Result is a measurable way to know you're getting there (e.g., "Sign 50 new customers this quarter").
A KPI (Key Performance Indicator) is an additional metric attached to an objective or key result — used for tracking specific numbers such as revenue, conversion rate, or headcount.

The app lets you create these goals, update your progress, discuss them with colleagues, and get email reminders so nothing slips through the cracks.`
  },
  {
    id: "signing-in",
    title: "Signing in",
    category: "Getting started",
    body: `When you open the app, click Sign in with Microsoft and use your normal work account (the same one you use for email and Teams). You won't need a separate password — it uses your company login.

Once you're signed in, your name appears at the bottom of the sidebar and you'll see everything you have permission to view.`
  },
  {
    id: "navigation",
    title: "Finding your way around",
    category: "Getting started",
    body: `On the left side of the screen is the sidebar menu. Hover over it (on a computer) or tap the Menu button (on a phone) to expand it. You'll see:

- Dashboard — a bird's-eye view of all goals and how they're progressing
- OKR Board — the main working area where you create and update goals
- Activity — a history of changes (visible to Managers and Admins)
- Config — settings for the app (visible to Admins only)
- Help — this guide

At the top of the main area is the app switcher (Ventures / SVH) and the notification bell. At the bottom of the sidebar you'll see your name, connection status, and the version number.`
  },
  {
    id: "okr-board",
    title: "The OKR Board",
    category: "Working with goals",
    body: `The OKR Board is where most of your work happens. It shows objectives grouped by venture and department, each with its key results and KPIs underneath.

For each objective you'll see its code and title, owner, a progress bar, a coloured RAG badge (red, amber or green), a chat bubble for discussions, and a warning icon if it hasn't been updated recently.

Filtering the view: Use the toolbar at the top to narrow down what you see — by venture, department, time period, owner, or status. This is handy when you only want to look at your own team's goals.

Expanding an objective: Click an objective card to reveal its key results and KPIs listed underneath.`
  },
  {
    id: "create-objective",
    title: "Creating an Objective",
    category: "Working with goals",
    body: `1. Click the Add Objective button (visible to Editors, Managers and Admins).
2. Fill in the form: Title, Description (optional), Venture, Department, Strategic Theme, OKR Cycle, Owner (name and email), Status and Type.
3. Click Save.

The app automatically gives your objective a code like "OBJ-001". A short progress bar will appear while it saves.

Note: Depending on your role, you may only be able to create or edit objectives that you own.`
  },
  {
    id: "add-key-results",
    title: "Adding Key Results",
    category: "Working with goals",
    body: `Under each objective there's an Add KR button. Key results are the measurable steps toward the objective.

1. Click Add KR beneath the objective.
2. Fill in the title, metric type, baseline value, target value, and owner.
3. Click Save.

The current value starts equal to the baseline. Update it over time to track progress. The progress percentage is calculated as how far the current value has moved from the baseline toward the target.`
  },
  {
    id: "kpis",
    title: "KPIs (Key Performance Indicators)",
    category: "Working with goals",
    body: `KPIs are additional metrics you can attach to an objective or key result. They work like a lightweight tracking row — a title, a target, and a current value — without the full structure of a key result.

To add a KPI: Click Add KPI beneath an objective or key result, fill in the title, target value, current value, and weight (importance weighting), then click Save.

KPIs appear as flat rows with a thin progress bar showing how close the current value is to the target. Click the pencil icon to edit a KPI's values.

Weight: If you assign weights to KPIs, the dashboard uses them to calculate a weighted overall progress score for the objective.`
  },
  {
    id: "update-progress",
    title: "Updating your progress",
    category: "Working with goals",
    body: `Keeping progress up to date is the whole point of the app. To update a key result:

1. On the OKR Board, click the key result row to open it for editing.
2. Update the Current value. The progress percentage recalculates automatically.
3. The change saves and the parent objective's progress bar updates.

To update a KPI, click the pencil icon on the KPI row and change the current value.

Key results with KPIs vs without: If a key result has KPIs under it, its progress is the weighted roll-up of those KPIs and its Current value is read-only — update the KPIs instead. If a key result has no KPIs, you score it directly: its Current value is editable and its progress is Current / Target.

Tip: Update your progress at least once a week. If a goal goes more than 7 days without an update during an active period, it gets flagged with a warning icon.`
  },
  {
    id: "rag-status",
    title: "Understanding the colours (RAG status)",
    category: "Working with goals",
    body: `Every objective shows a colour that tells you its health at a glance. This is called RAG status (Red, Amber, Green):

- Green — On track — typically 70% or more progress
- Amber — Needs attention — typically between 40% and 70%
- Red — At risk — typically below 40%

The exact thresholds can be adjusted by your Admin in Config > RAG, so they may differ slightly in your organisation.`
  },
  {
    id: "dashboard",
    title: "The Dashboard",
    category: "Working with goals",
    body: `The Dashboard gives you the big picture. Instead of editing individual goals, it summarises how everything is going: how many objectives are green, amber and red, average progress across teams, and a breakdown by venture and department.

Use the filters at the top to focus on a particular venture or department.

The KPI section shows KPIs with their progress bars and current vs target values, grouped by objective.`
  },
  {
    id: "discussions",
    title: "Discussions & chat",
    category: "Collaboration",
    body: `Every objective and every key result has its own discussion thread — like a mini chat room for that specific goal.

To open a discussion, click the chat bubble icon on any objective or key result row. A panel opens where you can read past messages, type a new message, and see who said what and when.

This is the place to discuss blockers, ask questions, or celebrate wins — all kept neatly attached to the relevant goal.`
  },
  {
    id: "mentions",
    title: "Mentioning colleagues",
    category: "Collaboration",
    body: `To get a colleague's attention in a discussion, mention them:

1. While typing a message, type the @ symbol.
2. A dropdown appears listing your colleagues.
3. Start typing their name and select them (use arrow keys + Enter, or click).
4. Their name is inserted into your message, highlighted in teal.

When you post the message, the people you mentioned receive an email notification with a preview of your message and a direct link to the discussion. This is the best way to make sure someone sees something important.`
  },
  {
    id: "notification-bell",
    title: "The notification bell",
    category: "Collaboration",
    body: `The bell icon at the top of the screen keeps you informed about discussions.

- A red number on the bell shows how many discussions have new messages you haven't read yet.
- Click the bell to open a list of all discussions, with unread ones at the top.
- Each item shows the latest message and how long ago it was posted.
- Click any item to jump straight to that discussion.

Once you open and read a discussion, it stops counting as unread.`
  },
  {
    id: "email-reminders",
    title: "Email reminders",
    category: "Reminders & AI",
    body: `The app can send helpful email reminders so you remember to keep your goals up to date. These are sent automatically on a schedule. There are five types:

- Weekly Digest — Monday morning — a summary of all your objectives
- End-of-Week Reflection — Friday afternoon — your objectives and key results, to review before the weekend
- Mid-Month Checkpoint — 15th of the month — only the goals that need attention (amber and red)
- Third-Week Focus — 22nd of the month — goals falling behind, so you can catch up before month-end
- Month-End Readiness — last working day — a full snapshot to make sure everything is up to date

Each run gathers all relevant reminders into one tidy email rather than flooding your inbox.

For Admins: You can also send these reminders manually at any time, choose which types to send, and pick who receives them — all from the Notifications tab in Config.`
  },
  {
    id: "ai-assistant",
    title: "The AI assistant",
    category: "Reminders & AI",
    body: `In the corner of the screen there's an AI chat assistant. You can ask it questions about your OKRs in plain English, such as:

- "Which of my objectives are behind schedule?"
- "Summarise the ventures team's progress this quarter."
- "What KPIs are still at zero?"

The assistant knows about your current goals and answers based on live data. It's a quick way to get insights without digging through the board yourself.`
  },
  {
    id: "activity-log",
    title: "Activity log (for Managers & Admins)",
    category: "For managers & admins",
    body: `If you're a Manager or Admin, you'll see an Activity menu item in the sidebar. This is a complete history of every change made in the app: who changed what and when, exactly which fields were updated (for example, "Current value changed from 40 to 85"), with filters by date range, entity type, and user.

Click any entry to open a detail popup. For objectives, key results, and KPIs, the popup shows the item's current fields exactly as they are now — title, owner, progress, values, status, dates, notes, and blockers — so you can see the full picture, not just what changed.

There's also an Insights panel showing activity trends, the most active users, and the most-changed goals.`
  },
  {
    id: "config",
    title: "Settings & configuration (for Admins)",
    category: "For managers & admins",
    body: `If you're an Admin, you'll see a Config menu item with several tabs:

- Roles — assign roles (Admin, Manager, Editor, Viewer) to individual users, and set a default role for everyone who hasn't been assigned one
- Field Options — customise the dropdown choices used in the forms (objective types, statuses, cycles, metric types, etc.)
- RAG — set the green/amber/red progress thresholds for your organisation
- Card Colors — change the background colours of the board cards
- Ventures — manage ventures and their departments (the organisational structure)
- Notifications — turn reminder emails on/off, change their schedules, edit their wording, and send them manually

Sending reminders manually: In the Notifications tab, click Send Reminders Now. Choose which types to send, pick recipients (and preview the exact email each person will get), then send.`
  },
  {
    id: "roles",
    title: "What you can do based on your role",
    category: "For managers & admins",
    body: `Your role determines what you're allowed to do. There are four roles:

- Viewer — look at everything, but cannot make any changes
- Editor — create and update only the objectives, key results, and KPIs that you own
- Manager — view everything, create any goal, update any goal, and see the Activity log
- Admin — everything, including Config, Roles, and sending reminders

If you're not sure what your role is, ask your Administrator. People who haven't been assigned a role get the default role chosen by the Admin (or are denied access if no default is set).`
  },
  {
    id: "ventures-structure",
    title: "Ventures & departments",
    category: "For managers & admins",
    body: `The app organises goals by Venture and Department. A Venture represents a business unit or initiative (e.g., "EASE Ventures"). Each Venture can have multiple Departments (e.g., "Finance", "Operations").

When you create an objective, you assign it to a Venture and a Department. This drives the filtering on the OKR Board and the grouping on the Dashboard.

Admins manage the list of Ventures and Departments in Config > Ventures. Adding or renaming a Venture or Department there makes it available in the dropdown on all forms.`
  },
  {
    id: "faq",
    title: "Frequently asked questions",
    category: "Help",
    body: `I can't create or edit a goal — why? Your role may not allow it. Editors can only edit goals they own; Viewers can't edit at all. Ask your Admin to check your role in Config > Roles.

A goal shows a warning icon. What does that mean? It hasn't been updated in over a week during an active period. Open it and update the current value to clear the warning.

Why didn't I get a reminder email? Reminders only go to people who own active objectives or key results. If you don't own any active goals you won't be on the list. Also check your spam folder.

I mentioned someone but they say they didn't get an email. Make sure you selected them from the @ dropdown so their name appears highlighted. Ask them to check their spam folder too.

The progress percentage looks wrong. Progress is calculated as how far the current value has moved from the baseline toward the target. Double-check the baseline, target, and current values are correct.

How are colours (red/amber/green) decided? Automatically, based on the progress percentage. Your Admin sets the exact thresholds in Config > RAG.

Can I change someone else's goal? Only if you're a Manager or Admin. Editors can only change goals they own.

What's the difference between a Key Result and a KPI? A Key Result is a primary measurable step toward an objective. A KPI is a lighter tracking metric — useful for secondary numbers you want to monitor alongside the main goal, with a weight that feeds the overall progress calculation.`
  }
];

export const HELP_CATEGORIES: string[] = Array.from(
  new Set(HELP_SECTIONS.map((section) => section.category))
);
