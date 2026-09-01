# Phase 1 Data Model: Resolución Síncrona de Trayectorias Simultáneas (Tick a Tick)

## Hallazgo clave: `resolveChain` (`src/engine/events.ts`) ya es una cola FIFO -- sembrar dos sitios a la vez ya los intercala hop a hop

`resolveChain` de hoy hace `queue.shift()` (saca el PRIMERO), procesa un único salto, y empuja su `nextSites` al FINAL de la cola. Si se sembrara con DOS sitios iniciales a la vez (`queue = [A0, B0]`) en vez de dos llamadas separadas, el orden de procesamiento natural ya sería `A0, B0, A1, B1, A2, B2, ...` -- una alternancia estricta, uno por uno, exactamente la semántica de "un tick avanza cada trayectoria activa un salto" (research.md, Decisión 1/2). No hace falta una estructura de "rondas" nueva desde cero -- basta con (a) sembrar ambos sitios en la MISMA cola en vez de dos llamadas secuenciales, y (b) añadir, ANTES de cada `shift()`, una comprobación de si dos entradas cualesquiera de la cola actual comparten el mismo `to` -- si la hay, se resuelven esas dos con la regla simétrica nueva en vez de continuar con el `shift()` normal.

## Tipos nuevos/modificados (`src/engine/events.ts`)

```ts
export type MutualImpactHandler = (
  board: Board,
  siteA: ImpactSite,
  siteB: ImpactSite,
) => { board: Board; events: ChainEvent[]; nextSites: ImpactSite[] };

export function resolveChain(
  board: Board,
  initialSites: ImpactSite[], // CAMBIO: antes era un único `initialSite`
  handleImpact: ImpactHandler,
  handleMutualImpact: MutualImpactHandler, // NUEVO
): { board: Board; events: EventLog } {
  const events: EventLog = [];
  const queue: ImpactSite[] = [...initialSites];
  let currentBoard = board;

  while (queue.length > 0) {
    const collision = findCoincidingPair(queue); // busca dos entradas con el mismo `to`
    if (collision !== null) {
      const [indexA, indexB] = collision;
      const [siteA, siteB] = [queue[indexA], queue[indexB]];
      queue.splice(indexB, 1);
      queue.splice(indexA, 1); // se quitan las dos (índice mayor primero, para no desplazar al otro)
      const result = handleMutualImpact(currentBoard, siteA, siteB);
      currentBoard = result.board;
      events.push(...result.events);
      queue.push(...result.nextSites);
      continue;
    }

    const site = queue.shift()!;
    const result = handleImpact(currentBoard, site);
    currentBoard = result.board;
    events.push(...result.events);
    queue.push(...result.nextSites);
  }

  return { board: currentBoard, events };
}
```

`findCoincidingPair` recorre `queue` en orden y devuelve los índices de las dos primeras entradas cuyo `to` coincide (misma fila y columna), o `null` si no hay ninguna -- determinista (siempre el mismo par, en el mismo orden, para la misma cola -- research.md, Decisión 4: 3+ coincidencias se resuelven por pares, repetido si el resultado de la primera sigue coincidiendo con una tercera).

**Por qué esto no cambia NADA para el caso de hoy (N≤1 sitio activo)**: con `initialSites.length === 1` (todo lanzamiento sin rojo, y el propio `resolveLaunch`), la cola nunca tiene más de una entrada pendiente a la vez salvo momentáneamente cuando se le añade el `nextSites` de un único `applyImpact` -- pero eso sigue siendo como mucho 1 entrada. `findCoincidingPair` sobre una cola de 0 o 1 elementos siempre devuelve `null` de inmediato -- el bucle se comporta exactamente igual que hoy, sin ningún coste ni cambio observable (FR-006, SC-002).

## Nueva función: `applyMutualImpact` (`src/engine/pieces/push.ts`)

**Corregido durante la implementación** (research.md, Decisión 3, "bug real encontrado"): la primera versión dejaba que una ficha ya `broken` "se quedara broken y siguiera" indefinidamente -- rompía la garantía de terminación. La versión correcta comprueba la fragilidad de CADA lado ANTES de esta colisión: si ya era `broken`, esa ficha desaparece aquí (sin nueva trayectoria); si no, avanza una vez y sí continúa -- exactamente el mismo patrón que `settleOrVanish` ya aplica en el caso asimétrico.

```ts
/**
 * Un lado de una colisión simétrica: dada la fragilidad de esa trayectoria
 * ANTES de esta colisión, decide si avanza y genera una nueva trayectoria
 * (`pushOnward`), o -- ya `broken` de antes -- simplemente desaparece (`null`).
 */
function resolveMutualSide(
  fragilityBefore: Fragility,
  color: PieceColor,
  from: Coordinate,
  pushOnward: (hit: Piece) => { direction: Direction; to: Coordinate },
): ImpactSite | null {
  if (fragilityBefore === 'broken') {
    return null; // ya agotó su golpe extra antes -- desaparece ahora
  }
  const hit: Piece = { color, fragility: advance(fragilityBefore) };
  const { direction, to } = pushOnward(hit);
  return { piece: hit, direction, from, to };
}

export function applyMutualImpact(
  board: Board,
  siteA: ImpactSite,
  siteB: ImpactSite,
): { board: Board; events: ChainEvent[]; nextSites: ImpactSite[] } {
  if (siteA.piece.color === siteB.piece.color) {
    // Mismo color: aniquilación mutua -- mismo resultado que la regla ya
    // existente, ahora también alcanzable entre dos trayectorias en
    // movimiento (research.md, Decisión 3).
    return {
      board,
      events: [{ type: 'ANNIHILATION', at: siteA.to, color: siteA.piece.color }],
      nextSites: [],
    };
  }

  // Distinto color: cada una avanza su propia fragilidad (fue golpeada,
  // exactamente una vez, por la otra) y continúa con el mecanismo de empuje
  // Y LA DIRECCIÓN de la otra -- research.md, Decisión 3, confirmada por el
  // usuario: intercambio de dirección, no un "rebote" en la dirección propia.
  const nextA = resolveMutualSide(siteA.piece.fragility, siteA.piece.color, siteA.to, (hit) => ({
    direction: siteB.direction,
    to: PUSH_STRATEGY[siteB.piece.color as Exclude<PieceColor, 'red'>](board, hit, siteA.to, siteB.direction),
  }));
  const nextB = resolveMutualSide(siteB.piece.fragility, siteB.piece.color, siteB.to, (hit) => ({
    direction: siteA.direction,
    to: PUSH_STRATEGY[siteA.piece.color as Exclude<PieceColor, 'red'>](board, hit, siteB.to, siteA.direction),
  }));

  return {
    board,
    events: [],
    nextSites: [nextA, nextB].filter((site): site is ImpactSite => site !== null),
  };
}
```

**Por qué esto SÍ termina siempre**: cada instancia de ficha concreta puede avanzar como mucho dos veces (`new`→`cracked`, `cracked`→`broken`) antes de que la TERCERA colisión que la involucre la haga desaparecer -- una progresión finita y sin ciclos, la misma idea que ya usa `advance()`/`settleOrVanish` para el caso asimétrico, generalizada aquí a dos trayectorias golpeándose a la vez. Verificado empíricamente contra un caso real que, con la primera versión (incorrecta) de esta función, colgaba el proceso indefinidamente -- con esta versión, termina en 6 eventos (`tests/unit/engine/red.test.ts`).

**Nota sobre "sin eventos" (`events: []`)**: a diferencia de `applyImpact`, que siempre asienta a la golpeadora de inmediato (`settleOrVanish`, con su propio `MOVE_STEP`), en una colisión simétrica NINGUNA de las dos fichas se asienta en la casilla de la colisión -- ambas continúan de inmediato hacia su nuevo destino (research.md, Decisión 3: cada una hereda el desplazamiento de la otra). El evento visible de cada una llegará cuando su PROPIO `nextSite` se resuelva (vía el `applyImpact` normal de la siguiente vuelta del bucle, si su destino ya no coincide con nada) -- consistente con que `applyImpact` nunca "asienta antes de saber si el impacto es una aniquilación", aplicado aquí también a "antes de saber si el impacto es simétrico".

**`Exclude<PieceColor, 'red'>` en el cast**: `PUSH_STRATEGY` no tiene entrada para `'red'` (rojo no empuja, divide -- `push.ts` ya lo tipa así). Dado que `siteA`/`siteB` son trayectorias YA EN MOVIMIENTO (nunca la propia ficha roja que provocó la división original, que se asienta de inmediato y nunca vuelve a viajar), ninguna de las dos puede ser roja en la práctica -- se documenta como invariante, verificado con un test dedicado, no asumido.

## `resolveRedSplit` -- ya no llama a `resolveChain` dos veces

```ts
function resolveRedSplit(
  board: Board,
  hitDefender: Piece,
  position: Coordinate,
  direction: Direction,
): { board: Board; events: ChainEvent[] } {
  const [first, second] = PERPENDICULAR_DIRECTIONS[direction];

  return resolveChain(
    board,
    [
      { piece: hitDefender, direction: first, from: position, to: stepBy(position, first, 1) },
      { piece: hitDefender, direction: second, from: position, to: stepBy(position, second, 1) },
    ],
    applyImpact,
    applyMutualImpact,
  );
}
```

Sustituye las dos llamadas secuenciales de siempre por una única llamada con ambos sitios sembrados a la vez -- `resolveChain` (ya modificado arriba) se encarga de intercalarlas hop a hop y de detectar cualquier coincidencia.

## `resolve-launch.ts` -- único otro consumidor de `resolveChain`

```ts
const { board: finalBoard, events } = resolveChain(level.board, [initialSite], applyImpact, applyMutualImpact);
```

Cambia de `initialSite` a `[initialSite]` -- un array de un solo elemento, nunca produce ninguna coincidencia por sí mismo (FR-006).

## Tests nuevos

- `tests/unit/engine/events.test.ts` (o ampliar el fichero de tests de `resolveChain` que ya exista) -- `findCoincidingPair`/`resolveChain` con múltiples sitios iniciales sintéticos: 2 sitios sin coincidencia nunca se resuelven como colisión simétrica; 2 sitios cuyo primer salto coincide se resuelven como colisión simétrica inmediatamente; 3+ sitios con coincidencias en cadena se resuelven por pares, en orden (research.md, Decisión 4).
- `tests/unit/engine/push.test.ts` -- `applyMutualImpact`: mismo color aniquila mutuamente; distinto color intercambia dirección y mecanismo de empuje, con la fragilidad de ambas avanzando exactamente una vez; una de las dos ya `broken` no avanza más allá de `broken`.
- Un test de integración real, vía `resolveLaunch`, con una división de rojo cuyas dos ramas se cruzan de verdad por wrap-around (US1, Independent Test de spec.md) -- construido y verificado a mano, comparando explícitamente contra lo que el motor SECUENCIAL (antes de esta feature) producía para el mismo caso, para demostrar que el resultado cambia solo aquí.
- Regresión completa: niveles 14/15 del prototipo y los 140 niveles generados, reproducidos contra el motor ya cambiado -- ninguno de ellos tiene un cruce real entre ramas (se verifica, no se asume), así que deben seguir produciendo exactamente el mismo resultado (FR-006/SC-002/SC-003).
