# Contract: Engine Public API (actualización sobre las features 001-003)

`resolveLaunch(level: Level, launch: Launch): LaunchOutcome` mantiene exactamente la misma firma y
garantías (pura, determinista, síncrona). Esta historia no cambia ningún tipo público existente.

## Cambios

- Nuevo fixture exportado: `testLevelWrapToEmpty01`.
- `resolveLaunch` sigue siendo agnóstica a la implementación interna: el wrap-around vive en
  `stepBy` (`move-step.ts`), como parte del concepto de movimiento — no de la colisión. Ni
  `resolveStrike` (`pieces/push.ts`) ni la orquestación pública saben que puede ocurrir; solo
  reciben una coordenada de destino ya envuelta cuando corresponde. Ninguna rama nueva en el
  viaje inicial de lanzamiento (`travelLaunch`).

## Mapeo Acceptance Scenario → verificación de contrato

| Acceptance Scenario (spec.md) | Verificación |
|---|---|
| 1-2. Wrap a destino vacío | Sobre `resolveLaunch` con `testLevelWrapToEmpty01`: la ficha empujada aparece en `outcome.board.cells[2][0]`, y el lanzador se asienta en `cells[2][7]` (la casilla que la empujada dejó vacía). |
| 3-4. Wrap a destino ocupado (color distinto / mismo color) | Por composición, no por fixture de `resolveLaunch` (ver data-model.md para el porqué): `move-step.test.ts` prueba que `stepBy` calcula la coordenada envuelta correctamente; `orange.test.ts`/`same-color.test.ts` ya prueban que `resolveStrike` resuelve empuje/aniquilación para cualquier coordenada de destino ocupada, sea o no producto de un wrap. |
| 5. Missclick no afectado | Cualquier lanzamiento existente que ya era missclick (p. ej. `GREEN_MISSCLICK_LAUNCH` sobre `testLevelGreen01`) sigue produciendo `outcome.missclick === true` sin cambios — cubierto por `launch.test.ts`, sin modificar. |
| 6. No regresión | Las seis suites existentes, sin modificar, siguen en verde tras esta implementación. |
