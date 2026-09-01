# Quickstart: La Ficha Lanzadora Recién Asentada Debe Ser Visible Para el Desplazamiento de la Ficha Que Golpeó

## Validar el bug contra el código actual (antes del fix)

```bash
npm test -- push.test.ts
```

El nuevo test de regresión (data-model.md) debe **fallar** contra el código actual -- confirma que el bug es real y reproducible antes de tocar `push.ts` (Principio II, test-first).

## Aplicar el fix

En `src/engine/pieces/push.ts`, dentro de `applyImpact`, cambiar la llamada a `PUSH_STRATEGY` para que reciba `boardWithStriker` en vez de `vacated` (data-model.md). Una sola línea.

## Verificar la suite completa

```bash
npm run typecheck && npm test
```

Debe pasar el 100% (SC-001) -- incluyendo el nuevo test de regresión.

## Reproducir el nivel 49 manualmente

```bash
npx tsx -e "
import { createLevel, resolveLaunch } from './src/engine/index.js';
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('./levels/49.json', 'utf-8'));
let level = createLevel({ pieces: data.pieces, hand: data.hand, goal: { at: data.goal.cell, color: data.goal.color } });
for (const launch of data.solution) {
  const outcome = resolveLaunch(level, { direction: launch.direction, lane: launch.lane });
  level = { board: outcome.board, hand: outcome.hand, goal: level.goal };
  console.log(outcome.result);
}
"
```

Antes del fix: el último `result` es `'won'`. Después del fix: deja de serlo -- confirma SC-002.

## Historia 3: el asentamiento limpio de marrón necesita un golpeador `'broken'`

Descubierta al ejecutar la suite tras el fix de la Historia 1 (tres tests empezaron a fallar por la misma razón -- ver research.md, Decisión 4). Validar:

```bash
npm test -- brown.test.ts generate.test.ts fragility.test.ts prototype-levels.test.ts
```

Debe pasar el 100% -- el nivel 12 del prototipo, el fixture 2 del generador, y las comprobaciones de uniformidad de `'easy'`/`'hard'` (013) reflejan el golpeador marrón forzado a `'broken'` (`obligations.ts`, `mustBeBroken`).

## Reverificar y regenerar el batch (Historia 2)

1. Reproducir la secuencia de referencia de los 140 niveles de `levels/` con el motor y generador corregidos; anotar cuáles dejan de resolver a `'won'`. Resultado real: 11 de 140 (`40, 49, 71, 101, 107, 113, 132, 156, 165, 207, 251`).
2. Para cada nivel afectado, regenerarlo con `generateLevel({ seed: id, complexityScore, maxGenerationAttempts: 20000 })` usando su mismo `complexityScore` (ver `levels/<id>.json`, campo `params.complexityScore`). Si el `seed` original no produce una construcción válida dentro del presupuesto de intentos, probar un `seed` distinto (p. ej. `id * 100000 + offset`) -- el id del fichero no cambia, solo su contenido.
3. Reproducir de nuevo la secuencia de referencia de los 140 niveles -- confirmar 100% `'won'` (SC-003) y que la distribución (10 por cada uno de los 14 valores de `complexityScore`, 7-20) se mantiene intacta.
