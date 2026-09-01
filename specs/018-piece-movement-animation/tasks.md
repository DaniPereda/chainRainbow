# Tasks: Animación de Movimientos de Ficha Durante un Lanzamiento

**Input**: Design documents from `/specs/018-piece-movement-animation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (all present)

**Tests**: Included for the pure/testable part (`replayEvent`, Principle II). The Phaser orchestration (`playEventLog`, `BoardScene` wiring) is validated manually via quickstart.md, consistent with how `board-view.ts`/`BoardScene.ts` are already validated in this project.

**Organization**: Tasks are grouped by user story (US1/US2/US3, priorities P1/P2/P2 from spec.md). US2 and US3 both depend on US1's restructuring of `launch()` into a callback-driven sequence.

## Path Conventions

Single existing project (monorepo). This feature touches only `src/renderer/` (new `launch-animation.ts`, modified `BoardScene.ts`) and its test (`tests/unit/renderer/launch-animation.test.ts`) — `src/engine/` is untouched (FR-009).

---

## Phase 1: Setup

**Purpose**: Establish the regression baseline before any change.

- [X] T001 Run `npm run typecheck && npm test && npm run build` at the repo root and confirm the pre-feature baseline is green before making any change. No files modified.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A for this feature — there is no shared infrastructure separate from User Story 1 itself. US1 *is* the foundational animation mechanism that US2 (input blocking) and US3 (overlay timing) both hook into; captured as a phase dependency below rather than a separate empty phase with its own tasks.

---

## Phase 3: User Story 1 - Ver la cascada de un lanzamiento paso a paso, no de golpe (Priority: P1) 🎯 MVP

**Goal**: `BoardScene.launch()` reproduces a launch's `EventLog` visually, one event at a time (each `MOVE_STEP` as a tween, each `ANNIHILATION` as a fade), before the final authoritative `redraw()` — instead of jumping straight to the final board state.

**Independent Test**: Launch a chain of at least two links and observe each piece move visually, in event order, before the board settles into its final state (spec.md, Historia 1, Independent Test).

### Tests for User Story 1

- [X] T002 [P] [US1] Write `tests/unit/renderer/launch-animation.test.ts`: `replayEvent` (data-model.md) — a normal `MOVE_STEP` relocates the piece; a `MOVE_STEP` whose `piece.fragility === 'broken'` clears the origin without placing anything at the destination; an `ANNIHILATION` clears its cell; reducing a full known `EventLog` (e.g. the 016/017 auto-collision fixture already in `tests/unit/engine/push.test.ts`) over its pre-launch board produces exactly the same final `Board` as `resolveLaunch` already returns for that case.

### Implementation for User Story 1

- [X] T003 [US1] Create `src/renderer/launch-animation.ts`: `replayEvent(board, event): Board` (pure, per data-model.md) and `pixelCenter(coord)` (reuses `CELL_SIZE` from `board-view.ts`). Run T002 and confirm it passes.
- [X] T004 [US1] Add `playEventLog(scene, boardGraphics, goal, boardBeforeLaunch, events, onDone)` to `launch-animation.ts` (data-model.md orchestration sketch): plays each event strictly in sequence via `scene.tweens.add` (a temporary `Phaser.GameObjects.Arc` per event, styled like `drawPieceFragility`'s color), redrawing the static layer via `drawBoard`+`replayEvent` between steps so the board underneath never shows a duplicated or missing piece; calls `onDone()` once the last event's tween completes. Missing/empty `events` calls `onDone()` immediately with no animation (FR-004).
- [X] T005 [US1] In `src/renderer/scenes/BoardScene.ts`, change `launch()` to capture `this.session.current.board` *before* calling `applySessionLaunch`, then call `playEventLog(...)` with `outcome.events` instead of calling `redraw()` immediately; `onDone` calls the existing `redraw()` (unchanged) followed by the existing win/lose overlay check (unchanged code, just moved into the callback for now — US3 refines exactly when this fires relative to blocking).
- [X] T006 [US1] Run `npm run typecheck && npm test && npm run build` — confirm T002 passes and no existing test changed. Manually validate quickstart.md steps 1-4 (chain animates in order, annihilation fades, missclick unaffected, final board matches).

**Checkpoint**: User Story 1 independently functional and testable — SC-001/SC-002/SC-003 verified.

---

## Phase 4: User Story 2 - No se puede interrumpir una animación en curso (Priority: P2)

**Goal**: While a launch's animation is playing, confirming a new launch or changing the hand-piece selection has no effect.

**Independent Test**: Start a multi-step animation and, while it's still playing, attempt a new launch and a hand-piece tap — confirm neither has any effect until the animation finishes (spec.md, Historia 2, Independent Test).

### Implementation for User Story 2

- [X] T007 [US2] Add `private animating = false;` to `BoardScene`. In `launch()`, add `|| this.animating` to the existing early-return guard (alongside empty-hand/resolved-level); set `this.animating = true` right before calling `playEventLog`, and `this.animating = false` at the start of its `onDone` callback (before the existing `redraw()`).
- [X] T008 [US2] In `redraw()`'s hand-hit-zone `pointerdown` handler, add an `if (this.animating) return;` guard before calling `selectHandPiece`.
- [X] T009 [US2] Run `npm run typecheck && npm test && npm run build`. Manually validate quickstart.md step 5 (new launch and hand-selection attempts during an in-progress animation have no effect; both work normally once it finishes).

**Checkpoint**: User Story 2 independently functional and testable — SC-004 verified.

---

## Phase 5: User Story 3 - El resultado final se muestra solo cuando la animación ha terminado (Priority: P2)

**Goal**: The win/lose overlay never appears before a launch's full animation has finished playing.

**Independent Test**: Confirm a level-resolving launch and verify the result window doesn't appear until the last animated event has finished (spec.md, Historia 3, Independent Test).

### Implementation for User Story 3

- [X] T010 [US3] Confirm (from T005's `onDone` wiring) that `showResultOverlay` is only ever called from inside `playEventLog`'s `onDone` callback, never synchronously right after `applySessionLaunch` — if T005 already placed it there, this task is verifying, not changing, the wiring.
- [X] T011 [US3] Run `npm run typecheck && npm test && npm run build`. Manually validate quickstart.md step 6 (result overlay only appears after the full animation) and step 7 (same behavior in `GeneratedLevelSelectScene`'s use of `BoardScene`).

**Checkpoint**: All user stories independently functional — SC-005 verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T012 Run `npm run typecheck && npm test && npm run build` for the final full regression.
- [X] T013 Execute the full quickstart.md validation (all 8 manual steps, including step 8: back-button navigation during an in-progress animation is unaffected).
- [X] T014 [P] Confirm via `git diff` that `src/engine/` has zero changes (FR-009, quickstart.md's own "done" checklist item).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Empty by design (see note above) — does not block anything beyond Setup.
- **User Story 1 (Phase 3)**: Depends on Setup only.
- **User Story 2 (Phase 4)**: Depends on **User Story 1 being complete** — blocking input during an animation only makes sense once the animation (and its `onDone` callback) exists.
- **User Story 3 (Phase 5)**: Depends on **User Story 1 being complete** (the `onDone` callback it verifies) — independent of User Story 2, though both modify the same `onDone` callback in practice.
- **Polish (Phase 6)**: Depends on US1 + US2 + US3 all complete.

### Within Each Phase

- Phase 3: T002 (test-first) → T003 → T004 → T005 → T006.
- Phase 4: T007 → T008 → T009.
- Phase 5: T010 → T011.
- Phase 6: T012 → T013 → T014.

### Parallel Opportunities

- T002 (writing the test file) can start in parallel with reading through `board-view.ts`/`BoardScene.ts` for T003-T005, but T003 must land before T002 can actually pass (test-first: write, confirm it fails/doesn't compile, then implement).
- Otherwise this feature is small enough (one new file, one modified scene) that its tasks are largely sequential within each phase.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1.
3. **STOP and VALIDATE**: run T006 — SC-001/SC-002/SC-003 hold. The core visual value (seeing the cascade) is delivered here; US2/US3 harden the interaction around it.

### Incremental Delivery

1. Setup → baseline confirmed green.
2. Add US1 (animation itself) → verify SC-001/SC-002/SC-003.
3. Add US2 (block input mid-animation) → verify SC-004.
4. Add US3 (defer result overlay) → verify SC-005.
5. Polish → final full regression + quickstart.md walkthrough + engine-untouched check.

---

## Phase 7: Refinamiento post-playtest (FR-011/FR-012, añadido tras probar la v1 en el navegador)

- [X] T015 [P] Bump `STEP_DURATION_MS` from 150ms to 350ms in `launch-animation.ts` (user playtest: "un poco más lenta").
- [X] T016 Add `jumpMidpoint(from, to, size)` to `launch-animation.ts` (pure, per research.md Decisión 6) plus its Vitest coverage in `launch-animation.test.ts` (horizontal, vertical, wrap-around, non-2-cell, diagonal cases).
- [X] T017 In `playEventLog`, branch on `jumpMidpoint`: `null` keeps the existing straight tween (plus `playImpactSound()` on `hasCollision`/`ANNIHILATION`); non-`null` plays a two-phase hop animation through the midpoint with a temporary highlight marker there, and `playJumpSound()` instead of the impact sound.
- [X] T018 Create `src/renderer/sound-effects.ts`: `playImpactSound`/`playJumpSound`/`playGoalSound`, three short tones via raw `AudioContext` (research.md Decisión 7, no audio assets). Wire `playGoalSound()` into `BoardScene.launch()`'s `onDone`, right before `showResultOverlay('won')`.
- [X] T019 Run `npm run typecheck && npm test && npm run build` — confirm all pass (189 tests) and no existing test's expected values changed.
- [X] T020 Manually validate in the browser: a jump (orange pushing something 2 cells) shows the hop + midpoint marker and its own sound; a normal collision plays the impact sound; reaching the goal plays the goal sound after the animation finishes.

## Phase 8: Segunda ronda de refinamiento post-playtest

- [X] T021 [P] Bump `STEP_DURATION_MS` from 350ms to 450ms (user playtest, round 2: "todo un poco mas lento").
- [X] T022 Add `entryCoordinate(direction, lane)` to `launch-animation.ts` (mirrors `launch.ts`'s private one, research.md Decisión 8); `playEventLog` gains a `launch: Launch` parameter; the first event of a trace, if it's a `MOVE_STEP`, now glides in a straight line from the true board edge to its real `event.from` before running its normal animation (jump-or-straight) unchanged. `BoardScene.launch()` passes `{ direction, lane }` through.
- [X] T023 Run `npm run typecheck && npm test && npm run build` — confirm all pass (189 tests) and no existing test's expected values changed.
- [X] T024 Manually validate in the browser: a hand launch now visibly glides in from the board edge before its first impact, instead of appearing to spawn right next to it.

## Phase 9: Tercera ronda de refinamiento post-playtest

- [X] T025 In `launch-animation.ts`'s jump-hop tween, make the arc's bulge perpendicular to the direction of travel (research.md Decisión 9): a horizontal jump still bulges up (`y` offset); a vertical jump now bulges right (`x` offset) instead of up.
- [X] T026 Run `npm run typecheck && npm test && npm run build` — confirm all pass (189 tests) and no existing test's expected values changed.
- [X] T027 Manually validate in the browser: a vertical orange jump now visibly arcs to the right instead of looking like a same-axis speed change.

---

## Notes

- [Story] labels map every Phase 3+ task to its user story for traceability; Setup/Foundational/Polish carry no story label by convention.
- Commit after each task or logical group; stop at any phase checkpoint to validate that story independently before continuing.
- Phase 7 was added retroactively after the user playtested the v1 implementation in the browser and asked for these three refinements in the same session — spec.md/research.md/data-model.md were updated to match (FR-011/FR-012, SC-006, research.md Decisiones 6-7).
