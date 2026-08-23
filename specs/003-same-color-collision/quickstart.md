# Quickstart: Validar la Aniquilación entre Fichas del Mismo Color

Guía de validación end-to-end una vez implementada esta historia. Complementa (no sustituye) las
de las features 001 y 002, que siguen siendo el checklist de no-regresión para colisiones de
colores distintos.

## Prerrequisitos

Los mismos que en features anteriores (Node.js 20+ LTS, `npm install` ya hecho — no se añade
ninguna dependencia nueva).

## Ejecutar toda la suite

```bash
npm test
```

**Resultado esperado**: las cinco suites existentes (`launch`, `chain`, `objective`,
`determinism`, `orange`) siguen en verde sin haber sido modificadas, más el nuevo
`same-color.test.ts`:

- `same-color.test.ts` → FR-001 a FR-005 (aniquilación en impacto inicial y en un eslabón de
  cascada, sin efecto de empuje/salto para ninguna de las dos fichas, objetivo evaluado
  correctamente sobre el tablero resultante).

## Validación manual rápida (opcional)

```ts
import { resolveLaunch, testLevelSameColor01, testLevelSameColorCascade01 } from './src/engine';

const outcome = resolveLaunch(testLevelSameColor01, { direction: 'E', lane: 6 });
console.log(outcome.events);  // [{ type: 'ANNIHILATION', ... }]
console.log(outcome.board.cells[6][4]); // null — ninguna ficha sobrevive ahí

const cascade = resolveLaunch(testLevelSameColorCascade01, { direction: 'E', lane: 7 });
console.log(cascade.board.cells[7][4]); // { color: 'green' } — el lanzador sí se asienta
console.log(cascade.board.cells[7][5]); // null — las dos naranjas se aniquilaron
console.log(cascade.result); // 'won'
```

## Criterio de "hecho" para esta historia

- [ ] `same-color.test.ts` pasa, cubriendo impacto inicial y eslabón de cascada.
- [ ] Las cinco suites existentes siguen pasando **sin haber sido modificadas** (verificable por
      fecha de modificación de fichero o `git diff`, según corresponda en el momento).
- [ ] `testLevelGreen01` sigue produciendo `'won'` con `GREEN_WINNING_LAUNCH` — solo cambió el
      color de la ficha ya colocada y del objetivo, no el resultado.
- [ ] `src/engine/` sigue sin importar nada externo (sin Phaser, sin DOM, cero dependencias de
      runtime en `package.json`).
