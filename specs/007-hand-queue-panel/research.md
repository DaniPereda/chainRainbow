# Phase 0 Research: Panel de Fichas en Mano

## Decisión: módulo nuevo `hand-panel.ts`, mismo patrón que `board-view.ts`

- **Decisión**: crear `src/renderer/hand-panel.ts` con una función `drawHand(graphics, hand)`
  que dibuja un círculo de color por cada `Piece` de `hand.pieces`, en orden, reutilizando la
  misma paleta de color ya definida en `board-view.ts` para las fichas del tablero.
- **Rationale**: `board-view.ts` ya resolvió exactamente este mismo problema (traducir un dato
  del motor a formas Phaser, sin lógica de juego) para `Board`/`Objective`. Repetir el patrón
  para `Hand` es la opción más consistente y la que menos sorprende a quien lea el código después
  (Principio V: composición sobre casos especiales, aplicado también al código del renderer).
- **Alternatives considered**: añadir el dibujado de la mano directamente dentro de
  `board-view.ts` (renombrándolo a algo más genérico) — descartado porque `Board`/`Objective` y
  `Hand` son conceptos distintos del motor con sus propios tipos; mezclarlos en una función
  complicaría la firma sin aportar nada.

## Decisión: redibujar el panel en el mismo punto donde ya se redibuja el tablero

- **Decisión**: `BoardScene` ya tiene un método `redraw()` que se llama tras `create()`, tras
  cada lanzamiento, y tras reiniciar. Se añade la llamada a `drawHand` justo ahí, sin crear
  ningún nuevo punto de sincronización.
- **Rationale**: el panel y el tablero deben estar siempre en el mismo estado — comparten
  exactamente los mismos disparadores de actualización (`session.current` cambia). Añadir un
  punto de redibujado distinto sería una fuente de bugs de desincronización sin ningún beneficio.
- **Alternatives considered**: ninguna — no hay una alternativa razonable aquí, es la
  consecuencia directa de que ambos leen del mismo `session.current`.

## Decisión: posición y tamaño del panel

- **Decisión**: el panel se sitúa debajo de las casillas de lanzamiento del borde sur (las que
  ya existen para la dirección `'N'`), centrado horizontalmente, como una fila de círculos más
  pequeños que las fichas del tablero.
- **Rationale**: es el único hueco libre de la pantalla de juego actual (480×600) que no
  interfiere con ningún elemento ya existente (tablero, casillas de lanzamiento, botón "volver",
  overlay de resultado). No hace falta agrandar el lienzo del juego.
- **Alternatives considered**: un panel lateral — descartado, no hay hueco horizontal libre sin
  reducir el tamaño del tablero; la spec pide explícitamente "debajo del tablero".

## Sin necesidad de tests Vitest

`hand-panel.ts` es, igual que `board-view.ts`, una función de dibujo pura sobre datos ya
validados por el motor — no contiene ninguna lógica de negocio propia que testear (no decide
colores por reglas, no calcula estados, solo itera y coloca formas). La constitución exime
explícitamente de tests automatizados a este tipo de código de renderer para el prototipo
inicial; se valida manualmente, igual que el resto de `BoardScene`.
