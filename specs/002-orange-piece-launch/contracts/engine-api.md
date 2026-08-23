# Contract: Engine Public API (actualización sobre la feature 001)

`resolveLaunch(level: Level, launch: Launch): LaunchOutcome` mantiene exactamente la misma firma,
garantías (pura, determinista, síncrona) y semántica que en
`specs/001-green-piece-launch/contracts/engine-api.md`. Esta historia no cambia el contrato
público — solo amplía qué colores son válidos dentro de `Piece`/`PieceColor` y añade un fixture
nuevo.

## Cambios

- `PieceColor` pasa a admitir `'green' | 'orange'`.
- Nuevo fixture exportado: `testLevelOrange01` (junto al ya existente `testLevelGreen01`).
- `resolveLaunch` es agnóstica al color de la ficha lanzada: internamente resuelve el empuje según
  la tabla de distancias por color (ver data-model.md), sin ninguna rama de código específica por
  color en la superficie pública ni en la orquestación de `resolveLaunch`.

## Mapeo Acceptance Scenario → verificación de contrato (naranja)

| Acceptance Scenario (spec.md) | Verificación sobre `resolveLaunch` |
|---|---|
| 1. Salto de 2 casillas, intermedia intacta | Con `testLevelOrange01` (2 fichas verdes: impacto + intermedia, aterrizaje vacío): la ficha originalmente intermedia permanece en `outcome.board` exactamente donde estaba (mismo color, misma casilla); la ficha impactada aparece exactamente 2 casillas más allá de su posición original; `outcome.events.length >= 1`. |
| 2. Victoria | `outcome.result === 'won'` cuando una ficha queda en `objective.targetCell` tras el salto. |
| 3. Derrota | `outcome.result === 'lost'` cuando, tras una colisión (no missclick), `outcome.hand.pieces` queda vacío y el objetivo no se cumple — mismo criterio que en la feature 001. |
| 4. Missclick → sin determinar | `outcome.missclick === true`, `outcome.result === 'undetermined'` — mismo comportamiento ya contractado en la feature 001 (FR-012 de spec.md 001), ahora ejercitado con la ficha naranja. |
| 5. No regresión de verde | La suite de tests de la feature 001, sin modificar, sigue en verde tras esta implementación. |

**Nota**: la cascada (FR-004) no tiene fila de verificación en esta tabla — esta historia no la
ejercita explícitamente (ver spec.md → Assumptions y Edge Cases). Queda para una historia
posterior con un nivel de prueba dedicado.
