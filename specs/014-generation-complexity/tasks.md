# Tasks: Puntuación de Complejidad de Generación

**Input**: Design documents from `/specs/014-generation-complexity/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (all present)

**Tests**: Included. Constitution Principle II (test-first) is non-negotiable for this project, and plan.md's Constitution Check commits to updating the mechanical rename fixtures before adding the new `complexity.test.ts` suite.

**Organization**: Tasks are grouped by user story (US1/US2/US3, priorities P1/P2/P3 from spec.md). Unlike a typical spec-kit feature, US2 and US3 are NOT independent of US1 here by design: both reference the `fragilityProfile` field name that US1 introduces, so US1 must land first (see Dependencies).

## Path Conventions

Single existing project (monorepo). This feature touches only `tools/generator/` and `tests/unit/tools/generator/` — `src/engine/` and `src/renderer/` are out of scope (FR-014).

---

## Phase 1: Setup

**Purpose**: Establish the regression baseline before any change.

- [X] T001 Run `npm run typecheck && npm test` at the repo root and confirm the pre-feature baseline is green (148 tests, per this branch stacking on 013-generator-fragility-difficulty's final state) before making any change. No files modified.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A for this feature — there is no shared infrastructure that all three stories need before any of them can start. The real ordering constraint is that **User Story 1 (rename) must land before User Story 2/3 begin**, because their code references the post-rename field name (`fragilityProfile`) directly. This is captured in the Dependencies section below rather than as a separate Foundational phase.

---

## Phase 3: User Story 1 - El nombre "dificultad" deja de estar ocupado por un parámetro de entrada (Priority: P1) 🎯 MVP

**Goal**: `difficultyProfile` (introduced in 013-generator-fragility-difficulty) becomes `fragilityProfile` everywhere — `GenerationParams`, `ResolutionContext`, the `--difficulty-profile` CLI flag — with zero behavior change.

**Independent Test**: Generate levels with the renamed field/flag and confirm identical output (including reproducibility by seed) to before the rename — no test changes its expected VALUE, only the field/flag name used to reach it (spec.md, Historia 1, Independent Test).

### Implementation for User Story 1

- [X] T002 [P] [US1] Rename `difficultyProfile` → `fragilityProfile` in `tools/generator/generate.ts`: the `GenerationParams` field, its doc comment, and both `assignGroupFragility(params.difficultyProfile, ...)` call sites (currently around lines 152 and 180).
- [X] T003 [P] [US1] Rename `difficultyProfile` → `fragilityProfile` in `tools/generator/obligations.ts`: the `ResolutionContext` field, its doc comment, and the `pickBoardDecoyFragility` internal usages (`ctx.difficultyProfile`, currently 3 occurrences around lines 36/148/149/155).
- [X] T004 [P] [US1] Rename the `--difficulty-profile` flag to `--fragility-profile` in `tools/generator/cli.ts`, and the local `difficultyProfile` variable it's assigned to, to `fragilityProfile` (matching the renamed `GenerationParams` field from T002).
- [X] T005 [P] [US1] Rename the `--difficulty-profile` flag to `--fragility-profile` in `tools/generator/batch.ts`, same treatment as T004.
- [X] T006 [P] [US1] In `tools/generator/fragility.ts`, update the doc-comment wording "don't opt into a difficulty profile" (line 22) to say "fragility profile" instead — leave the file-header reference to the `013-generator-fragility-difficulty` branch name untouched (it's a historical reference, not the renamed field).

### Tests for User Story 1

- [X] T007 [US1] Mechanically rename every `difficultyProfile` reference in `tests/unit/tools/generator/fragility.test.ts` to `fragilityProfile` — field usages in test bodies, the `baseRootAndCtx` helper's parameter name, and the test description strings/comments that mention it (e.g. "omitting difficultyProfile..."). No expected VALUES change, only the identifier (depends on T002/T003 for the codebase to compile against the new field name).
- [X] T008 [US1] Run `npm run typecheck && npm test` and confirm all previously-passing tests still pass with identical expected values under the new field/flag name — this is the empirical proof of FR-002 (zero behavior change from the rename).

**Checkpoint**: User Story 1 independently functional and testable — SC-005 verified (zero "difficulty" references left pointing at the fragility-heterogeneity control).

---

## Phase 4: User Story 2 - Pedir un nivel por complejidad total, no factor a factor (Priority: P2)

**Goal**: A single optional `complexityScore` input resolves, via deterministic random budget distribution over 7 known factors (each with its own level count and JSON-configured brackets), into a fully concrete `GenerationParams`.

**Independent Test**: Generate many levels requesting the same `complexityScore` across different seeds, and confirm (a) each factor's concrete value falls within the bracket of the level it was assigned, (b) the assigned levels always sum to exactly the requested `complexityScore`, and (c) the same seed reproduces the exact same distribution and values (spec.md, Historia 2, Independent Test).

### Tests for User Story 2

- [X] T009 [P] [US2] Write contract tests for `resolveComplexity`/`complexityRange`/`sampleLevel` in `tests/unit/tools/generator/complexity.test.ts` (against synthetic in-memory `ComplexityConfig` objects, not the real config file): the resolved levels always sum to the requested `complexityScore`; no factor exceeds its own configured level count (including a factor configured with more than 3 levels); `integerRange`/`floatRange` levels consume exactly 1 `rng()` call each when sampled, `discreteSet` levels consume 0; `complexityRange` computes `[min, max]` correctly; same `complexityScore` + config + excluded-set + rng sequence → identical resolved output (data-model.md, "Función nueva: resolución de complejidad").

### Implementation for User Story 2

- [X] T010 [US2] Implement `ComplexityFactorName`, the discriminated `ComplexityFactorConfig` union (`integerRange`/`floatRange`/`discreteSet`), `ComplexityConfig`, the private `sampleLevel`, `resolveComplexity`, and `complexityRange` in `tools/generator/complexity.ts` to satisfy T009 (data-model.md, research.md Decisión 3/4).
- [X] T011 [P] [US2] Create `tools/generator/complexity-config.json` with the 7-factor bracket table from research.md Decisión 3: `launchCount` (1-2 / 3-4 / 5-6), `chainOriginProbability` (0.0-0.3 / 0.3-0.6 / 0.6-0.9), `defenderContinuationProbability` (0.0-0.3 / 0.3-0.5 / 0.5-0.7), `decoyCount` (0-1 / 2-3 / 4-6), `boardDecoyProbability` (0.0-0.1 / 0.1-0.3 / 0.3-0.5), `availableColors` (`['green','orange']` / `['green','orange','brown']`), `fragilityProfile` (`'easy'` / `'medium'` / `'hard'`).
- [X] T012 [US2] Implement `loadComplexityConfig()` in `tools/generator/complexity.ts`, reading `complexity-config.json` via `readFileSync` + `JSON.parse` (research.md Decisión 2) — depends on T010 (the `ComplexityConfig` type) and T011 (the file to read).
- [X] T013 [P] [US2] In `tools/generator/generate.ts`, add `complexityScore?: number` to `GenerationParams`, and widen `launchCount`, `availableColors`, `chainOriginProbability`, and `decoyCount` from required to optional (data-model.md, "`GenerationParams` (extendido)").
- [X] T014 [US2] Wire complexity resolution into `generateLevelWithRng` in `tools/generator/generate.ts`, before the existing `launchCount < 1` validation: when `params.complexityScore !== undefined`, load the config (T012), compute the set of factors that already have an explicit value in `params` (excluded from the budget per research.md Decisión 4), call `resolveComplexity`, and merge the resolved values into `params` such that any explicit value always wins; then validate that `launchCount`, `availableColors`, `chainOriginProbability`, and `decoyCount` are all defined at this point, throwing a clear error (same style as the existing `launchCount < 1` throw) if any are still missing (depends on T010, T012, T013).
- [X] T015 [P] [US2] Add an optional `--complexity-score <N>` CLI flag to `tools/generator/cli.ts`, mapped to `GenerationParams.complexityScore`, following the existing flag pattern (depends on T013).
- [X] T016 [P] [US2] Add the same optional `--complexity-score <N>` flag to `tools/generator/batch.ts` (depends on T013).
- [X] T017 [US2] Add end-to-end tests to `tests/unit/tools/generator/complexity.test.ts` exercising `generateLevelWithRng`/`generateLevel` with real `complexityScore` values: the minimum valid score uses only level-1 brackets for every factor; an intermediate score's assigned levels sum correctly; SC-001 (same seed + params + `complexityScore` → identical level, including which level each factor got and its sampled value); SC-003 (omitting `complexityScore` leaves every pre-existing scripted-rng fixture in `generate.test.ts`/`fragility.test.ts` byte-identical — zero new `rng()` calls) (depends on T014).

**Checkpoint**: User Stories 1 AND 2 both independently functional — SC-001/SC-002 verified.

---

## Phase 5: User Story 3 - Las horquillas se ajustan sin tocar código, y los parámetros explícitos siguen mandando (Priority: P3)

**Goal**: Config-driven brackets take effect without any code change, and an explicit individual parameter always overrides what `complexityScore` would have produced for that factor — including being excluded from the random budget and from the valid `complexityScore` range for that call.

**Independent Test**: Change a bracket in the config file (or, equivalently, pass a different `ComplexityConfig` object directly to `resolveComplexity`) and confirm sampled values move into the new range without touching any generator logic; separately, request a level with both `complexityScore` and an explicit factor value and confirm the explicit value is respected exactly while the rest is still governed by `complexityScore` (spec.md, Historia 3, Independent Test).

> No new production code expected: the exclusion behavior this story verifies is exactly what T014 already implements, and config-editability is exactly what `resolveComplexity`/`loadComplexityConfig` already provide by construction (pure function of its `config` parameter). This phase is test-only, confirming those guarantees hold.

### Tests for User Story 3

- [X] T018 [US3] Add tests to `tests/unit/tools/generator/complexity.test.ts` confirming config-editability without code changes: pass two different `ComplexityConfig` objects representing a bracket "before" and "after" an edit to `resolveComplexity`/`sampleLevel` and confirm the sampled value moves into the new range (SC-004); separately, confirm `loadComplexityConfig()` parses the real `tools/generator/complexity-config.json` into a well-formed `ComplexityConfig` containing exactly the 7 expected factor keys, each with a valid `kind` and at least one level.
- [X] T019 [US3] Add tests confirming FR-012/FR-013 compatibility via `generateLevelWithRng`/`generateLevel`: a call with neither `complexityScore` nor any complexity-related override behaves identically to the pre-014 baseline (extend/reuse the existing "statistical regression across real seeds" fixture in `generate.test.ts` as the proof); and a call combining `complexityScore` with an explicit individual factor value (e.g. `launchCount`) uses exactly that explicit value in the resulting level, while `complexityRange`'s `[min, max]` computed for that call excludes the explicitly-given factor entirely.

**Checkpoint**: All three user stories independently functional — SC-001 through SC-005 verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] Re-export `ComplexityFactorName`, `ComplexityConfig`, `resolveComplexity`, `complexityRange`, and `loadComplexityConfig` from `tools/generator/index.ts` if any consumer outside `tools/generator/` needs them (mirroring the precedent set for `fragility.ts` in 013).
- [X] T021 Run `npm run typecheck && npm test` for the full regression: the renamed fixtures, the new `complexity.test.ts` suite, and every pre-existing test all pass.
- [X] T022 Execute the quickstart.md manual CLI validation: run the generator with `--complexity-score 10 --seed 7`, again with individual flags and `--fragility-profile` (no `complexityScore`), and again mixing `--complexity-score` with an explicit `--launches`; then edit a bracket in `tools/generator/complexity-config.json` and confirm the first run's output range shifts accordingly, per quickstart.md's three checks.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Empty by design (see note above) — does not block anything beyond Setup.
- **User Story 1 (Phase 3)**: Depends on Setup only.
- **User Story 2 (Phase 4)**: Depends on **User Story 1 being complete** — `complexity.ts`, `complexity-config.json`, and the `generateLevelWithRng` wiring all reference the `fragilityProfile` field name that only exists after T002/T003/T007 land. This is a deliberate deviation from the usual "user stories are independent" spec-kit default, driven by the rename being a real prerequisite, not a stylistic choice.
- **User Story 3 (Phase 5)**: Depends on **User Story 2 being complete** — it tests behavior (`resolveComplexity`'s exclusion logic, config-driven bracket changes) that only exists once T010–T014 land.
- **Polish (Phase 6)**: Depends on US1 + US2 + US3 all complete.

### Within Each Phase

- Phase 3: T002/T003/T004/T005/T006 all parallel (different files) → T007 (depends on T002/T003 for the codebase to compile) → T008.
- Phase 4: T009 (own new test file) parallel to T011 (own new config file) parallel to T013 (different file, additive-only change) → T010 (depends on T009, test-first) → T012 (depends on T010 + T011) → T014 (depends on T010/T012/T013) → T015/T016 parallel (both depend on T013, different files) → T017 (depends on T014).
- Phase 5: T018 and T019 can run in parallel (both touch `complexity.test.ts` but as independent new test blocks / describe groups — sequence them if working solo to avoid a merge conflict on the same file).
- Phase 6: T020 parallel to nothing else pending; T021 after T020; T022 after T021.

### Parallel Opportunities

- T002–T006 (Phase 3): five independent files, no shared dependency — the whole rename can be done in one parallel batch.
- T009, T011, T013 (Phase 4): three independent new/additive pieces of work that don't depend on each other.
- T015 and T016 (Phase 4): the two CLI flag additions, independent of each other.
- T020 (Phase 6): independent of the regression/quickstart runs that follow it.

---

## Parallel Example: Phase 3 (User Story 1)

```bash
Task: "Rename difficultyProfile -> fragilityProfile in tools/generator/generate.ts"       # T002
Task: "Rename difficultyProfile -> fragilityProfile in tools/generator/obligations.ts"    # T003
Task: "Rename --difficulty-profile -> --fragility-profile in tools/generator/cli.ts"      # T004
Task: "Rename --difficulty-profile -> --fragility-profile in tools/generator/batch.ts"    # T005
Task: "Update 'difficulty profile' wording in tools/generator/fragility.ts doc comment"   # T006
```

## Parallel Example: Phase 4 (User Story 2)

```bash
Task: "Write contract tests for resolveComplexity/complexityRange/sampleLevel"  # T009
Task: "Create tools/generator/complexity-config.json with the 7-factor table"  # T011
Task: "Add complexityScore + widen 4 fields to optional in GenerationParams"   # T013
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1.
3. **STOP and VALIDATE**: run T008 — SC-005 holds (no "difficulty" references left over the fragility control), zero behavior change.

### Incremental Delivery

1. Setup → baseline confirmed green.
2. Add US1 (rename) → verify SC-005 → safe, zero-behavior-change checkpoint, and the prerequisite the rest of this feature needs.
3. Add US2 (`complexityScore` mechanism) → verify SC-001/SC-002 → the real capability this feature delivers.
4. Add US3 (compat + config-editability verification) → verify SC-003/SC-004 → confirms the design decisions from research.md Decisión 4 hold under test.
5. Polish → full regression + quickstart.md walkthrough.

---

## Notes

- [P] tasks touch different files and have no unmet dependency within their phase.
- [Story] labels map every Phase 3+ task to its user story for traceability; Setup/Foundational/Polish carry no story label by convention.
- `src/engine/` and `src/renderer/` are never touched by this feature (FR-014) — no task references them.
- Commit after each task or logical group; stop at any phase checkpoint to validate that story independently before continuing.
