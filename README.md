# Trellis — AI-Powered Celebration & Event Planning Platform

> **An intelligent celebration and event planning workspace** transforming human intent into tailored, structured, editable plans through adaptive GenAI discovery, multi-provider AI resilience, deterministic domain validation, governed atomic revisions, and calm email notifications.

Trellis provides specialized workflows for **Weddings**, **Milestone Birthdays**, **Community Gatherings & Fundraisers**, and **Custom Celebrations**.

---

## 1. Architectural Highlights

Trellis adheres strictly to clean architectural separation between presentation, deterministic domain logic, infrastructure adapters, and GenAI orchestration:

```
trellis/
├── apps/
│   ├── web/                     # React 19 + TypeScript + Vite + Tailwind CSS (Editorial Theme)
│   │   ├── src/components/      # UI components (auth, events, notifications, common voice intake)
│   │   ├── src/context/         # AuthContext (30-min idle timeout, session security)
│   │   └── src/pages/           # Event overview, discovery, studio, timeline, and landing views
│   └── api/                     # Node.js + Express + TypeScript + Firebase Admin + GenAI
│       ├── src/infrastructure/  # Gemini/Groq AI adapters, Resend email service, Firestore/memory repos
│       └── src/routes/          # /api/events, /api/ai, /api/notifications, /health
├── packages/
│   ├── domain/                  # Pure math & invariants (integer minor units, Kahn's cycle detection, diffing)
│   ├── contracts/               # Shared Zod schemas, TypeScript DTOs, notification payloads, API envelopes
│   └── config/                  # Event capability registry, category tokens, provenance kinds
├── tests/
│   ├── unit/                    # Money math, currency precision, date validation, cycle detection (20 tests)
│   ├── integration/             # API auth, tenant isolation, AI discovery, concepts, revisions (15 tests)
│   ├── security/                # Secret scanning, sliding-window rate limiting (429), payload limits (413), IDOR (15 tests)
│   └── e2e/                     # End-to-end full lifecycle user journeys (1 comprehensive test)
└── docs/
    └── SUBMISSION_EVIDENCE.md   # Verified tooling, prompt evolution, and audit evidence
```

### The Code vs. GenAI Boundary

| Concern | Enforced By | Technical Guarantee |
|---|---|---|
| **Budget arithmetic & totals** | Deterministic Code (`@trellis/domain`) | Exact integer minor-unit math (`cents`), tax, contingency, zero floating-point errors |
| **Schedule dependencies** | Deterministic Code (`@trellis/domain`) | Kahn's algorithm detects circular dependencies; strict ISO 8601 date validation |
| **Decision preservation** | Deterministic Code (`@trellis/domain`) | Re-planning strictly preserves items marked `locked: true` and tasks marked `status: 'done'` |
| **Access control & Auth** | Deterministic Code (`@trellis/api`) | Bearer token validation, tenant ACL check per operation, no client writes to Firestore |
| **Session Inactivity Timeout** | Deterministic Code (`@trellis/web`) | Automatic 30-minute idle logout listening to mouse, key, touch, and scroll events |
| **Email alerts & notifications** | Deterministic Code (`@trellis/api`) | Resend API integration with responsive HTML templates and dev simulation mode |
| **Adaptive inquiry & turns** | GenAI (`@google/genai` / Groq) | Heuristic `priority = impact × uncertainty × urgency`, asks high-impact questions first |
| **Personalized concepts** | GenAI (`@google/genai` / Groq) | Multi-dimensional concepts with `whyItFits`, `costBasis`, `tradeoffs`, and `effortLevel` |
| **Change proposal synthesis** | GenAI (`@google/genai` / Groq) | Unstructured user prompt translated to typed atomic operations (`add`, `update`, `remove`) |

---

## 2. Current Features & System Capabilities

### 🌟 AI Planning & Discovery
- **Adaptive Discovery Turns**: Trellis analyzes user event briefs and asks high-impact clarifying questions when details are missing, rather than hallucinating assumptions.
- **Dual AI Provider Resilience**: Primary orchestration via **Google Gemini 2.5 Flash** (`@google/genai`) with seamless fallback to **Groq AI** (`openai/gpt-oss-120b`) for ultra-fast, uninterrupted generation if quotas or rate limits are reached.
- **Governed Change Proposals & Atomic Revisions**: When users request edits, the AI proposes structured diff operations (`add`, `update`, `remove`). Locked items and completed checklist tasks are strictly protected against accidental overwrites.
- **Voice Intake**: Built-in speech-to-text recognition via Web Speech API (`VoiceIntakeModal`) allowing organizers to dictate their event vision naturally.

### ✉️ Email Notifications & Alert Engine
- **Resend Service Integration**: Fully integrated email delivery engine (`apps/api/src/infrastructure/email/email-service.ts`) using [Resend](https://resend.com) with beautiful, branded HTML templates.
- **Simulation Mode**: If `RESEND_API_KEY` is not configured, the API operates in zero-crash simulated mode, outputting structured logs to the server console.
- **Event Lifecycle Alerts**:
  - **Milestone Completions**: Celebrates to-do progress as tasks are checked off.
  - **Plan Creation & Revisions**: Delivers calibrated briefings when plans or AI patches are generated.
  - **Day-of Reminders & Countdowns**: Morning briefings and reminders as celebration dates approach.
- **Notification Preferences Modal**: Clean, scroll-safe modal with sticky header, visible close (`X`) button, pinned action footer, and background scroll locking.

### 🔐 Security & Multi-Tenancy
- **30-Minute Inactivity Auto-Logout**: Protects user sessions on shared devices by tracking idle time and cleanly signing out inactive users with redirection to the landing page.
- **Strict Multi-Tenant Isolation (IDOR Resistance)**: Every read and mutation verifies tenant ownership; unauthorized access attempts are rejected with HTTP 403 `FORBIDDEN`.
- **Sliding-Window Rate Limiting**: Built-in rate limiting (120 req/min) returning HTTP 429 when thresholds are exceeded, with strict $O(1)$ memory capping.
- **Database Access Rules (`firestore.rules`)**: Direct client writes to `/events` and subcollections are strictly denied (`allow write: if false;`). All mutations must pass through the authorized API.
- **Zero Secret Leakage**: Enforced by automated regex security scan across all source packages.

### ⚡ Resource Efficiency & Performance Optimization
- **Route-Based Code Splitting (`React.lazy`)**: All 9 primary workspace pages (`DashboardPage`, `DiscoveryPage`, `EventOverviewPage`, `BudgetPage`, `TasksPage`, `TimelinePage`, `VendorsPage`, `IdeasPage`, `RevisionsPage`) are dynamically code-split with `Suspense` fallbacks, reducing entry chunk size by **92%** (from 1.17 MB down to 124 kB).
- **Vendor Chunk Isolation**: Vite Rollup chunking separates heavy vendor dependencies (`vendor-react-core`, `vendor-firebase`, `vendor-query`, `vendor-icons`, `vendor-router`) to prevent monolithic bundle transfer and enable long-term browser HTTP caching.
- **Strict $O(1)$ Bounded Memory in Rate Limiter**: Rate limiter map uses automatic sliding TTL eviction and a hard 5,000-entry cap with LRU pruning, guaranteeing zero memory leaks from ephemeral client IPs or tokens.
- **Indexed In-Memory Repository**: The repository maintains inverted secondary indices (`Map<eventId, Set<id>>`), transforming $O(N)$ full-memory table scans into $O(1)$ direct lookups for all tasks, budget items, vendors, ideas, and proposals.
- **TanStack Query Cache Optimization**: Configured with a 1-minute `staleTime` and 10-minute `gcTime` to eliminate network thrashing during workspace navigation while minimizing garbage collection pressure.
- **Context Re-Render Guard**: `AuthContext` memoizes its provider value with `useMemo`, preventing needless cascading re-renders across consumers.

### 💾 Resilient Storage Layer
- **Cloud Firestore**: Production database with subcollection support (`tasks`, `budgetItems`, `vendors`, `ideas`, `versions`, `proposals`).
- **In-Memory Repository Auto-Fallback**: Automatically falls back to an in-memory repository when Firebase credentials are unset (e.g. on Render free-tier or offline development), guaranteeing 100% testability with zero crashes.

---

## 3. Technology Stack

- **Runtime**: Node.js 20.x, 22.x LTS, and 24.x supported (`engines: { "node": ">=20.0.0" }`)
- **Package Manager**: `pnpm` v10+ (workspace monorepo)
- **Frontend (`apps/web`)**: React 19, TypeScript, Vite 6, Tailwind CSS, Lucide React, Sonner (toasting)
- **Backend (`apps/api`)**: Node.js, Express, TypeScript, Firebase Admin SDK
- **AI Providers**: `@google/genai` (Gemini 2.5 Flash), Groq SDK / REST fallback
- **Email Provider**: Resend API
- **Testing**: Vitest v3.2.7 (**51 automated tests** passing across 7 test suites)

---

## 4. Quick Start & Local Execution

### 1. Installation
Clone the repository and install workspace dependencies:
```bash
pnpm install
```

### 2. Environment Configuration
Copy the template environment file:
```bash
cp .env.example .env.local
```

For offline local development, Trellis runs completely without external cloud credentials:
- **Database**: Automatically falls back to the in-memory repository or local Firebase Emulator Suite.
- **AI Planning**: Defaults to the built-in isolated `SimulatedPlanGenerator` for deterministic offline testing.
- **Email Delivery**: Defaults to simulated mode (logs dispatch info to console without network errors).

To activate live cloud features locally, configure keys in `.env.local`:
```env
# Live Gemini AI
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# Groq AI Fallback (Optional)
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b

# Email Service (Resend)
RESEND_API_KEY=re_your_resend_api_key
NOTIFICATION_EMAIL_FROM="Trellis Celebrations <onboarding@resend.dev>"
APP_BASE_URL=http://localhost:5173
```

### 3. Running Development Servers
Start both the React frontend and Express API concurrently:
```bash
pnpm dev
```
- **Web App**: [http://localhost:5173](http://localhost:5173)
- **API Server**: [http://localhost:8080](http://localhost:8080)
- **Health Endpoint**: [http://localhost:8080/health](http://localhost:8080/health)

---

## 5. Test Suite Execution

Trellis features a test suite covering unit math, API integration, security audits, and full E2E journeys:

```bash
# Run all 51 tests across the monorepo
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test suites
pnpm vitest run tests/unit/domain.test.ts
pnpm vitest run tests/unit/contracts.test.ts
pnpm vitest run tests/integration/api.test.ts
pnpm vitest run tests/integration/ai.test.ts
pnpm vitest run tests/integration/revisions.test.ts
pnpm vitest run tests/security/security_and_privacy.test.ts
pnpm vitest run tests/e2e/core_journey.test.ts
```

### Type Checking & Production Build
```bash
# Run strict TypeScript check across all monorepo packages
pnpm typecheck

# Build all packages and applications for production
pnpm build
```

---

## 6. Deployment Guide

### Option A: Render (API) + Vercel (Web) — Recommended

This project includes a native [`render.yaml`](./render.yaml) specification for the Express API and is optimized for Vercel on the frontend.

#### 1. Deploy API on Render
- Connect your GitHub repository to [Render](https://render.com).
- Render detects `render.yaml` automatically to build and deploy `trellis-api`.
- Set the following environment variables in the **Render Dashboard**:
  - `GEMINI_API_KEY`: Your Google AI Studio API key.
  - `RESEND_API_KEY`: Your Resend API key (`re_...`).
  - `GROQ_API_KEY`: *(Optional)* Groq fallback API key.
  - `CORS_ORIGIN`: Your production Vercel frontend URL (e.g., `https://trellis-event-planner.vercel.app`).
  - `USE_IN_MEMORY_REPO`: Set to `true` if not connecting Firebase Service Account keys on Render.

#### 2. Deploy Web Frontend on Vercel
- Connect the repository to [Vercel](https://vercel.com) and select `apps/web` as the root directory.
- Build Command: `pnpm --filter @trellis/config --filter @trellis/contracts --filter @trellis/domain --filter @trellis/web run build`
- Output Directory: `dist`
- Configure Environment Variables:
  - `VITE_API_BASE_URL`: URL of your deployed Render API (e.g., `https://trellis-api.onrender.com`).
  - `VITE_FIREBASE_*`: Firebase Web client credentials for client authentication.

---

### Option B: Google Cloud Run & Firebase Hosting

#### Deploying API to Cloud Run:
```bash
# 1. Build and tag container image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/trellis-api

# 2. Deploy to Cloud Run
gcloud run deploy trellis-api \
  --image gcr.io/YOUR_PROJECT_ID/trellis-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,PORT=8080,FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
```

#### Deploying Web Frontend to Firebase Hosting:
```bash
# 1. Build web application
pnpm --filter @trellis/web run build

# 2. Deploy hosting targets and Firestore rules
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

---

## 7. Honest Limitations & Operational Boundaries

1. **Live Vendor Lookup:** Google Places API and live web search require billing-enabled Google Cloud credentials and API keys. When unconfigured, Trellis operates in verified checklist mode allowing organizers to record candidate quotes and statuses manually, without fabricating fake vendor records.
2. **AI Provider Availability:** If `GEMINI_API_KEY` and fallback keys are omitted, requests to the live AI router return a transparent HTTP 503 `AI_PROVIDER_UNAVAILABLE` explaining that configuration is missing. Trellis **never** silently swaps in canned fake AI plans.
3. **Email Delivery Tier:** On free Resend tiers without custom verified domains, outbound emails can be sent to the email address registered on your Resend account using `onboarding@resend.dev`. Verifying your domain in the Resend dashboard unlocks sending to any recipient address.
4. **Unpaid Model Tier Data Notice:** In accordance with Google Gemini API terms for unpaid tiers, sensitive personal data (e.g., guest contact directories or payment details) must never be passed to unpaid model endpoints.
