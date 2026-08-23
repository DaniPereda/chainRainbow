# Contract: Engine Public API (actualización sobre las features 001/002)

`resolveLaunch(level: Level, launch: Launch): LaunchOutcome` mantiene la misma firma y garantías
(pura, determinista, síncrona). Esta historia amplía qué puede contener `LaunchOutcome.events`.

## Cambios

- Nuevo tipo exportado: `AnnihilationEvent`, y el tipo unión `ChainEvent = MoveStepEvent |
  AnnihilationEvent`. `EventLog` pasa a ser `ChainEvent[]` (antes `MoveStepEvent[]`) — extensión
  aditiva, no rompe código que ya solo esperaba `MoveStepEvent` en niveles de colores distintos.
- Nuevos fixtures exportados: `testLevelSameColor01`, `testLevelSameColorCascade01`.
- `testLevelGreen01` cambia dos valores (ficha ya colocada y color del objetivo, ambos de verde a
  naranja) — ver `data-model.md`. Su forma (`Level`) no cambia.
- `resolveLaunch` sigue siendo agnóstica a la implementación de cada regla: la comprobación de
  mismo color vive enteramente dentro de `pieces/push.ts`, sin ninguna rama de código específica
  en la orquestación pública.

## Mapeo Acceptance Scenario → verificación de contrato

| Acceptance Scenario (spec.md) | Verificación sobre `resolveLaunch` |
|---|---|
| 1. Aniquilación en impacto inicial | Con `testLevelSameColor01`: `outcome.events` tiene longitud 1 y `outcome.events[0].type === 'ANNIHILATION'`; la casilla donde estaba la ficha ya colocada queda `null` en `outcome.board`. |
| 2. Aniquilación en un eslabón de cascada | Con `testLevelSameColorCascade01`: `outcome.events` incluye al menos un `MOVE_STEP` (el lanzador asentándose) y al menos un `ANNIHILATION`; las dos casillas que ocupaban las fichas naranjas quedan `null`. |
| 3. Colisión de colores distintos sin cambios | Las suites `launch`/`chain`/`objective`/`determinism`/`orange`, sin modificar, siguen produciendo el mismo resultado que antes de esta historia. |
| 4. Objetivo evaluado sobre el tablero post-aniquilación | `outcome.result` calculado normalmente (`evaluateObjective`) sobre `outcome.board`/`outcome.hand` — sin lógica especial para el caso de aniquilación. |
| 5. `testLevelGreen01` no regresiona | `resolveLaunch(testLevelGreen01, GREEN_WINNING_LAUNCH).result === 'won'`, igual que antes de esta historia (mismo carril, misma casilla objetivo, solo cambia el color de quien la ocupa). |
