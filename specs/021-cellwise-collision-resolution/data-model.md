# Phase 1 Data Model: Resolución de Colisiones Casilla a Casilla

Ningún cambio de forma en `MoveStepEvent`/`AnnihilationEvent`/`EventLog` (research.md, Decisión 5).
Todos los cambios viven en `ImpactSite` y en `tools/generator/...` no se ven afectados en absoluto
(el generador nunca invierte una caminata de marrón casilla a casilla, solo su destino final --
sigue funcionando exactamente igual, ver Escenario de verificación más abajo).

## `ImpactSite` (`src/engine/events.ts`) -- un campo nuevo, opcional

```ts
export type ImpactSite = {
  piece: Piece;
  direction: Direction;
  from: Coordinate;
  to: Coordinate;
  pushedByColor?: PieceColor;
  // Presente únicamente cuando `to` es un paso TENTATIVO de exactamente 1
  // casilla en curso de una caminata marrón (`pushedByColor === 'brown'`),
  // nunca un destino final -- `from` permanece fijo en el origen real de la
  // caminata mientras `to` avanza una casilla cada vez que este site vuelve a
  // su turno en la cola FIFO de resolveChain. Ausente para cualquier otro
  // caso (verde, naranja, o un `to` ya final) -- ver research.md, Decisión 2.
  walking?: { edgeCrossings: number };
};
```

## `applyImpact` (`src/engine/pieces/push.ts`) -- dos puntos de cambio

### 1. Rama `defender === null` -- dispensa un paso más en vez de asentar, cuando `site.walking` está presente

```ts
if (defender === null) {
  if (site.walking !== undefined) {
    const raw = step(site.to, site.direction);
    const crossedEdge = !isInBounds(raw);
    const edgeCrossings = site.walking.edgeCrossings + (crossedEdge ? 1 : 0);
    if (edgeCrossings >= MAX_EDGE_CROSSINGS) {
      // Tope alcanzado sin colisión -- se asienta aquí, mismo límite ya
      // existente de stepUntilBlocked (spec.md 008).
      const { board: boardAfter, events } = settleOrVanish(
        board, site.piece, site.from, site.to, site.direction, false, site.pushedByColor,
      );
      return { board: boardAfter, events, nextSites: [] };
    }
    const nextSite: ImpactSite = {
      ...site,
      to: wrapCoordinate(raw),
      walking: { edgeCrossings },
    };
    return { board, events: [], nextSites: [nextSite] }; // sin evento -- todavía en vuelo
  }
  // Comportamiento actual, sin cambios (verde, naranja, o un `to` ya final).
  const { board: boardAfter, events } = settleOrVanish(
    board, site.piece, site.from, site.to, site.direction, false, site.pushedByColor,
  );
  return { board: boardAfter, events, nextSites: [] };
}
```

`step`/`isInBounds`/`wrapCoordinate` ya están disponibles (mismos primitivos que `stepUntilBlocked`
ya usa en `move-step.ts`) -- `applyImpact` necesita importar `isInBounds` (ya exportado de
`board.ts`, usado hoy solo dentro de `move-step.ts`) además de lo que ya importa.

### 2. Construcción del `nextSite` de una ficha desplazada por un golpeador marrón

```ts
// Antes:
// const to = PUSH_STRATEGY[site.piece.color](boardWithStriker, hitDefender, site.to, site.direction);
// const nextSite: ImpactSite = { piece: hitDefender, direction: site.direction, from: site.to, to, pushedByColor: site.piece.color };

// Después:
const nextSite: ImpactSite =
  site.piece.color === 'brown'
    ? {
        piece: hitDefender,
        direction: site.direction,
        from: site.to,
        to: wrapCoordinate(step(site.to, site.direction)),
        pushedByColor: 'brown',
        walking: { edgeCrossings: 0 },
      }
    : {
        piece: hitDefender,
        direction: site.direction,
        from: site.to,
        to: PUSH_STRATEGY[site.piece.color](boardWithStriker, hitDefender, site.to, site.direction),
        pushedByColor: site.piece.color,
      };
```

Nota: el primer paso de una caminata marrón nunca cruza un borde en la práctica salvo que
`site.to` ya esté en el borde -- se calcula igual que cualquier otro paso (`isInBounds` +
incremento condicional), no como un caso especial con `edgeCrossings` fijo a `0`. El pseudocódigo
de arriba simplifica asumiendo el caso común; la implementación real reutiliza el mismo cálculo de
paso-más-cruce-de-borde que la rama `defender === null` (research.md Decisión 4), evitando
duplicar la lógica -- ver "Función compartida" más abajo.

### Función compartida: `stepWalking`

Para no duplicar el cálculo "da un paso, cuenta si cruza un borde, decide si sigues o te asientas"
entre los dos puntos de cambio de arriba, se extrae una función interna a `push.ts`:

```ts
/**
 * Un paso de 1 casilla de una caminata marrón en curso -- misma lógica de
 * cruce de borde que `stepUntilBlocked` (move-step.ts) ya usaba internamente,
 * ahora expuesta para poder repartirse entre llamadas sucesivas a applyImpact
 * en vez de vivir en un único bucle síncrono (research.md Decisión 2/4).
 * Nunca decide si la casilla resultante está ocupada -- eso lo resuelve quien
 * llama, releyendo el tablero real (o la cola) con el `to` ya actualizado.
 */
function stepWalking(
  from: Coordinate,
  direction: Direction,
  edgeCrossingsSoFar: number,
): { to: Coordinate; edgeCrossings: number; capped: boolean } {
  const raw = step(from, direction);
  const crossedEdge = !isInBounds(raw);
  const edgeCrossings = edgeCrossingsSoFar + (crossedEdge ? 1 : 0);
  return { to: wrapCoordinate(raw), edgeCrossings, capped: edgeCrossings >= MAX_EDGE_CROSSINGS };
}
```

Usada en ambos puntos de cambio: la construcción inicial de un `nextSite` marrón usa
`stepWalking(site.to, site.direction, 0)`; la rama `defender === null` de un site ya `walking` usa
`stepWalking(site.to, site.direction, site.walking.edgeCrossings)`. Si `capped` es `true`, se
asienta en vez de continuar (mismo límite ya existente).

## `applyMutualImpact`/`resolveMutualSide` (`src/engine/pieces/push.ts`) -- mismo cambio, en el lado heredado

`resolveMutualSide`'s `pushOnward` callback (llamado una vez por lado, con la dirección/color del
OTRO lado ya resueltos) cambia para producir `walking` cuando el mecanismo heredado es marrón:

```ts
const nextA = resolveMutualSide(siteA.piece.fragility, siteA.piece.color, siteA.to, (hit) => {
  if (siteB.piece.color === 'brown') {
    const { to, edgeCrossings } = stepWalking(siteA.to, siteB.direction, 0);
    return { direction: siteB.direction, to, pushedByColor: 'brown', walking: { edgeCrossings } };
  }
  return {
    direction: siteB.direction,
    to: PUSH_STRATEGY[siteB.piece.color as Exclude<PieceColor, 'red'>](board, hit, siteA.to, siteB.direction),
    pushedByColor: siteB.piece.color,
  };
});
// nextB simétrico, con A y B intercambiados.
```

`resolveMutualSide`'s propio tipo de retorno (`ImpactSite | null`) y su `pushOnward` callback
ganan `walking?` como campo opcional en el objeto que devuelven, hilvanado directamente al
`ImpactSite` resultante -- sin cambiar la lógica de `resolveMutualSide` en sí (sigue siendo "si ya
está rota, desaparece; si no, avanza fragilidad y construye el siguiente site").

## Sin cambios

- `resolveChain`/`findCoincidingPair` (`events.ts`): ninguno. Ya comparan `to` y ya exigen casilla
  vacía -- funcionan idénticamente sobre un `to` tentativo o uno final.
- `MoveStepEvent`/`AnnihilationEvent`/`EventLog`: ninguno.
- `src/renderer/launch-animation.ts`: ninguno -- sigue leyendo `from`/`to`/`direction` de cada
  evento FINAL exactamente igual; los valores que recibe ahora son correctos, no una forma
  distinta de recibirlos.
- `tools/generator/`: ninguno -- el generador invierte push de marrón hacia atrás mediante
  `inverseCandidates('brown', ...)`, que ya calcula candidatos de ORIGEN para un DESTINO final ya
  decidido (una operación puramente matemática sobre el tablero ya construido hasta ese punto,
  nunca sobre una caminata en curso) -- no interactúa con `site.walking` en absoluto, porque el
  generador nunca ejecuta `resolveChain`/`applyImpact` durante la construcción hacia atrás, solo
  durante `validatesForward` (reproducción con el motor real, que si usa el nuevo camino, pero de
  forma transparente).
- `PUSH_STRATEGY['green']`/`PUSH_STRATEGY['orange']`: ninguno.

## Escenario de verificación (para quickstart.md)

Nivel 2 modificado a mano (`levels/2.json`): brown en `(5,5)`, green en `(5,4)` y `(5,6)`. Rojo
lanzado hacia el norte o el sur en el carril 5 debe producir, con el motor corregido, un evento de
`ANNIHILATION` en `(5,1)` con `color: 'green'` -- las dos fichas verdes desaparecen exactamente en
la columna 1, coincidiendo con el punto medio geométrico derivado a mano en research.md, Decisión 0.
