# Student Dashboard Backend Contract

The client student experience reads one authenticated endpoint:

`GET /api/student/dashboard`

The request sends `credentials: include` and expects the existing application session cookie. The backend must enforce authentication and the Student role. Return `401` for an absent/expired session and `403` for a non-Student account. The client does not treat frontend route access as authorization.

## Response shape

```json
{
  "student": {
    "id": "student-id",
    "name": "Student name",
    "displayName": "Optional display name",
    "email": "student@example.com",
    "avatarUrl": null
  },
  "nextAction": null,
  "tasks": [],
  "unreadMessages": 0,
  "notifications": [],
  "recentActivity": [],
  "upcomingActions": [],
  "explainAndDefend": null
}
```

The empty arrays and `null` values are legitimate real states, not fixtures. Do not add sample objects to make the dashboard look populated.

## Task fields

Each task should include the fields available under the student permission policy:

```json
{
  "id": "task-id",
  "reference": "SN-2048",
  "title": "Student-provided title",
  "type": "Actual task type",
  "subject": "Optional subject or domain",
  "domain": "Optional domain",
  "status": "QUOTE_READY",
  "deadline": "2026-09-28T00:00:00Z",
  "priority": 10,
  "latestUpdate": {
    "text": "Official plan is ready.",
    "createdAt": "2026-09-14T10:42:00Z"
  },
  "expert": {
    "name": "Approved display name",
    "verified": true
  },
  "nextAction": {
    "label": "Review official plan",
    "route": "/student/tasks"
  }
}
```

`expert` must be omitted unless an expert is actually assigned. Do not return private contact information, payout data, internal notes, or another student’s data.

The documented lifecycle values are used directly by the client adapter:

`DRAFT`, `SUBMITTED`, `VALIDATING`, `AI_ANALYZED`, `NEEDS_INFORMATION`, `FEASIBILITY_REVIEW`, `QUOTE_READY`, `AWAITING_ACCEPTANCE`, `PAYMENT_PENDING`, `PAID`, `ASSIGNMENT_PENDING`, `IN_PROGRESS`, `QUALITY_REVIEW`, `DELIVERED`, `REVISION_REQUESTED`, `REVISION_IN_PROGRESS`, `COMPLETED`, `DECLINED`, `CANCELLED`, `DISPUTED`.

The client maps these values to student-facing language in `client/src/student/studentDashboardData.js`; backend enums should not be changed for presentation.

## Related collections

Activity and notification records should include an `id`, `createdAt`, display-safe `title`/`body`, and an optional frontend route. `upcomingActions` should include `id`, `date` or `deadline`, display-safe `title`, and optional task reference/title. Counts must be derived from authorized records.

## Manual setup required

1. Implement `GET /api/student/dashboard` in the backend or configure a reverse proxy so this path reaches the API.
2. Ensure the authenticated browser session cookie is sent cross-origin if the API is on another origin (`SameSite`, `Secure`, CORS, and `credentials` configuration).
3. Enforce `role === Student` and student ownership checks for every returned task, message, notification, file, delivery, payment, and activity record.
4. Return only student-safe expert and payment fields.
5. Connect the existing sign-in flow to the backend session. The current sign-in screen is still a visual prototype and does not create a real session.
6. Add backend mutations for notification mark-as-read, quote acceptance, payments, task responses, and delivery/revision actions before exposing those controls in their destination pages.
7. If the backend already has realtime delivery, publish task, message, payment, delivery, and notification changes and invalidate/refetch this dashboard snapshot. No new realtime stack is assumed by the client.
8. Add contract/integration tests for empty, action-required, active, delivered, completed, unauthorized, forbidden, and partial-data responses.

Until step 1 and the real session are available, visiting `/student` correctly shows a backend access/load state rather than fake dashboard content.

## My Tasks endpoint

The authenticated `/student/tasks` workspace reads:

`GET /api/student/tasks`

It accepts the current student session and may return either a plain task array or this paginated shape:

```json
{
  "tasks": [],
  "meta": { "total": 0, "current_page": 1, "last_page": 1 }
}
```

The client maps each row through the same dashboard state resolver. Each task should include its real `id`, `title` or `type`, `status`, optional `reference`, `subject`/`domain`, `deadline`, `createdAt`, `updatedAt`, `latestUpdate`, `expert`, and server-supplied `nextAction` when available. No preview row is fabricated when the endpoint is empty or unavailable.

Selecting a row may request:

`GET /api/student/tasks/:id/preview`

This endpoint must enforce student ownership and return only student-safe preview data. The UI uses the response for the current state, journey, next step, latest update, deadline, and assigned expert summary.

## Messages / Conversations endpoints

The messaging system uses conversation-based endpoints. Each conversation is linked to a task.

### List conversations

`GET /api/student/conversations`

Returns all conversations the student is part of.

```json
[
  {
    "id": "conv-id",
    "taskId": "task-id",
    "taskTitle": "Research Report",
    "taskRef": "SN-2042",
    "subject": "Information Systems",
    "status": "IN_PROGRESS",
    "state": "active",
    "needsStudent": true,
    "needsStudentReason": "Clarification needed about citation style.",
    "unread": 2,
    "participant": {
      "name": "Amara P.",
      "role": "Verified Expert",
      "initials": "AP",
      "avatar": null,
      "expertise": "Information Systems"
    },
    "lastActivityAt": "2026-09-19T14:38:00Z",
    "lastMessage": {
      "body": "Can you confirm APA 7 or Harvard?",
      "from": "expert",
      "createdAt": "2026-09-19T14:38:00Z"
    },
    "deadline": "24 Sep, 23:59",
    "plan": "Standard · 2 revisions",
    "fileCount": 3,
    "files": [
      {
        "id": "file-id",
        "name": "rubric-v2.pdf",
        "type": "PDF",
        "size": "1.4 MB",
        "uploadedBy": "You",
        "uploadedAt": "2026-09-18T09:44:00Z"
      }
    ]
  }
]
```

### Get messages for a conversation

`GET /api/student/conversations/:id/messages`

Returns messages for a specific conversation. Supports pagination.

Query params: `page` (default 1), `per_page` (default 50).

```json
{
  "messages": [
    {
      "id": "msg-id",
      "kind": "message",
      "from": "expert",
      "author": "Amara P.",
      "role": "Verified Expert",
      "initials": "AP",
      "body": "Hi — I've read through the brief.",
      "createdAt": "2026-09-18T09:20:00Z",
      "attachments": [],
      "status": null
    },
    {
      "id": "evt-id",
      "kind": "event",
      "event": "EXPERT_ASSIGNED",
      "title": "Expert assigned",
      "createdAt": "2026-09-18T09:12:00Z",
      "action": { "label": "View plan", "href": "#" }
    }
  ],
  "meta": { "total": 20, "current_page": 1, "last_page": 1 }
}
```

Message `kind` values: `"message"` (chat bubble), `"event"` (system event line), `"date"` (date separator).

Message `from` values: `"student"`, `"expert"`, `"system_person"`.

### Send a message

`POST /api/student/conversations/:id/messages`

Body:
```json
{
  "body": "Message text here",
  "fileId": "optional-file-id"
}
```

Returns the created message object. The backend must enforce that the conversation belongs to the student.

### Mark conversation as read

`PATCH /api/student/conversations/:id/read`

Clears the unread count for the student. Returns `200` with `{ "ok": true }`.

### Upload file to a conversation

`POST /api/student/conversations/:id/files`

Multipart form data with `file` field. Returns the uploaded file object.

### Key rules

1. All endpoints require student session (`credentials: include`).
2. Return `401` for absent/expired session, `403` for non-Student.
3. Enforce student ownership — a student can only see conversations linked to their tasks.
4. The `unreadMessages` count on `GET /api/student/dashboard` should be derived from actual conversation data.
5. Auto-close conversations with no activity for 2+ days is a frontend hint only; backend remains the authority on conversation state.
