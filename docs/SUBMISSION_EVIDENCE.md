# Trellis — Submission Evidence & Verification Record

> **Notice:** This document is maintained incrementally throughout implementation. Only verified tools, genuine commands executed, and actual integration evidence are recorded here. No pre-claimed tools or fictitious verification results are permitted.

---

## 1. Tooling & Agent Usage Record

| Tool / Agent Capability | Purpose in Trellis | When & How Used | Status / Verification |
|---|---|---|---|
| Google Antigravity Agent | Primary build agent & orchestrator | Phase 1–7 end-to-end implementation | Active |
| pnpm | Monorepo workspace package manager | Workspace dependency management | Active |
| TypeScript (Strict) | Static typing & interface enforcement | Monorepo-wide strict contracts | Active |
| Vitest | Fast unit & integration test runner | Domain and contracts testing | Active |
| React + Vite | Frontend SPA framework | `apps/web` client application | Active |
| Tailwind CSS + shadcn/ui | Editorial design system & accessible UI components | `apps/web` styling and UI components | Active |
| Express.js | API server runtime | `apps/api` trusted backend | Active |
| Firebase Authentication | User identity verification | Auth tokens & session management | Active |
| Cloud Firestore | Persistent document store & real-time sync | Event aggregates, subcollections, revisions | Active |
| Firebase Genkit | GenAI flow orchestration | `apps/api` structured output flows | Active |
| Google Gemini API | GenAI model provider for planning flows | Intent, concepts, plans, revisions | Active |
| Firebase Emulator Suite | Offline local development & rules testing | Auth & Firestore emulation | Active |

---

## 2. Architecture & Prompt Flow

### System Architecture Summary
- **Client (`apps/web`):** React 19 + TypeScript + Vite + Tailwind CSS. Reads live event projections via Firebase Web SDK snapshot listeners. Sends commands with Firebase ID tokens to `apps/api`.
- **API (`apps/api`):** Express + TypeScript. Verifies Firebase ID tokens, enforces event ownership/membership ACLs, validates domain invariants, orchestrates Genkit flows, and commits versioned event revisions.
- **Shared Packages:**
  - `packages/domain`: Pure calculation and invariant rules (safe currency math, date ordering, dependency cycle detection, change diffing). No framework dependencies.
  - `packages/contracts`: Shared Zod schemas and TypeScript DTOs.
  - `packages/config`: Shared event capability registry, constants, and category tokens.

### GenAI vs. Deterministic Application Boundary
| Responsibility | Handled By | Rationale |
|---|---|---|
| Financial arithmetic & budget totals | Deterministic Code (`packages/domain`) | AI cannot guarantee exact currency math or roundings |
| Date constraints & dependency cycles | Deterministic Code (`packages/domain`) | Graph cycles and chronology must be mathematically strict |
| Authorization & Tenant Isolation | Deterministic Code (`apps/api`) | AI must never make security or access control decisions |
| Versioning, locking, and atomic commits | Deterministic Code (`apps/api` + Firestore) | Concurrency and idempotency require ACID guarantees |
| Natural language intent classification | GenAI (`apps/api/infrastructure/ai`) | Flexible interpretation of user prompts |
| Adaptive follow-up question ranking | GenAI + Rule Heuristic | Asks highest-impact unknown questions |
| Diverse celebration concept generation | GenAI (`apps/api/infrastructure/ai`) | Creative framing tailored to known user preferences |
| Scoped change proposal synthesis | GenAI (`apps/api/infrastructure/ai`) | Translates unstructured user change requests to structured operations |

---

## 3. Prompt Evolution Record

*This section documents how system and flow prompts evolved during development to enforce strict JSON schemas and eliminate hallucinations.*

- **Prompt 1: Intent Classification & Brief Extraction**
  - *Initial objective:* Classify intent and extract event fields.
  - *Refinements:* Constrained output strictly to Zod schema; separated confirmed facts from assumptions; mandated confidence scoring.
- **Prompt 2: Adaptive Question Selection**
  - *Initial objective:* Decide what question to ask next.
  - *Refinements:* Guided by `priority ≈ impact × uncertainty × urgency`. Included explicit choices for "Not sure" and "Skip for now".
- **Prompt 3: Multi-Dimensional Concept Generation**
  - *Initial objective:* Generate 2–3 celebration concepts.
  - *Refinements:* Required 3 orthogonal dimensions (experience, effort, budget priority); enforced `whyItFits` citing actual user preferences; costBasis explicitly marked as estimate.
- **Prompt 4: Scoped Plan Revision**
  - *Initial objective:* Modify existing plan based on user feedback.
  - *Refinements:* Base version locking; output proposed operations array (`add`, `update`, `remove`); explicit list of affected items; preservation of locked decisions.

---

## 4. Test & Verification Evidence

- [ ] Domain unit tests passing (money math, currency precision, date validation, dependency cycle detection, diffing).
- [ ] Schema validation tests passing for all event types (wedding, birthday, community, custom).
- [ ] API authorization and token verification tests.
- [ ] Re-planning and locked item preservation tests.
- [ ] Production build succeeds without errors.

---

## 5. Known Limitations & Cloud Constraints

1. **Local Emulator First:** Testing and development defaults to Firebase Emulator Suite and local mocks when live cloud credentials are not supplied.
2. **External Vendor Lookup:** Google Places API and live web search require billing-enabled credentials; without them, Trellis operates in trusted offline checklist mode without fabricating fake vendor records.
3. **Unpaid Model Tier Data Notice:** In accordance with Google Gemini API terms for unpaid tiers, sensitive user details (such as real guest addresses or phone numbers) must not be submitted to unpaid model endpoints.
