# Trellis — AI-Powered Celebration & Event Planning Platform

Trellis turns human celebration intent into tailored, structured, editable plans through adaptive AI discovery, deterministic domain validation, and a versioned planning workspace.

Trellis supports **Weddings**, **Milestone Birthdays**, **Community Gatherings & Fundraisers**, and **Custom Celebrations**.

---

## 1. Architecture Overview

Trellis uses a modular monorepo structured around clean architecture principles:

```
trellis/
├── apps/
│   ├── web/                     # React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
│   └── api/                     # Node.js + Express + TypeScript + Firebase Admin + Genkit
├── packages/
│   ├── domain/                  # Pure deterministic domain rules (money arithmetic, graph cycles, diffs)
│   ├── contracts/               # Shared Zod schemas, API DTOs, and event models
│   └── config/                  # Event capability registry, currency settings, provenance tokens
├── tests/
│   ├── unit/                    # Unit tests for domain, contracts, and schema invariants
│   ├── integration/             # API authorization and repository integration tests
│   └── e2e/                     # End-to-end user journeys
└── docs/
    ├── SUBMISSION_EVIDENCE.md   # Verified tooling, prompt evolution, and audit evidence
    ├── DESIGN.md                # System design and non-negotiable principles
    └── PHASE.md                 # Implementation phase checklist
```

---

## 2. Core Principles

1. **User-Led, AI-Assisted:** The AI proposes structured options; deterministic code validates invariants; the human organizer makes all final decisions.
2. **Deterministic Financial Math:** All currency calculations (totals, forecast, tax, contingency, variance) use integer minor-unit arithmetic in pure application code—never model hallucinations.
3. **Preservation of User Decisions:** Re-planning or updating constraints strictly preserves locked decisions, completed checklist tasks, manual notes, and booked vendor commitments.
4. **No Fabricated Evidence:** Trellis never invents vendor availability, quotes, prices, or source URLs. Unverified data is visibly labelled `Needs confirmation` or `AI estimate`.

---

## 3. Quick Start

### Prerequisites
- **Node.js**: v22 LTS (tested on v22.20.0)
- **pnpm**: v10+ (tested on v10.30.3)

### Installation
```bash
# Install all dependencies across the workspace
pnpm install
```

### Running Tests
```bash
# Run all unit tests
pnpm test
```

### Type Checking & Linting
```bash
# Typecheck all packages and apps
pnpm typecheck

# Lint codebase
pnpm lint
```

### Local Development
```bash
# Copy environment template
cp .env.example .env.local

# Run web and api concurrently
pnpm dev
```
