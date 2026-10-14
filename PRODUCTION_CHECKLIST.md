# SolveNest production handoff

Deployment scaffolding and application safeguards are implemented, but production readiness is not yet verified. Live provider configuration, database migration execution, browser checks, and the launch verification below remain required.

## Services to create

1. Create a Supabase production project in a nearby region. Enable email/password authentication, decide whether email confirmation is required, and configure the production Site URL and `/reset-password` redirect.
2. Run every SQL file in `server/migrations` in numeric order. Create a private Storage bucket named `student-files`. Never expose the service-role key to the browser.
3. Create a Stripe account and production webhook pointing to `https://YOUR_DOMAIN/api/payments/stripe/webhook`. Subscribe to the events listed in `server/SETUP.md`.
4. Create SMTP credentials and a verified sender domain. Use a monitored address for `CONTACT_EMAIL`.
5. Deploy or subscribe to the Solvy analysis service and obtain its private API URL and key.
6. Register a domain and choose a container host. The host must support Docker, HTTPS, persistent environment secrets, health checks, and outbound access to Supabase, Stripe, SMTP, and Solvy.

## Deploy

1. Copy `server/.env.production.example` to `server/.env.production` outside source control and fill every placeholder. Generate `FILE_SIGNING_SECRET` with a cryptographically secure password generator.
2. Run `docker compose -f compose.production.yml up -d --build` on the host. Put a TLS reverse proxy or managed HTTPS load balancer in front of `127.0.0.1:4174` and set `TRUST_PROXY_HOPS` to the exact proxy count.
3. Configure the host health check to use `/api/ready` and the process liveness check to use `/api/health`.
4. Create the first Superadmin through the Supabase SQL editor or another trusted administrator. Create Admin and Expert accounts through the controlled role-management process.

## Required launch verification

Perform these checks in Stripe test mode and with non-sensitive sample files before accepting customers:

- Register, confirm email if enabled, sign in, reset the password, and sign out as a Student.
- Submit a task, upload each supported file type, and verify unsafe or malformed files are rejected.
- Review and quote a task as Admin, fund each milestone through Stripe Checkout, assign an Expert, complete QA, and release the delivery.
- Issue both free and paid scope changes and confirm the Expert brief updates once.
- Confirm Admin credentials cannot enter `/superadmin` and Superadmin credentials cannot enter `/admin`.
- Change a role as Superadmin and confirm the audit history records the actor, target, old role, new role, and reason.
- Submit a support request and task-room message and confirm notifications and email delivery.
- Confirm `/api/ready` returns 503 when the database or ClamAV is unavailable and returns 200 after recovery.

## Operations

- Enable Supabase point-in-time recovery or daily database backups. Schedule a monthly restore drill into a separate project.
- Enable Storage backups or object versioning appropriate to the chosen provider and document the retention period.
- Alert on `/api/ready` failures, repeated HTTP 5xx responses, Stripe webhook failures, stale ClamAV signatures, SMTP failures, database capacity, and backup failures.
- Send container logs to a retained log service. The API emits JSON request and error records with request IDs.
- Rotate Supabase, Stripe, SMTP, Solvy, and file-signing secrets on a documented schedule and immediately after suspected exposure.
- Publish privacy, retention, refund, academic-integrity, and terms policies reviewed for the countries where SolveNest operates.

## Latest implementation and verification status

- Apply migrations 001 through 009 in order. Migration 009 preserves Admin audit records in domain storage; do not deploy this application version without it.
- After building the client and configuring server/.env.production, run `npm run preflight --prefix server`. It reports configuration names only and does not validate provider connectivity.
- For the supplied HTTPS proxy, set APP_DOMAIN and run `docker compose -f compose.production.yml -f compose.https.yml up -d --build`. Point DNS to the host first and configure the exact proxy hop count. See server/SETUP.md.
- Student Account provides a JSON data export and a staff-reviewed closure request. Closure does not delete data or disable the account. Define retention and deletion policies before adding automatic deletion.
- Refund rule confirmed: unfinished agreed work is eligible for a refund after staff verifies the task and payment records; disputed completed work requires review against the accepted scope and delivery. Student Help includes separate request reasons for both. Refund execution is not implemented by these support requests. Define partial milestone refund amounts and retention periods before automating refunds or deletion. Staff account suspension and notification delivery requirements also need completion review.
- The frontend production build and server syntax checks passed locally. No automated tests were written or run, as requested.
- Browser inspection could not connect to the local preview. Check all four roles at mobile, tablet, and desktop widths, keyboard navigation, drawer focus, and error/reconnect states before release.
- Database migrations, Docker runtime, SMTP, Stripe, Supabase, and Solvy still require verification with configured services. The preflight command cannot certify these integrations.
- The optional WhyHeroCanvas bundle remains large (approximately 885 kB minified); evaluate its loading performance on mobile connections.

## Role navigation

- Student: enter the Student sign-in flow and use `/student` for tasks, payments, messages, files, and account settings.
- Expert: use `/expert/login`, then `/expert/dashboard` for assigned work.
- Admin: use `/admin` for operational task review, assignment, quality review, and support.
- Superadmin: use `/superadmin` for governance and role management.
- Admin and Superadmin are separate roles and sessions. Provision the appropriate role through the controlled governance process; neither workspace should offer a shortcut that grants access to the other role.
