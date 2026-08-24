# Phase 0 Research: Ficha Roja (Ramificación)

## Decisión: `resolveSplit`/`resolveBranch`, invocados desde `resolveStrike` cuando `strikerColor === 'red'`

- **Decisión**: en `resolveStrike`, después de la comprobación de mismo color (que sigue
  teniendo prioridad, sin cambios), se añade: `if (strikerColor === 'red') { return
  resolveSplit(board, defender.color, position, direction); }` — antes de la línea que hoy
  calcula `to` vía `PUSH_STRATEGY[strikerColor]`. Rojo nunca llega a esa línea.
- **Rationale**: mantiene intacta la única rama que verde/naranja/marrón comparten
  (`PUSH_STRATEGY` + comprobación de ocupación en `to`), sin ensuciarla con una rama de lista de
  destinos. Ver plan.md → justificación Principio V.

## `PERPENDICULAR_DIRECTIONS`

```ts
const PERPENDICULAR_DIRECTIONS: Record<Direction, [Direction, Direction]> = {
  N: ['E', 'O'],
  S: ['E', 'O'],
  E: ['N', 'S'],
  O: ['N', 'S'],
};
```

Directo del documento de diseño (sección 10) y de spec.md FR-003/FR-005: el eje de impacto
(vertical N/S, horizontal E/O) determina el eje de las ramas (el otro), y dentro de ese eje el
orden es siempre E-antes-que-O o N-antes-que-S, sin importar si el impacto concreto fue N o S
(ambos dan el mismo par ordenado) ni si fue E u O (ídem).

## Diseño de `resolveBranch` — y un bug que se encontró y corrigió durante el propio diseño

Primera versión (incorrecta) probada mentalmente contra un caso con cascada:

```ts
// INCORRECTO -- no coloca la propia ficha de la rama en el caso "ocupado"
function resolveBranch(board, color, from, direction) {
  const to = stepBy(from, direction, 1);
  const occupant = getPieceAt(board, to);
  if (occupant === null) {
    return { board: setPieceAt(board, to, { color }), events: [...] };
  }
  const next = resolveStrike(board, color, to, direction); // <- next.board nunca tiene
                                                              //    una ficha `color` en `to`
  return { board: next.board, events: [...] };
}
```

Al trazar a mano un caso de 3 fichas (rojo divide una verde, y la rama que golpea a una naranja
más allá debía dejar la propia ficha verde asentada donde estaba la naranja), la ficha verde de
esa rama desaparecía del tablero final — `resolveStrike(board, color, to, direction)` resuelve
correctamente qué le pasa a QUIEN ESTÁ en `to` (la naranja, empujada), pero nunca coloca a quien
la golpeó (la ficha `color` de esta rama) en la posición que esa naranja deja libre — eso, en el
resto del motor, siempre lo hace el NIVEL DE LLAMADA de `resolveStrike`
(`setPieceAt(clearedPosition, to, defender)`), no `resolveStrike` en sí. `resolveBranch` actúa
como ese nivel de llamada para su propia rama, así que tiene que replicar exactamente ese mismo
paso:

```ts
function resolveBranch(board: Board, color: PieceColor, from: Coordinate, direction: Direction) {
  const to = stepBy(from, direction, 1);
  const piece: Piece = { color };
  const occupant = getPieceAt(board, to);

  if (occupant === null) {
    const boardAfter = setPieceAt(board, to, piece);
    return { board: boardAfter, events: [{ type: 'MOVE_STEP', piece, from, to, hasCollision: false }] };
  }

  const next = resolveStrike(board, color, to, direction);
  const boardAfter = next.annihilated ? next.board : setPieceAt(next.board, to, piece);
  return {
    board: boardAfter,
    events: [{ type: 'MOVE_STEP', piece, from, to, hasCollision: true }, ...next.events],
  };
}
```

La condición `next.annihilated ? next.board : setPieceAt(next.board, to, piece)` es literalmente
la misma que ya usa `resolveStrike` para su propio `defender` — la única diferencia es que aquí
`piece` es una ficha recién construida (una de las dos mitades de la división), no una que ya
existiera en el tablero.

## Hallazgo: quién se asienta en la casilla que deja la división se obtiene gratis

- **Hallazgo**: `resolveSplit` limpia `position` (la casilla donde estaba la ficha dividida) y
  devuelve `annihilated: false`. Quien haya llamado a `resolveStrike(..., 'red', position, ...)`
  — ya sea `applyImpact` (si rojo fue la ficha lanzada, que entonces nunca se asienta, spec.md
  006) o el nivel de cascada anterior (si rojo llegó empujado hasta ahí) — coloca a la propia
  ficha roja en `position` exactamente con el mismo `setPieceAt(clearedPosition, to, defender)`
  que ya existe para cualquier empuje normal, sin ningún cambio adicional. Verificado a mano
  con un caso de 2 niveles: naranja lanzada empuja a rojo, que aterriza sobre una ficha verde y
  la divide — rojo termina asentada donde estaba la verde, la naranja lanzada no se asienta en
  ningún sitio, ambas cosas sin tocar ni una línea fuera de `resolveSplit`/`resolveBranch`.
- **Rationale**: es la razón última de por qué el Principio V se sostiene aquí pese a introducir
  un primitivo nuevo — el primitivo nuevo está estrictamente contenido a "qué le pasa a la ficha
  golpeada", nunca a "qué le pasa a quien golpea", que sigue gobernado íntegramente por la
  recursión ya existente.

## Decisión: no se añade protección explícita contra recursión infinita en la ramificación

- **Decisión**: si una rama golpea a OTRA ficha roja, esa ficha roja también se divide (el
  chequeo `strikerColor === 'red'` se aplica en cada nivel de recursión, sin distinguir si es la
  ficha lanzada o el producto de una división anterior) — no se limita la profundidad de
  ramificaciones anidadas en esta feature.
- **Rationale**: construir un ciclo genuino de ramificaciones infinitas requeriría un diseño de
  nivel muy deliberado (varias fichas rojas dispuestas para reactivarse entre sí en bucle) — el
  propio documento de diseño del juego ya asume esto explícitamente como responsabilidad del
  diseño de niveles por ahora ("las reglas de diseño de niveles deberán evitar estos casos
  inicialmente, aunque el motor puede incorporar protecciones técnicas", sección 11), igual que
  ya se decidió para el límite de vuelta única de marrón (spec.md 008) — pero ahí SÍ hacía falta
  protección porque CUALQUIER fila/columna despejada ya lo disparaba, sin necesitar un diseño
  deliberado. Aquí no hay ese mismo riesgo por defecto.
- **Alternatives considered**: un contador de profundidad máxima de ramificación (análogo al
  `maxEdgeCrossings` de marrón) — descartado por prematuro: no hay un escenario natural (sin
  diseño deliberado) que lo dispare, a diferencia de marrón.

## Decisión: no se testea el orden de las dos ramas de forma aislada — se cubre por determinismo

- **Decisión**: no se construye un fixture que demuestre observablemente "si el orden fuera al
  revés, el resultado cambiaría" (SC-003 se cubre en su lugar con un test de determinismo, igual
  patrón que `determinism.test.ts` de la feature 001: mismo nivel + mismo lanzamiento, dos veces,
  mismo resultado).
- **Rationale**: las dos ramas se mueven en direcciones opuestas a lo largo del MISMO eje desde
  el MISMO origen — sus propias cadenas nunca pueden compartir una casilla salvo completando
  wrap-around suficiente para encontrarse por el lado opuesto del tablero, algo que ninguna de
  las dos ramas hace por sí sola con un único paso más una cascada razonable. Construir un
  fixture que sí lo lograra necesitaría una cadena de piezas tan larga como la usada para
  estudiar el caso `isSelf` de marrón, para demostrar algo que ya es una consecuencia directa
  del propio diseño secuencial (documentado como limitación deliberada en spec.md, no algo que
  necesite una prueba positiva de que "importa").
- **Alternatives considered**: forzar un cruce vía wrap-around con una cadena larga de piezas —
  descartado por la misma razón que se descartó en marrón/006: la complejidad de construirlo no
  aporta nada que el determinismo genérico no demuestre ya.
