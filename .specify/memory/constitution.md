<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Modified principles: none (Core Principles I-V unchanged)
- Modified sections:
  - Development Workflow: replaced the single "prototype order" bullet (verde → naranja →
    marrón → rojo, then renderer) with an explicit phase breakdown. Fase 1 (verde, naranja,
    regla de mismo color, wrap-around) is now marked closed; a Fase 2 renderer prototype is
    inserted BEFORE marrón/rojo, reversing the original "all pieces before any renderer work"
    order; marrón/rojo/future pieces move to Fase 3.
- Added sections: none
- Removed sections: none
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

- **Fase 1 (cerrada)**: motor headless para verde, naranja, la regla de mismo color
  (aniquilación mutua), y wrap-around de fichas en el tablero — implementado, probado, y
  fusionado en `develop`/`main`. Marrón y rojo NO forman parte de esta fase.
- **Fase 2 (actual)**: antes de añadir más piezas o reglas al motor, se construye un prototipo
  de renderer simple que visualice y ejercite las interacciones ya implementadas en Fase 1:
  pantalla de inicio, selector de niveles (1 a 10, cada uno hardcodeado como dato declarativo,
  Principio IV), ventana de éxito/fallo, y reinicio. Esta fase invierte deliberadamente el orden
  original de "todas las piezas antes que cualquier renderer" para validar visualmente el diseño
  acordado antes de seguir invirtiendo en complejidad del motor. El renderer sigue sujeto al
  Principio I: consume estado/eventos del motor, nunca decide reglas de juego.
- **Fase 3 (futura, no iniciada)**: marrón, rojo, y cualquier pieza/regla adicional del motor,
  una vez validado el prototipo de Fase 2. A partir de aquí se retoma el orden original por
  pieza: spec → implementación del motor con tests → integración en el renderer ya existente.
- Dentro de cualquier fase que toque el motor, cada pieza o cambio de regla de interacción sigue
  el orden: spec → implementación del motor con tests unitarios → integración en el renderer, en
  ese orden. El trabajo de renderer NUNCA debe usarse para compensar o enmascarar un
  comportamiento incorrecto del motor.
- Los niveles de prueba manuales (Fase 1 y el selector hardcodeado de Fase 2) DEBEN existir y
  pasar/funcionar antes de construir cualquier generador de niveles.
- Las features que introducen nuevas primitivas de motor o cambian la semántica de resolución de
  cadenas DEBEN documentar el cambio y su razón en el plan.md de esa feature, referenciando qué
  principio (si alguno) motiva la desviación de las primitivas composables existentes.

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

**Version**: 1.1.0 | **Ratified**: 2026-08-22 | **Last Amended**: 2026-08-23
