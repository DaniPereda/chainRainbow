# Quickstart: Resolución de Colisiones Casilla a Casilla

## Prerrequisitos

- Implementación completa (`src/engine/events.ts`, `src/engine/pieces/push.ts`).
- `npm test` en verde para todo `tests/unit/engine/`.

## Escenario 1 -- El ejemplo exacto del usuario: dos verdes se encuentran en la columna 1 (SC-001)

```ts
import { createLevel, resolveLaunch } from './src/engine/index.js';
import { readFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync('levels/2.json', 'utf-8'));
const level = createLevel({ pieces: raw.pieces, hand: raw.hand, goal: { at: raw.goal.cell, color: raw.goal.color } });

const outcome = resolveLaunch(level, { direction: 'N', lane: 5 }, 1); // rojo, hand index 1
```

Confirmar que `outcome.events` contiene un `ANNIHILATION` con `at: {row: 5, col: 1}` y
`color: 'green'` -- las dos fichas verdes desaparecen exactamente en la columna 1, no en ningún
destino final precalculado.

## Escenario 2 -- Cero regresión: los casos ya cubiertos por la corrección anterior siguen igual (SC-002)

```bash
npm test -- tests/unit/engine/red.test.ts tests/unit/engine/events.test.ts tests/unit/engine/push.test.ts
```

En particular, el test "both branches strike their own real, stationary defender directly" (red
north through column 6) y el test reescrito de "the O branch strikes the real orange directly"
deben seguir pasando SIN cambiar su expectativa -- si esta feature necesitara tocar esos tests,
sería señal de una regresión real, no de un ajuste esperado.

## Escenario 3 -- Marrón sigue asentándose en su destino final de siempre cuando nada más está en vuelo (FR-005)

```bash
npm test -- tests/unit/engine/brown.test.ts
```

Todos los casos ya existentes de marrón (vuelta completa, wrap-around, tope de cruces de borde)
deben seguir produciendo exactamente el mismo tablero final -- el nuevo camino paso a paso es una
forma distinta de CALCULAR el mismo resultado, no una regla nueva.

## Escenario 4 -- Reverificación de los 150 niveles + prototipos 14/15 (SC-003)

Sin test automatizado dedicado (ninguno recorre `levels/*.json` hoy, ver research.md de
020-generator-red-support) -- verificación manual con un script puntual (no comprometido) que lea
cada nivel, reproduzca su `solution` con `resolveLaunch`, y confirme 100% `'won'`, exactamente
igual que en features anteriores que tocaron el motor.

```bash
npm test -- tests/unit/levels/
```

cubre los dos niveles de prototipo (14/15); el lote de 150 se reverifica con un script puntual.
