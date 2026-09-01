# Tasks: La Ficha Lanzadora Recién Asentada Debe Ser Visible Para el Desplazamiento de la Ficha Que Golpeó

**Input**: Design documents from `/specs/017-striker-visibility-gap/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (all present)

**Tests**: Included. Constitution Principle II (test-first) is non-negotiable, and this feature changes chain-resolution semantics -- research.md/data-model.md commit to a dedicated regression test before the one-line fix.

**Organization**: Tasks are grouped by user story (US1/US2/US3, priorities P1/P2/P2 from spec.md). US2 and US3 both depend on US1 (the engine fix) landing first; US3 was discovered during implementation (see research.md, Decisión 4) and added to this file retroactively, in the same phase structure as the rest.

## Path Conventions

Single existing project (monorepo). This feature touches `src/engine/pieces/push.ts` (one-line change), `tools/generator/obligations.ts`/`generate.ts` (US3, discovered mid-implementation), `src/levels/prototype-levels.ts` (level 12), `levels/` (reverified, 11 regenerated), and several test files — no other files change.

---

## Phase 1: Setup

**Purpose**: Establish the regression baseline before any change.

- [X] T001 Run `npm run typecheck && npm test` at the repo root and confirm the pre-feature baseline is green before making any change. No files modified.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A for this feature — there is no shared infrastructure separate from User Story 1 itself. US1 *is* the one-line engine fix that US2 (reverify/regenerate levels) and US3 (generator) both depend on; captured as a phase dependency below rather than a separate empty phase with its own tasks.

---

## Phase 3: User Story 1 - Una ficha desplazada dentro de una cascada choca con la ficha lanzadora que la propia cascada ya asentó (Priority: P1) 🎯 MVP

**Goal**: `applyImpact` (`src/engine/pieces/push.ts`) computes the struck defender's own onward displacement (`PUSH_STRATEGY[...]`) against `boardWithStriker` (the board that already includes the just-settled striker) instead of the stale `vacated` snapshot, so a defender's walk (in practice, only observable for brown's `stepUntilBlocked`) can collide with the striker that struck it, including on a full board wrap-around.

**Independent Test**: Reproduce a synthetic cascade mirroring level 49 (brown strikes a defender in an otherwise-clear lane, where the only obstacle the defender's own walk can encounter is the striker that just settled) and confirm the walk now stops at the striker's cell instead of wrapping all the way around and landing past it (spec.md, Historia 1, Independent Test).

### Tests for User Story 1

- [X] T002 [US1] Add a regression test to `tests/unit/engine/push.test.ts` calling `applyImpact` directly: a brown striker hits a defender of a different color on an otherwise-empty board such that the defender's own `stepUntilBlocked` walk, if it didn't see the striker, would wrap fully around and land elsewhere — assert the returned `nextSites` entry's `to` is the striker's own settled cell (immediate collision), not a wrapped-around landing spot. Confirm this test fails against the current `push.ts` (Principle II) before continuing to T003.

### Implementation for User Story 1

- [X] T003 [US1] In `src/engine/pieces/push.ts`, inside `applyImpact`'s different-color branch, change `PUSH_STRATEGY[site.piece.color](vacated, hitDefender, site.to, site.direction)` to pass `boardWithStriker` instead of `vacated` (data-model.md). No other line changes; `vacated` keeps its existing uses (the striker's own `settleOrVanish` call, and the `defender === null` base case).
- [X] T004 [US1] Run `npm run typecheck && npm test` and confirm the new regression test (T002) now passes. (Discovered here, not a clean pass: three pre-existing tests newly failed — a foundational `brown.test.ts` test, a `prototype-levels.test.ts` assertion on level 12, and a `generate.test.ts` fixture — all for the same underlying reason, escalated into User Story 3 below rather than papered over.)

**Checkpoint**: User Story 1 independently functional and testable — SC-001/SC-002 verified once US3's fixes land (T004's initial run surfaced the need for US3 before SC-001 could be declared clean).

---

## Phase 4: User Story 2 - El batch de niveles generados se reverifica contra el motor corregido (Priority: P2)

**Goal**: All 140 levels in `levels/` are reverified by replaying their reference `solution` against the corrected engine; any that no longer resolve to `'won'` are regenerated with their original `complexityScore`.

**Independent Test**: Replay all 140 levels' reference solutions against the corrected engine, identify the (possibly empty) affected subset, regenerate each with its original `complexityScore`, and confirm 100% resolve to `'won'` afterward (spec.md, Historia 2, Independent Test).

### Implementation for User Story 2

- [X] T005 [US2] Write and run a verification script (scratch, not committed) that reads every `levels/<id>.json`, replays its `solution` via `resolveLaunch` against the corrected engine, and reports which ids no longer resolve to `'won'`. Result: 11 of 140 affected (`40, 49, 71, 101, 107, 113, 132, 156, 165, 207, 251`) — SC-002 confirms level 49 is among them.
- [X] T006 [US2] For each affected level id, regenerate it via `generateLevel({ seed: id, complexityScore, maxGenerationAttempts: 20000 })` using the `complexityScore` recorded in its existing `params.complexityScore`, replacing `levels/<id>.json` in place (same id). 7 of 11 succeeded with `seed: id` directly; the remaining 4 (`165, 207, 40, 49`) needed a different seed (`id * 100000 + offset`, small offset) since the original seed's `rng()` stream, under the corrected engine+generator, didn't yield a valid construction within the attempt budget — each regenerated level was replayed and confirmed `'won'` before writing.
- [X] T007 [US2] Re-run the verification script (T005) against the updated batch: confirm 100% of the 140 levels resolve to `'won'` (SC-003). `index.json`/`.next-id.txt` unchanged (same ids, in-place content replacement only — no id churn).

**Checkpoint**: User Story 2 independently functional and testable — SC-003 verified.

---

## Phase 5: User Story 3 - El generador sigue pudiendo construir un asentamiento limpio de marrón (Priority: P2)

**Goal**: `tools/generator/obligations.ts` marks a brown striker chosen for a `'settle'`-context defender obligation as `mustBeBroken`; when that obligation resolves, it's forced to a direct hand launch (never a chain) with fragility `'broken'` in `generate.ts`, excluding it from the launched-piece fragility-uniformity group. Prototype level 12 and its dependent tests are updated to match.

**Independent Test**: Reproduce prototype level 12's construction through the generator and confirm the resulting brown striker has fragility `'broken'` and the construction still forward-validates (spec.md, Historia 3, Independent Test).

### Tests for User Story 3

- [X] T008 [US3] Confirm (via T004's run) that `tests/unit/engine/brown.test.ts`'s foundational "stops right before the second edge crossing on an otherwise empty row" test, `tests/unit/levels/prototype-levels.test.ts`'s level-12 assertion, and `tests/unit/tools/generator/generate.test.ts`'s fixture 2 all fail against the corrected engine before implementing US3 (Principle II) — each for the same reason (research.md, Decisión 4): a genuinely clear lane for brown is no longer reachable with a real striker, for any distance.

### Implementation for User Story 3

- [X] T009 [US3] In `tools/generator/obligations.ts`: add `mustBeBroken?: boolean` to `Obligation` and `forcedFragility?: 'broken'` to `RawLaunch`. When a `'defender'` obligation resolves via `chooseStrikerAndOrigin(..., 'settle', ...)`, mark the pushed `'striker-origin'` obligation `mustBeBroken: resolved.striker === 'brown'`. When resolving a `'striker-origin'` obligation, fold `mustBeBroken` into `forceHand` (always direct launch, skipping the `chainOriginProbability` roll) and set `forcedFragility: 'broken'` on the pushed `RawLaunch` when it applies.
- [X] T010 [US3] In `tools/generator/generate.ts`: before assigning launched-piece fragility, split `playOrder` into forced vs. non-forced indices; call `assignGroupFragility` only for the non-forced count (identical behavior/rng-count when nothing is forced); merge the forced `'broken'` values back by original position.
- [X] T011 [US3] Update `src/levels/prototype-levels.ts` level 12: hand `['brown']` → `[{ color: 'brown', fragility: 'broken' }]`, preserving its original demonstrated outcome exactly (verified by direct replay before editing).
- [X] T012 [US3] Update `tests/unit/engine/brown.test.ts`: rewrite the foundational test to use a broken striker (same expected far-edge outcome as before); add a new sibling test documenting the real-striker behavior (struck piece loops a full lap and collides with its own striker — verified by direct replay: `result: 'lost'`).
- [X] T013 [US3] Update `tests/unit/tools/generator/generate.test.ts` fixture 2's expected `hand` to `[{ color: 'brown', fragility: 'broken' }]`.
- [X] T014 [US3] Update `tests/unit/tools/generator/fragility.test.ts`'s two Historia-2 uniformity checks to exclude any `'broken'` entry from the launched-piece group before computing uniqueness (a launched piece can only be `'broken'` via `mustBeBroken`, never via the profile itself — FR-009/FR-010 of 013).
- [X] T015 [US3] Run `npm run typecheck && npm test`: confirm all tests pass, including T008's three previously-failing tests, with no other existing test's expected values changed.

**Checkpoint**: User Story 3 independently functional and testable — SC-004 verified; SC-001 (Phase 3's checkpoint) now also holds cleanly.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T016 Run `npm run typecheck && npm test` for the final full regression: the one-line engine fix, the generator's `mustBeBroken` mechanism, the new/updated tests, and the reverified/regenerated 140 levels all pass together (179 tests, 21 files).
- [X] T017 Execute the quickstart.md validation: reproduce level 49 manually before/after the fix to confirm the documented before/after behavior.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Empty by design (see note above) — does not block anything beyond Setup.
- **User Story 1 (Phase 3)**: Depends on Setup only.
- **User Story 2 (Phase 4)**: Depends on **User Story 1 being complete** — reverifying/regenerating levels only makes sense against the corrected engine. Independent of User Story 3.
- **User Story 3 (Phase 5)**: Depends on **User Story 1 being complete** — discovered via US1's own T004 regression run. Independent of User Story 2, though in practice US3 (Historia 3) needed to land before US2's regeneration (T006) could use the corrected generator.
- **Polish (Phase 6)**: Depends on US1 + US2 + US3 all complete.

### Within Each Phase

- Phase 3: T002 (test-first, must fail against current `push.ts`) → T003 (implementation) → T004 (full regression, surfaces US3's need).
- Phase 4: T005 (identify affected) → T006 (regenerate affected, needs US3 landed first in practice) → T007 (verify) — strictly sequential.
- Phase 5: T008 (confirm failures, test-first) → T009 → T010 (implementation) → T011 → T012 → T013 → T014 (dependent test/content updates) → T015 (full regression).
- Phase 6: T016 → T017.

### Parallel Opportunities

- None beyond what's already noted — this feature's tasks are largely sequential within each phase, and US2's regeneration step in practice depended on US3 landing first despite being nominally independent.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1.
3. **STOP and VALIDATE**: run T004 — this is what actually surfaced User Story 3's need, rather than a clean pass. The core correctness fix (SC-002) holds at this point even though the full regression isn't clean yet.

### Incremental Delivery

1. Setup → baseline confirmed green.
2. Add US1 (one-line engine fix) → verify SC-002 → the actual bug is fixed here, but T004 reveals collateral test failures.
3. Add US3 (generator `mustBeBroken`) → resolves the collateral failures → SC-001/SC-004 verified.
4. Add US2 (reverify + selectively regenerate levels, now against the fully-corrected engine+generator) → verify SC-003.
5. Polish → final full regression + quickstart.md walkthrough.

---

## Notes

- [Story] labels map every Phase 3+ task to its user story for traceability; Setup/Foundational/Polish carry no story label by convention.
- This tasks.md was updated retroactively to include User Story 3 (Phase 5) and the reordered checkpoints, reflecting what was actually discovered and built during implementation — see research.md, Decisión 4, for the full empirically-verified reasoning behind the scope expansion.
- Commit after each task or logical group; stop at any phase checkpoint to validate that story independently before continuing.
