# Tasks: Fragilidad como Factor de Dificultad del Generador

**Input**: Design documents from `/specs/013-generator-fragility-difficulty/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (all present)

**Tests**: Included. Constitution Principle II (test-first) is non-negotiable for this project, and plan.md's Constitution Check explicitly commits to "el trabajo empieza actualizando fixtures existentes... antes de añadir la suite nueva de Historias 1-3".

**Organization**: Tasks are grouped by user story (US1/US2/US3, priorities P1/P2/P3 from spec.md) so each can be implemented and verified independently.

## Path Conventions

Single existing project (monorepo). This feature touches only `tools/generator/` and `tests/unit/tools/generator/` — `src/engine/` and `src/renderer/` are out of scope (FR-013).

---

## Phase 1: Setup

**Purpose**: Establish the regression baseline before any change.

- [X] T001 Run `npm run typecheck && npm test` at the repo root and confirm the pre-feature baseline is green (130 existing tests under `tests/unit/tools/generator/`, per quickstart.md) before making any change. No files modified.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared primitive (`assignGroupFragility`) and the type/shape changes every user story depends on to carry fragility from generation through to output and verification.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Write contract tests for `assignGroupFragility` in `tests/unit/tools/generator/fragility.test.ts`: `profile === undefined` returns `count` copies of `'new'` with zero `rng()` calls; `'easy'` makes exactly 1 `rng()` call and returns `count` copies of one sampled state from `allowedStates`; `'hard'` makes exactly `count` independent `rng()` calls, one per position; `'medium'` samples a base state (1 call) then rolls a deviation per position; `count === 0` returns `[]` with zero `rng()` calls for every profile (data-model.md, "Función nueva: asignación de fragilidad por grupo").
- [X] T003 Implement `FragilityProfile` type (`'easy' | 'medium' | 'hard'`) and the pure `assignGroupFragility(profile, count, allowedStates, rng)` function in `tools/generator/fragility.ts` to satisfy T002, including the `MEDIUM_DEVIATION_PROBABILITY = 0.3` constant for `'medium'` (data-model.md).
- [X] T004 Widen `GenerationParams` (add optional `difficultyProfile?: FragilityProfile`) and `GeneratedLevel` (`pieces: { at, color, fragility: Fragility }[]`, `hand: HandPieceInput[]`) in `tools/generator/generate.ts` (data-model.md, "`GenerationParams`/`GeneratedLevel` extendido").
- [X] T005 Update `boardPieces()` in `tools/generator/generate.ts` to read and include `fragility` from each `Piece` on the board instead of discarding it, matching the widened `GeneratedLevel.pieces` shape from T004.
- [X] T006 [P] Add optional `difficultyProfile?: FragilityProfile` to `ResolutionContext` in `tools/generator/obligations.ts` (data-model.md, "`ResolutionContext` extendido").
- [X] T007 [P] Mechanically update the `pieces` fixtures in `tests/unit/tools/generator/generate.test.ts` (the `toEqual` assertions around lines 36-38, 52-54, and 66-72) to include `fragility: 'new'`, matching the widened output shape from T004/T005 — no expected VALUES change, only shape (quickstart.md, "Regresión completa").

**Checkpoint**: `npm run typecheck && npm test` green, byte-identical behavior to pre-feature baseline (no `difficultyProfile` used anywhere yet).

---

## Phase 3: User Story 1 - La fragilidad asignada nunca rompe la propia solución construida (Priority: P1) 🎯 MVP

**Goal**: Every board piece the built solution strikes stays safely `'new'` (single strike) or the construction is discarded (2+ strikes) — the existing reactive mechanism (`validatesForward`) already guarantees this; this story makes the guarantee genuine end-to-end and proves it.

**Independent Test**: Generate a large batch of multi-launch levels with fragility active and confirm 100% of levels delivered as valid still reproduce `'won'` with the real engine (spec.md, Historia 1, Independent Test).

### Implementation for User Story 1

- [X] T008 [US1] In `attemptOnce` (`tools/generator/generate.ts`), build the `pieces` used for both the output and the `createLevel` verification call directly from `boardPieces(outcome.board)` (carrying real `fragility`) instead of stripping it down to `{ at, color }` first — this is what turns `validatesForward`'s reproduction into a genuine check against real fragility values rather than an assumed `'new'` (data-model.md, "`validatesForward` (sin cambios de firma ni de lógica)").

### Tests for User Story 1

- [X] T009 [US1] Add Historia 1 acceptance tests to `tests/unit/tools/generator/fragility.test.ts`: (a) over a large batch of `launchCount >= 2` generations with `difficultyProfile` active, 100% of levels delivered as valid reproduce `resultado: 'won'` (SC-001); (b) any board piece the solution strikes exactly once is always `'new'` in `result.level.pieces`; (c) a construction where the built solution strikes the same board piece twice is discarded by the existing attempt-and-retry mechanism — a deliberate regression test for the behavior already fixed in commit `4e90191`, not new production code (research.md, Decisión 1).

**Checkpoint**: User Story 1 independently functional and testable — SC-001 verified.

---

## Phase 4: User Story 2 - La dificultad se controla mediante un perfil discreto (Priority: P2)

**Goal**: `difficultyProfile` controls how much fragility-state heterogeneity appears within each of three groups — board decoys, hand decoys, and the solution's own launched pieces — while board-struck pieces stay untouched (governed exclusively by US1).

**Independent Test**: Generate levels with decoys under each profile and confirm, in aggregate, the hardest profile produces more within-group state variety than the easiest, with no decoy ever appearing in the reference solution and no board-struck piece ever varying from `'new'` (spec.md, Historia 2, Independent Test).

### Implementation for User Story 2

- [X] T010 [US2] In `resolveObligations` (`tools/generator/obligations.ts`), add a local `pickBoardDecoyFragility` helper plus an `'easy'`-profile caching variable scoped to the function call (not `ResolutionContext`, which is passed by value): with `ctx.difficultyProfile === undefined` return `'new'` without consuming `rng()`; with `'easy'` sample the shared state once per attempt and reuse it; with `'hard'`/`'medium'` sample independently each call via `assignGroupFragility(profile, 1, ['new', 'cracked'], rng)[0]` (data-model.md, "Decisión 3").
- [X] T011 [US2] Wire `pickBoardDecoyFragility` into the board-decoy placement block of `resolveObligations` (`tools/generator/obligations.ts`), replacing the unconditional `fragility: 'new'` currently passed to `setPieceAt`.
- [X] T012 [US2] In `attemptOnce` (`tools/generator/generate.ts`), after `resolveObligations` succeeds, assign launched-piece fragility via `assignGroupFragility(params.difficultyProfile, playOrder.length, ['new', 'cracked'], rng)` and build `hand` as `HandPieceInput[]` pairing each launch with its sampled state (data-model.md, "`attemptOnce` (comportamiento extendido)").
- [X] T013 [US2] In `attemptOnce` (`tools/generator/generate.ts`), assign hand-decoy fragility via `assignGroupFragility(params.difficultyProfile, params.decoyCount, ['new', 'cracked', 'broken'], rng)` when appending decoy entries to the hand, in place of the current color-only loop.
- [X] T014 [P] [US2] Add an optional `--difficulty-profile <easy|medium|hard>` CLI flag to `tools/generator/cli.ts`, mapped directly to `GenerationParams.difficultyProfile`, following the existing flag pattern (`--decoys`, `--board-decoy-probability`).
- [X] T015 [P] [US2] Add the same optional `--difficulty-profile <easy|medium|hard>` flag to `tools/generator/batch.ts`.

### Tests for User Story 2

- [X] T016 [US2] Add Historia 2 tests to `tests/unit/tools/generator/fragility.test.ts`: with `'easy'`, all board decoys share one state, all hand decoys share one state, and all launched pieces share one state (three groups may differ from each other); with `'hard'`, over a large batch, the proportion of levels showing more than one state within a group is notably higher than with `'easy'` (SC-003); for any profile, board-struck pieces never vary from `'new'` and the reference solution still reproduces `'won'`; same seed + params + profile always produces an identical level including fragility (SC-004); and with `difficultyProfile` omitted, generated levels are unchanged from the pre-feature baseline for a sample of existing seeds — zero extra `rng()` calls (research.md, Decisión 3).

**Checkpoint**: User Stories 1 AND 2 both independently functional — SC-003/SC-004 verified.

---

## Phase 5: User Story 3 - Ningún señuelo de tablero se asigna en estado que lo haga desaparecer (Priority: P3)

**Goal**: Board decoys are never assigned `'broken'` (which `createLevel` would silently drop), while hand decoys can legitimately reach `'broken'`.

**Independent Test**: Generate many levels with board decoys and the hardest profile, and confirm the delivered board-piece count always matches solution-critical pieces plus requested board decoys — none vanish (spec.md, Historia 3, Independent Test).

### Tests for User Story 3

> No new production code: `allowedStates = ['new', 'cracked']` for board decoys (already wired in T010/T011) structurally makes `'broken'` unreachable for this group — this story is verification of that guarantee, per data-model.md's per-group `allowedStates` table.

- [X] T017 [US3] Add Historia 3 tests to `tests/unit/tools/generator/fragility.test.ts`: over a large batch with `difficultyProfile: 'hard'` and board decoys requested, no board decoy ever appears as `'broken'` in `result.level.pieces` (SC-002), and the delivered board-piece count always equals solution-critical pieces plus requested board decoys; as a contrast check, hand decoys under the same profile DO reach `'broken'` sometimes (FR-009), confirming the board/hand asymmetry is intentional.

**Checkpoint**: All three user stories independently functional — SC-001 through SC-004 verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T018 [P] Re-export `FragilityProfile` and `assignGroupFragility` from `tools/generator/index.ts` if any consumer outside `tools/generator/` needs them (data-model.md, "vive en el generador... re-exporta si hiciera falta").
- [X] T019 Run `npm run typecheck && npm test` for the full regression: all pre-existing generator tests plus the new `fragility.test.ts` suite pass.
- [X] T020 Execute the quickstart.md manual CLI validation: run the generator with `--difficulty-profile hard --seed 7` and again with `--difficulty-profile easy`, and confirm the output matches quickstart.md's three checks (every `hand`/`pieces` entry carries `fragility`; solution-origin board pieces are `'new'`; `hard` shows visibly more decoy-state variety than `easy`).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational only (independent of US1's T008/T009, though both touch `generate.ts`/`fragility.test.ts` so run the phases in order to avoid merge conflicts).
- **User Story 3 (Phase 5)**: Depends on Foundational + US2's T010/T011 (board-decoy `allowedStates` wiring) — it verifies behavior US2 already implements, so it must follow US2.
- **Polish (Phase 6)**: Depends on US1 + US2 + US3 all complete.

### Within Each Phase

- Phase 2: T002 → T003 (test-first) → T004 → T005 (same file, sequential); T006 parallel to T004/T005 (different file); T007 after T004/T005 (shape it asserts against).
- Phase 3: T008 → T009.
- Phase 4: T010 → T011 (same file); T012 → T013 (same file); T014/T015 parallel to everything else in the phase (different files); T016 last (asserts on all of the above).
- Phase 5: T017 only.
- Phase 6: T018 parallel to nothing else pending; T019 after T018; T020 after T019.

### Parallel Opportunities

- T002 can start immediately in Phase 2 (own file, no prior dependency).
- T006 can run parallel to T004/T005 (different files, same phase).
- T007 can run parallel to T006.
- T014 and T015 can run in parallel (different files, both only need `GenerationParams.difficultyProfile` from T004).
- T018 can run parallel to the tail of Phase 5 once Phase 4 is done.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Can run together once Setup (T001) is done:
Task: "Write contract tests for assignGroupFragility in tests/unit/tools/generator/fragility.test.ts"          # T002
# After T003/T004/T005 land:
Task: "Add difficultyProfile to ResolutionContext in tools/generator/obligations.ts"                            # T006
Task: "Update pieces fixtures in tests/unit/tools/generator/generate.test.ts for the widened shape"             # T007
```

## Parallel Example: Phase 4 (User Story 2)

```bash
Task: "Add --difficulty-profile flag to tools/generator/cli.ts"     # T014
Task: "Add --difficulty-profile flag to tools/generator/batch.ts"   # T015
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks everything).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run the Historia 1 batch check (T009) independently — SC-001 holds even with no `difficultyProfile` ever passed, since US1 requires no new decision logic (research.md, Decisión 1).

### Incremental Delivery

1. Setup + Foundational → shared primitive and widened types ready, zero behavior change.
2. Add US1 → verify SC-001 → this alone is a safe, shippable no-op-by-default state.
3. Add US2 → verify SC-003/SC-004 → `--difficulty-profile` becomes a real, useful CLI parameter.
4. Add US3 → verify SC-002 → confirms the board-decoy edge case never regresses.
5. Polish → full regression + quickstart.md walkthrough.

---

## Notes

- [P] tasks touch different files and have no unmet dependency within their phase.
- [Story] labels map every Phase 3+ task to its user story for traceability; Setup/Foundational/Polish carry no story label by convention.
- `src/engine/` and `src/renderer/` are never touched by this feature (FR-013) — no task references them.
- Commit after each task or logical group; stop at any phase checkpoint to validate that story independently before continuing.
