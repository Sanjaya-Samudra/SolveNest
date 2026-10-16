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

- Apply migrations 001 through 016 in order. The latest migrations add scoped domain indexes, cross-instance scheduled-job leases, and a durable retrying notification-email outbox.
- After building the client and configuring server/.env.production, run `npm run preflight --prefix server`. It reports configuration names only and does not validate provider connectivity.
- For the supplied HTTPS proxy, set APP_DOMAIN and run `docker compose -f compose.production.yml -f compose.https.yml up -d --build`. Point DNS to the host first and configure the exact proxy hop count. See server/SETUP.md.
- Student Account provides a JSON data export and a staff-reviewed closure request. Account deletion remains staff-reviewed because financial, dispute, and legal retention periods must be chosen for the launch jurisdiction before destructive deletion can be enabled.
- Refund handling supports staff review, provider-backed execution, and payment/task reconciliation. Unfinished agreed work is eligible after verification; disputed completed work is reviewed against the accepted scope and delivery. Define the published partial-milestone calculation and jurisdiction-specific wording before launch.
- Student notification preferences now govern future in-app and email delivery by task, message, and payment category. Enabled email notifications enter a durable outbox and are retried with backoff.
- Signed Stripe events are claimed by provider event ID before processing. Subscribe to refund and dispute events as well as Checkout and PaymentIntent events.
- The frontend production build and server syntax checks passed locally. No automated tests were written or run, as requested.
- The browser automation surface was unavailable during the final pass. Complete the live-provider launch verification above at mobile, tablet, and desktop widths before accepting customers.
- Database migrations, Docker runtime, SMTP, Stripe, Supabase, and Solvy still require verification with configured services. Set `ACTIVE_POLICY_VERSION` after legal review; the preflight command cannot certify these integrations.
- The Why SolveNest route now uses its responsive document visual and builds to about 28 kB of route JavaScript instead of the previous approximately 885 kB WebGL chunk.

## Role navigation

- Student: enter the Student sign-in flow and use `/student` for tasks, payments, messages, files, and account settings.
- Expert: use `/expert/login`, then `/expert/dashboard` for assigned work.
- Admin: use `/admin` for operational task review, assignment, quality review, and support.
- Superadmin: use `/superadmin` for governance and role management.
- Admin and Superadmin are separate roles and sessions. Provision the appropriate role through the controlled governance process; neither workspace should offer a shortcut that grants access to the other role.
