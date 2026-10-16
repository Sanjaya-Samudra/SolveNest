# SolveNest backend setup

## 1. Local run

From the repository root:

```powershell
Set-Location server
npm install
npm start
```

The API is available at `http://127.0.0.1:4174`. Never run `node index.js` from the repository root; the entrypoint is `server/index.js`.

## 2. Environment

Copy `.env.example` to `.env` for local development. The server loads dotenv automatically; production can supply variables through its process manager.

Required in production:

- `NODE_ENV=production`
- `DEV_DEMO_SESSION=0`
- `FILE_SIGNING_SECRET`: long random secret
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- a private Supabase Storage bucket, or configured S3-compatible private storage
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- `CONTACT_EMAIL` for the public Connect form
- `PUBLIC_APP_URL` for password-recovery links; add `${PUBLIC_APP_URL}/reset-password` to Supabase Auth redirect URLs
- `SOLVY_API_URL` and `SOLVY_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_CURRENCY` for real payments
- `TRUST_PROXY_HOPS` set to the exact number of trusted reverse proxies in front of the API, so per-IP limits use the client address
- `CLAMD_HOST` and `CLAMD_PORT` for a private ClamAV daemon with current signatures; configure its stream limit above the 100 MB application upload limit

## 3. Supabase project

1. Create a Supabase project.
2. In **Project Settings > API**, copy the Project URL into `SUPABASE_URL`.
3. Put the publishable/anon key in `SUPABASE_ANON_KEY`.
4. Put the server-only service role key in `SUPABASE_SERVICE_ROLE_KEY`. Never add this key to `client/.env` or browser code.
5. Set `SUPABASE_STORAGE_BUCKET=student-files`.
6. Create a private Storage bucket with that name.
7. In the Supabase SQL Editor, run every file in `server/migrations` from `001_initial.sql` through `013_record_level_domain_concurrency.sql` in numeric order.
8. In **Authentication > Providers**, enable Email/password. Decide whether email confirmation is required; if enabled, configure SMTP in Supabase Auth and complete confirmation before the first Student session.

The migration creates a `profiles` table linked to `auth.users`, a signup trigger, Row Level Security policies, task/file/analysis/review tables, idempotency records, and guest-transfer records. The service role is used only by the trusted server for Storage and server-side operations.

Expert sign-in uses `/expert/login` and requires an existing Supabase Auth user whose `profiles.role` is `Expert`. Local development without Supabase can still open the demo Expert workspace when `STRICT_SESSION=0`. Production always requires a signed-in Expert session.

Expert and staff sessions are stored in the private `app_sessions` table, so API restarts do not log users out. The browser holds a random, HttpOnly cookie; only its SHA-256-derived identifier is stored in the database. Sessions expire after seven days. Deleting a session record revokes its cookie.

Production rate limits use the `consume_rate_limit` database function so all API instances share the same counters. If the database is unavailable, limited actions are denied. Local development keeps the lightweight in-memory limiter.

Each real Expert now has an account-scoped workspace. An Expert account can sign in before receiving its first assignment. The Admin can assign a Student task after the Student accepts the official plan and Stripe confirms payment. The assignment includes the Student's source files and appears only in the chosen Expert's workspace. Staff QA searches all Expert workspaces. Migration 007 copies existing real Expert workspaces out of `app_state` into private, revision-checked `expert_workspaces` rows. Local demo data stays separate.

Admin sign-in uses `/admin` and requires an existing Supabase Auth user whose `profiles.role` is exactly `Admin`. Set the role for an approved staff account in the Supabase dashboard or SQL Editor. For local preview only, set `ADMIN_DEMO_SESSION=1` in `server/.env` and restart the server. The preview is available only from the same computer while `NODE_ENV` is not `production`.

Super Admin sign-in uses `/superadmin` and requires `profiles.role = 'Superadmin'`. Admin and Super Admin use separate cookies, login endpoints, API guards, and workspaces; neither role can enter the other role's application. Apply `server/migrations/002_staff_governance.sql` to enable audited role changes and the activity feed. Create the first Superadmin through a trusted Supabase administrator; the workspace does not let a user promote their own account. Set `SUPERADMIN_DEMO_SESSION=1` for a loopback-only visual preview. That preview cannot read or change real team access.

Admin operations now include quality review and support. Quality approval moves an Expert submission to `ready_to_deliver`; requested changes return feedback to the Expert. Support requests are stored with the application state and Student ticket reads are limited to the owning Student. Existing local `help-tickets.json` records remain visible locally and are copied into the new store when an Admin updates them.

Support status changes require an internal note. A `waiting_on_student` change also requires a separate message visible to the Student and creates a notification. The Help catalog and ticket endpoints return only tickets owned by the signed-in Student.

## 4. PostgreSQL

1. Supabase already provides PostgreSQL.
2. Optionally set `DATABASE_URL` to the Supabase Session Pooler connection string.
3. Run the migration from the dashboard, or run:

```powershell
Set-Location server
npm run db:migrate
```

`DATABASE_URL` and `npm run db:migrate` are optional if you run the SQL migration manually in Supabase. Do not create a second standalone users table; Supabase Auth is the identity source.

When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured, the active domain store persists each task, payment, plan, message, support request, notification, and related entity as an individual row in `domain_records`. Migration 008 copies the old `app_state` document into these rows and retains the original document only as migration rollback data. Migration 013 applies optimistic checks to each changed record, so unrelated Student operations no longer contend on one global revision and conflicting edits still retry safely. Without Supabase keys, JSON files are used only as a local development fallback. Do not deploy without the Supabase variables.

## 5. Private object storage

Create a private Supabase Storage bucket named `student-files`. Do not enable public access. The server uses `SUPABASE_SERVICE_ROLE_KEY` to upload objects and generate short-lived signed access URLs. The `S3_*` variables are optional fallback settings for non-Supabase storage and can remain empty. A six-hour maintenance job removes expired Guest Quick Scan transfers and unreferenced objects older than 24 hours; retain database and Storage backups independently.

All uploads are checked for supported file signatures. Office files are inspected for the required DOCX/PPTX structure, path traversal, symlinks, encryption, and excessive expansion. In production every upload must also pass a ClamAV `INSTREAM` scan before storage or email delivery; unavailable scanning rejects uploads. Keep the ClamAV TCP port on a private network because its protocol does not authenticate clients. Run signature updates with `freshclam` and monitor their freshness. Local development can omit `CLAMD_HOST` to work without a scanner.

## 6. SMTP

Create an SMTP credential with your mail provider. Set the SMTP variables. Registration sends a welcome email when SMTP is configured. Add email verification and password-reset templates/provider workflows before public launch.
The public Connect form sends to `CONTACT_EMAIL` only when SMTP is configured. Password recovery uses Supabase Auth and redirects to `PUBLIC_APP_URL/reset-password`.

## 7. Solvy

Expose a server-to-server Solvy endpoint that accepts authorized file metadata and short-lived signed file URLs, then returns JSON analysis. Set `SOLVY_API_URL` and `SOLVY_API_KEY`. The browser never receives the key. Without these variables, development uses the explicitly marked `local-intake` fallback; production refuses to start.

## 8. Payments

Set the Stripe server variables, configure a Stripe webhook for `/api/payments/stripe/webhook`, and subscribe it to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, and `charge.dispute.closed`. Events are claimed by Stripe event ID before processing. The browser receives a short-lived hosted Checkout URL; Stripe secrets remain server-side. Funding is recorded only after provider confirmation.

An Admin can issue either a full-payment plan or a two-milestone plan. The first milestone unlocks Expert assignment; the second must be paid before an approved delivery is released. The Admin chooses the first milestone percentage when issuing the quote. The plan shown to the Student lists both amounts before acceptance. Each milestone uses a separate Checkout Session and payment record.

For work that changes after acceptance, an Admin can issue a scope change while the Expert assignment remains open. The Student sees the old and revised scope, date, and additional price. A zero-price change applies on acceptance; a paid change applies only after its separate Checkout Session is confirmed. Accepted changes update the Expert brief. If the Expert workspace is temporarily unavailable, the API retries that sync every minute.

## 9. HTTPS and process management

Serve the built `client/dist` site over HTTPS. Route `/api` on that same origin to the Node API, because browser requests use relative `/api` paths and session cookies are scoped to the site. Terminate TLS at a trusted reverse proxy, set `TRUST_PROXY_HOPS` to its exact hop count, and keep the API private behind that proxy. Allow SSE connections through it with buffering disabled. Multiple API instances share Supabase sessions, rate limits, Expert workspaces, record-level domain writes, and the short-lived `realtime_events` relay used by Student SSE connections. Keep migration 012 applied before running more than one API instance.

Use `/api/health` as the liveness probe and `/api/ready` as the traffic readiness probe. Readiness checks the domain store and malware scanner; it returns 503 if either is unavailable. Alert on repeated 503 responses, API errors, failed Stripe webhook deliveries, stale ClamAV signatures, and backup failures.

## 10. Release sequence and remaining gates

1. Choose a production host for the static React build and Node API, and connect an HTTPS domain with same-origin `/api` routing.
2. Create Supabase, run all sixteen migrations, create the private bucket, enable Email/password Auth, and make the first Superadmin through a trusted administrator.
3. Configure an SMTP provider and the Supabase Auth email templates and redirect allowlist.
4. Provide a real Solvy endpoint matching the documented analysis and Explain & Defend requests. The API cannot manufacture or configure that service.
5. Create a Stripe account, configure Checkout credentials and the signed webhook, and verify that the chosen account supports the configured currency.
6. Set every production environment variable in the host secret manager. Keep the service-role, Stripe, Solvy, SMTP, and file-signing secrets out of the client build and Git.
7. Build the client with `npm --prefix client run build`, start the API with `npm --prefix server start`, and confirm `/api/health` responds through the public HTTPS domain.
8. Manually register and sign in a Student, upload a brief and rubric, run analysis, create a task, issue and accept a plan, complete a real payment, assign an Expert, submit for Admin QA, deliver, and request a revision. Confirm password recovery and signed file downloads.

The code-level production gates are implemented: transactional domain rows, mandatory malware scanning over a private network, exact staff role boundaries, durable sessions and rate limits, signed provider callbacks, health checks, and container deployment. A public launch still depends on the owner-created services and credentials above. Complete the manual launch flow with those live providers before accepting customers.

## 11. Release preparation additions

Run `npm --prefix server run preflight` from the repository root after filling `server/.env.production`. This reports missing configuration names without printing secret values. It validates configuration format only; it does not contact providers.

Migrations 009 through 016 add durable Admin audit events, staff role invariants, Student account revision protection, a shared realtime relay, record-level domain concurrency, scoped read indexes, scheduled-job leases, and the notification outbox. Apply every migration in order before deploying this release.

For the included HTTPS proxy, export `APP_DOMAIN` on the host and use `docker compose -f compose.production.yml -f compose.https.yml up -d --build`. Set `PUBLIC_APP_URL=https://YOUR_DOMAIN` and `TRUST_PROXY_HOPS=1` for a single Caddy proxy; adjust the hop count if another trusted proxy is added. Ports 80 and 443 must reach the proxy. The database and ClamAV stay private.

The GitHub build workflow compiles the UI, checks server syntax, audits production dependencies, and builds the container. It does not run automated tests or deploy the application.
