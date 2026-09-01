# Tasks: Resolución Síncrona de Trayectorias Simultáneas (Tick a Tick)

**Input**: Design documents from `/specs/019-synchronous-tick-resolution/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (all present)

**Tests**: Included. Constitution Principle II (test-first) is non-negotiable, and this feature changes chain-resolution semantics — research.md/data-model.md commit to dedicated test suites before touching `resolveRedSplit`.

**Organization**: Tasks are grouped by user story (US1/US2/US3, priorities P1/P2/P1 from spec.md). US1 and US3 both depend on the same Foundational change (the `resolveChain`/`applyMutualImpact` generalization) and are really two verification angles on it (new case works; old cases don't regress) — US2 (generic N support) also depends on the same Foundational change.

## Path Conventions

Single existing project (monorepo). This feature touches `src/engine/events.ts`, `src/engine/pieces/push.ts`, `src/engine/resolve-launch.ts`, and their tests — `tools/generator/` and `src/renderer/` are untouched (FR-008, no new pieces).

---

## Phase 1: Setup

**Purpose**: Establish the regression baseline before any change.

- [X] T001 Run `npm run typecheck && npm test` at the repo root and confirm the pre-feature baseline is green before making any change. No files modified.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The core mechanism both US1 and US3 verify, and US2 extends — must land before any of the three stories can be demonstrated.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for the Foundational change

- [X] T002 [P] Write `tests/unit/engine/events.test.ts` (new, or extend if a suite for `resolveChain` already exists): `resolveChain` called with 2 synthetic `ImpactSite`s whose paths never coincide resolves each independently (same result as two sequential single-site calls would produce); 2 synthetic sites whose first hop already coincides resolve via a passed-in `handleMutualImpact` instead of `handleImpact`; a synthetic 3-site case where resolving the first coincidence produces a result that then coincides with the third site resolves as two sequential pairwise collisions, in queue order (research.md, Decisión 4). Confirm these fail (or don't compile) against the current single-`initialSite` signature before continuing.
- [X] T003 [P] Write new tests in `tests/unit/engine/push.test.ts`: `applyMutualImpact` — same-color mutual annihilation (single `ANNIHILATION` event, `nextSites: []`); different-color collision advances BOTH pieces' fragility exactly once and swaps direction/push-mechanism between them (data-model.md's exact contract — A continues with B's color's `PUSH_STRATEGY` in B's direction, and vice versa); a piece already `'broken'` going into the collision stays `'broken'` (never calls `advance` on an already-broken fragility) but still produces its own `nextSite`.

### Implementation for the Foundational change

- [X] T004 In `src/engine/events.ts`: change `resolveChain`'s signature from `(board, initialSite: ImpactSite, handleImpact)` to `(board, initialSites: ImpactSite[], handleImpact, handleMutualImpact: MutualImpactHandler)` (data-model.md). Add private `findCoincidingPair(queue): [number, number] | null` (first two entries sharing the same `to`, or `null`). In the main loop, check `findCoincidingPair` before each `shift()`; on a match, remove both entries, call `handleMutualImpact`, push its `nextSites`; otherwise proceed exactly as today. Add the `MutualImpactHandler` type.
- [X] T005 In `src/engine/pieces/push.ts`: add `applyMutualImpact(board, siteA, siteB)` (exported, per data-model.md) — same-color branch (mutual `ANNIHILATION`); different-color branch (`advanceIfReal` helper for the already-broken case; each site's `nextSite` uses the OTHER site's color's `PUSH_STRATEGY` and the OTHER site's `direction`). Run T003 and confirm it passes.
- [X] T006 In `src/engine/pieces/push.ts`: simplify `resolveRedSplit` to a single `resolveChain(board, [siteFirst, siteSecond], applyImpact, applyMutualImpact)` call, removing the two sequential `resolveChain` calls. In `src/engine/resolve-launch.ts`: change `resolveChain(level.board, initialSite, applyImpact)` to `resolveChain(level.board, [initialSite], applyImpact, applyMutualImpact)`. Run T002 and confirm it passes.
- [X] T007 Run `npm run typecheck && npm test` and confirm: T002/T003 now pass; every pre-existing engine test (001-018) still passes with identical expected values — the collision-detection check is a no-op whenever the queue never exceeds 1 pending entry, which is every case except red's split.

**Checkpoint**: Foundational mechanism in place and internally tested — ready for US1/US2/US3 to verify their respective angles.

---

## Phase 3: User Story 1 - Dos trayectorias que de verdad se cruzan colisionan entre sí (Priority: P1) 🎯 MVP

**Goal**: A real red-split case where the two branches' paths genuinely coincide (via wrap-around) now resolves as a symmetric collision, instead of one branch passing through the other undetected.

**Independent Test**: Construct a red-split case where one branch is delayed by a real obstacle while the other completes a full board lap and reaches the delayed branch's current cell; confirm both collide symmetrically (spec.md, Historia 1, Independent Test).

### Implementation for User Story 1

- [X] T008 [US1] Construct (by hand, verified via direct engine calls before writing the final test) a concrete board/hand/launch where red's two branches' real paths coincide after a wrap-around lap. Confirm, by comparing against the pre-019 `resolveRedSplit` (two sequential `resolveChain` calls, still recoverable from git history), that the OLD behavior lets one branch pass through the other, and the NEW behavior (T004-T006) makes them collide symmetrically.
- [X] T009 [US1] Add this case as a permanent regression test in `tests/unit/engine/red.test.ts`, asserting the exact symmetric-collision outcome (direction swap, fragility advance, or mutual annihilation depending on the colors chosen).
- [X] T010 [US1] Run `npm run typecheck && npm test`. Manually confirm via quickstart.md that this specific case is what changed, and that it's the ONLY behavioral change (SC-001).

**Checkpoint**: User Story 1 independently functional and testable — SC-001 verified.

---

## Phase 4: User Story 2 - El mecanismo soporta N trayectorias concurrentes (Priority: P2)

**Goal**: Confirm the mechanism built in Phase 2 doesn't assume exactly 2 active trajectories.

**Independent Test**: A synthetic test feeding 3+ initial `ImpactSite`s into `resolveChain` directly, confirming correct pairwise resolution with no code path assuming N=2 (spec.md, Historia 2, Independent Test).

### Implementation for User Story 2

- [X] T011 [US2] Add a synthetic test (in `tests/unit/engine/events.test.ts`, alongside T002) with 3 independently-constructed initial `ImpactSite`s designed so that resolving the first two's collision produces a result that then also coincides with the third — confirm it resolves as sequential pairwise collisions (research.md, Decisión 4), and that no part of `resolveChain`/`findCoincidingPair` special-cases exactly 2 sites (code review confirmation, not just a passing test).
- [X] T012 [US2] Run `npm run typecheck && npm test`. Confirm SC-004.

**Checkpoint**: User Story 2 independently functional and testable — SC-004 verified.

---

## Phase 5: User Story 3 - Ningún caso existente cambia de resultado (Priority: P1)

**Goal**: Confirm zero regression across the entire existing test suite, the two red prototype levels, and the full 140-level generated batch.

**Independent Test**: Run the full existing test suite and replay all 140 generated levels' reference solutions plus prototype levels 14/15 against the changed engine — 100% identical results (spec.md, Historia 3, Independent Test).

### Implementation for User Story 3

- [X] T013 [US3] Run `npm run typecheck && npm test` for the full existing suite (001-018) — confirm 100% pass with identical expected values (already effectively covered by T007, this task is the dedicated checkpoint for SC-002).
- [X] T014 [US3] Write and run a verification script (scratch, not committed) reproducing prototype levels 14/15 and all 140 files in `levels/` against the changed engine — confirm all still resolve to `'won'` (SC-003). No regeneration expected or performed unless this step finds a discrepancy.

**Checkpoint**: All user stories independently functional — SC-002/SC-003 verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T015 Run `npm run typecheck && npm test` for the final full regression: the generalized `resolveChain`, `applyMutualImpact`, the new red-crossing regression test, the N≥3 synthetic test, and the full existing suite all pass together.
- [X] T016 Execute the quickstart.md validation end to end.
- [X] T017 [P] Confirm via `git diff` that `tools/generator/` and `src/renderer/` have zero changes (FR-008, no new pieces).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all three user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational.
- **User Story 2 (Phase 4)**: Depends on Foundational. Independent of US1/US3.
- **User Story 3 (Phase 5)**: Depends on Foundational. Independent of US1/US2, though in practice T013 overlaps with T007's own confirmation.
- **Polish (Phase 6)**: Depends on US1 + US2 + US3 all complete.

### Within Each Phase

- Phase 2: T002/T003 (test-first, parallel — different files) → T004 → T005 → T006 → T007.
- Phase 3: T008 (hand-verified comparison against old behavior) → T009 (lock in as a test) → T010.
- Phase 4: T011 → T012.
- Phase 5: T013 → T014.
- Phase 6: T015 → T016 → T017.

### Parallel Opportunities

- T002 and T003 (different files: `events.test.ts` vs `push.test.ts`) can be written in parallel.
- Once Phase 2 is done, US1/US2/US3 (Phases 3-5) are independent of each other and could proceed in parallel.

---

## Implementation Strategy

### MVP First (Foundational + User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run T010 — SC-001 holds, and this alone is the actual fix (US2/US3 harden and verify it, not deliver new value on their own).

### Incremental Delivery

1. Setup → baseline confirmed green.
2. Foundational (generalized `resolveChain` + `applyMutualImpact` + simplified `resolveRedSplit`) → the mechanism exists.
3. US1 (real crossing case) → verify SC-001 → the actual bug (the deferred 009-red-piece item) is fixed here.
4. US2 (N≥3 synthetic) → verify SC-004.
5. US3 (full regression) → verify SC-002/SC-003.
6. Polish → final full regression + quickstart.md walkthrough + generator/renderer-untouched check.

---

## Notes

- [Story] labels map every Phase 3+ task to its user story for traceability; Setup/Foundational/Polish carry no story label by convention.
- Commit after each task or logical group; stop at any phase checkpoint to validate that story independently before continuing.
- The symmetric-collision direction-swap consequence (data-model.md, research.md Decisión 3) was explicitly confirmed with the user before Phase 1 began (not assumed) — see the conversation's own record of that confirmation.
