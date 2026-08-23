# Quickstart: Validar el Salto de la Ficha Naranja

Guía de validación end-to-end una vez implementada esta historia. Complementa (no sustituye) la
de `specs/001-green-piece-launch/quickstart.md`, que sigue siendo el checklist de no-regresión de
verde.

## Prerrequisitos

Los mismos que en la feature 001 (Node.js 20+ LTS, `npm install` ya hecho — no se añade ninguna
dependencia nueva).

## Ejecutar toda la suite (verde + naranja)

```bash
npm test
```

**Resultado esperado**: las cinco suites pasan —
`launch.test.ts`/`chain.test.ts`/`objective.test.ts`/`determinism.test.ts` (feature 001, sin
modificar) siguen en verde, más el nuevo `orange.test.ts`:

- `orange.test.ts` → FR-002, FR-003, FR-005 (salto de 2 casillas, casilla intermedia intacta,
  ficha lanzada se asienta en la posición original de la impactada), FR-006/FR-007 (comparte la
  lógica de victoria/derrota/sin determinar ya validada para verde). FR-004 (cascada) no tiene
  test dedicado en esta historia — ver spec.md → Assumptions.

## Validación manual rápida (opcional)

```ts
import { resolveLaunch, testLevelOrange01 } from './src/engine';

const outcome = resolveLaunch(testLevelOrange01, { direction: 'E', lane: 3 });
console.log(outcome.events);  // debe incluir el empuje de 2 casillas
console.log(outcome.result);  // 'won'
```

## Criterio de "hecho" para esta historia

- [x] `orange.test.ts` pasa, cubriendo el salto de 2 casillas y la integridad de la intermedia —
      5/5 suites, 14/14 tests en verde.
- [x] Las cuatro suites de la feature 001 siguen pasando **sin haber sido modificadas** (el repo
      no tiene commits todavía, así que se verificó por fecha de modificación de fichero en vez de
      `git diff`: ninguno de los cuatro se tocó durante esta feature).
- [x] La casilla intermedia de un salto de naranja queda verificablemente idéntica a su estado
      previo (`orange.test.ts` compara color y posición exactos, no solo "vacía por casualidad").
- [x] `pieces/green.ts` ya no existe; su comportamiento vive en `pieces/push.ts` y sigue siendo
      exactamente el mismo (verificado por la suite de verde, no por inspección).
- [x] `src/engine/` sigue sin importar nada externo (sin Phaser, sin DOM, cero dependencias de
      runtime en `package.json`).
