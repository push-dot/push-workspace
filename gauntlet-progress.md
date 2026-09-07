# Push implementation gauntlet

Goal: implement docs/plan.md, replace empty API contract, create private push-dot/push-fe and push-dot/push-be and attach pinned submodules.

## Locked references and checks

- Product contract: docs/plan.md, retrieved 2026-09-07. Final UI decision supersedes initial right-panel requirement.
- Visual reference: docs/no-right-sidebar-prototype-v6.png (1672×941), inspected. Historical Aside captures are missing; no claim of comparison to those captures.
- Domain reference: installed Super Resume skill package at /Users/cyjoon/.codex/plugins/cache/super-resume-marketplace/super-resume/0.1.0+codex.20260822061938; builders must inspect relevant source workflow before porting.
- Comparison mode: champion/challenger against product specification (cross-medium); UI compares rendered candidates against prototype. Each critic receives neutral immutable candidate versions and version-matched checks, never this progress file.
- Acceptance: evidence lineage; two-job isolation; fabricated claims blocked at finalization; PDF/DOCX Korean text, pagination and links; OAuth return and expiration; offline editing/conflicts; webhook idempotency; CLI absent/denied/failure/verified; no unapproved application submission; secrets absent from logs; keyboard/dark/narrow UI; actual beta 16/20 successful journeys.
- Tools: Codex collaboration spawn_agent, fresh critics via fork_turns=none; inherited model settings. Implementers sequential; only lead spawns. No background automation.

## Tasks

1. Domain workflow port and server API + docs contract — pending.
2. Tauri desktop shell, vertical tabs, home command and company chats without right sidebar — pending.
3. Vault, analysis, editor, versions and PDF/DOCX — pending.
4. Pipeline, calendar, interviews and offers — pending.
5. Four blueprints and approved external CLI execution/evidence verification — pending.
6. OAuth, Google, AI/BYOK, billing, flagged job adapters — pending.
7. Release signing/notarization/updater and 20-person private beta — pending; requires actual external credentials and participants.
8. Integrated acceptance and fresh critic convergence — pending.
9. Commit units, PRs to develop, squash merge and pin submodules — pending.

## Repository state

Original untracked docs preserved at /Volumes/Untitled/Documents/Github/push-workspace/docs.
Isolated implementation: /Volumes/Untitled/Documents/Github/push-workspace-implementation, feat/implement-push-plan based on develop.
Private repositories created: https://github.com/push-dot/push-fe and https://github.com/push-dot/push-be.
No existing executable code or test suite; baseline consists of README and untracked user docs.

## Evidence and next action

No passing implementation or critic verdict yet. Backend builder first, frontend next. External integrations must fail closed when credentials/permissions are absent; never label mocks as live integrations.

2026-09-07 user steering: external VPS/OAuth/Stripe/Apple/beta not prepared; proceed with implementation and local verification. External launch criteria stay explicitly pending, not a reason to stop local work.
Backend builder agent: /root/backend_builder, owns push-be and docs/api.md. Running actual PostgreSQL on 127.0.0.1:55432/push_test for integration tests.

2026-09-07 user steering: React HTTP MUST use ky; FSD structure with explicitly invoked feature-sliced-design skill. Loaded /Users/cyjoon/.agents/skills/feature-sliced-design/SKILL.md and layer/framework references. FSD v2.1 pages-first, index public APIs, no same-layer slice imports; no speculative layers. Frontend task must enforce this and test request auth/errors/no mutation retries.
