# ReachInbox — Email Job Scheduler

A production-grade full-stack email scheduling system built for the ReachInbox Software Development Intern assignment.

The project uses **Express + TypeScript**, **BullMQ + Redis**, **PostgreSQL + Prisma**, **Ethereal SMTP**, and a **Next.js + Tailwind CSS** dashboard with **real Google OAuth**.

Emails are persisted in PostgreSQL, scheduled as BullMQ delayed jobs, processed by configurable workers, rate-limited through Redis-backed counters, and delivered through Ethereal Email for safe testing.

> **No cron jobs are used anywhere.**

---

## Features

### Backend

- TypeScript + Express.js API
- PostgreSQL with Prisma
- BullMQ delayed jobs backed by Redis
- Persistent scheduling across process restarts
- Separate BullMQ worker process
- Configurable worker concurrency
- Configurable minimum delay between sends
- Configurable per-sender hourly rate limits
- Redis-backed atomic hourly counters
- Rate-limited jobs are delayed into the next available window instead of dropped
- Multiple Ethereal senders
- Exponential retry/backoff for transient SMTP failures
- Application-level idempotency protection
- Deterministic BullMQ job IDs
- Conditional database claim before SMTP send
- Boot-time reconciliation for pending database jobs
- Zod request validation
- Structured API errors
- User-scoped authenticated data access

### Frontend

- Next.js + TypeScript + Tailwind CSS
- Real Google OAuth login
- Protected dashboard routes
- Authenticated user name, email, avatar, and logout
- Professional SaaS dashboard
- Scheduled Emails view
- Sent Emails view
- Compose New Email modal
- CSV/TXT lead upload
- Recipient parsing and de-duplication
- Sender selection
- Start time configuration
- Minimum delay configuration
- Hourly cap configuration
- Search and pagination
- Loading, empty, and error states
- Ethereal preview links for sent emails
- Responsive desktop/tablet/mobile layout

---

## Tech Stack

### Backend

- Node.js
- TypeScript
- Express.js
- BullMQ
- Redis
- PostgreSQL
- Prisma
- Nodemailer
- Ethereal Email
- Zod

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Auth.js / NextAuth
- lucide-react

### Infrastructure

- Docker Compose
- PostgreSQL
- Redis with AOF persistence

---

## Architecture

```text
                     ┌──────────────────────┐
                     │   Next.js Frontend   │
                     │   Google OAuth       │
                     └──────────┬───────────┘
                                │
                                │ Authenticated API requests
                                ▼
                     ┌──────────────────────┐
                     │    Express API       │
                     │ validate + authorize │
                     └──────┬────────┬──────┘
                            │        │
                      DB write      BullMQ delayed jobs
                            │        │
                    ┌───────▼───┐  ┌─▼──────────────┐
                    │PostgreSQL │  │ Redis / BullMQ │
                    │source of  │  │ delayed queue  │
                    │truth      │  │ rate counters  │
                    └───────▲───┘  └──────┬────────┘
                            │             │
                            │             ▼
                            │      ┌───────────────┐
                            └──────│ BullMQ Worker │
                                   │ concurrency N │
                                   └──────┬────────┘
                                          │
                                          ▼
                                   Ethereal SMTP
```

**PostgreSQL is authoritative.** Redis holds BullMQ queue state and distributed rate-limit counters. Business state such as scheduled time, sent time, status, provider message ID, failure details, and campaign ownership lives in PostgreSQL.

---

## How Scheduling Works

1. `POST /api/campaigns` validates the payload with Zod.
2. Recipients are normalized and de-duplicated.
3. A `Campaign` is created for the authenticated user.
4. One `EmailJob` row is created per recipient.
5. Each recipient receives its own scheduled time:

```text
scheduledAt = startAt + (recipientIndex × delayMs)
```

6. One BullMQ delayed job is created per `EmailJob`.
7. The BullMQ job ID is deterministically derived from the database email job ID, for example:

```text
email-550e8400-e29b-41d4-a716-446655440000
```

8. BullMQ stores delayed jobs in Redis until they become due.
9. A worker claims and sends each job.

There is **no cron scheduler** and no application-level `setTimeout` loop used as the primary scheduler.

---

## Restart Persistence

Redis uses AOF persistence and persistent storage, so delayed BullMQ jobs survive ordinary API/worker process restarts.

A boot-time reconciliation pass also compares non-terminal `EmailJob` rows in PostgreSQL with BullMQ. If a pending DB record is missing from Redis, it can be safely restored using its deterministic job ID.

This means future scheduled emails do not restart from scratch after a process restart.

---

## Idempotency

BullMQ is at-least-once, so duplicate protection is enforced at the application layer.

### Deterministic job IDs

Each BullMQ job ID is derived from the database email job ID:

```text
email-<EmailJob UUID>
```

### Atomic database claim

Before SMTP send, the worker conditionally claims a pending email. Conceptually:

```sql
UPDATE "EmailJob"
SET status = 'sending'
WHERE id = $1
  AND status IN ('scheduled', 'queued');
```

Only one worker can successfully claim the row.

### Terminal-state guard

Already completed terminal records are not sent again.

> True end-to-end exactly-once SMTP delivery cannot be guaranteed across a network boundary. If a worker crashes after SMTP accepts a message but before PostgreSQL records success, a retry can occur. The system therefore provides application-level idempotency and duplicate protection rather than claiming impossible exactly-once semantics.

---

## Worker Concurrency

Worker concurrency is configurable:

```env
WORKER_CONCURRENCY=5
```

Up to the configured number of jobs may be in flight simultaneously.

---

## Minimum Delay Between Emails

Default:

```env
MIN_DELAY_BETWEEN_EMAILS_MS=2000
```

That corresponds to a **2 second minimum gap between send starts**. The limiter is Redis-backed and coordinated across workers.

---

## Hourly Rate Limiting

Default:

```env
MAX_EMAILS_PER_HOUR_PER_SENDER=200
```

The assignment does **not** require exactly 200 emails/hour; `200` is the chosen default and the limit is configurable.

Rate limiting uses Redis-backed atomic counters scoped by sender/hour window. When the limit is reached, jobs are **not dropped** and **not permanently failed**. They are delayed into the next available window while preserving ordering as much as practical.

---

## Behavior Under Load

For 1000+ recipients scheduled around the same time:

- PostgreSQL persists one `EmailJob` per recipient
- BullMQ holds the corresponding delayed jobs
- worker concurrency controls parallel processing
- the minimum delay controls send-start rate
- Redis-backed sender counters enforce hourly caps
- overflow jobs are delayed into later windows

This prevents a thundering herd of SMTP sends.

---

## Ethereal Email

Ethereal is intentionally used because the assignment requires fake SMTP for testing.

Messages are accepted and rendered by Ethereal but are not delivered to real external inboxes.

If sender credentials are not provided, the application can provision test accounts through Nodemailer. Stable Ethereal credentials can also be configured through environment variables.

Example:

```env
SENDER_0_EMAIL=your-ethereal-address
SENDER_0_NAME=Outreach One
SENDER_0_USER=your-ethereal-user
SENDER_0_PASS=your-ethereal-password
```

Successful sends store the provider message ID and Ethereal preview URL so the dashboard can expose **Preview Email**.

---

## Google OAuth

The frontend uses real Google OAuth through Auth.js / NextAuth.

For local development, configure a Google OAuth **Web application** client with:

```text
Authorized JavaScript origin:
http://localhost:3000

Authorized redirect URI:
http://localhost:3000/api/auth/callback/google
```

Frontend environment variables:

```env
AUTH_GOOGLE_ID=your-google-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-google-client-secret
AUTH_SECRET=generate-a-random-secret
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Backend:

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Do not commit `.env` or `.env.local`.

---

## User Data Isolation

Authenticated dashboard data is scoped to the current user.

Users only see their own:

- campaigns
- scheduled email history
- sent email history
- user-specific dashboard statistics

Ownership is enforced in backend/database queries rather than only hidden in React.

---

## API Reference

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health and queue status |
| `GET` | `/api/me` | Current authenticated user |
| `GET` | `/api/senders` | Available senders |
| `POST` | `/api/campaigns` | Schedule a campaign |
| `DELETE` | `/api/campaigns/:id` | Cancel pending jobs for an owned campaign |
| `GET` | `/api/emails/scheduled` | Scheduled/queued/sending emails |
| `GET` | `/api/emails/sent` | Sent/failed history |
| `GET` | `/api/stats` | User-scoped dashboard statistics |

Example request:

```json
{
  "subject": "ReachInbox Scheduler Demo",
  "body": "This is a scheduled test email.",
  "recipients": [
    "demo1@example.com",
    "demo2@example.com"
  ],
  "startAt": "2026-08-14T12:00:00.000Z",
  "delayMs": 2000,
  "hourlyLimit": 200
}
```

---

## Quick Start

### Requirements

- Node.js 20+
- pnpm
- Docker

### 1. Start infrastructure

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure backend

```bash
cd apps/api
cp .env.example .env
```

### 4. Prisma

Use the scripts defined in `apps/api/package.json`, for example:

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

### 5. Start API

```bash
pnpm dev
```

API:

```text
http://localhost:4000
```

### 6. Start worker

In another terminal:

```bash
cd apps/api
pnpm worker
```

### 7. Configure frontend

```bash
cd apps/web
cp .env.example .env.local
```

Add your Google OAuth values.

### 8. Start frontend

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

---

## Environment Variables

Representative backend configuration:

```env
DATABASE_URL=
REDIS_URL=

WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
JOB_MAX_ATTEMPTS=3
JOB_BACKOFF_MS=5000
RECONCILE_ON_BOOT=true

GOOGLE_CLIENT_ID=

SENDER_0_EMAIL=
SENDER_0_NAME=
SENDER_0_USER=
SENDER_0_PASS=
```

Frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXTAUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_SECRET=
```

Use `.env.example` files for placeholders only.

---

## Testing

The backend includes automated coverage for reliability-critical behavior.

Current verified suite:

```text
10 automated tests passing
14 reliability scenarios covered
```

Coverage includes:

- campaign scheduling
- recipient de-duplication
- scheduled time calculation
- deterministic BullMQ job IDs
- atomic worker claim
- already-completed job protection
- Redis hourly limits
- concurrent limit reservations
- sender isolation
- rate-limit rescheduling
- SMTP success handling
- retry/final-failure behavior
- reconciliation without duplicate queue jobs

Run the configured test command from `apps/api`:

```bash
pnpm test
```

Also run production builds before submission.

---

## Manual Restart Test

1. Start PostgreSQL and Redis.
2. Start the API and worker.
3. Schedule an email several minutes in the future.
4. Confirm it appears under Scheduled Emails.
5. Stop the API and worker.
6. Keep PostgreSQL and Redis running.
7. Restart the API and worker.
8. Confirm the original job remains scheduled.
9. Wait for its scheduled time.
10. Confirm it moves to Sent Emails.
11. Open its Ethereal preview.

---

## Assignment Requirement Mapping

### Backend

- [x] TypeScript
- [x] Express.js
- [x] PostgreSQL
- [x] BullMQ
- [x] Redis
- [x] BullMQ delayed jobs
- [x] No cron jobs
- [x] Ethereal SMTP
- [x] Multiple senders
- [x] Restart persistence
- [x] Idempotency protection
- [x] Configurable worker concurrency
- [x] Minimum delay between sends
- [x] Configurable hourly rate limiting
- [x] Distributed Redis-backed counters
- [x] Over-limit rescheduling
- [x] Retry/backoff
- [x] 1000+ email load behavior documented

### Frontend

- [x] Real Google OAuth
- [x] User name/email/avatar
- [x] Logout
- [x] Compose New Email
- [x] Subject + body
- [x] CSV/TXT lead upload
- [x] Recipient count
- [x] Start time
- [x] Delay setting
- [x] Hourly limit setting
- [x] Scheduled Emails table
- [x] Sent Emails table
- [x] Loading states
- [x] Empty states
- [x] Error handling
- [x] Reusable TypeScript UI components

---

## Trade-offs

### Fixed hourly windows

A fixed-window Redis counter is used instead of a sliding window. This keeps the distributed implementation simple and atomic across workers.

### Queue-wide minimum pacing

The minimum-delay limiter controls queue-wide send-start pacing, while hourly limits are enforced separately per sender.

### At-least-once delivery

BullMQ jobs are at-least-once and Ethereal does not provide a provider-side idempotency key. Deterministic queue IDs, conditional DB claims, and terminal-state guards reduce duplicate risk.

### Polling

The dashboard refreshes email state periodically instead of maintaining a WebSocket connection. This keeps the assignment simpler while still providing near-real-time updates.

### One sender per campaign

A campaign selects one sender at creation time. Multiple sender identities are supported across campaigns and rate-limited independently.

---

## Security Notes

- Real Google OAuth, not mocked
- Backend identity derived from verified authentication
- User data scoped to authenticated ownership
- No cron-based scheduling
- No arbitrary shell execution
- API input validation
- Secrets kept out of Git
- PostgreSQL remains the business source of truth

---

## Repository Structure

```text
reachinbox-email-scheduler/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   └── src/
│   └── web/
│       └── src/
├── samples/
│   └── leads.csv
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── README.md
└── .gitignore
```

---

## Demo Checklist

The submission demo should show:

1. Google login
2. Dashboard
3. CSV/TXT lead upload
4. Compose campaign
5. Schedule future emails
6. Scheduled Emails table
7. Stop API/worker
8. Restart API/worker
9. Confirm the scheduled job survives
10. Sent Emails table
11. Ethereal preview
12. Optional rate-limit demonstration
13. Automated test results

---

## Submission

The final submission includes:

- Private GitHub repository
- Repository access for the requested reviewers
- Hosted project URL
- Demo video (maximum 5 minutes)
- Completed assignment submission form

---

Created for the ReachInbox / Outbox Labs Software Development Intern hiring assignment.
