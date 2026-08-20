# Pulse Platform — Comprehensive Implementation Plan

**Status:** Initial engineering blueprint  
**Product name:** Pulse  
**Primary user:** Single-user first, multi-user capable later  
**Primary agent integration:** Hermes via MCP  
**Primary interfaces:** Next.js web app, React Native / Expo mobile app, native iOS + Android widgets  
**Backend:** API-first, PostgreSQL-backed  
**Core design principle:** Pulse owns task state. Hermes is an intelligent client, never the source of truth.

---

# 1. Product Vision

Pulse is a personal task-management platform inspired by Todoist, but designed from the beginning to work as both:

1. A high-quality standalone task manager across web and mobile.
2. A structured execution layer that an AI agent such as Hermes can fully operate through MCP.

Pulse should feel polished enough to replace Todoist for everyday use while exposing every important user action through a clean, semantic API and MCP surface.

The long-term goal is for Pulse to become one component of a broader personal software platform in which Hermes acts as the conversational orchestration layer across tasks, finance, files, home-server services, and future personal applications.

Pulse should therefore be built as a proper independent application, not as a Hermes plugin.

---

# 2. Core Architectural Principle

All clients are peers.

```text
                         ┌────────────────────┐
                         │      Pulse API     │
                         │  source of truth   │
                         └─────────┬──────────┘
                                   │
                              PostgreSQL
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
  Next.js Web App           React Native App             Pulse MCP
                               (Expo)                      Server
        │                          │                          │
        │                   ┌──────┴──────┐                   ▼
        │                   ▼             ▼                 Hermes
        │                iOS Widget   Android Widget          │
        │                   │             │                   ▼
        └───────────────────┴─────────────┴────────────── Telegram
```

Rules:

- The web app never talks directly to PostgreSQL.
- The mobile app never talks directly to PostgreSQL.
- Hermes never talks directly to PostgreSQL.
- Widgets never talk directly to PostgreSQL.
- All mutations go through Pulse business logic exposed by the Pulse API.
- MCP is a semantic adapter around the Pulse API.
- Hermes memory must never replace durable Pulse state.

---

# 3. Product Goals

Pulse V1 should support most of the task-management workflows that make Todoist useful:

- Inbox
- Today
- Upcoming
- Projects
- Sections
- Tasks
- Subtasks
- Labels/tags
- Priorities
- Start dates
- Due dates
- Recurring tasks
- Reminders
- Search
- Filters
- Task comments / notes
- Task completion and reopening
- Completed-task history
- Activity history
- Drag-and-drop ordering
- Bulk operations
- Keyboard-driven web workflow
- Mobile-native capture and management
- Home-screen widgets
- Offline-friendly mobile behavior
- Notifications
- MCP access for Hermes

Long-term extensions may include:

- Shared projects
- Multi-user support
- Natural-language scheduling
- Calendar integration
- Personal planning / Focus mode
- Goal tracking
- Time estimates
- Energy/context fields
- AI-assisted prioritization
- Event-driven cross-application workflows
- Voice-first task capture through Hermes

---

# 4. Non-Goals for Initial V1

Do not initially build:

- Corporate team-management workflows
- Kanban as the primary interface
- Sprints
- Story points
- Complex permissions
- Enterprise RBAC
- Chat inside projects
- Generic plugin framework
- Arbitrary user-created database schemas
- AI scheduling directly inside Pulse backend
- Agent access to raw SQL or shell commands

Pulse should remain a deterministic task platform. Intelligence lives primarily in Hermes.

---

# 5. Recommended Technology Stack

## 5.1 Web

**Framework:** Next.js  
**Language:** TypeScript  
**Rendering:** App Router  
**Styling:** Tailwind CSS  
**UI primitives:** shadcn/ui or Radix-based components  
**Client state / server cache:** TanStack Query  
**Forms:** React Hook Form  
**Validation:** Zod  
**Drag/drop:** dnd-kit  
**Command palette:** cmdk or equivalent

The web interface should be desktop-first and optimized for:

- Keyboard shortcuts
- Dense task lists
- Fast navigation
- Context menus
- Drag-and-drop
- Multi-pane layouts
- URL-addressable projects/views/filters
- Responsive tablet layouts

The existing Todoist clone repository can be used as a visual and feature reference:

`https://github.com/kulkarniankita/todoist-clone-todovex`

Do not make Pulse architecturally dependent on that repository.

---

## 5.2 Mobile

**Framework:** React Native  
**Toolchain:** Expo  
**Routing:** Expo Router  
**Language:** TypeScript  
**State / network cache:** TanStack Query  
**Local storage:** SQLite or a local persistence layer compatible with Expo  
**Secure token storage:** Expo SecureStore  
**Notifications:** Expo Notifications initially; native enhancements if needed  
**Gestures:** React Native Gesture Handler  
**Animation:** Reanimated

The mobile app should be mobile-native rather than a compressed desktop UI.

Primary mobile workflows:

- Quick capture
- Today
- Inbox triage
- Complete/reschedule
- Project navigation
- Search
- Notifications/reminders
- Share-sheet capture
- Widgets
- Offline access

---

## 5.3 Widgets

Widgets should share **data models and business rules**, not necessarily rendering code.

### iOS
- WidgetKit
- SwiftUI
- App Groups for shared state
- App Intents for interaction/configuration

### Android
- AppWidget
- Jetpack Glance
- Native widget configuration
- Android-supported interaction model

Shared package:

```text
packages/widget-core/
├── types.ts
├── filters.ts
├── sort.ts
├── config.ts
├── snapshot.ts
└── theme.ts
```

Platform renderers:

```text
apps/mobile/ios/PulseWidget/
apps/mobile/android/PulseWidget/
```

Widget renderers should be intentionally thin.

---

## 5.4 Backend

Recommended options:

### Preferred TypeScript path
- NestJS or Fastify
- TypeScript
- PostgreSQL
- Drizzle ORM or Prisma
- Zod where appropriate

### Preferred Python path
- FastAPI
- PostgreSQL
- SQLAlchemy
- Pydantic

Either is acceptable.

For maximum shared typing with the frontend, TypeScript is attractive.

For very fast API development and future Python-heavy integration work, FastAPI is attractive.

The critical requirement is not language choice; it is maintaining a clean HTTP API contract.

---

## 5.5 Database

**PostgreSQL**

Reasons:

- Strong relational model
- Excellent transaction guarantees
- Good JSONB support
- Mature migrations
- Full-text search options
- Suitable for long-term event history
- Easy to self-host

---

## 5.6 API Contract

Use standard HTTP/JSON.

Generate an OpenAPI schema.

Generate a TypeScript API client used by:

- Next.js
- React Native
- Pulse MCP
- tests
- future clients

Avoid making the primary backend contract dependent on tRPC.

---

# 6. Monorepo Structure

Recommended:

```text
pulse/
├── apps/
│   ├── web/                  # Next.js web app
│   ├── mobile/               # React Native / Expo
│   ├── api/                  # Pulse backend API
│   ├── mcp/                  # Hermes-facing MCP server
│   └── worker/               # reminders, recurrence, background jobs
│
├── packages/
│   ├── api-client/           # generated/shared HTTP client
│   ├── domain/               # pure task/business domain helpers
│   ├── types/                # shared application types
│   ├── schemas/              # Zod/shared validation where relevant
│   ├── date-utils/           # recurrence/date utilities
│   ├── widget-core/          # widget model/config/sorting
│   ├── design-tokens/        # colors, spacing, typography tokens
│   └── test-utils/
│
├── infra/
│   ├── docker/
│   ├── nginx/
│   ├── compose/
│   └── migrations/
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── mcp.md
│   ├── database.md
│   ├── mobile.md
│   └── widgets.md
│
├── scripts/
├── docker-compose.yml
├── package.json
└── README.md
```

Use pnpm workspaces and optionally Turborepo.

---

# 7. Core Domain Model

## 7.1 User

Build single-user first but include `user_id` in all user-owned tables.

```text
users
- id
- email
- display_name
- timezone
- created_at
- updated_at
```

Do not hard-code singleton assumptions into the schema.

---

## 7.2 Task

Recommended task fields:

```text
tasks
- id
- user_id
- project_id nullable
- section_id nullable
- parent_task_id nullable

- title
- description nullable

- status
- priority

- start_at nullable
- due_at nullable
- due_timezone nullable
- all_day boolean

- estimated_minutes nullable
- energy nullable

- sort_order
- source

- created_at
- updated_at
- completed_at nullable
- cancelled_at nullable
- deleted_at nullable
```

Suggested status enum:

```text
inbox
todo
in_progress
done
cancelled
```

Suggested priority enum:

```text
none
low
medium
high
urgent
```

Suggested source enum:

```text
web
mobile
widget
hermes
api
automation
import
```

---

# 8. Project Model

```text
projects
- id
- user_id
- name
- description nullable
- color nullable
- icon nullable
- status
- sort_order
- created_at
- updated_at
- archived_at nullable
```

Possible statuses:

```text
active
archived
completed
```

Projects should remain lightweight.

Examples:

- Personal AI Platform
- Pulse
- Finance
- Home Server
- Travel
- Admin

---

# 9. Sections

Sections group tasks inside projects.

```text
sections
- id
- project_id
- name
- sort_order
- created_at
- updated_at
```

Example:

```text
Project: Pulse

Backlog
In Progress
Polish
Later
```

Sections should not replace project structure.

---

# 10. Subtasks

Subtasks are ordinary tasks using:

```text
parent_task_id
```

Do not create a separate subtask table.

Support arbitrary nesting only if implementation complexity remains acceptable. Otherwise cap UI nesting depth while preserving a generic parent relationship.

---

# 11. Labels / Tags

```text
labels
- id
- user_id
- name
- color nullable
- created_at

task_labels
- task_id
- label_id
```

Suggested examples:

```text
#coding
#server
#shopping
#deep-work
#5min
#waiting
#errand
```

Projects answer **where does this belong?**

Labels answer **what kind of work is this?**

---

# 12. Start Date vs Due Date

Treat these separately.

```text
start_at = when task becomes relevant / planned
due_at   = deadline
```

Example:

```text
start_at = Saturday 09:00
due_at   = Sunday 23:59
```

This distinction is important for future Hermes planning.

---

# 13. Estimated Duration and Energy

Optional but strongly recommended early fields:

```text
estimated_minutes
energy = low | medium | high
```

These enable future queries such as:

- "What can I do in 20 minutes?"
- "I'm tired. Give me something easy."
- "Plan my next 90 minutes."

These are particularly valuable for agent-driven task selection.

---

# 14. Reminders

Reminders are independent from due dates.

```text
reminders
- id
- user_id
- task_id
- remind_at
- channel
- status
- created_at
- delivered_at nullable
```

Suggested channel values:

```text
push
email
telegram
```

Initial implementation can support only `push`.

Do not model reminders by changing due dates.

---

# 15. Recurrence

Recurrence needs deliberate design.

Use RFC 5545 RRULE-compatible recurrence expressions.

```text
recurrence_rules
- id
- task_id
- rule
- timezone
- next_occurrence_at
- created_at
- updated_at
```

Example:

```text
FREQ=WEEKLY;BYDAY=SU
```

Recommended behavior:

- A recurring definition represents recurrence.
- Completed occurrences should remain historically visible.
- Completing one occurrence generates the next occurrence.
- Do not mutate the same historical task indefinitely.

Potential future separation:

```text
task_templates
task_occurrences
```

V1 may keep the model simpler if required.

---

# 16. Comments / Notes

```text
task_comments
- id
- task_id
- user_id
- body
- source
- created_at
- updated_at
- deleted_at nullable
```

This can support:

- Human notes
- Hermes-added context
- Agent explanations
- Future attachments

---

# 17. Attachments

Optional early, likely useful.

```text
attachments
- id
- user_id
- task_id nullable
- project_id nullable
- filename
- mime_type
- storage_provider
- storage_key
- created_at
```

Initial storage can be local object storage, S3-compatible storage, or deferred.

Future Hermes workflows may attach:

- PDFs
- screenshots
- receipts
- project documents

---

# 18. Activity / Event History

This is a core architectural feature.

Do not only store current state.

```text
task_events
- id
- user_id
- task_id
- event_type
- actor_type
- actor_id nullable
- payload jsonb
- created_at
```

Suggested event types:

```text
task.created
task.updated
task.completed
task.reopened
task.cancelled
task.deleted
task.rescheduled
task.priority_changed
task.project_changed
task.section_changed
task.label_added
task.label_removed
task.comment_added
```

Examples:

```json
{
  "event_type": "task.rescheduled",
  "payload": {
    "from": "2026-08-20T09:00:00+08:00",
    "to": "2026-08-23T09:00:00+08:00"
  }
}
```

This enables future Hermes questions such as:

- "Why is this still unfinished?"
- "How many times have I postponed it?"
- "What did I finish this week?"
- "What changed yesterday?"

---

# 19. Agent Audit Log

Every agent-originated mutation should be auditable.

```text
agent_actions
- id
- user_id
- agent
- session_id nullable
- tool_name
- request_payload jsonb
- response_payload jsonb
- outcome
- created_at
```

Possible `agent`:

```text
hermes
```

This should not contain private reasoning. Store tool/action metadata only.

Purpose:

- Debugging
- Undo investigation
- Trust
- Security
- Future agent analytics

---

# 20. Inbox Model

Inbox is not a special table.

A task is in Inbox when:

```text
project_id IS NULL
```

and it is active.

This allows frictionless capture.

Hermes should be allowed to create minimally specified tasks such as:

```text
title = "Investigate weird Nextcloud CPU issue"
project_id = null
status = inbox
```

Hermes should not invent missing metadata unless confidently inferred.

---

# 21. Core Views

Implement:

## Inbox
Untriaged tasks.

## Today
Tasks due today and optionally tasks scheduled to start today.

## Upcoming
Chronological view.

## Projects
Per-project task structure.

## Search
Full task search.

## Completed
Historical completions.

## Focus
Small manually or agent-selected working set.

## Overdue
Tasks with due dates before now and unfinished.

---

# 22. Filters

Todoist-style custom filters are valuable but can be delayed until core flows work.

Possible query structure:

```text
filters
- id
- user_id
- name
- query
- color nullable
- created_at
```

Avoid inventing a highly complex DSL initially.

Possible structured filter model:

```json
{
  "and": [
    {"project_id": "..."},
    {"labels": ["server"]},
    {"due": "this_week"}
  ]
}
```

Hermes can generate these later.

---

# 23. Ordering

Support persistent manual ordering.

Task:

```text
sort_order
```

Project:

```text
sort_order
```

Section:

```text
sort_order
```

Use fractional indexing / LexoRank-style ordering rather than rewriting every row during drag-and-drop if convenient.

---

# 24. Search

Initial search should support:

- Title
- Description
- Project
- Labels
- Comments

Start with PostgreSQL full-text/trigram capabilities.

Do not introduce Elasticsearch early.

---

# 25. REST API Design

Suggested endpoints.

## Tasks

```text
POST   /v1/tasks
GET    /v1/tasks
GET    /v1/tasks/:id
PATCH  /v1/tasks/:id
DELETE /v1/tasks/:id

POST   /v1/tasks/:id/complete
POST   /v1/tasks/:id/reopen
POST   /v1/tasks/:id/cancel

POST   /v1/tasks/:id/move
POST   /v1/tasks/:id/reschedule
POST   /v1/tasks/:id/labels
DELETE /v1/tasks/:id/labels/:labelId
```

## Bulk Task Actions

```text
POST /v1/tasks/bulk/update
POST /v1/tasks/bulk/reschedule
POST /v1/tasks/bulk/complete
POST /v1/tasks/bulk/move
```

## Projects

```text
POST   /v1/projects
GET    /v1/projects
GET    /v1/projects/:id
PATCH  /v1/projects/:id
DELETE /v1/projects/:id
POST   /v1/projects/:id/archive
```

## Sections

```text
POST   /v1/projects/:projectId/sections
PATCH  /v1/sections/:id
DELETE /v1/sections/:id
```

## Labels

```text
POST   /v1/labels
GET    /v1/labels
PATCH  /v1/labels/:id
DELETE /v1/labels/:id
```

## Comments

```text
POST   /v1/tasks/:id/comments
GET    /v1/tasks/:id/comments
PATCH  /v1/comments/:id
DELETE /v1/comments/:id
```

## Reminders

```text
POST   /v1/tasks/:id/reminders
GET    /v1/tasks/:id/reminders
PATCH  /v1/reminders/:id
DELETE /v1/reminders/:id
```

## Views

```text
GET /v1/views/inbox
GET /v1/views/today
GET /v1/views/upcoming
GET /v1/views/overdue
GET /v1/views/completed
GET /v1/views/focus
```

## Search

```text
GET /v1/search?q=
```

## Activity

```text
GET /v1/activity
GET /v1/tasks/:id/activity
```

---

# 26. API Semantics

All writes should be transactional.

Each mutation should:

1. Validate authorization.
2. Validate domain rules.
3. Modify current state.
4. Append one or more relevant events.
5. Return the updated canonical resource.
6. Emit async side effects if needed.

Example:

```text
POST /tasks/:id/complete
```

should:

```text
BEGIN
  update task
  insert task.completed event
  schedule next recurring occurrence if needed
COMMIT
```

---

# 27. MCP Philosophy

MCP should expose semantic user actions.

Good:

```text
create_task
complete_task
reschedule_task
move_task
search_tasks
create_project
archive_project
add_label
```

Bad:

```text
execute_sql
update_row
run_shell
modify_json
```

Hermes should operate Pulse exactly as a human would, but through structured capabilities.

---

# 28. MCP Surface

Initial recommended tools:

```text
pulse.get_task
pulse.search_tasks
pulse.get_inbox
pulse.get_today
pulse.get_upcoming
pulse.get_overdue

pulse.create_task
pulse.update_task
pulse.complete_task
pulse.reopen_task
pulse.cancel_task
pulse.reschedule_task
pulse.move_task

pulse.bulk_update_tasks
pulse.bulk_reschedule_tasks
pulse.bulk_complete_tasks
pulse.bulk_move_tasks

pulse.get_projects
pulse.create_project
pulse.update_project
pulse.archive_project

pulse.get_labels
pulse.create_label
pulse.add_label_to_task
pulse.remove_label_from_task

pulse.add_comment
pulse.get_task_activity
```

Later:

```text
pulse.create_filter
pulse.manage_recurrence
pulse.create_reminder
pulse.delete_reminder
pulse.manage_sections
pulse.manage_focus
```

---

# 29. MCP Implementation Rule

The MCP server must call the Pulse API.

```text
Hermes
  ↓
Pulse MCP
  ↓
Pulse API
  ↓
Business Logic
  ↓
PostgreSQL
```

Never:

```text
Hermes
  ↓
Pulse MCP
  ↓
PostgreSQL
```

The MCP should remain a thin adapter.

---

# 30. Hermes Interaction Examples

## Create

User:

```text
Remind me Saturday to build the Finance MCP.
```

Hermes:

```text
pulse.create_task(
  title="Build the Finance MCP",
  start_at="...",
  project_id="..."
)
```

## Query

User:

```text
What server stuff do I still need to do?
```

Hermes:

```text
pulse.search_tasks(
  query="server"
)
```

then summarizes returned structured data.

## Complex bulk operation

User:

```text
Move all Personal AI Platform tasks to this weekend except the API work.
```

Hermes:

1. Query matching tasks.
2. Resolve which task represents API work.
3. Use bulk reschedule.
4. Report changes.

---

# 31. MCP Safety

MCP calls should use authenticated service credentials.

Recommended:

- Hermes runs on trusted internal network.
- Pulse MCP is not publicly exposed.
- Pulse MCP authenticates to Pulse API with restricted service credentials.
- Hermes is only allowed to call explicitly approved MCP tools.
- Destructive operations can require confirmation.
- Hard deletes should generally not be exposed to Hermes initially.

Prefer:

```text
archive
cancel
soft-delete
```

over immediate hard delete.

---

# 32. Web UX

The web app should intentionally resemble the productivity of Todoist, not necessarily visually clone it.

Primary layout:

```text
┌───────────────┬──────────────────────────────────────┐
│ Sidebar       │ Main View                            │
│               │                                      │
│ Inbox         │ Today                                │
│ Today         │                                      │
│ Upcoming      │ ○ Task                               │
│ Filters       │ ○ Task                               │
│               │ ○ Task                               │
│ Projects      │                                      │
│  Pulse        │                                      │
│  Server       │                                      │
└───────────────┴──────────────────────────────────────┘
```

Important interactions:

- Quick-add task
- Natural keyboard navigation
- Drag/drop
- Inline title editing
- Context menus
- Quick reschedule
- Priority changes
- Project moves
- Label selection
- Bulk selection
- Keyboard shortcuts
- Command palette

---

# 33. Web Keyboard Model

Suggested shortcuts:

```text
Q          quick add
/          search
G then I   inbox
G then T   today
G then U   upcoming
E          edit selected
C          complete selected
D          set due date
P          set priority
M          move
Esc        close
```

Exact shortcuts can evolve.

Keyboard speed should be a core quality metric.

---

# 34. Mobile UX

Primary tabs:

```text
Today
Inbox
Projects
Search
```

Use floating/quick add.

Recommended gestures:

- Swipe right: complete
- Swipe left: reschedule / actions
- Long press: task actions
- Pull-to-refresh
- Drag/reorder where appropriate

Use bottom sheets for task editing.

Do not replicate the desktop sidebar architecture on mobile.

---

# 35. Offline / Sync Strategy

Pulse mobile should remain useful when disconnected.

Recommended model:

```text
Server
   ↓
local task cache
   ↓
React Native UI
   ↓
optimistic mutations
   ↓
sync queue
   ↓
Server
```

V1 can use:

- TanStack Query persistence
- SQLite/local store
- queued mutations

Rules:

- User actions update local UI immediately.
- Mutations are queued when offline.
- Server remains canonical.
- Conflicts should prefer explicit latest writes initially.
- Add version fields / updated timestamps to support conflict handling.

Potential fields:

```text
version integer
updated_at
```

Do not build CRDTs unless real requirements emerge.

---

# 36. Real-Time Updates

Useful because:

- Hermes can modify tasks while web/mobile are open.
- Widget actions may modify state.
- Multiple clients may be active.

Possible implementation:

- WebSockets
- Server-Sent Events
- Postgres LISTEN/NOTIFY
- Polling initially, then real-time

V1 can begin with query invalidation + short polling.

Longer term:

```text
Pulse API mutation
      ↓
event
      ↓
WebSocket/SSE
      ↓
web/mobile refresh
```

---

# 37. Widget Architecture

Widgets should render snapshots.

```text
Pulse API
    ↓
Pulse mobile app
    ↓
widget snapshot cache
    ↓
┌───────────────┬─────────────────┐
│ iOS Widget    │ Android Widget  │
│ WidgetKit     │ Jetpack Glance  │
└───────────────┴─────────────────┘
```

Avoid widgets frequently making arbitrary server requests.

---

# 38. Widget Configuration Model

Example shared config:

```typescript
export type PulseWidgetConfig = {
  view:
    | "today"
    | "inbox"
    | "upcoming"
    | "project"
    | "label"
    | "filter";

  projectId?: string;
  labelIds?: string[];

  maxTasks: number;

  sort:
    | "manual"
    | "priority"
    | "due"
    | "created";

  density:
    | "compact"
    | "comfortable";

  showCompleted: boolean;
  showDueDate: boolean;
  showPriority: boolean;

  theme:
    | "system"
    | "light"
    | "dark"
    | "custom";

  accentColor?: string;

  interactions: {
    complete: boolean;
    addTask: boolean;
    openTask: boolean;
  };
};
```

---

# 39. Widget Snapshot Model

```typescript
export type PulseWidgetSnapshot = {
  title: string;
  count: number;

  tasks: Array<{
    id: string;
    title: string;
    completed: boolean;
    dueAt?: string;
    priority: "none" | "low" | "medium" | "high" | "urgent";
  }>;

  updatedAt: string;
};
```

---

# 40. Widget Types

Initial:

## Today List
Shows today's tasks.

## Inbox
Quick capture awareness.

## Project
Selected project.

## Compact Count
Tiny widget showing task count.

## Focus
Shows only currently selected focus tasks.

Later:

- Upcoming
- Label
- Filter
- Habit/recurring status
- Smart overview

---

# 41. Widget Actions

Support where platform allows:

```text
complete
open task
add task
```

Later:

```text
snooze
reschedule
priority
```

Do not attempt to replicate the full app inside widgets.

---

# 42. Notifications

Pulse should send native reminders independent of Hermes.

Use:

- push/local notifications
- background reminder worker
- timezone-correct scheduling

Hermes may also send Telegram reminders later, but Pulse should function without Hermes.

---

# 43. Background Worker

Use a dedicated worker process for:

- reminders
- recurrence generation
- notification delivery
- cleanup
- scheduled maintenance
- optional event processing

Example:

```text
apps/worker/
```

Use a simple queue initially.

Possible choices:

- Redis + BullMQ
- Postgres-backed job queue
- Celery if Python stack

Avoid Kafka.

---

# 44. Authentication

V1 can be single-user, but implement authentication properly.

Recommended:

- Email/password or passkey
- Session cookies for web
- Access/refresh tokens for mobile
- Service token for MCP
- Separate credentials for widgets/mobile where needed

Do not expose Pulse publicly without authentication.

---

# 45. Authorization

Even in single-user mode:

- Every row belongs to a user.
- Every API resource access checks ownership.
- MCP credentials are scoped.
- Audit agent actions.

This makes future multi-user support much easier.

---

# 46. Home Server Deployment

Recommended containers:

```text
pulse-web
pulse-api
pulse-worker
pulse-mcp
pulse-postgres
pulse-redis        # optional
```

Internal network:

```text
pulse-internal
```

Public routing:

```text
nginx
  ↓
pulse.example.com → pulse-web
api.pulse.example.com → pulse-api
```

Do not publicly route `pulse-mcp` unless absolutely necessary.

Hermes can access it internally.

---

# 47. Docker Networking

Example conceptual topology:

```text
nginx
  │
  ├── pulse-web
  └── pulse-api

pulse-api
  │
  ├── pulse-postgres
  └── pulse-redis

pulse-worker
  │
  ├── pulse-postgres
  └── pulse-redis

hermes
  │
  └── pulse-mcp
          │
          └── pulse-api
```

---

# 48. Observability

Instrument Pulse from the start.

Metrics:

- HTTP latency
- error rate
- request count
- background job failures
- reminder delivery failures
- MCP invocation count
- MCP errors
- database query latency
- mobile sync failures

Use existing Prometheus/Grafana infrastructure.

Logs should be structured JSON where practical.

---

# 49. Health Endpoints

Implement:

```text
GET /health/live
GET /health/ready
```

Ready should check critical dependencies.

MCP service should also expose health status.

---

# 50. Testing Strategy

## Unit tests
- date logic
- recurrence
- filters
- priority ordering
- domain validation
- widget snapshot logic

## API tests
- CRUD
- ownership
- completion
- recurrence
- bulk actions
- activity/event generation

## MCP tests
- schema correctness
- API mapping
- permission boundaries
- bulk action safety

## Web E2E
Use Playwright.

Critical flows:

- create
- edit
- complete
- reschedule
- move
- project creation
- search

## Mobile E2E
Use Maestro or Detox where feasible.

---

# 51. Agent-Friendly Development Rules

Coding agents working on Pulse should follow these constraints:

1. Do not bypass the Pulse API for client mutations.
2. Do not let MCP access PostgreSQL directly.
3. Do not add AI decision-making into backend business logic unless explicitly requested.
4. Maintain current-state tables plus immutable activity/event records.
5. Prefer semantic operations over generic mutation primitives.
6. Preserve mobile/web independence while sharing data/domain code.
7. Avoid unnecessary microservices.
8. Avoid introducing infrastructure such as Kafka, Elasticsearch, Kubernetes, or CRDTs without demonstrated need.
9. Keep widgets thin and platform-native.
10. Add tests for every non-trivial business rule.
11. All external interfaces must be typed and documented.
12. Maintain backward-compatible API contracts where reasonable.

---

# 52. Recommended Development Sequence

## Phase 0 — Repository Foundation

Build:

- Monorepo
- formatting/linting
- shared TypeScript config
- Docker development environment
- PostgreSQL
- migration framework
- CI
- environment management

Deliverable:

```text
pnpm dev
```

starts all required development services.

---

# 53. Phase 1 — Pulse Core Backend

Implement:

- users
- tasks
- projects
- sections
- labels
- subtasks
- priorities
- start/due dates
- event history
- OpenAPI
- basic auth

Do not implement recurrence/reminders initially if they slow the vertical slice.

Deliverable:

A fully testable REST API.

---

# 54. Phase 2 — Minimal Web Vertical Slice

Build:

- login
- sidebar
- inbox
- today
- project page
- quick add
- complete
- edit
- reschedule
- move
- project creation

Goal:

Pulse should already be useful as a basic todo app.

---

# 55. Phase 3 — MCP Vertical Slice

Implement:

```text
get_today
get_inbox
search_tasks
create_task
update_task
complete_task
reschedule_task
```

Connect Hermes.

Success criterion:

From Telegram:

```text
Remind me Saturday to work on the Finance MCP.
```

creates a real task visible in the web app.

Then:

```text
What do I need to do this weekend?
```

returns correct Pulse data.

This proves the central architecture.

---

# 56. Phase 4 — Todoist-Level Core Features

Add:

- subtasks
- sections
- labels
- drag/drop
- filters
- bulk operations
- comments
- completed task history
- activity timeline
- search improvements
- keyboard shortcuts
- command palette

---

# 57. Phase 5 — Mobile Application

Build React Native / Expo application:

- authentication
- inbox
- today
- projects
- task detail
- quick add
- reschedule
- complete
- search
- local cache
- optimistic updates
- offline mutation queue

Goal:

Daily-driver mobile usability.

---

# 58. Phase 6 — Recurrence + Reminders

Implement:

- RRULE
- recurrence generation
- reminder worker
- push notifications
- timezone correctness
- recurring occurrence history

This phase needs strong automated tests.

---

# 59. Phase 7 — Widgets

Implement shared widget model first.

Then:

## iOS
- Today
- Project
- Focus
- Complete task
- Open task

## Android
Equivalent widgets using Glance.

After functional parity:

- configuration
- themes
- sizing
- density
- custom filters

---

# 60. Phase 8 — Full MCP Surface

Expose:

- projects
- sections
- labels
- recurrence
- reminders
- comments
- bulk operations
- filters
- focus
- activity

Hermes should be capable of essentially every normal user operation.

Destructive actions remain restricted.

---

# 61. Phase 9 — Event Integration

After Pulse is stable, introduce platform-wide events.

Potential Pulse events:

```text
task.created
task.completed
task.overdue
task.rescheduled
project.created
project.completed
reminder.failed
```

Future event router:

```text
Pulse
Finance
Homelab
Other apps
    ↓
Event Router
    ↓
Hermes Webhook
    ↓
Telegram
```

Do not make this a Phase 1 dependency.

---

# 62. Phase 10 — Personal Platform Integration

Pulse becomes one part of:

```text
Hermes
│
├── Pulse MCP
├── Finance MCP
├── Homelab MCP
├── Google Drive
├── Calendar
└── future services
```

Example cross-service flows:

```text
"I bought an SSD for the server.
Record the expense and remind me before the warranty ends."
```

Hermes can call:

```text
finance.create_transaction(...)
pulse.create_task(...)
```

Pulse should remain unaware of Finance.

Hermes performs orchestration.

---

# 63. First Vertical Slice Specification

This should be the first serious implementation target.

## Backend

Task schema:

```text
id
user_id
title
description
status
priority
project_id
start_at
due_at
created_at
updated_at
completed_at
```

Endpoints:

```text
POST /tasks
GET /tasks
GET /tasks/:id
PATCH /tasks/:id
POST /tasks/:id/complete

POST /projects
GET /projects

GET /views/inbox
GET /views/today
```

## Web

Screens:

```text
/inbox
/today
/project/:id
```

Interactions:

```text
create
edit
complete
move
reschedule
```

## MCP

Tools:

```text
create_task
get_inbox
get_today
search_tasks
update_task
complete_task
```

## Acceptance Test

Telegram:

```text
Create a task to build the Finance MCP on Saturday.
```

Result:

1. Hermes calls Pulse MCP.
2. Pulse MCP calls API.
3. API writes PostgreSQL.
4. Task appears immediately in web UI.
5. Activity records source = Hermes.
6. Hermes can retrieve it later.

---

# 64. Suggested Initial Database Migration

Minimum tables:

```text
users
projects
sections
tasks
labels
task_labels
task_events
agent_actions
```

Second migration:

```text
comments
reminders
recurrence_rules
filters
```

---

# 65. API Error Model

Standardize errors:

```json
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task does not exist.",
    "details": {}
  }
}
```

MCP should translate API errors into clear agent-readable failures.

Do not return database implementation details.

---

# 66. Idempotency

Important for mobile retries and agents.

For mutation endpoints, support optional:

```text
Idempotency-Key
```

This is especially useful for:

- task creation
- bulk actions
- offline mobile replay
- Hermes retries

---

# 67. Soft Deletion

Use:

```text
deleted_at
```

Hard deletion should be a maintenance/admin action.

This makes agent mistakes recoverable.

Expose:

```text
delete_task
```

to users only if it performs soft delete.

---

# 68. Undo

Long-term, add undo support around recent actions.

Because activity events are stored, common operations can eventually generate inverse operations.

Examples:

- move
- reschedule
- complete
- priority change

This is particularly useful for AI-originated actions.

---

# 69. Security Model for Hermes

Recommended:

```text
Hermes
   │
   │ internal network
   ▼
Pulse MCP
   │
   │ scoped service token
   ▼
Pulse API
```

Hermes should initially receive:

- read
- create
- normal update
- complete
- reschedule
- project operations

Hermes should not initially receive:

- hard delete
- user account management
- authentication management
- API key management
- database maintenance

---

# 70. Confirmation Policy

Normal reversible task operations should not require confirmation.

Examples:

```text
create task
complete task
reschedule task
move task
add label
```

Potentially destructive/high-impact operations should.

Examples:

```text
delete 500 tasks
archive all projects
remove all recurrence rules
mass completion
```

Implement bulk safeguards:

```text
max_items
dry_run
preview
```

Potential MCP tool:

```text
preview_bulk_update(...)
```

---

# 71. Design System

Share visual tokens between web and mobile where useful:

```text
packages/design-tokens/
```

Define:

- palette
- semantic colors
- spacing
- typography scale
- radius
- priority colors
- project colors

Do not force component implementations to be shared.

---

# 72. Pulse Brand Direction

Name:

```text
Pulse
```

Concept:

```text
Know what needs your attention.
```

Possible internal language:

- Pulse Inbox
- Pulse Today
- Pulse Focus
- Pulse Projects
- Pulse Upcoming
- Pulse Activity

Product feeling:

- clean
- fast
- calm
- high information density when needed
- not overly gamified
- native-feeling on mobile
- keyboard-first on desktop

---

# 73. Custom Widget Product Direction

Widget customization should be a differentiator.

Users should be able to configure:

- source view
- project
- labels
- filter
- sort
- maximum visible tasks
- density
- displayed metadata
- theme
- accent
- interaction behavior

Example configurations:

```text
Today / Compact / priority sort
Home Server / 8 tasks / dark
#shopping / due order
Focus / large
```

---

# 74. Performance Targets

Aim for:

- Fast optimistic interaction
- Sub-100 ms perceived local UI actions
- API p95 comfortably below 300 ms on LAN/home server
- Initial web page responsive under normal self-hosted conditions
- Smooth list performance for thousands of tasks
- Search returning quickly for normal personal datasets

Use pagination where needed.

---

# 75. Data Portability

Add eventually:

- JSON export
- CSV export
- Todoist import
- Todoist-compatible-ish importer where feasible

Do not trap user data.

This also makes migration from Todoist realistic.

---

# 76. Todoist Importer

Useful early if Pulse will replace Todoist.

Importer should support:

- projects
- sections
- tasks
- subtasks
- priorities
- labels
- descriptions
- due dates
- recurrence if extractable

Store import provenance.

---

# 77. Development Agent Workstreams

Agents can work in parallel once interfaces stabilize.

## Agent A — Backend
Own:

- schema
- migrations
- API
- business logic
- OpenAPI
- tests

## Agent B — Web
Own:

- Next.js UI
- task views
- interactions
- keyboard UX
- drag/drop

## Agent C — Mobile
Own:

- Expo app
- navigation
- cache
- offline
- notifications

## Agent D — MCP
Own:

- MCP schema
- API integration
- Hermes tests
- audit integration

## Agent E — Widgets
Own later:

- widget-core
- WidgetKit
- Glance

## Agent F — Infrastructure
Own:

- Docker
- CI
- nginx
- observability
- deployment

Do not start all workstreams before backend API contracts exist.

---

# 78. Agent Task Handoff Format

Each coding task should include:

```text
Objective
Relevant files
API contract
Data contract
Constraints
Acceptance criteria
Tests required
Out-of-scope items
```

Example:

```text
Objective:
Implement complete_task MCP tool.

Relevant:
apps/mcp/src/tools/tasks.ts
packages/api-client

Contract:
POST /v1/tasks/:id/complete

Constraints:
No direct DB access.
Record Hermes agent audit metadata.

Acceptance:
Hermes can complete a task by ID.
Repeated request is idempotent.
API errors become structured MCP errors.

Tests:
Success.
Already completed.
Missing task.
Unauthorized task.
```

---

# 79. Documentation Rules

Keep these documents current:

```text
docs/architecture.md
docs/database.md
docs/api.md
docs/mcp.md
docs/web.md
docs/mobile.md
docs/widgets.md
```

Every schema change should update relevant docs.

Every MCP tool should have:

- purpose
- arguments
- behavior
- error cases
- examples

---

# 80. Suggested Immediate Sprint

## Sprint Goal

Build the complete vertical slice:

```text
Web ↔ API ↔ DB ↔ MCP ↔ Hermes
```

### Task 1
Initialize monorepo.

### Task 2
Configure PostgreSQL + migration system.

### Task 3
Implement User / Project / Task schema.

### Task 4
Implement task CRUD API.

### Task 5
Implement Inbox / Today endpoints.

### Task 6
Generate TypeScript API client.

### Task 7
Build minimal Next.js sidebar + Inbox + Today.

### Task 8
Implement create/edit/complete.

### Task 9
Build MCP server.

### Task 10
Expose create/get/search/update/complete tools.

### Task 11
Connect Hermes.

### Task 12
Test Telegram → Hermes → Pulse.

This should be completed before recurrence, widgets, complex mobile work, or event-driven automation.

---

# 81. Definition of V1

Pulse V1 is successful when it can replace a basic Todoist workflow.

Required:

- Reliable task storage
- Inbox
- Today
- Upcoming
- Projects
- Sections
- Subtasks
- Labels
- Priorities
- Due/start dates
- Search
- Complete/reopen
- Recurring tasks
- Reminders
- Web app
- Mobile app
- Basic widgets
- MCP
- Hermes natural-language task management
- Activity history
- Agent audit trail
- Self-hosted deployment

---

# 82. Definition of V2

Potential V2:

- Advanced custom filters
- Highly customizable widgets
- richer Focus/planning system
- calendar integration
- attachment management
- Todoist migration polish
- richer offline sync
- shared projects
- browser extension
- smartwatch support
- AI-assisted task planning through Hermes
- event-driven integration with Finance and homelab
- natural-language project generation
- weekly review workflows

---

# 83. Key Architectural Decisions Summary

1. **Next.js for web.**
2. **React Native + Expo for mobile.**
3. **Native widgets per platform.**
4. **Shared widget model, not shared widget renderer.**
5. **PostgreSQL source of truth.**
6. **One central Pulse API.**
7. **MCP calls Pulse API, never database.**
8. **Hermes is intelligence/orchestration, not task storage.**
9. **Activity/event history is first-class.**
10. **Agent actions are auditable.**
11. **Offline mobile is supported with local cache + sync queue.**
12. **Avoid unnecessary infrastructure.**
13. **Build one complete end-to-end vertical slice first.**
14. **Design all major user actions as semantic API operations.**
15. **Keep Pulse independently useful without Hermes.**

---

# 84. First Command for Coding Agents

Agents beginning work should prioritize this path:

```text
1. Read this document completely.
2. Establish the monorepo.
3. Implement the backend domain model and migrations.
4. Publish a stable OpenAPI contract.
5. Build the minimum web client.
6. Build the minimum Pulse MCP adapter.
7. Validate the full Hermes integration.
8. Only then expand Todoist-level features.
```

The first meaningful milestone is not "a pretty task UI."

It is:

```text
Telegram
   ↓
Hermes
   ↓
Pulse MCP
   ↓
Pulse API
   ↓
PostgreSQL
   ↓
Next.js reflects the new task
```

Once that works reliably, the core architecture is proven.

---

# 85. Product Principle

Pulse should be designed so that a human can use it extremely efficiently without AI, while an agent can operate it completely without touching the UI.

That creates the ideal separation:

```text
Pulse = durable structured execution system
Hermes = natural-language reasoning and orchestration
Telegram = conversational capture/interface
Web = high-productivity management interface
Mobile = ubiquitous personal interface
Widgets = ambient glance/action interface
```

That is the foundation for the broader personal platform.
