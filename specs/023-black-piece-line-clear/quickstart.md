# Quickstart: Ficha Negra (Limpieza de Línea)

## Prerrequisitos

- Implementación de motor completa (`src/engine/board.ts`, `src/engine/pieces/push.ts`).
- `npm test` en verde para todo `tests/unit/engine/`.

## Escenario 1 -- Negra lanzada limpia toda su fila (SC-001)

```ts
import { createLevel, resolveLaunch } from './src/engine/index.js';

const level = createLevel({
  pieces: [
    { at: { row: 4, col: 1 }, color: 'green' },
    { at: { row: 4, col: 5 }, color: 'orange' },
    { at: { row: 4, col: 6 }, color: 'brown' },
  ],
  hand: ['black'],
  goal: { at: { row: 0, col: 0 }, color: 'green' },
});

const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });
```

Confirmar: `outcome.board.cells[4]` no tiene ninguna ficha (las tres desaparecen, incluida la
propia negra); `outcome.events` contiene un `ANNIHILATION` por cada una de las tres, todos con
`direction: 'E'`.

## Escenario 2 -- Negra asentada limpia su columna al ser golpeada (SC-002)

```ts
const level = createLevel({
  pieces: [
    { at: { row: 4, col: 4 }, color: 'black' },
    { at: { row: 1, col: 4 }, color: 'green' },
    { at: { row: 6, col: 4 }, color: 'orange' },
    { at: { row: 4, col: 0 }, color: 'green' }, // misma fila -- NO debe verse afectada
  ],
  hand: ['green'],
  goal: { at: { row: 0, col: 0 }, color: 'green' },
});

const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });
```

Confirmar: la columna 4 completa queda vacía (incluida la negra); `outcome.board.cells[4][0]`
sigue teniendo la ficha verde de la fila 4 -- la limpieza fue por columna, no por fila, porque el
impacto llegó desde el norte.

## Escenario 3 -- Precedencia: rojo golpea a una negra, gana la limpieza, no la ramificación (Decisión 3 de research.md)

```ts
const level = createLevel({
  pieces: [{ at: { row: 4, col: 4 }, color: 'black' }],
  hand: ['red'],
  goal: { at: { row: 0, col: 0 }, color: 'black' },
});

const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });
```

Confirmar: `outcome.events` NO contiene ningún `MOVE_STEP` de dos ramas negras perpendiculares
(lo que produciría la ramificación habitual de rojo) -- en su lugar, se limpia la fila 4 completa
(incluida la propia negra) por `ANNIHILATION`, con `direction: 'S'`.

## Escenario 4 -- Negro contra negro sigue siendo aniquilación por mismo color, sin limpieza (FR-006)

```ts
const level = createLevel({
  pieces: [
    { at: { row: 4, col: 4 }, color: 'black' },
    { at: { row: 4, col: 6 }, color: 'green' }, // en la misma fila -- NO debe desaparecer
  ],
  hand: ['black'],
  goal: { at: { row: 0, col: 0 }, color: 'green' },
});

const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });
```

Confirmar: `outcome.events` tiene exactamente un `ANNIHILATION` (las dos negras), y
`outcome.board.cells[4][6]` sigue teniendo la ficha verde -- ninguna limpieza de fila se
produjo.

## Escenario 5 -- Missclick: el carril está vacío, la negra vuelve a la mano (FR-007)

```bash
npm test -- tests/unit/engine/black.test.ts
```

Debe incluir el caso ya cubierto genéricamente por `launch.test.ts` para cualquier color: un
lanzamiento cuyo carril completo está vacío es un missclick, sin limpiar nada.

## Escenario 6 -- Cero regresión sobre rojo/mismo color/wrap-around ya existentes (FR-008)

```bash
npm test
```

Los 237 tests ya existentes deben seguir en verde salvo los que se actualicen deliberadamente
para cubrir la excepción documentada en Decisión 3 de research.md (rojo cede su ramificación
ante una defensora negra) -- cualquier otro cambio de expectativa sería una regresión real, no
esperada por esta feature.

## Escenario 7 -- Verificación visual manual (integración mínima de renderer)

```bash
npm run dev
```

Abrir `dev-levels.html`, cargar un nivel de prueba con una ficha negra en mano y varias fichas
repartidas en una fila/columna, lanzarla, y confirmar visualmente que todas desaparecen a la vez
(mismo lenguaje visual ya usado por la aniquilación por mismo color, reutilizado sin cambios por
Decisión 1 de research.md).
