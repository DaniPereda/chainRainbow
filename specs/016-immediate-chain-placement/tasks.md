# Tasks: Resolución de Cadenas por Cola de Fichas en Tránsito

**Input**: Design documents from `/specs/016-immediate-chain-placement/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (all present)

**Tests**: Included. Constitution Principle II (test-first) is non-negotiable, and this feature changes chain-resolution semantics -- research.md/data-model.md commit to a dedicated white-box test suite for the new primitives plus exact-trace regression fixtures for the two red-piece prototype levels.

**Organization**: Tasks are grouped by user story (US1/US2/US3, priorities P1/P2/P3 from spec.md). US2 and US3 both depend on US1 (the engine rewrite) landing first, but are independent of each other.

## Path Conventions

Single existing project (monorepo). This feature touches `src/engine/pieces/push.ts` (rewrite), `levels/` (regenerated), and comment-only references elsewhere — `src/engine/board.ts`, `move-step.ts`, `events.ts`, `resolve-launch.ts`, and `tools/generator/` stay functionally unchanged (FR-006/FR-013, research.md Decisión 6).

---

## Phase 1: Setup

**Purpose**: Establish the regression baseline before any change.

- [X] T001 Run `npm run typecheck && npm test` at the repo root and confirm the pre-feature baseline is green before making any change. No files modified.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A for this feature — there is no shared infrastructure separate from User Story 1 itself. US1 *is* the foundational engine change that US2 (regenerate levels) and US3 (re-verify red levels) both depend on; captured as a phase dependency below rather than a separate empty phase with its own tasks.

---

## Phase 3: User Story 1 - Ninguna ficha de una cascada queda invisible para el resto de esa misma cascada (Priority: P1) 🎯 MVP

**Goal**: `applyImpact` (`src/engine/pieces/push.ts`) resolves one impact per invocation and hands off the rest of the cascade to the already-existing queue in `resolveChain` (`src/engine/events.ts`), instead of recursing internally — so any board query mid-cascade only ever sees a genuinely empty cell or a fully-resolved real piece.

**Independent Test**: Reproduce the level-56-style cascade (three board pieces in the same lane, where a brown push would previously wrap all the way around the board) and confirm it now collides with the piece the same cascade already settled, instead of passing through it (spec.md, Historia 1, Independent Test).

### Tests for User Story 1

- [X] T002 [US1] Write the new test suite in `tests/unit/engine/push.test.ts` (new file), importing `applyImpact` directly from `../../../src/engine/pieces/push.js`:
  - **`applyImpact`'s four branches**, called directly with synthetic boards/sites: (a) empty destination → striker settles, `hasCollision: false`, `nextSites: []`; (b) same-color destination → single `ANNIHILATION` event, board cell cleared, `nextSites: []`; (c) different-color destination whose own push lands on an empty cell → striker settles `hasCollision: true`, the displaced defender's own settle event also present, `nextSites: []`; (d) different-color destination whose own push lands on an occupied cell → striker settles, `nextSites` has exactly one entry describing the displaced defender (color, advanced fragility, correct `from`/`to`/`direction`).
  - **`resolveRedSplit` sequencing**: a synthetic split where branch 1's own displaced piece lands on an occupied cell (triggering its own further push) — assert branch 2's impact is computed against the board *after* branch 1's entire sub-cascade has finished, not interleaved (FR-004/FR-005 of 009-red-piece, preserved).
  - **Auto-collision regression** (SC-002/SC-005): a three-board-piece lane cascade (mirroring the level 56 case from the design conversation — see research.md) where a brown push's wrap-around would, under the old semantics, pass through an earlier link of the same cascade; assert it now collides with that real, already-settled piece instead (same-color → annihilation if applicable, matching the color chosen in the fixture).
  - These tests exercise a contract `applyImpact` does not have yet (today it always returns `nextSites: []`) — confirm they fail against the current `push.ts` before continuing to T003 (Principle II).

### Implementation for User Story 1

- [X] T003 [US1] Rewrite `src/engine/pieces/push.ts` per `data-model.md`: new `applyImpact` (same public `ImpactHandler` signature, `settleOrVanish` private helper, the four-branch contract from T002); new private `resolveRedSplit(board, hitDefender, position, direction, strikerEvents)` that calls the already-existing `resolveChain` (imported from `../events.js`) once per branch, sequentially, threading the board between the two calls; delete `resolveStrike`, `resolveBranch`, `resolveSplit`. `PUSH_STRATEGY`, `PERPENDICULAR_DIRECTIONS`, and `advance` stay unchanged.
- [X] T004 [US1] Run `npm run typecheck && npm test` and confirm: the new `push.test.ts` suite passes; every pre-existing engine test (`chain.test.ts`, `red.test.ts`, `brown.test.ts`, `orange.test.ts`, `same-color.test.ts`, `wrap-around.test.ts`, `fragility.test.ts`, `move-step.test.ts`, `goal.test.ts`, `level.test.ts`, `session.test.ts`, `determinism.test.ts`, `launch.test.ts`, `tests/unit/levels/prototype-levels.test.ts`) still passes with identical expected values (SC-001) — none of them import `push.ts` directly (confirmed during planning), so this is the empirical proof that no observable behavior changed for any non-self-colliding cascade (FR-011).

**Checkpoint**: User Story 1 independently functional and testable — SC-002/SC-005 verified, SC-001 confirmed as a regression baseline for US2/US3.

---

## Phase 4: User Story 2 - Los niveles generados se reconstruyen desde cero contra el motor corregido (Priority: P2)

**Goal**: The 140 already-generated levels are deleted and regenerated (10 per `complexityScore` value, 7 through 20) against the corrected engine.

**Independent Test**: Delete `levels/` entirely, regenerate the same 140-level batch with `tools/generator/batch.ts`, and confirm 100% resolve to `'won'` when replayed with the real (corrected) engine (spec.md, Historia 2, Independent Test).

### Implementation for User Story 2

- [X] T005 [US2] Delete `levels/*.json`, `levels/index.json`, and `levels/.next-id.txt` (`git rm -r levels/` to keep the removal tracked, matching how the previous reset was done in 014's session).
- [X] T006 [US2] Regenerate the same batch against the corrected engine: for each `complexityScore` from 7 to 20, generate levels (seeded, incrementing id) until 10 real successes are collected per value — same top-up approach used in the original 014 generation session (generous `maxGenerationAttempts`, since harder `complexityScore` values need more tries), writing `levels/<id>.json`, `levels/index.json`, and `levels/.next-id.txt` in the same format `tools/generator/batch.ts` already produces.
- [X] T007 [US2] Verify the regenerated batch (SC-003): read all 140 files, confirm `index.json`/`.next-id.txt` are internally consistent with the files on disk (no orphans, no missing entries — same check used in the 014 session), and replay every level's `solution` with `resolveLaunch` against its `pieces`/`hand`/`goal`, confirming 100% resolve to `'won'`.

**Checkpoint**: User Story 2 independently functional and testable — SC-003 verified.

---

## Phase 5: User Story 3 - La ficha roja se re-verifica, no se regenera ni se re-especifica (Priority: P3)

**Goal**: Confirm the two red-piece prototype levels (14, 15) resolve exactly the same after the engine rewrite.

**Independent Test**: Reproduce levels 14 and 15 with `resolveLaunch` and confirm both the result and the full event trace are byte-identical to a capture taken before the change (spec.md, Historia 3, Independent Test).

### Tests for User Story 3

- [X] T008 [US3] Add a fixture regression test to `tests/unit/levels/prototype-levels.test.ts` asserting the exact event trace for level 14 (`resolveLaunch` with `{direction: 'S', lane: 3}`) and level 15 (same launch) match the values captured during this feature's design phase before any engine change (a 3-event trace for level 14: red's split settling, then both green branches settling with `hasCollision: false`; a 4-event trace for level 15: red's split settling, one green branch pushing orange onward with `hasCollision: true` then orange settling with `hasCollision: false`, the other green branch settling with `hasCollision: false`) — byte-for-byte, not just `result === 'won'` (which `prototype-levels.test.ts` already covers today, SC-004's weaker half).

**Checkpoint**: All three user stories independently functional — SC-001 through SC-005 verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T009 [P] Update stale comment references to the now-removed `resolveStrike`/`resolveBranch`/`resolveSplit` — replace with `applyImpact`/`resolveRedSplit` where the comment's point still applies, or rephrase where it doesn't — in `src/engine/move-step.ts`, `tools/generator/generate.ts`, `tests/unit/engine/brown.test.ts`, `tests/unit/engine/move-step.test.ts`, `tests/unit/engine/red.test.ts` (confirmed as the full set of files mentioning these names outside `push.ts` itself).
- [X] T010 Run `npm run typecheck && npm test` for the final full regression: the rewritten engine, the new `push.test.ts` suite, the red-level fixture, the regenerated 140 levels, and every pre-existing test all still pass.
- [X] T011 Execute the quickstart.md validation: confirm the level-56-style manual trace shows the corrected collision behavior, and spot-check a handful of the regenerated levels' JSON output.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Empty by design (see note above) — does not block anything beyond Setup.
- **User Story 1 (Phase 3)**: Depends on Setup only.
- **User Story 2 (Phase 4)**: Depends on **User Story 1 being complete** — regenerating levels only makes sense against the corrected engine.
- **User Story 3 (Phase 5)**: Depends on **User Story 1 being complete** — re-verifying red only makes sense against the corrected engine. Independent of User Story 2 (red is untouched by the generator) — **US2 and US3 can proceed in parallel** once US1 is done.
- **Polish (Phase 6)**: Depends on US1 + US2 + US3 all complete.

### Within Each Phase

- Phase 3: T002 (test-first, must fail against current `push.ts`) → T003 (implementation) → T004 (full regression).
- Phase 4: T005 (delete) → T006 (regenerate) → T007 (verify) — strictly sequential, same directory.
- Phase 5: T008 only.
- Phase 6: T009 → T010 → T011 (each depends on the previous being in place, though T009 is comment-only and low-risk).

### Parallel Opportunities

- Phase 4 (US2) and Phase 5 (US3) are independent of each other once Phase 3 (US1) completes — could be worked in parallel.
- T009 (Phase 6) touches multiple files but is a single low-risk comment-accuracy pass — grouped as one task rather than split, since none of the edits are load-bearing.

---

## Parallel Example: After User Story 1 completes

```bash
Task: "Delete and regenerate the 140 levels against the corrected engine"   # T005-T007 (US2)
Task: "Add the red-level exact-trace regression fixture"                    # T008 (US3)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1.
3. **STOP and VALIDATE**: run T004 — SC-001/SC-002/SC-005 hold. This alone is the correctness fix; US2/US3 are consequences, not prerequisites, of it being correct.

### Incremental Delivery

1. Setup → baseline confirmed green.
2. Add US1 (engine rewrite) → verify SC-001/SC-002/SC-005 → the actual bug is fixed here.
3. Add US2 (regenerate levels) and US3 (re-verify red) in parallel → verify SC-003/SC-004.
4. Polish → comment accuracy pass + final full regression + quickstart.md walkthrough.

---

## Notes

- [P] tasks touch different files and have no unmet dependency within their phase.
- [Story] labels map every Phase 3+ task to its user story for traceability; Setup/Foundational/Polish carry no story label by convention.
- No test in this repository imports `src/engine/pieces/push.ts` directly today (confirmed by search during planning) — every existing engine test goes through the public `resolveLaunch`/`createLevel` API, which is exactly why SC-001 (zero changes to existing expected values) is a meaningful, checkable claim rather than something that needs its own migration work.
- Commit after each task or logical group; stop at any phase checkpoint to validate that story independently before continuing.
