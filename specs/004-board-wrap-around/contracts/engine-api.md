# Contract: Engine Public API (actualización sobre las features 001-003)

`resolveLaunch(level: Level, launch: Launch): LaunchOutcome` mantiene exactamente la misma firma y
garantías (pura, determinista, síncrona). Esta historia no cambia ningún tipo público existente.

## Cambios

- Nuevos fixtures exportados: `testLevelWrapToEmpty01`, `testLevelWrapToDifferentColor01`,
  `testLevelWrapToSameColor01`.
- `resolveLaunch` sigue siendo agnóstica a la implementación interna: el wrap-around vive
  enteramente dentro de `resolveStrike` (`pieces/push.ts`) y `wrapCoordinate` (`board.ts`), sin
  ninguna rama nueva en la orquestación pública ni en el viaje inicial de lanzamiento.

## Mapeo Acceptance Scenario → verificación de contrato

| Acceptance Scenario (spec.md) | Verificación sobre `resolveLaunch` |
|---|---|
| 1-2. Wrap a destino vacío | Con `testLevelWrapToEmpty01`: la ficha empujada aparece en `outcome.board.cells[2][0]`, y `cells[2][7]` (su casilla original) queda `null`. |
| 3. Wrap a destino de color distinto | Con `testLevelWrapToDifferentColor01`: `cells[3][7]` = lanzador (verde), `cells[3][0]` = naranja (la empujada, ahora ahí), `cells[3][2]` = verde (la que había en `(3,0)`, empujada tras el wrap). |
| 4. Wrap a destino del mismo color | Con `testLevelWrapToSameColor01`: `cells[4][7]` = verde (lanzador), `cells[4][0]` = `null` (ambas naranjas aniquiladas), `outcome.events` incluye un `ANNIHILATION`. |
| 5. Missclick no afectado | Cualquier lanzamiento existente que ya era missclick (p. ej. `GREEN_MISSCLICK_LAUNCH` sobre `testLevelGreen01`) sigue produciendo `outcome.missclick === true` sin cambios — cubierto por `launch.test.ts`, sin modificar. |
| 6. No regresión | Las seis suites existentes, sin modificar, siguen en verde tras esta implementación. |
