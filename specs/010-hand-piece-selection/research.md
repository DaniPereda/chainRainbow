# Phase 0 Research: Selección Libre de Ficha en Mano

## Decisión: `resolveLaunch` gana un tercer parámetro `pieceIndex` (por defecto 0), en vez de meter el índice dentro de `Launch`

- **Decisión**: `resolveLaunch(level: Level, launch: Launch, pieceIndex: number = 0): LaunchOutcome`.
  `Launch` (`{ direction, lane }`) no cambia de forma.
- **Rationale**: `Launch` representa el gesto de apuntar (dirección + carril de entrada) — un
  concepto ortogonal a CUÁL ficha se dispara. Mezclar ambos en el mismo tipo obligaría a todo
  código que construye un `Launch` (fixtures de motor, niveles, el propio manejador de los
  marcadores de borde en `BoardScene.ts`) a razonar sobre selección de mano aunque no le
  concierna. Con un parámetro nuevo y con valor por defecto, los ~80 call sites existentes de
  `resolveLaunch`/`applySessionLaunch` en tests y en el prototipo siguen funcionando sin tocarlos
  — coherente con FR-005 (selección por defecto = primera de la cola).
- **Alternatives considered**: añadir `pieceIndex?: number` dentro de `Launch` — descartado por
  la mezcla de conceptos de arriba, y porque no aporta nada que el parámetro aparte no dé ya (el
  valor por defecto cubre exactamente el mismo caso de retrocompatibilidad).

## Decisión: la selección vive en `LevelSession`, no en `BoardScene.ts`

- **Decisión**: `LevelSession` gana `selectedHandIndex: number | null` (`null` solo cuando la
  mano está vacía). Nueva función pura `selectHandPiece(session: LevelSession, index: number):
  LevelSession`, que solo actualiza `selectedHandIndex` si `index` es una posición válida de
  `session.current.hand.pieces` (defensivo, sin lanzar). `applySessionLaunch` internamente usa
  `session.selectedHandIndex ?? 0` como `pieceIndex` al llamar a `resolveLaunch`, y tras obtener
  el resultado:
  - si `outcome.missclick` es `true` → `selectedHandIndex` NO cambia (FR-007).
  - si no → `selectedHandIndex` pasa a `0` si la mano resultante no está vacía, o a `null` si sí
    lo está (FR-006/FR-008) — siempre "la primera de las que quedan", nunca la ficha ya usada.
  `restartSession` reconstruye `selectedHandIndex` exactamente como lo haría `startSession` sobre
  el nivel inicial (FR-005, mismo criterio que ya usa para `current`).
- **Rationale**: la propia regla de "a qué se resetea la selección tras cada lanzamiento" es
  determinista y forma parte del contrato de qué pasa tras una acción del jugador — exactamente
  el tipo de lógica que la constitución exige probar en aislamiento (Principio II) y que el
  renderer NO debe decidir por su cuenta (Principio I: "Rendering code MAY read engine output;
  it MUST NOT feed decisions back into engine logic"). Si esta lógica viviera en `BoardScene.ts`,
  quedaría sin test unitario y el renderer pasaría de "traducir toques a acciones" a "decidir una
  regla de juego" — justo la línea que la constitución traza.
- **Alternatives considered**: guardar la selección como estado puramente local de
  `BoardScene.ts` (un `private selectedIndex` sin pasar por el motor) — descartado: es
  exactamente la Alternative rechazada arriba, y además haría que reiniciar/recargar un nivel
  tuviera que reimplementar a mano la misma lógica de reset que `restartSession` ya centraliza
  para el resto del estado de sesión.

## Decisión: `takeFirstPiece` se generaliza a `takePieceAt(hand, index)`

- **Decisión**: en `launch.ts`, `takeFirstPiece(hand)` se sustituye por `takePieceAt(hand: Hand,
  index: number): { piece: Piece; hand: Hand }`, que extrae la ficha en `index` y conserva el
  orden relativo del resto (`hand.pieces.filter((_, i) => i !== index)`).
- **Rationale**: es la misma generalización que ya se hizo en la feature 008 para
  `PUSH_DISTANCE` → `PUSH_STRATEGY` — el caso "siempre el primero" era un detalle de las features
  001-009, no el contrato real de "extraer una ficha de la mano". Ningún test importa
  `takeFirstPiece` directamente (solo se usa dentro de `resolve-launch.ts`), así que renombrarla
  no rompe ninguna cobertura existente.

## Decisión: anillo de resaltado en el panel de mano, reutilizando el lenguaje visual del anillo de objetivo

- **Decisión**: `drawHand` dibuja, alrededor de la ficha en `selectedIndex`, un círculo trazado
  (`lineStyle(3, HAND_SELECTION_RING_COLOR, 1)` + `strokeCircle`) de radio `PIECE_RADIUS + 4` —
  mismo grosor de línea (3px) que ya usa `drawBoard` para el anillo de objetivo. Color elegido:
  `0xffee58`, el mismo amarillo-acento que ya usa el resto de la UI del prototipo para indicar
  "esto es interactivo/está activo" (texto de "< Niveles", "Reiniciar", "Volver al selector" en
  `BoardScene.ts`), no el mismo azul/verde de ninguna ficha — necesita distinguirse de la ficha
  en sí misma para cualquier color, incluyendo justo el color de la ficha resaltada.
- **Rationale**: el usuario pidió explícitamente reutilizar "el mismo lenguaje visual que el
  anillo de objetivo" — mismo grosor y mismo tipo de trazo (círculo alrededor, no relleno)
  cumple eso sin heredar literalmente `GOAL_RING_COLOR`, que ya no existe como constante fija
  desde el fix del PR #10 (ahora el anillo de objetivo usa el color de la propia ficha objetivo,
  `PIECE_COLOR[goal.targetColor]` — reutilizar ESE mismo criterio aquí sería contraproducente,
  porque para una ficha verde seleccionada un anillo verde sobre un círculo verde apenas se vería).
- **Alternatives considered**: reutilizar `PIECE_COLOR[piece.color]` de la propia ficha
  seleccionada para el anillo — descartado por la razón de contraste de arriba (mismo problema
  que ya se corrigió para el objetivo, pero en sentido inverso: ahí SÍ queríamos que coincidiera
  con el color pedido; aquí NO, porque el círculo relleno ya muestra ese color, y el anillo debe
  comunicar "seleccionado", no "de qué color es" — esa información ya está en el propio relleno).

## Decisión: `drawHand` devuelve las posiciones locales de cada ficha, para que `BoardScene.ts` construya las zonas táctiles

- **Decisión**: `drawHand(graphics, hand, selectedIndex): { x: number; y: number }[]` devuelve un
  array con el centro local (relativo al origen de `handGraphics`) de cada ficha dibujada, en el
  mismo orden que `hand.pieces`. `BoardScene.ts` usa esas posiciones + el origen ya conocido de
  `handGraphics` (`this.scale.width / 2`, `handPanelY`) para crear una zona interactiva por
  ficha (`this.add.zone(...).setInteractive()`), destruyendo y recreando el conjunto en cada
  `redraw()` — a diferencia de los marcadores de borde del tablero (fijos, se crean una única vez
  en `create()`), el número de fichas en mano cambia con cada lanzamiento, así que las zonas
  necesitan recrearse junto con el propio dibujo.
- **Rationale**: mantiene el cálculo de layout (`SLOT_WIDTH`, `totalWidth`, `startX`) en un único
  sitio (`hand-panel.ts`), evitando que `BoardScene.ts` duplique esa aritmética para posicionar
  las zonas táctiles — el mismo motivo por el que `drawBoard`/`CELL_SIZE`/`BOARD_PIXELS` ya son
  la única fuente de verdad para posicionar los marcadores de borde del tablero.
- **Alternatives considered**: que `BoardScene.ts` recalculara las posiciones de forma
  independiente a partir de `hand.pieces.length` — descartado: duplicaría la fórmula de layout en
  dos sitios, con el riesgo de que diverjan si `SLOT_WIDTH`/`PIECE_RADIUS` cambian en el futuro.
