# Quickstart: Ficha Arcoíris (Cambio de Color)

## Prerrequisitos

- Implementación de motor completa (`src/engine/board.ts`, `src/engine/events.ts`,
  `src/engine/pieces/push.ts`, `src/engine/resolve-launch.ts`, `src/engine/session.ts`).
- `npm test` en verde para todo `tests/unit/engine/`.

## Escenario 1 -- Arcoíris lanzada pausa la resolución y cambia el color de la defensora (SC-001, SC-002)

```ts
import { createLevel, resolveLaunch } from './src/engine/index.js';

const level = createLevel({
  pieces: [{ at: { row: 4, col: 4 }, color: 'green' }],
  hand: ['rainbow'],
  goal: { at: { row: 0, col: 0 }, color: 'blue' },
});

const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });
```

Confirmar: `outcome.pendingColorChoice` está definido, con `at: {row:4, col:4}` (la ficha verde
que fue golpeada) y `options` igual a las 5 no-arcoíris (`['green','orange','brown','red',
'black']`). `outcome.events` ya contiene un `ANNIHILATION` de la propia arcoíris, con su
`from`/`direction` reales -- research.md Decisión 10: viaja y desaparece ANTES de la pausa, no
después, para que el jugador vea el trayecto completo antes de que aparezca el diálogo.
`outcome.board.cells[4][4]` es `null` (la ficha verde original ya no está -- consistente con lo
que el renderer muestra mientras el diálogo está abierto) y NO se ha comprobado ningún objetivo
todavía.

## Escenario 2 -- Tras elegir un color, la resolución continúa hasta el estado final (SC-003)

```ts
const resolved = outcome.pendingColorChoice!.resume('red');
```

Confirmar: `resolved.pendingColorChoice` es `undefined` (la cadena terminó); `resolved.board`
tiene una ficha `red` en `{row:4, col:4}` (no `green`, no `rainbow`); `resolved.events` es
ACUMULATIVO (data-model.md) e incluye, en este orden, el `ANNIHILATION` de la propia arcoíris ya
visto en el Escenario 1 y un `COLOR_CHOICE` nuevo en `{row:4,col:4}` (`fromColor:'green',
toColor:'red'`); `resolved.result` refleja el objetivo evaluado contra el tablero ya final.

## Escenario 3 -- Ficha arcoíris asentada cambia su propio color al ser golpeada

```ts
const level = createLevel({
  pieces: [{ at: { row: 4, col: 4 }, color: 'rainbow' }],
  hand: ['orange'],
  goal: { at: { row: 0, col: 0 }, color: 'orange' },
});

const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });
```

Confirmar: `outcome.pendingColorChoice.at` es `{row:4,col:4}` (la propia arcoíris, ahora
defensora) — no la ficha naranja atacante. Tras `outcome.pendingColorChoice.resume('brown')`, la
casilla `{row:4,col:4}` pasa a tener una ficha `brown`, y la naranja atacante ha desaparecido
(`ANNIHILATION`, `from === at` es falso para ella -- viajó realmente hasta ahí, igual que
cualquier atacante consumido).

## Escenario 4 -- Precedencia: negro golpea a una arcoíris asentada, gana la limpieza de negro (FR-009)

```ts
const level = createLevel({
  pieces: [{ at: { row: 4, col: 4 }, color: 'rainbow' }],
  hand: ['black'],
  goal: { at: { row: 0, col: 0 }, color: 'black' },
});

const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });
```

Confirmar: `outcome.pendingColorChoice` es `undefined` -- la resolución termina de un tirón, sin
pausa. `outcome.board.cells` no tiene ninguna ficha en la columna 4 (limpieza de línea de negro,
sin cambios respecto a spec.md 023); ningún `COLOR_CHOICE` aparece en `outcome.events`.

## Escenario 5 -- Precedencia: arcoíris golpea (o es golpeada por) rojo, gana el cambio de color (FR-010)

```ts
const level = createLevel({
  pieces: [{ at: { row: 4, col: 4 }, color: 'red' }],
  hand: ['rainbow'],
  goal: { at: { row: 0, col: 0 }, color: 'green' },
});

const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });
```

Confirmar: `outcome.pendingColorChoice` SÍ está definido (`at: {row:4,col:4}`, la roja) -- rojo
nunca llega a dividirse. Tras elegir un color, `outcome.events` no contiene ningún `MOVE_STEP`
perpendicular (lo que produciría la ramificación habitual de rojo).

## Escenario 6 -- Arcoíris contra arcoíris sigue siendo aniquilación por mismo color (FR-008)

```ts
const level = createLevel({
  pieces: [{ at: { row: 4, col: 4 }, color: 'rainbow' }],
  hand: ['rainbow'],
  goal: { at: { row: 0, col: 0 }, color: 'green' },
});

const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });
```

Confirmar: `outcome.pendingColorChoice` es `undefined` -- ambas desaparecen de inmediato
(`ANNIHILATION` x2), sin ningún `COLOR_CHOICE`.

## Escenario 7 -- Missclick: el carril está vacío, la arcoíris vuelve a la mano (FR-011)

```bash
npm test -- tests/unit/engine/rainbow.test.ts
```

Debe incluir el caso ya cubierto genéricamente por `launch.test.ts` para cualquier color: un
lanzamiento cuyo carril completo está vacío es un missclick, sin abrir ningún
`pendingColorChoice`.

## Escenario 8 -- Cero regresión sobre el resto de colores/reglas ya existentes (FR-013)

```bash
npm test
```

Todos los tests ya existentes deben seguir en verde salvo los que se actualicen deliberadamente
por el cambio de firma de `applyImpact`/`resolveChain` documentado en research.md, Decisión 1
(migración mecánica: los tests que llaman a `applyImpact`/`resolveChain` directamente pasan a
comprobar `result.status === 'resolved'` antes de leer `board`/`events`/`nextSites`) -- ningún
comportamiento de verde/naranja/marrón/rojo/negro/mismo color/wrap-around debe cambiar.

## Escenario 9 -- Verificación visual manual (diálogo de color + sonido propio)

```bash
npm run dev
```

Abrir `dev-levels.html`, cargar un nivel de prueba con una ficha arcoíris en mano y una ficha de
color conocido en el tablero, lanzarla, y confirmar visualmente:

- La resolución se detiene tras el impacto y aparece un diálogo flotante señalando la ficha
  afectada, con las 5 opciones de color.
- Al hacer clic en un color, la ficha cambia visualmente a ese color, la arcoíris desaparece, y
  se reproduce el efecto de sonido propio de arcoíris (no el genérico de choque).
- El resto del tablero permanece sin cambios mientras el diálogo está abierto.
