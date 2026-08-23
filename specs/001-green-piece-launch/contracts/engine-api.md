# Contract: Engine Public API (`src/engine/index.ts`)

Esta historia es una librería headless, no un servicio de red — su "contrato" es la superficie
pública de TypeScript que expone el módulo `engine`, consumida por los tests de esta historia y,
más adelante, por el renderer.

## Función pública

```ts
function resolveLaunch(level: Level, launch: Launch): LaunchOutcome;
```

- **Pure function**: no muta `level` ni ninguno de sus objetos anidados; siempre construye y
  devuelve nuevas instancias de `Board`/`Hand`. Esto es lo que permite "reiniciar" el nivel
  (FR-010): el llamador simplemente vuelve a invocar `resolveLaunch(levelOriginal, otroLaunch)`.
- **Determinista** (FR-011): para el mismo `level` y el mismo `launch`, MUST devolver un
  `LaunchOutcome` estructuralmente idéntico en cualquier número de invocaciones.
- No es `async`: toda la resolución de la cadena es síncrona (no hay E/S ni temporizadores en el
  motor, Principio III de la constitución).

## Tipos exportados

Exporta también todos los tipos de `data-model.md` necesarios para que un llamador (test o futuro
renderer) construya un `Level`/`Launch` y consuma un `LaunchOutcome` con seguridad de tipos:
`Coordinate`, `Direction`, `PieceColor`, `Piece`, `Board`, `Hand`, `Launch`, `MoveStepEvent`,
`EventLog`, `Objective`, `Level`, `LevelResult`, `LaunchOutcome`.

## Fixture de nivel de esta historia

```ts
const testLevelGreen01: Level; // exportado desde src/engine/level.ts
```

Nivel de prueba concreto de esta historia: tablero 8×8 con una ficha verde colocada de forma que
un lanzamiento en una dirección conocida colisiona con ella y, tras la reacción de la ficha verde
(un MOVE_STEP adicional con colisión, ver Assumptions del spec), la ficha impactada queda
exactamente en la casilla objetivo. El objetivo NO se cumple en el estado inicial (Edge Cases del
spec).

## Mapeo Acceptance Scenario → verificación de contrato

| Acceptance Scenario (spec.md) | Verificación sobre `resolveLaunch` |
|---|---|
| 1. Missclick | `outcome.missclick === true`, `outcome.board` y `outcome.hand` idénticos a los del `Level` original, `outcome.events` vacío, `outcome.result === 'undetermined'` (FR-012: la mano conserva la ficha, así que no hay veredicto todavía). |
| 2. Colisión desencadena cadena | `outcome.events.length >= 1`, cada evento es `MOVE_STEP` válido dentro del tablero. |
| 3. Objetivo cumplido en estable | `outcome.result === 'won'`. |
| 4. Objetivo no cumplido tras colisión, mano agotada | `outcome.missclick === false`, `outcome.hand.pieces.length === 0`, `outcome.result === 'lost'`. |
| 5. No evaluar objetivo a mitad de cadena | Sin test dedicado en esta historia: con la ficha verde la cadena tiene como máximo un evento, así que no hay estado intermedio observable distinto del final. Se añade una verificación explícita cuando exista una ficha con cadenas de varios eventos (p. ej. marrón). |
| 6. Missclick deja el nivel sin determinar | `outcome.result === 'undetermined'` tras un `launch` que resulta en missclick (FR-012) — no `'lost'`, porque `outcome.hand` conserva la ficha. |
