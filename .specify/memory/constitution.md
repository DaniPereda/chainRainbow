<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Modified principles: n/a (initial ratification)
- Added sections:
  - Core Principles: I. Pure, UI-Independent Simulation Core (NON-NEGOTIABLE)
  - Core Principles: II. Test-First Engine Logic
  - Core Principles: III. Determinism & Reproducibility
  - Core Principles: IV. Levels as Declarative Data
  - Core Principles: V. Composable Primitives Over Special-Casing
  - Technology Stack Requirements
  - Development Workflow
  - Governance
- Removed sections: none (initial document)
- Templates requiring follow-up: none — plan/spec/tasks templates read this file at runtime,
  no changes needed here.
- Deferred TODOs: none
-->

# Chained Rainbow Constitution

## Core Principles

### I. Pure, UI-Independent Simulation Core (NON-NEGOTIABLE)
The simulation engine (board state, MOVE_STEP primitive, collision policies, event queue,
chain resolution, objective evaluation) MUST be implemented as pure TypeScript with zero
dependency on any rendering, animation, or platform library (no Phaser, no DOM, no Capacitor
APIs). The engine MUST be fully operable and testable headless, driven only by a sequence of
inputs and returning a deterministic sequence of state transitions/events. Rendering code MAY
read engine output; it MUST NOT feed decisions back into engine logic. Rationale: the game
design explicitly calls for "un simulador independiente de la interfaz gráfica" — this
boundary is what keeps chain-reaction logic verifiable, debuggable, and portable across any
future renderer or platform.

### II. Test-First Engine Logic
Every piece behavior and every interaction rule (colisión, wrap-around, regla de mismo color,
ramificación del rojo, missclick de lanzamiento) MUST have unit tests covering its rules before
or alongside implementation, using Vitest. A new piece or rule is not considered done until its
tests exist and pass in isolation from rendering. Rationale: the engine is a deterministic rule
system where a single miscomputed MOVE_STEP can silently corrupt an entire chain; tests are the
only practical way to keep composed behaviors correct as new pieces are added.

### III. Determinism & Reproducibility
Given an identical board state and an identical player action, the engine MUST always produce
the identical event chain and final stable state. No randomness, timers, or external state may
influence chain resolution. Any randomness (e.g. future level generation) MUST be confined to
level-authoring code that runs before the engine receives a level, never inside chain
resolution. Rationale: the design's "axioma conceptual" treats a player action as triggering a
deterministic chain — this must hold for the game to be solvable, debuggable, and fair.

### IV. Levels as Declarative Data
Levels (board size, initial piece placement, hand contents, objective) MUST be expressed as
declarative JSON/TS data structures consumed by the engine, not hardcoded as imperative logic.
Rationale: the roadmap explicitly anticipates a future level generator and a solvability
validator; both require levels to be data the tooling can produce and inspect, not code.

### V. Composable Primitives Over Special-Casing
New piece behaviors MUST first be attempted as a composition of existing primitives
(MOVE_STEP, collision policy, repetition, branching) before introducing a bespoke, one-off
implementation path. A genuinely novel primitive requires explicit justification in the
relevant plan.md. Rationale: the design doc's own analysis shows verde/naranja/marrón reduce to
the same MOVE_STEP primitive — preserving this composability keeps the rule system small and
prevents each new color from becoming a special case that has to be tested and maintained on
its own.

## Technology Stack Requirements

- **Simulation core**: TypeScript, no runtime dependencies beyond the standard library.
  Package/module boundary MUST be enforced (e.g. a dedicated `engine/` package) so it can be
  imported by tests, the renderer, or future tooling (level generator/validator) without pulling
  in rendering code.
- **Rendering/UI**: Phaser 3 (TypeScript), used strictly as a presentation layer over engine
  state and events (board rendering, piece sprites, tweened animation of chain reactions, touch
  input capture). Phaser code translates raw touch/click input into engine actions and translates
  engine events into visuals; it MUST NOT contain gameplay rule logic.
- **Mobile packaging**: Capacitor, wrapping the web build for iOS/Android distribution from the
  same codebase used for web. Native plugins are only to be introduced when a feature strictly
  requires a native API.
- **Build tooling**: Vite for dev server and production builds.
- **Testing**: Vitest for the simulation core and any pure logic (level validation, etc.).
  Rendering/integration testing tools MAY be added later (e.g. Playwright) but are not required
  for the initial prototype.
- **Target platforms**: mobile (iOS/Android) is the primary target for release; the web build
  used to produce it MUST remain runnable directly in a browser to keep iteration fast during
  prototyping.

## Development Workflow

- Prototype order: implement and thoroughly test the simulation core for the current set of
  pieces (verde, naranja, marrón, rojo) before investing in renderer polish or animation.
  Manually authored test levels MUST exist and pass before any level generator is built.
- Every new piece or interaction rule change goes through: spec → engine implementation with
  unit tests → renderer wiring, in that order. Renderer work MUST NOT be used to compensate for
  or mask incorrect engine behavior.
- Features that introduce new engine primitives or change chain-resolution semantics MUST
  document the change and its rationale in that feature's plan.md, referencing which principle
  (if any) motivates the deviation from existing composable primitives.

## Governance

This constitution supersedes ad-hoc practice for this project. All plans and PRs MUST verify
compliance with the Core Principles above, in particular the UI-independence of the simulation
core (Principle I) and the presence of engine tests (Principle II) before a feature is
considered complete.

Amendments require: a documented rationale for the change, an update to this file via the
`/speckit-constitution` workflow, and a version bump following semantic versioning:
- MAJOR: backward-incompatible removal or redefinition of a principle.
- MINOR: a new principle or materially expanded guidance is added.
- PATCH: wording clarifications or non-semantic fixes.

Complexity or deviation from these principles (e.g. a piece behavior that cannot be expressed
as composed primitives, or engine logic that must depend on rendering state) MUST be justified
in the relevant plan.md rather than silently introduced.

**Version**: 1.0.0 | **Ratified**: 2026-08-22 | **Last Amended**: 2026-08-22
