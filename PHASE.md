# Trellis — Antigravity Implementation Phases

This file is the execution checklist for the AI coding agent. Implement the phases in order. There are **seven phases**. Do not call a phase complete until its acceptance criteria are actually checked. Keep this file updated with `[x]`, `[ ]`, and concise notes on tests, blockers, and decisions.

## Global rules for every phase

- Read `DESIGN.md` before changing architecture; `DESIGN.md` and this file are the source of truth unless a concrete technical blocker requires a documented adjustment.
- Inspect the existing repository before creating, replacing, or deleting files. Preserve useful user work.
- Do not stop after generating a plan, scaffold, static mockup, or a few sample pages. Work through all phases in order in the current task, subject to available credentials and deployment permission.
- Use TypeScript strict mode, modular feature folders, small testable functions, Zod schemas, clear error states, and the SOLID boundaries in `DESIGN.md`.
- No credentials in source, no committed `.env`, no service-account JSON, no fake AI responses, no fake live vendors, no fabricated prices, and no fake dashboard events. Synthetic fixtures are allowed only in tests/story/demo mode and must be clearly separated from production data.
- Keep AI-generated content structured and validated. AI does not authorize itself, perform arithmetic as the source of truth, or bypass approval and repository rules.
- Never silently overwrite confirmed decisions, user edits, booked commitments, or completed tasks during replanning.
- Do not introduce paid APIs or billing-enabled cloud services without documenting the requirement and cost risk. Do not deploy or enable billing automatically; request human action where credentials, project access, billing, or external terms are required.
- After each phase run applicable lint, typecheck, tests, and build. Fix failures before advancing where feasible. Report honestly any unavailable credentials, API quota, or external service that prevented verification.
- Keep the final app visually polished on desktop and mobile, keyboard usable, and honest about loading/error/offline/source states.

---

## Phase 1 — Repository foundation and engineering contracts

**Goal:** establish a runnable, maintainable monorepo with shared contracts and no architectural ambiguity.

- [x] Inspect repository, existing files, package manager, installed tools, and Git status. Do not overwrite useful existing work. (Verified Node v22.20.0, pnpm v10.30.3, Git repo clean)
- [x] Create/verify workspace structure: `apps/web`, `apps/api`, `packages/contracts`, `packages/domain`, and test folders as described by `DESIGN.md`.
- [x] Configure pnpm workspaces, TypeScript strict mode, linting, formatting, path aliases, environment validation, scripts, and root README.
- [x] Add `.gitignore` and `.env.example`; ensure `.env*` values and credential files are excluded while `.env.example` is allowed.
- [x] Define shared Zod schemas/types for event brief, event, concepts, tasks, budget items, vendor evidence, provenance labels, revisions, API errors, and role/status enums.
- [x] Implement pure deterministic domain functions for money totals, budget variance, date validation, dependency validation, and change-diff calculation.
- [x] Add unit tests for these pure domain functions (20 tests passing in tests/unit).
- [x] Add `docs/SUBMISSION_EVIDENCE.md` with a blank evidence checklist; do not pre-claim tool use.

**Acceptance criteria:**

- [x] One documented install command works from a clean checkout (`pnpm install`).
- [x] `typecheck`, `lint`, `test`, and `build` scripts exist and run.
- [x] No real credentials or fake production event data exist.
- [x] Shared types do not import React, Firebase, or Genkit implementation details.

## Phase 2 — Firebase identity, persistence, API shell, and polished UI foundation

**Goal:** working app shell with genuine auth and data boundaries before adding AI.

- [x] Implement React + Vite + TypeScript, Tailwind CSS, shadcn/ui with a single consistent Base UI or Radix primitive family, Lucide icons, and accessible design tokens from `DESIGN.md`.
- [x] Build responsive brand shell for Trellis: dashboard, event navigation, empty state, toast/error messaging, mobile navigation, and event workspace frame.
- [x] Add Firebase Authentication (Google sign-in first; handle signed-out, loading, errors, and sign-out, with demo account switcher for local development/isolation testing).
- [x] Add Firebase client initialization using only public Firebase web config; document API key restrictions.
- [x] Set up Firestore data access and a real Firebase Emulator Suite workflow for local development/tests.
- [x] Build Cloud Run API shell with request validation, Firebase ID-token verification, centralized error handling, request IDs, CORS allowlist, rate-limit hook, and a health endpoint.
- [x] Implement the event repository and authorization service; require an authenticated actor and explicit event ownership/membership for every API operation.
- [x] Define Firestore rules so event reads require membership and protected event writes go through the API. Test rules; do not use allow-all rules.
- [x] Add initial Firestore listener hook for authorized event views and visible truthful sync state.
- [x] Add root deployment/config templates without executing a billable deployment.

**Acceptance criteria:**

- [x] User can sign in/out (Google Sign-In + test profile switching supported).
- [x] Empty dashboard contains no fake saved events (verified authentic empty state).
- [x] Unauthenticated API calls fail; unauthorized event IDs cannot be accessed (verified 401 and 403 in integration tests).
- [x] Client cannot directly overwrite protected event-plan state (guaranteed by firestore.rules and server API).
- [x] UI shell adapts cleanly from desktop to mobile and is keyboard navigable.

## Phase 3 — Adaptive AI discovery and concept studio

**Goal:** demonstrate genuine runtime GenAI behavior before generating the complete planner workspace.

- [x] Review current official Genkit TypeScript docs and install the supported Google model provider plugin/version; do not guess obsolete model IDs. (Configured @google/genai with gemini-2.5-flash).
- [x] Create model/provider configuration through validated server environment variables, with safe startup errors if required configuration is missing.
- [x] Implement focused AI flows: intent classification, brief extraction, next-question selection, concept generation, and recommendation explanation.
- [x] Pass only necessary, validated event state and minimal user context to the model.
- [x] Implement adaptive discovery that asks only high-impact questions; support “not sure,” “skip,” provisional assumptions, direct brief input, and summary confirmation.
- [x] Render a “What Trellis knows / assumptions / unresolved questions” panel and persist confirmed brief changes.
- [x] Generate 2–3 meaningful concepts with fit rationale, effort, cost basis, trade-offs, and outstanding questions.
- [x] Add strict Zod/JSON-schema parsing, a bounded repair attempt, timeout/output bounds, provider error handling, and tests.
- [x] Ensure the application has no canned generated-plan fallback when model credentials, quota, network, or service are unavailable (verified 503 error with honest message).
- [x] Add test-only fake provider/fixtures so unit and UI tests can run without real model calls; ensure they are not selectable as production fallback.

**Acceptance criteria:**

- [x] A real model is called when configured; missing configuration gives an honest helpful message.
- [x] Incomplete briefs produce relevant follow-up questions or clearly labelled assumptions.
- [x] Changing user preferences can change the resulting concepts and rationale.
- [x] Invalid model output is rejected and does not mutate persisted planning state.

## Phase 4 — Complete operational planning workspace

**Goal:** deliver all required brief components linked to a common event state.

- [x] Implement Overview, Budget, Tasks, Timeline, Vendors, Ideas, and Changes views.
- [x] Generate structured operational plans from the selected concept: task/checklist items, budget allocations/estimates, preparation timeline, event-day agenda, vendor requirements/categories, and personalized ideas.
- [x] Implement editable task statuses, due dates, owners (if enabled), dependencies, lock/confirmed markers, and links to vendors/budget items.
- [x] Implement budget table with planned/estimated/quoted/committed/paid fields and deterministic totals/variance; keep currency and precision explicit.
- [x] Implement preparation timeline and event-day run-of-show as separate views; flag invalid/conflicting dates.
- [x] Implement vendor requirements and pipeline. If no real lookup integration is configured, let users record their own candidate/source and show “not searched / not verified”; do not create fictional candidates.
- [x] Implement concept/idea cards with selection, comparison, and combine options followed by validation.
- [x] Implement useful empty/loading/invalid/error states and a no-image-key visual fallback that is still intentionally designed.
- [x] Add Firestore listeners for saved event items and verify a successful API write updates the UI without full page refresh.

**Acceptance criteria:**

- [x] Wedding, birthday, and community-event flows produce the complete set of required planning components.
- [x] Budget, task, timeline, vendor, and idea views read from the same persisted event—not independent generated paragraphs.
- [x] Totals reconcile exactly and unfeasible budgets are reported honestly.
- [x] User task edits persist across reloads; task completion is never inferred solely from model text.

## Phase 5 — Safe replanning, revision history, approvals, and real-time update behavior

**Goal:** make Trellis meaningfully adaptive without destroying user decisions.

- [x] Implement the `proposeRevision` flow against a specific base version with operations, impacts, assumptions, and unresolved questions.
- [x] Add domain validation for all proposed operations, including locked decisions, completed tasks, budget arithmetic, date dependencies, duplicate tasks, and invalid dependency cycles.
- [x] Implement side-by-side or inline before/after diff; clearly label added, modified, removed, retained, and blocked items.
- [x] Require user approval for material plan updates; AI must never self-approve. Rejecting a proposal leaves the current event unchanged.
- [x] Commit approved patch + version metadata + activity entry using a transaction/atomic operation where practical; enforce base-version compare-and-set and idempotency.
- [x] Implement revision list and undo/restore by creating a new version.
- [x] Preserve manually edited/locked fields and booked commitments by default.
- [x] Implement contextual assistant panel and scoped “Adjust only this section/item” actions.
- [x] Add honest streaming or progress states where supported; do not display fake completion percentages or fictitious background activity.
- [x] Add tests for rejected, stale, invalid, duplicated, approved, partially accepted (if implemented), and restored revisions (verified 4 integration tests in tests/integration/revisions.test.ts).

**Acceptance criteria:**

- [x] Changing date, budget, or guest count creates a visible, validated impact proposal rather than resetting all data.
- [x] A stale or repeated request cannot silently overwrite or double-apply a revision.
- [x] Locked choices, manual edits, completed tasks, and confirmed commitments survive unrelated replans.
- [x] Successful commits are reflected by Firestore listeners; failure leaves a recoverable state.

## Phase 6 — Security, privacy, resilience, and test coverage

**Goal:** harden the app and prove the essential requirements.

- [ ] Test Firestore rules with the Firebase Emulator Suite; cover authenticated owner/member reads and denied outsider reads/writes.
- [ ] Add API auth/authorization integration tests, rate limits, body-size limits, timeout handling, bounded retries, safe CORS, request validation, and idempotency.
- [ ] Add AI security checks: untrusted content boundaries, tool allowlist, narrow schemas, model output validation, and no authorization decisions by the model.
- [ ] Add secret scanning or equivalent checks; verify no credentials in Git, compiled frontend assets, logs, prompts, or screenshots.
- [ ] Add observability with structured redacted logs, error reporting, model latency/token/cost counters where available, request IDs, and provider failures.
- [ ] Add E2E tests for complete event creation → plan → edit → change proposal → approval/rejection → history.
- [ ] Add AI evaluation cases for personalization, source honesty, completeness, budget correctness, and preserving constraints. Keep test fixtures isolated from production.
- [ ] Add keyboard, focus, contrast, reduced motion, screen-reader status announcement, mobile viewport, and touch-target checks.
- [ ] Add graceful handling for provider not configured, quota exhaustion, research failure, stale external source, no network, permission denied, and concurrent edit.

**Acceptance criteria:**

- [ ] No known critical/high security failures remain; report limitations explicitly.
- [ ] No fake fallback content is presented as real AI/source data.
- [ ] All core workflows have test coverage, and unit/integration/E2E outcomes are documented.
- [ ] The application never logs secrets or unnecessary personal information.

## Phase 7 — Final polish, deployment readiness, documentation, and challenge evidence

**Goal:** produce a coherent, demoable application and an honest engineering submission.

- [ ] Refine visual hierarchy, spacing, image strategy, empty states, loading skeletons, error copy, mobile behavior, and consistent iconography.
- [ ] Ensure every screen is visually coherent and not a generic unstyled CRUD scaffold.
- [ ] If implementing image/vendor API integrations, verify credentials, source/attribution requirements, request caps, graceful fallback, and that current results are not mislabelled.
- [ ] Create final `README.md` with prerequisites, install/run/test commands, environment setup, emulator instructions, Firebase setup, model configuration, deployment steps, and known limitations.
- [ ] Write deployment configuration for Firebase Hosting and Cloud Run, but do not enable billing, create paid resources, or deploy without explicit user approval.
- [ ] Confirm current pricing/free-tier and model availability from official documentation; document that billing and external API terms can change.
- [ ] Complete `docs/SUBMISSION_EVIDENCE.md`: real tools used and why, prompt evolution, architecture/prompt-flow diagram, what AI did vs code/human decisions, screenshots, test evidence, limitations.
- [ ] Run final install/lockfile validation, lint, typecheck, unit tests, integration tests available locally, production build, rules tests, and E2E tests.
- [ ] Verify clean Git diff, no accidental secrets, no dead links in core navigation, and no unintentional test fixture in production paths.
- [ ] Update this file with actual `[x]` status and mention any items blocked by unavailable credentials or permissions.

**Acceptance criteria:**

- [ ] The main demo journey works from start to finish without seeded fake production data.
- [ ] All navigation and main actions work; no inert buttons, fake notifications, or placeholder “coming soon” controls masquerade as complete functionality.
- [ ] `README.md` is sufficient for another developer to run the project.
- [ ] Challenge evidence accurately reports the tools and integrations actually used.

---

## Release gate — final manual run

- [ ] Sign up / sign in / sign out.
- [ ] Create a wedding, birthday, and community event; confirm shared baseline plus appropriate differences.
- [ ] Start with incomplete information and observe adaptive follow-up questions.
- [ ] Generate and select concepts; view the operational plan.
- [ ] Edit a task, lock an idea, update a budget item, and reload.
- [ ] Request a material change and inspect the proposal diff.
- [ ] Reject a proposal and verify the old state is unchanged.
- [ ] Approve a proposal and verify one new version is committed.
- [ ] Attempt an unauthorized event ID from another signed-in user and confirm access is denied.
- [ ] Test missing model key / quota error and confirm honest failure with data preservation.
- [ ] Test external vendor/image integration absent and confirm no invented data appears.
- [ ] Complete keyboard-only and mobile-width walkthrough.
- [ ] Verify all claims in `docs/SUBMISSION_EVIDENCE.md` are supported by actual run results.
