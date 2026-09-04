# Quickstart: Ficha Púrpura (Atracción)

## Prerrequisitos

- Implementación de motor completa (`src/engine/board.ts`, `src/engine/events.ts`,
  `src/engine/pieces/push.ts`, `src/engine/pieces/purple.ts`, `src/engine/resolve-launch.ts`).
- `npm test` en verde para todo `tests/unit/engine/`.

Un mismo nivel se usa para los tres escenarios -- solo cambia el carril/lanzamiento:

```ts
import { createLevel, resolveLaunch } from './src/engine/index.js';

const level = createLevel({
  pieces: [
    { at: { row: 4, col: 1 }, color: 'green' },
    { at: { row: 4, col: 6 }, color: 'orange' },
    { at: { row: 2, col: 4 }, color: 'brown' },
  ],
  hand: [{ color: 'purple', fragility: 'broken' }],
  goal: { at: { row: 0, col: 0 }, color: 'green' },
});
```

## Escenario 1 -- Distancias distintas: la más cercana espera, luego colisionan juntas (SC-001, SC-003)

```ts
const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });
```

La púrpura entra en `{row:0,col:4}` y avanza por la columna 4 sin nada que la bloquee hasta
`{row:4,col:4}`, donde la fila 4 tiene ficha a cada lado: verde en `col:1` (distancia 3) y naranja
en `col:6` (distancia 2). Confirmar: `outcome.missclick === false`; `outcome.events` contiene un
`ANNIHILATION` con `color: 'purple'`, `at: {row:4,col:4}`; verde y naranja terminan colisionando
entre sí en `{row:4,col:4}` con la misma resolución de choque mutuo ya validada para dos
trayectorias que convergen (mismo color → aniquilación; distinto color, como aquí → cada una
avanza su fragilidad y se mueve según la mecánica de la otra, exactamente igual que ya ocurre
entre dos ramas paralelas de rojo) -- NUNCA una se asienta antes que la otra en `{row:4,col:4}` a
la espera de un segundo impacto por separado. `outcome.board.cells[4][1]` y `[4][6]` quedan
vacías; ninguna ficha púrpura sigue en juego.

## Escenario 2 -- Bloqueada por una ficha real antes de asentarse: missclick (SC-002)

```ts
const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });
```

Con la ficha marrón añadida en `{row:2,col:4}` (en el mismo carril, antes de la fila 4), la
púrpura queda bloqueada al llegar ahí -- nunca encuentra ninguna celda cualificada. Confirmar:
`outcome.missclick === true`; `outcome.board` es idéntico al del nivel original (nada cambia,
incluida la propia ficha marrón); `outcome.hand` sigue teniendo la púrpura, sin consumir.

## Escenario 3 -- Ningún lado con las dos fichas nunca: missclick por agotar el carril (SC-002)

```ts
const outcome = resolveLaunch(level, { direction: 'S', lane: 7 });
```

Lanzada por el carril `col:7`, al pasar por la fila 4 solo encuentra ficha a un lado (naranja en
`col:6`, distancia 1) -- el lado derecho no tiene ninguna ficha con la que emparejar (fuera del
tablero) -- así que esa celda no cualifica, y el resto del carril está vacío. Confirmar:
`outcome.missclick === true`, mismo resultado que el Escenario 2 aunque la causa sea distinta
(agotar el carril en vez de un bloqueo), y el mismo tablero/mano sin cambios.

## Escenario 4 -- Sonido de activación (SC-004)

Repetir el Escenario 1 y comprobar, en el renderer (`launch-animation.ts`), que el evento
`ANNIHILATION` con `color: 'purple'` dispara `playPurpleSound()` en vez del sonido de impacto
genérico -- no requiere ningún cambio en el motor, solo inspeccionar qué rama del despacho de
sonido se ejecuta para ese evento.
