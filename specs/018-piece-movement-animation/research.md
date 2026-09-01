# Research: Animación de Movimientos de Ficha Durante un Lanzamiento

## Decisión 1: Fichas temporales para lo que se anima, `drawBoard` sin cambios para el resto

**Decisión**: Durante la reproducción de un lanzamiento, cada `MOVE_STEP`/`ANNIHILATION` se representa con un `Phaser.GameObjects.Arc` **temporal** (creado justo antes de tweenearlo, destruido justo después) -- nunca se convierte el tablero completo a `GameObject`s persistentes por ficha. Entre un evento y el siguiente, la capa estática (`this.boardGraphics`) se redibuja con `drawBoard` de siempre, pasándole una copia del tablero ya actualizada con los eventos reproducidos hasta ese punto (ver Decisión 2) -- así nunca hay una ficha duplicada (la estática ya "sabe" que esa celda está vacía mientras la temporal viaja) ni una que falte.

**Rationale**: `drawBoard`/`drawPieceFragility` (`board-view.ts`) ya son la única fuente de verdad visual para "cómo se ve una ficha" (color + grieta) -- reutilizarlos para la capa estática entre pasos, y solo añadir un `Arc` temporal con el mismo estilo para el tramo que sí se anima, es el cambio más pequeño posible. Convertir TODO el tablero a `GameObject`s persistentes (una alternativa más "correcta" a largo plazo) es un refactor bastante mayor de `board-view.ts` para una feature que el propio roadmap describe como "sencilla" (memoria de proyecto, "mejorar la interfaz gráfica animando los movimientos de manera sencilla").

**Alternativas consideradas**:

- **Tablero completo con `GameObject`s persistentes por ficha** (un sprite/arc por celda ocupada, actualizado en vez de recreado): más flexible para animaciones futuras más ricas (arrastre, selección animada, etc.), pero es un refactor de `board-view.ts` mucho mayor del que esta feature necesita. Queda como posible evolución futura, no parte de esta feature.
- **Animación vía DOM/CSS superpuesta al canvas de Phaser**: descartada -- todo el renderer ya vive dentro de Phaser/canvas; introducir DOM para esto sería una dependencia nueva sin ningún beneficio sobre usar `this.tweens` que Phaser ya ofrece.

## Decisión 2: Reproducir el tablero intermedio con un reductor propio del renderer, no pedírselo al motor

**Decisión**: Una función pura y testeada (`replayEvent(board, event): Board`, `src/renderer/launch-animation.ts`) aplica un `ChainEvent` a una copia de `Board`: un `MOVE_STEP` coloca la ficha en `to` (salvo que su fragilidad sea `'broken'`, en cuyo caso no se coloca nada -- igual que `settleOrVanish`); una `ANNIHILATION` vacía la celda `at`. **Deliberadamente NO vacía `from`** -- ver el error real cometido y corregido más abajo. El renderer arranca esta reproducción desde el tablero ANTERIOR al lanzamiento (`session.current.board` antes de llamar a `applySessionLaunch`) y la avanza evento a evento, en el mismo orden que `EventLog`.

**Rationale**: El motor ya expone toda la información necesaria en `EventLog` (spec.md, Input) -- no hace falta que `resolveLaunch` devuelva una lista de tableros intermedios (eso violaría FR-009, cambiar el motor para una necesidad puramente de presentación). Como el propio `EventLog` es ya una traza completa y determinista de cómo cambia el tablero paso a paso, reproducirlo con la misma semántica de escritura que ya usa `applyImpact`/`settleOrVanish` (`src/engine/pieces/push.ts`) es suficiente para reconstruir cada estado intermedio con exactitud -- y el estado final de esta reproducción es, por construcción (mismos eventos, mismo reductor), idéntico al `board` final que ya devolvió el motor (FR-008/SC-003), sin necesidad de compararlos en tiempo de ejecución.

**Error real cometido y corregido durante la implementación (T002)**: la primera versión de `replayEvent` vaciaba `from` antes de escribir `to`, asumiendo que cada `MOVE_STEP` representa "esta ficha vacía su casilla anterior y ocupa la nueva". El test de integración (reproducir un `EventLog` real de una división de rojo y compararlo contra el `board` final de `resolveLaunch`) falló de inmediato: en una división de rojo, el `from` de CADA rama es el propio punto de división -- la MISMA casilla donde el rojo lanzador acaba de asentarse (FR-007 de 009-red-piece, rojo se queda ahí para siempre) -- así que vaciar `from` borraba a rojo por error. Al leer `settleOrVanish` directamente (`src/engine/pieces/push.ts`): `const boardAfter = piece.fragility === 'broken' ? board : setPieceAt(board, to, piece);` -- **nunca escribe `from`, solo `to`**. `from` es puramente documental (de dónde viene esa ficha), nunca una instrucción de vaciar una casilla; el vaciado de una casilla vieja ocurre siempre de forma implícita, porque el SIGUIENTE evento que la afecta la sobrescribe con su propio `to` (o, si nada vuelve a tocarla, se queda con lo último que se escribió ahí -- que es exactamente lo correcto). Corregido para no escribir nunca `from`; el test de integración pasa con esta versión. Se documenta aquí en detalle porque es exactamente el tipo de suposición-sin-verificar que este proyecto ya se ha encontrado antes (016/017) -- confirma que verificar contra el código fuente real, no contra la forma superficial de los eventos, sigue siendo la disciplina correcta.

**Consecuencia visual aceptada**: dado que `from` nunca se vacía explícitamente, la ficha temporal de un paso puede aparecer superpuesta, por un instante, con la ficha estática que ya ocupa esa casilla (típicamente la propia ficha que la golpeó, ya asentada un paso antes) -- un solape breve en el momento del impacto, no un error. Aceptado como parte de "animación sencilla" (FR-010).

**Alternativas consideradas**:

- **Que `resolveLaunch`/`applyImpact` devuelvan también los tableros intermedios**: descartada explícitamente por spec.md (FR-009, "ninguna regla del motor debe cambiar") -- sería exponer una necesidad de presentación en la superficie pública del motor, violando el Principio I (el motor no sabe nada de cómo se presenta).
- **Interpolar directamente sobre el tablero FINAL sin reproducir eventos** (p. ej. animar cualquier ficha que cambió de posición entre el tablero inicial y el final, sin mirar el orden de eventos): descartada -- pierde exactamente lo que esta feature quiere mostrar (el ORDEN de la cadena, FR-001), y no distingue una ficha que se movió una vez de una que participó en varios saltos de la misma cascada.

## Decisión 3: Reproducción estrictamente secuencial, nunca en paralelo

**Decisión**: Los eventos se animan uno detrás de otro (el siguiente tween empieza solo cuando el anterior termina), nunca varios a la vez -- incluidas las dos ramas de una división de rojo, que ya llegan como una lista plana y ordenada dentro del mismo `EventLog` (016-immediate-chain-placement: la rama 1 se resuelve por completo antes de que la rama 2 empiece).

**Rationale**: `EventLog` YA es una lista totalmente ordenada -- no hay ninguna noción de "estos dos eventos ocurrieron a la vez" en el modelo actual del motor (el propio roadmap del proyecto -- ver memoria "cálculo síncrono tick a tick" -- reconoce esto como una limitación conocida y separada, no algo que esta feature deba resolver). Animar estrictamente en el mismo orden es, por tanto, la única interpretación fiel posible hoy.

**Alternativas consideradas**:

- **Animar en paralelo los eventos que "podrían" ser simultáneos** (p. ej. las dos ramas de rojo): requeriría que el motor expusiera qué eventos son independientes entre sí -- información que no existe hoy y que se relaciona directamente con el futuro trabajo de "cálculo síncrono tick a tick" (roadmap, siguiente feature tras esta). Fuera de alcance aquí.

## Decisión 4: Bloqueo de input vía un flag simple en la escena

**Decisión**: `BoardScene` gana un campo privado `animating: boolean` (`false` por defecto). `launch()` y el `pointerdown` de cada zona táctil de mano comprueban `this.animating` al principio y no hacen nada si es `true` -- igual que ya comprueban `hand.pieces.length===0`/`status!=='undetermined'` hoy. Se pone a `true` justo antes de empezar la secuencia de animación y a `false` justo después del `redraw()` final, antes de evaluar si toca mostrar la ventana de resultado.

**Rationale**: Es el mismo patrón ya usado por los otros dos guardas de `launch()` (mano vacía, nivel ya resuelto) -- ningún mecanismo nuevo, solo una condición más. El botón "< Niveles" (volver al selector) NO se bloquea deliberadamente (ver Assumptions) -- navegar fuera de `BoardScene` mientras se anima destruye la escena entera (y con ella, cualquier tween en curso), así que no hay ningún estado inconsistente que proteger ahí.

**Alternativas consideradas**:

- **Deshabilitar visualmente los controles (opacidad reducida, etc.) además de bloquear el input**: no descartada, pero se deja como detalle de implementación (`/speckit-tasks`), no una decisión de research -- spec.md no exige ninguna señal visual concreta de "bloqueado", solo que el intento no tenga efecto (FR-005/FR-006).

## Decisión 5: Duración/easing fijos, sin controles para quien juega

**Decisión**: Cada tween usa una duración corta fija (constante en `launch-animation.ts`, p. ej. 150ms por paso) y un easing lineal simple -- sin exponer ningún control de velocidad, pausa, o scrubbing (FR-010, ya explícito en spec.md).

**Rationale**: Spec.md ya lo deja como decisión tomada, no abierta -- esta feature es una primera versión deliberadamente simple (memoria de proyecto: "de manera sencilla").

*(Refinamiento tras playtest, mismo día): `STEP_DURATION_MS` sube de 150 a 350, y luego a 450 en una segunda ronda ("todo un poco más lento") -- el propio usuario, tras probar cada versión, pidió más duración. Sigue siendo una constante fija, sin exponerse como control (FR-010 no cambia).*

## Decisión 8 (segunda ronda de refinamiento): la animación del primer evento empieza en el borde de entrada, no en `event.from`

**Decisión**: `playEventLog` recibe ahora también el `Launch` confirmado (`{direction, lane}`). Para el PRIMER evento de la traza únicamente, si es un `MOVE_STEP`, la ficha temporal se crea en `entryCoordinate(direction, lane)` (una copia local, deliberada, de la función privada del mismo nombre en `launch.ts` -- mismo precedente que `tools/generator/obligations.ts`) y primero desliza en línea recta hasta el `event.from` real, ANTES de ejecutar la animación normal de ese evento (salto o desplazamiento recto) sin ningún otro cambio.

**Rationale**: `event.from` del primer evento de una traza NUNCA es el borde real de entrada -- `resolve-launch.ts` lo calcula como `step(hitAt, opposite(direction))`, es decir, una sola casilla antes del primer impacto, sin importar cuántas casillas vacías haya recorrido la ficha lanzada desde el borde real. Antes de este refinamiento, la ficha "aparecía" de la nada justo al lado de su primer impacto en vez de entrar visiblemente desde el borde del tablero -- el usuario lo pidió explícitamente ("que la animación empezara en la casilla 0 desde el lanzamiento de la mano"). Separar esto en un tramo previo de deslizamiento recto (sin salto, sin sonido propio) mantiene intacta toda la lógica ya existente para el evento en sí (detección de salto, sonido, marcador) -- el tramo de entrada es puramente un añadido delante, no una reinterpretación del evento real.

**Alcance deliberadamente limitado**: solo se aplica al primer evento, y solo si es un `MOVE_STEP` -- si el primer (y único) evento de la traza es una `ANNIHILATION` (rojo golpeando rojo desde la mano, por ejemplo), no se añade ningún tramo de entrada; se mantiene el fundido en el sitio de siempre, ya que no hay ningún desplazamiento previo que mostrar. No se investigó ni se pidió resolver este caso -- se deja como limitación conocida, no un defecto.

## Decisión 9 (tercera ronda de refinamiento): el salto es perpendicular a la dirección de viaje, no siempre "hacia arriba"

**Decisión**: el desplazamiento del arco del salto (`hopOffset`) ya no es siempre un offset en `y` (hacia arriba) -- ahora es perpendicular a la dirección real del movimiento: un salto horizontal (misma fila, `event.from.col !== event.to.col`) sigue desplazando en `y`; un salto vertical (misma columna) desplaza en `x` (hacia la derecha).

**Rationale**: el usuario detectó que un salto vertical, con el offset fijo en `y`, no se leía como un arco -- se veía como la ficha simplemente moviéndose más rápido/lento por la misma línea vertical, ya que el offset y el propio desplazamiento compartían el mismo eje. Desplazando siempre en el eje PERPENDICULAR al de viaje, el arco es visualmente un "bulto" hacia un lado, legible como salto sea cual sea la dirección.

## Decisión 6 (refinamiento tras playtest): detectar el salto de naranja por geometría, no por color

**Decisión**: `jumpMidpoint(from, to, size)` (`launch-animation.ts`) detecta un "salto de naranja" puramente por geometría -- ¿`from`→`to` es un desplazamiento recto de exactamente 2 casillas (por el camino corto, considerando wrap-around)? -- en vez de mirar el color de la ficha que golpeó. Si lo es, devuelve la casilla intermedia que se salta; si no, `null`.

**Rationale**: `MoveStepEvent` no incluye qué color la golpeó, solo la propia ficha desplazada (`piece`) y sus casillas -- no hay forma directa de saber "esto lo empujó naranja" desde un evento aislado. Pero 2 casillas en línea recta es precisamente la distancia fija y exclusiva de `PUSH_STRATEGY.orange` (`stepBy(...,2)`, `src/engine/pieces/push.ts`) -- verde siempre es 1, marrón camina y se detiene donde encuentre obstáculo o el tope de cruces (raramente coincide en exactamente 2, y si lo hace, tratar ese caso igual que un salto de naranja es una simplificación aceptable, no engañosa: sigue siendo un salto real de 2 casillas). El cálculo del punto medio necesita manejar el wrap-around correctamente (research.md ya trata esto en otras features -- aquí, `shortDelta` replica la misma convención de "camino más corto" que `wrapCoordinate`/`stepBy` ya usan en el motor, sin importar código del motor).

**Alternativas consideradas**:

- **Pasar el color del golpeador explícitamente hasta el renderer** (cambiar `EventLog` o añadir un campo): descartado -- violaría FR-009 (ningún cambio al motor) para una necesidad que la geometría ya resuelve sin tocar `src/engine/`.
- **Sonido genérico de choque también para el salto** (en vez de uno distinto): descartado -- el usuario pidió explícitamente un sonido diferente para el salto de naranja, no una variación del de choque.

## Decisión 7 (refinamiento tras playtest): sonidos generados por síntesis simple, sin ficheros de audio

**Decisión**: `sound-effects.ts` genera tres tonos cortos y distintos directamente con la Web Audio API (`AudioContext`/`OscillatorNode`) -- ningún fichero de audio, ninguna dependencia nueva, ningún uso del gestor de sonido de Phaser.

**Rationale**: "Sonidos sencillos" (spec.md/petición del usuario) no requiere composición real -- tres tonos cortos con distinta frecuencia/forma de onda (choque: cuadrada grave; salto: triangular aguda; objetivo: dos tonos ascendentes en seno) ya son perceptiblemente distintos entre sí, sin necesitar ningún asset ni pipeline de carga nuevo.
