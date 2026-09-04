# Quickstart: Generador -- Negro como Eliminador de Bloqueantes

## Prerrequisitos

- Implementación completa de `tools/generator/obligations.ts` (campo `target` en `RawLaunch`, tipo `LandingCell` y campo `landingCells` en `ResolutionOutcome`), `tools/generator/black-decoys.ts` (nuevo, `buildBlackDecoyCandidates`), y la integración en `tools/generator/generate.ts` (`buildLevelFrom` + `attemptOnce`).
- `npm test` en verde para todo `tests/unit/tools/generator/`.

Dado que `generateLevel` usa un PRNG real sembrado por `seed`, y esta feature depende de varias tiradas de `rng()` en puntos concretos, los escenarios de validación se apoyan en el mismo patrón ya usado por `obligations.test.ts` (un `scriptedRng` que devuelve una secuencia fija de valores) para los casos unitarios, y en seeds concretos reproducidos con el motor real para los casos end-to-end.

## Escenario 1 -- Estrategia A: negro protege el carril de un lanzamiento de mano, acercándose en perpendicular (SC-001, SC-002, SC-004)

Construir una solución real de al menos un lanzamiento de mano cuyo carril, desde su entrada hasta su `target`, tenga al menos una celda intermedia libre. Con `blackLineClearProbability: 1` y un `rng` guionizado que seleccione la Estrategia A, esa celda como bloqueante obligatorio, y una cantidad de bloqueantes decorativos adicionales:

Confirmar: `level.pieces` incluye el bloqueante obligatorio (estrictamente entre la entrada y el objetivo real, nunca sobre él) y entre 0 y 6 decorativos adicionales, todos en la MISMA línea perpendicular al carril protegido -- nunca en el propio carril; `level.hand` incluye una ficha `'black'`; `level.solution` tiene el lanzamiento de negro INMEDIATAMENTE ANTES del lanzamiento protegido, viajando por el eje perpendicular a esa dirección; y reproducir `level.solution` completa con `resolveLaunch` (el mismo criterio que `validatesForward`) termina en `'won'` exactamente en el último paso -- la ficha objetivo, al estar en el eje protegido y no en el perpendicular, nunca se ve afectada por la limpieza de negro.

## Escenario 2 -- Sin la ayuda de negro, el lanzamiento protegido fallaría (confirma que el bloqueo es real)

Tomar el mismo nivel del Escenario 1 y reproducir SOLO el lanzamiento que la Estrategia A protegía, sin el paso de negro que lo precede. Confirmar: `resolveLaunch` produce un missclick, o un impacto contra el bloqueante en vez del objetivo real esperado -- evidencia de que el bloqueante obligatorio genuinamente obstruía ese carril, no era decorativo.

## Escenario 3 -- Estrategia B: negro protege una celda de aterrizaje intermedia, acercándose en perpendicular a la dirección del empuje (SC-001, SC-002, SC-003, SC-004)

Construir una solución real con al menos un lanzamiento encadenado cuya celda de aterrizaje intermedia resuelve por `chooseHand` directo (aparece en `landingCells`), en un nivel donde ningún carril de `rawLaunches` tenga hueco para la Estrategia A. Con `blackLineClearProbability: 1` y un `rng` guionizado que haga que la Estrategia A no encuentre candidato y la B sí:

Confirmar: `level.pieces` incluye un bloqueante obligatorio DIRECTAMENTE sobre esa celda de aterrizaje, más entre 0 y 6 decorativos en la línea perpendicular a la dirección del empuje que la llena (nunca en la dirección de ese empuje); `level.solution` tiene el lanzamiento de negro INMEDIATAMENTE ANTES de ese empuje; y la reproducción completa termina en `'won'` en el último paso -- la ficha que estaba a punto de ser empujada, al estar en el eje del empuje y no en el perpendicular, nunca se ve afectada.

## Escenario 4 -- Ningún candidato es seguro: se descarta y el nivel se genera igual, sin negro (SC-004, SC-005, User Story 3)

Construir un candidato (Estrategia A o B) cuya línea perpendicular coincida, en algún punto DE LA PARTIDA (no del tablero inicial -- por ejemplo, una celda vacía al principio que un lanzamiento anterior de la propia solución llena antes de que negro dispare), con una ficha real de la solución. Con `blackLineClearProbability: 1`:

Confirmar: `buildLevelFrom` sobre ese candidato devuelve `null` (`validatesForward` no pasa); el generador descarta ese candidato sin hacer fallar el intento completo; y el `GeneratedLevel` final usa la solución real original -- `level.hand` NO incluye ninguna ficha `'black'`, `level.pieces` es idéntico al que se habría generado con `blackLineClearProbability` ausente.

## Escenario 5 -- Parámetro desactivado: cero cambios (ya validado por 011/014, confirmar que sigue así)

Generar el mismo nivel del Escenario 1 sin `blackLineClearProbability` (o con `0`). Confirmar: el resultado es idéntico, bit a bit, al que se obtenía antes de esta feature -- ninguna llamada nueva a `rng()`, ningún campo nuevo poblado, `buildBlackDecoyCandidates` nunca invocada.
