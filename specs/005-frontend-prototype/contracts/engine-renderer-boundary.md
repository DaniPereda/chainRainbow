# Contract: Límite Engine ↔ Renderer

Esta feature es la primera en introducir un consumidor real del motor (`src/renderer/`, Phaser
3). Este documento fija exactamente qué cruza esa frontera, en qué sentido, para que el
Principio I (UI-independence) sea verificable en revisión, no solo intencional.

## Lo que el renderer puede importar del motor (`src/engine/`)

- `createLevel`, `Level`, `PiecePlacement` — para construir/leer los 10 niveles.
- `startSession`, `applySessionLaunch`, `restartSession`, `LevelSession` (`session.ts`) — para
  jugar un nivel.
- `Launch`, `Direction` — para construir el lanzamiento a partir del punto tocado en el borde.
- `Board`, `Piece`, `Coordinate`, `PieceColor` — para leer el estado y dibujarlo.
- `LevelResult` — para decidir qué ventana mostrar (o ninguna).

Todo lo demás en `src/engine/` (p. ej. `resolveStrike`, `wrapCoordinate`, `resolveChain`,
`stepBy`, eventos de cadena) es un detalle interno que el renderer NUNCA importa directamente —
si el renderer necesitara algo de ahí, sería una señal de que falta una función pública en
`session.ts`/`level.ts`, no una excusa para perforar el límite.

## Lo que el motor NUNCA importa

Nada de `src/renderer/` ni de Phaser. `src/engine/` (`session.ts` incluido) se mantiene
compilable e independientemente testeable con Vitest sin que `phaser`/`vite` estén siquiera
instalados como dependencia de esa parte del árbol — verificable con la misma comprobación ya
usada en features anteriores (`grep` de imports externos en `src/engine/`).

## Flujo de una jugada, con quién hace qué

```text
1. Renderer: jugador toca una casilla del borde
     -> renderer traduce esa posición a { direction, lane } (Launch)
2. Renderer: llama a engine.applySessionLaunch(session, launch)
3. Engine:   resuelve el lanzamiento (resolveLaunch ya existente), actualiza LevelSession,
             devuelve { session, outcome } -- una decisión, no una sugerencia
4. Renderer: redibuja el tablero a partir de session.current.board (board-view.ts)
             y decide la UI (ventana éxito/fallo o ninguna) leyendo outcome.result/session.status
             -- el renderer NUNCA recalcula ni cuestiona ese resultado
```

## Verificación de contrato

| Requisito de spec.md | Cómo se cumple en este límite |
|---|---|
| FR-004 (render fiel del nivel) | El renderer lee `session.current.board`/`objective` tal cual los devuelve el motor, sin transformarlos salvo a coordenadas de pantalla. |
| FR-006 (el motor decide, el renderer traduce) | `applySessionLaunch` es la única vía; el renderer no reimplementa ninguna regla. |
| FR-007/FR-008/FR-009 (éxito/fallo/indeterminado) | El renderer bifurca su UI únicamente sobre `outcome.result`/`session.status`, valores que ya trae `LevelResult`. |
| FR-010 (reiniciar) | `restartSession` es la única vía — el renderer no reconstruye el estado inicial por su cuenta. |
| FR-011/FR-014 (volver al selector, desde la ventana de resultado o desde el tablero) | Ambas rutas son solo una transición de escena (`BoardScene` → `LevelSelectScene`); ninguna toca `session` ni el motor — abandonar un nivel simplemente deja de referenciarlo. |
| FR-013 (Principio I) | La tabla de imports permitidos arriba es exactamente lo verificable en revisión de código. |
