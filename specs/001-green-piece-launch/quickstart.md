# Quickstart: Validar el Walking Skeleton (Ficha Verde)

Guía para ejecutar y comprobar de punta a punta esta historia una vez implementada. No sustituye
a `tasks.md` (que detalla cómo construirla) — asume que el código de `src/engine/` y los tests de
`tests/unit/engine/` ya existen.

## Prerrequisitos

- Node.js 20+ LTS instalado.
- Dependencias instaladas: `npm install` (instala `typescript` y `vitest` como dev dependencies;
  el motor en sí no tiene dependencias de runtime — ver Technical Context en plan.md).

## Ejecutar la suite de tests del motor

```bash
npm test
```

**Resultado esperado**: las cuatro suites pasan, cada una cubriendo su bloque de requisitos:

- `launch.test.ts` → FR-001, FR-002, FR-003 (viaje casilla a casilla, missclick)
- `chain.test.ts` → FR-004, FR-005, FR-006 (interacción, cola de eventos, estado estable antes de evaluar objetivo)
- `objective.test.ts` → FR-007, FR-008, FR-009, FR-010 (victoria, derrota, reinicio)
- `determinism.test.ts` → FR-011 (mismo input, mismo output, repetido varias veces)

## Validación manual rápida (opcional)

Sin necesidad de escribir un test nuevo, se puede comprobar el comportamiento en un script ad-hoc
de Node/TS:

```ts
import { resolveLaunch, testLevelGreen01 } from './src/engine';

// Lanzamiento que debería colisionar y ganar el nivel (carril y dirección del fixture,
// ver src/engine/level.ts):
const outcomeWin = resolveLaunch(testLevelGreen01, { direction: 'E', lane: 4 });
console.log(outcomeWin.result); // 'won'
console.log(outcomeWin.events); // secuencia de MOVE_STEP aplicados

// Lanzamiento en un carril vacío (missclick):
const outcomeMiss = resolveLaunch(testLevelGreen01, { direction: 'E', lane: 0 });
console.log(outcomeMiss.missclick); // true
console.log(outcomeMiss.board);     // idéntico al tablero inicial del fixture
```

## Criterio de "hecho" para esta historia

- [x] Las cuatro suites de Vitest pasan (`npm test` en verde) — 4/4 ficheros, 10/10 tests.
- [x] `resolveLaunch` no muta ni `level.board` ni `level.hand` de entrada (verificado en
      `objective.test.ts` y `determinism.test.ts` comparando el `Level` original antes/después).
- [x] Ejecutar `resolveLaunch(testLevelGreen01, { direction: 'E', lane: 4 })` dos veces produce
      `LaunchOutcome` idéntico en ambas (SC-004 / FR-011) — `determinism.test.ts`.
- [x] `src/engine/` no importa nada de fuera de sí mismo (sin Phaser, sin DOM) — verificado
      revisando los imports de cada archivo del módulo (todos relativos, dentro de `src/engine/`).
