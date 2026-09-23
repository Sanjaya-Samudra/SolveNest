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

## Files & Deliveries endpoints

The `/student/files` page reads from task dossier endpoints. Each dossier groups a task's source materials, exchanges, and delivery packages.

### List task dossiers

`GET /api/student/dossiers`

Query params: `page` (default 1), `per_page` (default 20), `view` (all|my-uploads|deliveries), `search`, `sort` (recently-updated|newest|oldest|name|task), `file_type`, `file_role`, `delivery_version`, `task`.

```json
{
  "dossiers": [
    {
      "id": "task-id",
      "taskId": "task-id",
      "title": "Research Report",
      "reference": "SN-2042",
      "subject": "Information Systems",
      "status": "IN_PROGRESS",
      "fileCount": 6,
      "hasNewDelivery": true,
      "lastActivityAt": "2026-09-19T14:38:00Z",
      "expert": { "name": "Amara P." },
      "sourceFiles": [
        {
          "id": "file-id",
          "name": "assessment-2.pdf",
          "type": "application/pdf",
          "size": 1843200,
          "role": "brief",
          "origin": "student",
          "uploadedAt": "2026-09-14T09:44:00Z",
          "uploadedByName": "You",
          "canReplace": true,
          "canRemove": false,
          "locked": false
        }
      ],
      "exchangeFiles": [
        {
          "id": "file-id",
          "name": "dataset-cleaned.xlsx",
          "type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "size": 524288,
          "role": "supporting",
          "origin": "expert",
          "uploadedAt": "2026-09-15T14:42:00Z",
          "conversationId": "conv-id"
        }
      ],
      "deliveryVersions": [
        {
          "id": "del-v1",
          "version": 1,
          "deliveredAt": "2026-09-12T18:00:00Z",
          "status": "accepted",
          "files": [
            { "id": "df-1", "name": "Report_V1.pdf", "type": "application/pdf", "size": 2097152 }
          ],
          "qa": { "complete": true, "checks": [{ "label": "Requirements reviewed", "pass": true }, { "label": "Citation checked", "pass": true }] },
          "note": "Initial delivery covering all sections.",
          "revision": { "status": "completed", "remaining": 1 },
          "explainAndDefend": null
        },
        {
          "id": "del-v2",
          "version": 2,
          "deliveredAt": "2026-09-19T18:42:00Z",
          "status": "ready_to_review",
          "files": [
            { "id": "df-3", "name": "Final_Report.docx", "type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "size": 3145728 },
            { "id": "df-4", "name": "Final_Report.pdf", "type": "application/pdf", "size": 2621440 },
            { "id": "df-5", "name": "Reference_List.pdf", "type": "application/pdf", "size": 104857 }
          ],
          "qa": { "complete": true, "checks": [{ "label": "Requirements reviewed", "pass": true }, { "label": "Citation checked", "pass": true }, { "label": "Files verified", "pass": true }] },
          "note": "Revised per feedback — added methodology section.",
          "revision": { "status": "available", "remaining": 1 },
          "explainAndDefend": { "eligible": true, "route": "/student/explain" }
        }
      ]
    }
  ],
  "meta": { "total": 6, "current_page": 1, "last_page": 1 },
  "facets": {
    "fileTypes": ["pdf", "docx", "xlsx"],
    "fileRoles": ["brief", "rubric", "reference", "supporting", "deliverable"]
  }
}
```

### Get dossier detail

`GET /api/student/dossiers/:taskId`

Returns full dossier with source, exchange, and delivery files for a specific task. Enforces student ownership.

### Get delivery package

`GET /api/student/dossiers/:taskId/delivery`

Query param: `version` (optional, defaults to latest).

Returns the delivery package for a specific version including files, QA state, note, revision status, and Explain & Defend eligibility.

### Get signed file access

`GET /api/student/files/:fileId/access`

Returns a short-lived signed URL for preview or download. The backend must enforce that the file belongs to a task owned by the student.

```json
{
  "signedUrl": "https://storage.example.com/...",
  "expiresAt": "2026-09-20T15:00:00Z"
}
```

### Upload file to a dossier

`POST /api/student/dossiers/:taskId/files`

Multipart form data with `file` field and `section` field (source|exchange). Returns the uploaded file object. Upload is only permitted when task state allows it.

### Replace a file

`PUT /api/student/files/:fileId/replace`

Multipart form data with `file` field. Returns the updated file object. Only allowed for student-uploaded source files before scope lock.

### Remove a file

`DELETE /api/student/files/:fileId`

Removes a file from the task. Only allowed for student-uploaded files when task state permits. Returns `200` with `{ "ok": true }`.

### Request revision

`POST /api/student/dossiers/:taskId/revision`

Body:
```json
{
  "note": "Optional revision note"
}
```

Creates a revision request against the current delivery. Returns the revision object.

### Key rules

1. All endpoints require student session (`credentials: include`).
2. Return `401` for absent/expired session, `403` for non-Student.
3. Enforce student ownership — a student can only see files and deliveries for their own tasks.
4. Never expose internal Expert working files, admin-only attachments, hidden QA documents, private moderation files, other students' files, internal Expert notes, or permanent storage URLs.
5. Use signed URLs for all file access — never place long-lived private URLs in the DOM, localStorage, or frontend config.
6. The `hasNewDelivery` flag should be derived from real backend state (e.g. a delivery viewed/read timestamp per student).
7. File upload is only permitted when task state allows it (e.g. before scope confirmation for source files).
8. Revision requests are only permitted when the delivery's revision status is `available` and the revision limit has not been reached.
9. QA data exposed to students must be student-safe only — no internal scoring, no expert private notes.
10. Delivery version history must preserve all versions the student has access to.

## Explain & Defend endpoints

The `/student/explain` practice studio reads eligible deliveries from the existing dossier APIs, then calls a dedicated Explain API for grounded practice rounds. All requests use `credentials: include`. Return `401` for an absent/expired session and `403` for a non-Student account. Enforce student ownership on every task, artifact, session, rubric, and usage record.

### Eligibility and artifacts (existing dossier endpoints)

Eligible tasks are derived from `GET /api/student/dossiers` and `GET /api/student/dossiers/:taskId`. Each delivery version already carries an `explainAndDefend` flag:

```json
{ "eligible": true, "route": "/student/explain" }
```

Processing / blocked shapes the client understands:

```json
{ "eligible": false, "status": "processing", "reason": "Indexing delivery files." }
{ "eligible": false, "reason": "Explain & Defend is not available for this delivery." }
```

Delivery files for the Source pane come from the same dossier/delivery payloads (no separate artifact list endpoint). File preview/download continues to use `GET /api/student/files/:fileId/access`.

### Start / continue a practice round

`POST /api/student/explain/tasks/:taskId/explain`

Body:

```json
{
  "artifactId": "delivery-file-id-or-null",
  "mode": "explain | why | quiz | lecturer | defend",
  "selection": { "text": "optional student-selected excerpt", "anchor": {} },
  "question": "optional free-text question",
  "prompt": "optional structured prompt id or text",
  "answers": ["optional quiz/viva answers for reveal/complete rounds"],
  "scope": "optional quiz scope (e.g. quick | full | section)",
  "round": "optional | question | reveal | complete"
}
```

Either return a single JSON object or stream partial JSON lines. Streaming may use `Content-Type: text/event-stream` (`data: {...}` lines, optional `data: [DONE]`) or `application/x-ndjson` (one JSON object per line). Chunks are shallow-merged by the client until the stream ends.

Status codes the client special-cases:

| Status | Behavior |
| --- | --- |
| `401` / `403` | Auth error → access state |
| `404` / `501` | `EXPLAIN_UNSUPPORTED` → unavailable state |
| `422` + integrity payload | Academic-integrity notice |
| other non-OK | Generic request failure |

Integrity payload (also allowed on `200` JSON bodies):

```json
{
  "integrity": {
    "code": "INTEGRITY",
    "message": "student-safe explanation of the concern",
    "actions": []
  }
}
```

Common response envelope fields (mode-specific fields layered on top):

```json
{
  "sessionId": "session-id",
  "grounding": "delivery_source | task_requirements | rubric | general",
  "anchor": {
    "kind": "document | code | slide",
    "ref": "block-or-section-ref",
    "label": "Page 3",
    "file": "Report_V2.pdf",
    "page": 3,
    "lines": [12, 40],
    "section": "Methodology",
    "index": 1
  },
  "source": "short citation label or null",
  "rubricCriterionId": "c-method",
  "usage": { "remaining": 17, "limit": 25, "periodLabel": "this week" },
  "uncertainty": null
}
```

Anchor `kind` must be `document`, `code`, or `slide`. `ref` is required for the client to offer “View Source”. Prefer real section/page/line references from the artifact — never invent citations.

Mode payload fields:

| Mode | Fields |
| --- | --- |
| `explain` | `plainExplanation` (`paragraphs`/`bullets`/`formula`/`example` or string), `whyItMatters`, `trySayingIt` |
| `why` | `decision`, `reason`, `alternative`, `tradeOff` |
| `quiz` | `setup?`, `question`, `reveal?`, `completion?`, `total`, `index` |
| `lecturer` | `question`, `coaching` (`covered`/`missing`/`stronger`), `followUp?`, `complete`, `total`, `index` |
| `defend` | `decision`, `question`, `feedback` (`clear`/`missing`/`strengthen`), `complete`, `total`, `index` |

Question shape: `{ "id", "prompt", "type": "choice|short", "choices": [{ "id", "label" }], "total", "sourceTag", "context", "index" }`.

Quiz rounds: omit `round` (or send `question`) to start; `round: "reveal"` after an answer; `round: "complete"` to finish. `answers` should carry prior answers for reveal/complete.

### Rubric

`GET /api/student/explain/tasks/:taskId/rubric`

`404`/`501` (or empty list) means the UI hides the Rubric control. Shape:

```json
{
  "criteria": [
    { "id": "c-method", "label": "Methodology", "weight": 20, "description": "…" }
  ],
  "source": "optional label"
}
```

A plain array of criteria is also accepted.

### Session history and resume

`GET /api/student/explain/tasks/:taskId/sessions`

`404`/`501` or empty → history control hidden.

```json
{
  "sessions": [
    { "id": "sess-1", "title": "Methodology explained", "mode": "explain", "updatedAt": "2026-09-20T12:00:00Z" }
  ]
}
```

`GET /api/student/explain/sessions/:sessionId`

```json
{
  "session": {
    "id": "sess-1",
    "mode": "explain",
    "artifactId": "file-id",
    "anchor": {},
    "title": "Methodology explained",
    "trail": [{ "key": "…", "label": "…", "status": "complete" }]
  }
}
```

`PATCH /api/student/explain/sessions/:sessionId`

Body is a partial session patch (client currently sends `{ "trail": [...] }`). Returns `200` on success; failures surface a non-blocking “session could not be saved” notice.

### Usage limits

`GET /api/student/explain/usage`

`404`/`501` or missing `remaining` hides the quota chip.

```json
{ "remaining": 17, "limit": 25, "periodLabel": "this week" }
```

The same `usage` object may be attached to explain responses so the chip updates after each round.

### Artifact structured content

`GET /api/student/explain/artifacts/:artifactId/content`

Used when the Source pane needs searchable structured content (document blocks, code lines, slides, dataset rows) instead of a binary signed URL. Return `404`, `415`, or `501` when unsupported — the client falls back to signed URL/image/PDF preview.

Document example:

```json
{
  "kind": "document",
  "title": "Final Report",
  "pages": [
    {
      "n": 1,
      "blocks": [
        { "id": "b-1", "type": "heading", "text": "Methodology", "page": 1 },
        { "id": "b-2", "type": "paragraph", "text": "…", "page": 1, "sectionId": "s-method" }
      ]
    }
  ]
}
```

Code example: `{ "kind": "code", "files": [{ "path": "src/app.py", "language": "python", "lines": [{ "n": 1, "text": "…" }] }] }`.

Slides: `{ "kind": "slides", "slides": [{ "n": 1, "title": "…", "bullets": ["…"] }] }`.

Dataset: `{ "kind": "dataset", "columns": ["…"], "rows": [["…"]], "totalRows": 5000, "truncated": true }` — client previews at most 100 rows.

### Key rules

1. All endpoints require student session (`credentials: include`).
2. Return `401` for absent/expired session, `403` for non-Student.
3. Enforce student ownership — a student can only explain tasks/deliveries/artifacts they own.
4. Ground every non-`general` answer in real delivery, requirement, or rubric content; include a resolvable `anchor` and short `source` label when citing the artifact. Do not fabricate citations or page/line references.
5. `grounding: "general"` must be reserved for answers that are not grounded in the student’s files (and should be rare in this product).
6. Preserve `sessionId` across rounds of the same practice thread so trail/history resume works.
7. Enforce and return `usage.remaining` server-side; never trust client quota math.
8. Integrity rejections must use student-safe wording and the `422`/`integrity` contract above — do not leak model prompts, internal scores, or other students’ data.
9. Optional endpoints (`rubric`, `sessions`, `usage`, artifact `content`) should answer `404`/`501` when not available so the UI degrades cleanly instead of erroring.
10. Streaming is optional; a complete JSON body with the same fields is fully supported.
