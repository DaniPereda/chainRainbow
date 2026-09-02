# Quickstart: Ficha Roja en el Generador de Niveles

## Prerrequisitos

- Implementación completa (obligations.ts, inverses.ts, generate.ts, complexity-config.json).
- `npm test` en verde para todo `tests/unit/tools/generator/` y `tests/unit/engine/`.

## Escenario 1 -- El generador construye un nivel con un split de rojo (US1, SC-001/SC-002/SC-003)

```ts
import { generateLevel } from '../tools/generator/generate.js';

const result = generateLevel({
  seed: 1,
  launchCount: 3,
  availableColors: ['green', 'orange', 'brown', 'red'],
  chainOriginProbability: 0.7,
  defenderContinuationProbability: 0.6,
  decoyCount: 0,
});
```

Repetir con varias semillas (p. ej. 1..50) hasta observar al menos un nivel cuya `solution`,
reproducida con el motor real (`resolveLaunch` paso a paso, igual que `validatesForward`), pase
por un lanzamiento de color `'red'`. Confirmar en cada nivel generado (con o sin rojo):

- `validatesForward(level, solution)` es `true` (ya lo garantiza `attemptOnce`, pero conviene
  reafirmarlo en un test de integración dedicado a rojo).
- Ninguna pieza de tablero con color `obligationColor` que participó en un split tiene fragilidad
  distinta de `'new'` ANTES de ser golpeada por rojo (SC-003) -- verificable inspeccionando
  `pieces` del nivel generado en la celda `C` correspondiente.

## Escenario 2 -- Cero regresión sin rojo (US1 Acceptance Scenario 3, SC-005)

```ts
const before = generateLevel({ seed: 42, launchCount: 4, availableColors: ['green', 'orange', 'brown'], chainOriginProbability: 0.5, defenderContinuationProbability: 0.4, decoyCount: 2 });
```

Comparar byte a byte contra la misma llamada ANTES de esta feature (o, más simple, contra un
fixture ya congelado en `tests/unit/tools/generator/generate.test.ts`) -- debe ser IDÉNTICO.

## Escenario 3 -- La rama secundaria tiene su propia cadena (US2, SC-004)

Generar un lote suficientemente grande (p. ej. 200 semillas) con `chainOriginProbability`/
`defenderContinuationProbability` altos (favorecen cadena sobre mobiliario) y `availableColors`
incluyendo rojo. Entre los niveles cuya solución use rojo, confirmar que al menos uno tiene, en el
tablero final, una pieza con fragilidad `'cracked'` en una celda que NO es ni `C` (el punto de
split) ni la celda del objetivo -- evidencia de que la rama secundaria fue efectivamente golpeada
por un eslabón anterior en vez de colocada directamente como mobiliario.

## Escenario 4 -- Regeneración completa del lote de `levels/` (Historia 3, SC-006)

`tests/unit/levels/` solo cubre los niveles del prototipo (14/15, hand-authored) -- ningún test
automatizado recorre `levels/*.json` (son consumidos en runtime por el renderer vía fetch, no
importados por ningún test). Verificación manual necesaria:

```bash
rm levels/*.json && echo "[]" > levels/index.json && echo "1" > levels/.next-id.txt
# para cada complexityScore válido (7..21 tras FR-006), generar hasta acumular
# 10 éxitos -- ver research.md Decisión 11 para por qué `batch.ts --count 10`
# tal cual no basta en las puntuaciones más altas.
```

Luego, un script puntual (no comprometido) que lea cada `levels/<id>.json`, reproduzca su
`solution` con `resolveLaunch` contra el motor real, y confirme:
- 100% resuelve `'won'` (SC-002/SC-006).
- El total es 10 × 15 = 150 niveles (uno más de complexityScore que antes de esta feature).
- Una fracción no trivial usa rojo en mano, tablero, u objetivo (SC-006) -- verificado: 69/150
  (46%) en la ejecución real de esta feature.
