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

Copy `.env.example` to `.env`. The server does not load dotenv automatically, so either export variables in the process manager or add dotenv before production deployment.

Required in production:

- `NODE_ENV=production`
- `DEV_DEMO_SESSION=0`
- `FILE_SIGNING_SECRET`: long random secret
- `DATABASE_URL`: PostgreSQL connection string
- `S3_BUCKET`, `S3_REGION`, and S3 credentials in the process environment
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- `SOLVY_API_URL` and `SOLVY_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_CURRENCY` for real payments

## 3. Supabase project

1. Create a Supabase project.
2. In **Project Settings > API**, copy the Project URL into `SUPABASE_URL`.
3. Put the publishable/anon key in `SUPABASE_ANON_KEY`.
4. Put the server-only service role key in `SUPABASE_SERVICE_ROLE_KEY`. Never add this key to `client/.env` or browser code.
5. Set `SUPABASE_STORAGE_BUCKET=student-files`.
6. Create a private Storage bucket with that name.
7. In the Supabase SQL Editor, run the contents of `server/migrations/001_initial.sql`.
8. In **Authentication > Providers**, enable Email/password. Decide whether email confirmation is required; if enabled, configure SMTP in Supabase Auth and complete confirmation before the first Student session.

The migration creates a `profiles` table linked to `auth.users`, a signup trigger, Row Level Security policies, task/file/analysis/review tables, idempotency records, and guest-transfer records. The service role is used only by the trusted server for Storage and server-side operations.

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
