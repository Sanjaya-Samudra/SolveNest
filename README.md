# SolveNest

SolveNest is a student-focused platform where learners can submit academic tasks and get expert guidance, support, and feedback in a modern digital experience.

The project is built for students, mentors, and admins, with a premium academic feel and a strong emphasis on usability, trust, and smooth mentorship workflows.

## What SolveNest does

- Students can submit assignments, projects, and study-related tasks.
- Experts and mentors can review and guide students with structured support.
- Admins manage the platform and oversee operations.
- The platform supports secure file uploads and pay-per-task transactions.
- The overall experience is designed with a premium 3D visual style and modern interface.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Three.js
- Node.js

## Run locally

Install dependencies in both `client` and `server`, then run `npm run dev` from the project root. This starts the API on port 4174 and Vite on its available development port. Starting only Vite leaves `/api` requests without a server, so the Student and Expert workspaces cannot load.

The Admin review workspace is at `/admin`. Local development can preview it with `ADMIN_DEMO_SESSION=1` in `server/.env`; this preview is limited to loopback requests and never applies in production. A deployed Admin signs in with a Supabase profile whose role is `Admin` or `Superadmin`.

The Super Admin workspace is at `/superadmin`. It shows platform operations, service configuration, team access, and decision history. Set `SUPERADMIN_DEMO_SESSION=1` in `server/.env` for a loopback-only local preview; team access changes require a real Superadmin account and the staff governance migration.

Admin operations are split into task intake (`/admin`), quality review (`/admin/qa`), and support requests (`/admin/support`). Reviewers can inspect files in the relevant case before acting. Support status changes and quality decisions are recorded for Super Admin oversight. The Super Admin control room uses live operational counts and clearly labels service configuration checks as configuration signals rather than uptime checks.

Students can see only their own support requests. When an Admin marks a request as waiting on the Student, a separate Student-facing message explains what is needed; internal staff notes remain private.
