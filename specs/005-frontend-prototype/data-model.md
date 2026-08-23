# Phase 1 Data Model: Prototipo Frontend de Niveles

Extiende el motor existente (features 001-004), que sigue vigente salvo lo indicado aquí.

## Renombrado: `createTestLevel` → `createLevel` (`src/engine/level.ts`)

Mismo comportamiento, mismo tipo `Level`/`PiecePlacement`, solo cambia el nombre exportado:

```ts
export function createLevel(config: {
  pieces: PiecePlacement[];
  hand: PieceColor[];
  objective: PiecePlacement;
}): Level {
  // cuerpo idéntico al actual createTestLevel
}
```

Las fixtures de test existentes (`testLevelGreen01`, `testLevelOrange01`,
`testLevelSameColor01`, `testLevelSameColorCascade01`, `testLevelWrapToEmpty01`) pasan a
llamar a `createLevel` en vez de `createTestLevel`; ellas mismas conservan su nombre `testLevelXxx`
porque siguen siendo fixtures de test del motor. `src/engine/index.ts` exporta `createLevel` en
vez de `createTestLevel`.

## Nuevo: `LevelSession` (`src/engine/session.ts`)

Representa una partida en curso sobre un nivel: el nivel inicial (fijo, nunca muta) más el
estado actual (que sí avanza con cada lanzamiento) y si la partida ya terminó.

```ts
export type LevelSession = {
  initial: Level;
  current: Level;   // mismo objective que initial; board/hand mutan con cada lanzamiento
  status: LevelResult; // 'won' | 'lost' | 'undetermined', reexportado desde objective.ts
};

export function startSession(level: Level): LevelSession {
  return { initial: level, current: level, status: 'undetermined' };
}

export function applySessionLaunch(session: LevelSession, launch: Launch): {
  session: LevelSession;
  outcome: LaunchOutcome;
} {
  const outcome = resolveLaunch(session.current, launch);
  const current: Level = {
    board: outcome.board,
    hand: outcome.hand,
    objective: session.current.objective,
  };
  return { session: { ...session, current, status: outcome.result }, outcome };
}

export function restartSession(session: LevelSession): LevelSession {
  return startSession(session.initial);
}
```

Reglas derivadas de spec.md:
- **FR-009 / Edge Case (missclick)**: si `outcome.result === 'undetermined'`, `applySessionLaunch`
  igualmente actualiza `current` (aunque en la práctica no cambie tras un missclick, porque
  `resolveLaunch` ya devuelve el mismo board/hand sin modificar) — el llamador (renderer) decide
  no mostrar ninguna ventana en ese caso (FR-009), pero la sesión en sí no necesita una rama
  especial para missclick: es el mismo camino que cualquier otro lanzamiento.
- **US2, Acceptance Scenario 3** (mano vacía → no se puede lanzar más): no se modela como un
  campo booleano aparte — se deriva directamente de `session.current.hand.pieces.length === 0`,
  reutilizando `hasAvailablePiece` ya existente en `launch.ts`.
- **FR-010 (reiniciar)**: `restartSession` vuelve exactamente a `initial`, sin recalcular nada —
  es la garantía de que "reiniciar" siempre reproduce el mismo estado, coherente con el
  Principio III (determinismo).

## Nuevo: los 10 niveles del prototipo (`src/levels/prototype-levels.ts`)

```ts
export type PrototypeLevel = { id: number; level: Level }; // id: 1..10, para el selector

export const PROTOTYPE_LEVELS: PrototypeLevel[] = [
  { id: 1, level: createLevel({ /* ... */ }) },
  // ... hasta id 10
];
```

Cada nivel se construye con `createLevel`, reutilizando únicamente piezas/reglas de Fase 1
(verde, naranja, mismo color, wrap-around — SC-003 exige que los 10 sean superables solo con
estas reglas). El orden de dificultad concreto de los 10 niveles es una decisión de diseño de
niveles, no de este documento — se resuelve al escribir `prototype-levels.ts` en la fase de
implementación, validando cada uno manualmente antes de marcarlo listo (constitución,
Development Workflow: "Los niveles de prueba manuales... DEBEN existir y pasar/funcionar").

## Nuevo: traducción de estado del motor a la vista (`src/renderer/board-view.ts`)

No introduce ningún tipo de dominio nuevo — es una función pura `Board -> forma(s) Phaser
dibujables` (posición de cada `Piece` en píxeles según su `Coordinate`, color según
`PieceColor`, marca del `objective.targetCell`/`targetColor`). Vive en `renderer/` (no en
`engine/`) porque su salida SÍ es Phaser-específica (coordenadas de pantalla, `Graphics`/formas),
a diferencia de `session.ts`.
