# SolveNest backend setup

## 1. Local run

From the repository root:

```powershell
Set-Location server
npm install
npm test
npm start
```

The API is available at `http://127.0.0.1:4174`. Never run `node index.js` from the repository root; the entrypoint is `server/index.js`.

## 2. Environment

Copy `.env.example` to `.env` for local development. The server loads dotenv automatically; production can supply variables through its process manager.

Required in production:

- `NODE_ENV=production`
- `DEV_DEMO_SESSION=0`
- `FILE_SIGNING_SECRET`: long random secret
- `DATABASE_URL`: PostgreSQL connection string
- `S3_BUCKET`, `S3_REGION`, and S3 credentials in the process environment
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- `CONTACT_EMAIL` for the public Connect form
- `PUBLIC_APP_URL` for password-recovery links; add `${PUBLIC_APP_URL}/reset-password` to Supabase Auth redirect URLs
- `SOLVY_API_URL` and `SOLVY_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_CURRENCY` for real payments

## 3. Supabase project

1. Create a Supabase project.
2. In **Project Settings > API**, copy the Project URL into `SUPABASE_URL`.
3. Put the publishable/anon key in `SUPABASE_ANON_KEY`.
4. Put the server-only service role key in `SUPABASE_SERVICE_ROLE_KEY`. Never add this key to `client/.env` or browser code.
5. Set `SUPABASE_STORAGE_BUCKET=student-files`.
6. Create a private Storage bucket with that name.
7. In the Supabase SQL Editor, run `server/migrations/001_initial.sql`, then `server/migrations/002_staff_governance.sql`.
8. In **Authentication > Providers**, enable Email/password. Decide whether email confirmation is required; if enabled, configure SMTP in Supabase Auth and complete confirmation before the first Student session.

The migration creates a `profiles` table linked to `auth.users`, a signup trigger, Row Level Security policies, task/file/analysis/review tables, idempotency records, and guest-transfer records. The service role is used only by the trusted server for Storage and server-side operations.

Expert sign-in uses `/expert/login` and requires an existing Supabase Auth user whose `profiles.role` is `Expert`. Local development without Supabase can still open the demo Expert workspace when `STRICT_SESSION=0`. Production always requires a signed-in Expert session.

Each real Expert now has an account-scoped workspace. An Expert account can sign in before receiving its first assignment. The Admin can assign a Student task after the Student accepts the official plan and Stripe confirms payment. The assignment includes the Student's source files and appears only in the chosen Expert's workspace. Staff QA searches all Expert workspaces. Existing single-Expert data is read for its matching account and copied into that account's workspace on its next update. Local demo data stays separate from a real Expert's legacy workspace. Production workspaces are keyed by Expert profile ID in `app_state` until domain records are migrated to dedicated PostgreSQL tables.

Admin sign-in uses `/admin` and requires an existing Supabase Auth user whose `profiles.role` is `Admin` or `Superadmin`. Set the role for an approved staff account in the Supabase dashboard or SQL Editor. For local preview only, set `ADMIN_DEMO_SESSION=1` in `server/.env` and restart the server. The preview is available only from the same computer while `NODE_ENV` is not `production`.

Super Admin sign-in uses `/superadmin` and requires `profiles.role = 'Superadmin'`. Apply `server/migrations/002_staff_governance.sql` to enable audited role changes and the activity feed. Create the first Superadmin through a trusted Supabase administrator; the workspace does not let a user promote their own account. Set `SUPERADMIN_DEMO_SESSION=1` for a loopback-only visual preview. That preview cannot read or change real team access.

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

When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured, the active domain store persists its state in the Supabase `app_state` table. Without those keys, JSON files are used only as a local development fallback. Do not deploy without the Supabase variables.

## 5. Private object storage

Create a private Supabase Storage bucket named `student-files`. Do not enable public access. The server uses `SUPABASE_SERVICE_ROLE_KEY` to upload objects and generate short-lived signed access URLs. The `S3_*` variables are optional fallback settings for non-Supabase storage and can remain empty.

## 6. SMTP

Create an SMTP credential with your mail provider. Set the SMTP variables. Registration sends a welcome email when SMTP is configured. Add email verification and password-reset templates/provider workflows before public launch.
The public Connect form sends to `CONTACT_EMAIL` only when SMTP is configured. Password recovery uses Supabase Auth and redirects to `PUBLIC_APP_URL/reset-password`.

## 7. Solvy

Expose a server-to-server Solvy endpoint that accepts the authorized file metadata payload and returns JSON analysis. Set `SOLVY_API_URL` and `SOLVY_API_KEY`. The browser never receives the key. Without these variables, development uses the explicitly marked `local-intake` fallback.

## 8. Payments

Set the Stripe server variables, configure a Stripe webhook for `/api/payments/stripe/webhook`, and subscribe it to `payment_intent.succeeded` and `payment_intent.payment_failed`. The browser receives only a PaymentIntent client secret; Stripe secrets remain server-side.

## 9. HTTPS and process management

Terminate TLS at a reverse proxy, forward only `/api` to the Node server, set secure cookies, and run one process per instance behind a load balancer only after moving sessions/domain data to PostgreSQL. Allow SSE connections through the proxy with buffering disabled.

## 10. Smoke checks

```powershell
Set-Location server
npm test
Set-Location ..\client
npm run build
```

Then manually register a Student, upload a brief and rubric, run analysis, create the task, and verify the task appears in Dashboard, My Tasks, Files & Deliveries, and Notifications.
