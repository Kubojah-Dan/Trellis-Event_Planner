# Trellis — AI-Powered Celebration & Event Planning Platform

> **An intelligent celebration and event planning workspace** transforming human intent into tailored, structured, editable plans through adaptive GenAI discovery, deterministic domain validation, and a governed revision engine.

Trellis provides specialized workflows for **Weddings**, **Milestone Birthdays**, **Community Gatherings & Fundraisers**, and **Custom Celebrations**.

---

## 1. Architectural Highlights

Trellis adheres strictly to clean architectural separation between presentation, deterministic domain logic, infrastructure adapters, and GenAI orchestration:

```
trellis/
├── apps/
│   ├── web/                     # React 19 + TypeScript + Vite + Tailwind CSS (Editorial Theme)
│   └── api/                     # Node.js + Express + TypeScript + Firebase Admin + @google/genai
├── packages/
│   ├── domain/                  # Pure math & invariants (integer minor units, Kahn's cycle detection, diffing)
│   ├── contracts/               # Shared Zod schemas, TypeScript DTOs, and API error envelopes
│   └── config/                  # Event capability registry, category tokens, provenance kinds
├── tests/
│   ├── unit/                    # Money math, currency precision, date validation, cycle detection
│   ├── integration/             # API auth, tenant isolation, AI discovery turns, concept generation, revisions
│   ├── security/                # Secret scanning, sliding-window rate limiting (429), payload limits (413), IDOR
│   └── e2e/                     # End-to-end user journeys (intake -> concepts -> plan -> edit & lock -> revision diff -> approval)
└── docs/
    ├── SUBMISSION_EVIDENCE.md   # Verified tooling, prompt evolution, and audit evidence
    ├── DESIGN.md                # System design and non-negotiable architectural principles
    └── PHASE.md                 # 7-phase execution record and gates
```

### The Code vs. GenAI Boundary

| Concern | Enforced By | Technical Guarantee |
|---|---|---|
| **Budget arithmetic & totals** | Deterministic Code (`@trellis/domain`) | Exact integer minor-unit math (`cents`), tax, contingency, zero floating-point errors |
| **Schedule dependencies** | Deterministic Code (`@trellis/domain`) | Kahn's algorithm detects circular dependencies; strict ISO 8601 date validation |
| **Decision preservation** | Deterministic Code (`@trellis/domain`) | Re-planning strictly preserves items marked `locked: true` and tasks marked `status: 'done'` |
| **Access control & Auth** | Deterministic Code (`@trellis/api`) | Bearer token validation, tenant ACL check per operation, no client writes to Firestore |
| **Adaptive inquiry & turns** | GenAI (`@google/genai`) | Heuristic `priority = impact × uncertainty × urgency`, asks high-impact questions first |
| **Personalized concepts** | GenAI (`@google/genai`) | Multi-dimensional concepts with `whyItFits`, `costBasis`, `tradeoffs`, and `effortLevel` |
| **Change proposal synthesis** | GenAI (`@google/genai`) | Unstructured user prompt translated to typed atomic operations (`add`, `update`, `remove`) |

---

## 2. Prerequisites & Stack

- **Node.js**: v22 LTS (tested on `v22.20.0`)
- **Package Manager**: `pnpm` v10+ (tested on `v10.30.3`)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide React
- **Backend**: Node.js, Express, TypeScript, `@google/genai` (Gemini 2.5 Flash)
- **Database / Auth**: Cloud Firestore (with `firestore.rules`), Firebase Auth
- **Testing**: Vitest v3.2.7 (47 automated tests passing)

---

## 3. Quick Start & Local Execution

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
- **Database**: Automatically uses the in-memory repository or local Firebase Emulator Suite.
- **AI Planning**: Defaults to the built-in isolated `SimulatedPlanGenerator` for deterministic offline testing.
- **Live Gemini Integration**: Set `GEMINI_API_KEY=your_actual_key` in `.env.local` to enable live Gemini 2.5 Flash calls.

### 3. Running Development Servers
Start both the React frontend and Express API concurrently:
```bash
pnpm dev
```
- **Web App**: [http://localhost:5173](http://localhost:5173)
- **API Server**: [http://localhost:8080](http://localhost:8080)
- **Health Endpoint**: [http://localhost:8080/health](http://localhost:8080/health)

---

## 4. Test Suite Execution

Trellis features a test suite covering unit math, API integration, security audits, and full E2E journeys:

```bash
# Run all 47 tests across the monorepo
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
# Run strict TypeScript check across all workspace packages
pnpm typecheck

# Build all packages and applications for production
pnpm build
```

---

## 5. Security & Privacy Hardening

1. **Zero Secret Leakage:**
   - Automated regex scanning in `tests/security/security_and_privacy.test.ts` scans all source files (`apps/`, `packages/`, `tests/`) to verify no API keys, private keys, or credentials exist in source.
   - `.env.example` contains only safe placeholder identifiers.
   - Real environment files are strictly gitignored.

2. **Multi-Tenant Isolation (IDOR Resistance):**
   - Every read and mutation validates the authenticated actor token and verifies ownership or membership.
   - Cross-tenant access attempts return HTTP 403 `FORBIDDEN`.

3. **Rate Limiting & DoS Protection:**
   - In-memory sliding-window rate limiter per actor/IP (`120 requests/minute`).
   - Exceeding the threshold returns HTTP 429 `RATE_LIMIT_EXCEEDED` with retry time headers.
   - Strict 1MB JSON body size limit (`express.json({ limit: '1mb' })`) returns HTTP 413 `PAYLOAD_TOO_LARGE`.

4. **Database Access Rules (`firestore.rules`):**
   - Direct client writes to `/events/{eventId}` and all subcollections (`tasks`, `budgetItems`, `vendors`, `ideas`, `versions`, `proposals`) are strictly **DENIED** (`allow write: if false;`).
   - All mutations must pass through the authorized Cloud Run API.
   - Read permissions require authenticated membership verification (`isEventMember(eventId)`).
   - No permissive `allow read, write: if true;` rules exist anywhere.

5. **Safe Logging & Observability:**
   - Every request is tagged with a unique `X-Request-Id` UUID header.
   - Error handler outputs structured JSON logs with path, method, and error name, strictly redacting authentication tokens and personal data.

---

## 6. Cloud Run & Firebase Deployment Guide

> **Important:** Trellis is designed to run locally first. Do not deploy to Google Cloud or enable billable services without explicit administrative approval.

### Deploying the API to Google Cloud Run
The API includes a multi-stage production Dockerfile (`apps/api/Dockerfile`) that compiles TypeScript and runs as an unprivileged user:

```bash
# 1. Build and tag container image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/trellis-api

# 2. Deploy to Cloud Run (with ADC service identity, no JSON service keys needed)
gcloud run deploy trellis-api \
  --image gcr.io/YOUR_PROJECT_ID/trellis-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,PORT=8080,FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
```

### Deploying the Web Frontend to Firebase Hosting
`firebase.json` is configured to serve `apps/web/dist` with SPA routing and rewrites `/api/**` to Cloud Run:

```bash
# 1. Build web application
pnpm --filter @trellis/web run build

# 2. Deploy hosting targets and Firestore rules
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

---

## 7. Honest Limitations & Operational Boundaries

1. **Live Vendor Lookup:** Google Places API and live web search require billing-enabled Google Cloud credentials and API keys. When unconfigured, Trellis operates in verified checklist mode allowing organizers to record candidate quotes and statuses manually, without fabricating fake vendor records.
2. **AI Provider Availability:** If `GEMINI_API_KEY` is omitted, requests to the live AI router return a transparent HTTP 503 `AI_PROVIDER_UNAVAILABLE` explaining that configuration is missing. Trellis **never** silently swaps in canned fake AI plans.
3. **Unpaid Model Tier Data Notice:** In accordance with Google Gemini API terms for unpaid tiers, sensitive personal data (e.g., guest contact directories or payment details) must never be passed to unpaid model endpoints.
