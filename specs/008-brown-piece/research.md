# Phase 0 Research: Ficha Marrón (Movimiento Largo Repetido)

## Decisión: `PUSH_DISTANCE` (número fijo) se generaliza a `PUSH_STRATEGY` (función)

- **Decisión**: en `pieces/push.ts`,

  ```ts
  type DisplacementStrategy = (board: Board, position: Coordinate, direction: Direction) => Coordinate;

  const PUSH_STRATEGY: Record<PieceColor, DisplacementStrategy> = {
    green: (_board, position, direction) => stepBy(position, direction, 1),
    orange: (_board, position, direction) => stepBy(position, direction, 2),
    brown: (board, position, direction) => stepUntilBlocked(board, position, direction, 2),
  };
  ```

  reemplaza `PUSH_DISTANCE: Record<PieceColor, number>`. `resolveStrike` cambia una única línea
  (`const to = stepBy(position, direction, PUSH_DISTANCE[strikerColor]);` →
  `const to = PUSH_STRATEGY[strikerColor](board, position, direction);`) y nada más.
- **Rationale**: verde y naranja ya eran, conceptualmente, "calcula un destino según el color".
  Que ese cálculo sea siempre un salto de distancia fija era un detalle de implementación, no el
  contrato real. Generalizar el TIPO del mapa (de número a función) deja a verde/naranja/marrón
  como tres estrategias intercambiables sin que `resolveStrike` necesite saber cuál se está
  usando — coherente con el Principio V y con el propio patrón ya usado para el wrap-around
  (`resolveStrike` tampoco sabe si `stepBy` envolvió el destino).
- **Alternatives considered**: un `if (strikerColor === 'brown') {...} else {...}` dentro de
  `resolveStrike` — descartado explícitamente: es exactamente el caso especial que el Principio
  V pide evitar, y además mezclaría la lógica de "cómo se calcula el destino" con la de "qué
  pasa una vez calculado", que hoy están limpiamente separadas.

## Decisión: nuevo primitivo `stepUntilBlocked` en `move-step.ts`

- **Decisión**:

  ```ts
  export function stepUntilBlocked(
    board: Board,
    position: Coordinate,
    direction: Direction,
    maxEdgeCrossings: number,
  ): Coordinate {
    let current = position;
    let edgeCrossings = 0;

    for (;;) {
      const raw = step(current, direction);
      if (!isInBounds(raw)) edgeCrossings++;
      current = wrapCoordinate(raw);

      const occupant = getPieceAt(board, current);
      const isSelf = current.row === position.row && current.col === position.col;
      if (occupant !== null && !isSelf) return current; // bloqueado aquí

      if (edgeCrossings >= maxEdgeCrossings) return current; // tope de seguridad alcanzado
    }
  }
  ```

  Vive junto a `stepBy` en `move-step.ts` — mismo criterio ya establecido en la feature
  wrap-around: un primitivo de movimiento no sabe nada de colores ni de reglas de colisión, solo
  de coordenadas y del tablero.
- **Rationale**: comprueba ocupación en cada paso individual (a diferencia de `stepBy`, que solo
  calcula una coordenada final sin mirar el tablero) y cuenta cruces de borde para poder parar en
  el segundo, exactamente como se clarificó en spec.md.
- **Alternatives considered**: precalcular una "distancia máxima" (distancia hasta el primer
  borde + 8) y reutilizar `stepBy` con esa distancia, comprobando ocupación en cada paso
  intermedio con un bucle aparte — descartado por ser estrictamente más complicado (dos
  conceptos, "distancia" y "comprobación por paso", en vez de uno) sin ganar nada: contar cruces
  de borde durante el propio bucle da exactamente el mismo resultado con menos código.

## Hallazgo: una ficha marrón SIEMPRE se topa consigo misma antes del segundo cruce, si nada la bloquea

- **Hallazgo**: al tratarse de un ciclo de periodo 8 (el tamaño del tablero), la casilla de
  partida (`position`) se vuelve a visitar exactamente cada 8 pasos — en el paso 8, 16, 24...
  desde el inicio, sin importar por dónde se entró. El segundo cruce de borde ocurre en el paso
  `d + 8` (siendo `d` el paso del primer cruce, entre 1 y 8) — es decir, SIEMPRE en el paso 9 o
  posterior. El paso 8 (que aterriza exactamente en `position`) ocurre por tanto SIEMPRE antes
  del segundo cruce, en cualquier desplazamiento que no se bloquee antes. Esto no es un caso
  raro: es la situación normal de cualquier fila/columna despejada (justo el escenario de la
  Historia de Usuario 3). Sin tratamiento especial, `position` se leería como "bloqueado por mí
  mismo" en el paso 8, lo cual es incorrecto: la ficha ya no está conceptualmente ahí, es ella
  misma la que se mueve — y el tope de dos cruces nunca llegaría a alcanzarse.
- **Decisión**: `stepUntilBlocked` excluye explícitamente `position` (el punto de partida) de la
  comprobación de bloqueo — ver `isSelf` en el código de arriba. Los cruces de borde SÍ se
  siguen contando aunque el paso caiga sobre `position`; solo se ignora como obstáculo.
- **Rationale**: es la misma clase de problema que el "tablero no mutado durante la recursión"
  ya documentado en la feature 004 (wrap-around) y revisitado en la 006 — pero aquí aparece
  dentro de un único primitivo de movimiento, no entre eslabones de una cascada de varias
  fichas, así que sí es responsabilidad de esta feature resolverlo (a diferencia del caso
  multi-ficha entre eslabones de una cascada, que sigue fuera de alcance, ver siguiente
  decisión).
- **Cubierto por el mismo test que la Historia de Usuario 3** (fila/columna despejada, tope de
  dos cruces): al ser inevitable en ese escenario (visto arriba), no hace falta un test aparte
  para el auto-bloqueo — el propio test del tope ya lo ejercita y lo probaría fallido si el
  `isSelf` no estuviera.

## Fuera de alcance (heredado, no introducido por esta feature): bloqueo fantasma entre varias fichas de una misma cascada

Ya documentado en research.md de la feature 006: `resolveStrike` lee el mismo `board` sin mutar
durante toda una cascada, así que una cadena de VARIAS fichas que complete una vuelta completa
dentro de una misma resolución podría toparse con una ficha que, en la práctica, ya se movió de
ahí. Esto sigue sin resolverse aquí — es exactamente el escenario de "bucle" que la constitución
y spec.md 004 delegan explícitamente a esta feature (marrón), pero solo en el sentido de "una
ficha no debe dar más de una vuelta ella sola" (spec.md 008, resuelto arriba). El caso de
varias fichas encadenadas dando una vuelta completa ENTRE ELLAS sigue siendo un escenario de
diseño de niveles a evitar, no algo que el motor deba prevenir activamente — no cambia con esta
feature.

## Decisión: `board-view.ts` necesita una entrada de color para `'brown'`, sin añadir marrón a Fase 2

- **Decisión**: `PIECE_COLOR: Record<PieceColor, number>` en `board-view.ts` gana una entrada
  `brown: 0x8d6e63` (un marrón real). Ningún nivel del prototipo de Fase 2 usa esa entrada
  todavía — es solo lo mínimo para que `Record<PieceColor, number>` siga siendo un tipo
  exhaustivo y el build no se rompa.
- **Rationale**: `PieceColor` ganar un valor nuevo se propaga a cualquier `Record<PieceColor,
  ...>` ya existente en el repositorio (verificado: solo `push.ts` y `board-view.ts` usan ese
  patrón). No tocarlo dejaría el build roto, lo cual contradice igualmente el alcance "solo
  motor" — un build roto no es "sin cambios de renderer", es peor.
- **Alternatives considered**: cambiar `PIECE_COLOR` a `Partial<Record<PieceColor, number>>` para
  no necesitar la entrada — descartado porque debilita la seguridad de tipos existente sin
  ninguna ganancia real (el valor con nombre y sentido es más simple que manejar `undefined` en
  cada lectura).
