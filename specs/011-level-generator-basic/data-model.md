# Phase 1 Data Model: Generador de Niveles por Construcción Inversa (verde/naranja/marrón)

## Tipos (`tools/generator/obligations.ts`, `tools/generator/generate.ts`)

```ts
import type { Board, Coordinate, Direction, Piece, PieceColor } from '../../src/engine/board.js';

export type ObligationKind = 'defender' | 'striker-origin';

export type Obligation = {
  cell: Coordinate;
  color: PieceColor;
  kind: ObligationKind;
  direction: Direction | null; // heredada del paso que la creó si kind==='striker-origin'; null si 'defender'
  chainDepth: number; // solo relevante para 'striker-origin' -- tope de profundidad (research.md)
};

export type SolutionStep = { direction: Direction; lane: number; pieceIndex: number };

export type GenerationParams = {
  launchCount: number; // FR-008
  availableColors: PieceColor[]; // subconjunto de ['green','orange','brown']
  chainOriginProbability: number; // FR-005: prob. de que el origen de un golpeador sea cadena, no mano
  decoyCount: number; // FR-008
  seed: number; // FR-008/FR-009
  // Parámetros internos con valor por defecto, no listados como obligatorios en spec.md:
  defenderContinuationProbability?: number; // por defecto 0.4 (research.md)
  maxChainDepth?: number; // por defecto 4 (research.md)
  maxGenerationAttempts?: number; // por defecto 200 (research.md)
};

export type GeneratedLevel = {
  pieces: { at: Coordinate; color: PieceColor }[];
  hand: PieceColor[];
  goal: { color: PieceColor; cell: Coordinate };
  solution: SolutionStep[]; // en orden de juego real (FR-010)
  params: GenerationParams;
};

export type GenerationResult =
  | { ok: true; level: GeneratedLevel }
  | { ok: false; attemptsUsed: number }; // se agotó maxGenerationAttempts (edge case de spec.md)
```

## El algoritmo, resumido (ver research.md para el porqué de cada regla)

1. Con el `rng` inyectado: elegir color de objetivo y casilla de objetivo (cualquier color
   disponible, cualquier casilla del tablero 8×8).
2. Encolar la obligación inicial `{cell: objetivo, color: colorObjetivo, kind: 'defender',
   direction: null, chainDepth: 0}`. Esta obligación SIEMPRE se resuelve con un empuje (nunca
   mobiliario) — garantiza al menos 1 lanzamiento.
3. Mientras la cola no esté vacía, sacar una obligación y resolverla:
   - **`kind: 'defender'`**: si `launchesUsed >= launchCount`, o si el sorteo con
     `defenderContinuationProbability` así lo decide, cerrar como mobiliario inicial (colocar la
     ficha en el tablero en construcción). Si no, resolver con un empuje (paso 4).
   - **`kind: 'striker-origin'`**: nunca mobiliario. Si `chainDepth >= maxChainDepth`, o el sorteo
     con `1 - chainOriginProbability` así lo decide, cerrar como lanzamiento de mano (registrar un
     `SolutionStep`, incrementar `launchesUsed`, comprobar camino despejado desde el borde). Si
     no, resolver con un empuje (paso 4), reutilizando la MISMA `direction` heredada.
4. Resolver con un empuje: elegir un color de golpeador `S ≠ color de la obligación` (dentro de
   `availableColors`); si la obligación es `'defender'`, elegir además una dirección `D` nueva al
   azar (si es `'striker-origin'`, `D` es la heredada, sin elegir nada nuevo). Calcular la casilla
   de origen `X`:
   - Verde/naranja: único candidato (retroceder 1/2 casillas con wrap-around).
   - Marrón, si la casilla de llegada debe quedar VACÍA (obligación `'defender'` o el objetivo):
     solo válido si la casilla de llegada es el borde lejano del carril en dirección `D`; `X`
     puede ser cualquier casilla de ese carril con camino despejado hacia ella.
   - Marrón, si la casilla de llegada ya está ocupada (obligación `'striker-origin'`, donde la
     casilla de llegada es la de la obligación que se está resolviendo): `X` es cualquier
     candidato del conjunto con camino despejado hacia esa casilla ya ocupada.
   Si ningún candidato es válido con los colores disponibles, la obligación no puede resolverse —
   contribuye a que este intento de generación falle (paso 6).
   Encolar dos obligaciones independientes: el defensor `{cell: X, color: color de la obligación
   resuelta, kind: 'defender', direction: null, chainDepth: 0}`, y el origen del golpeador
   `{cell: X, color: S, kind: 'striker-origin', direction: D, chainDepth: chainDepth+1}` — ambas
   en la MISMA casilla `X` (donde ocurre el golpe), pero cada una rastrea la historia de un color
   distinto (el defensor `C`, el golpeador `S`) y se resuelve de forma completamente
   independiente en un ciclo posterior del bucle (paso 3).
5. Al vaciar la cola: revertir el orden de los `SolutionStep` recogidos (se descubren en orden
   inverso al de juego real — el primero descubierto es el ÚLTIMO lanzamiento real) y asignar a
   cada uno el `pieceIndex` correspondiente a su posición en la mano final.
6. Reproducir la traza completa con el motor real (`resolveLaunch` en cada paso, en el orden ya
   corregido). Si el resultado final no coincide exactamente (mismo tablero, `result: 'won'`),
   descartar TODO el intento y empezar de nuevo desde el paso 1 (spec.md FR-007), hasta
   `maxGenerationAttempts`.
7. Si es válido: añadir `decoyCount` fichas señuelo al final de la mano (colores aleatorios de
   `availableColors`, sin afectar los `pieceIndex` ya asignados a los pasos de la solución —
   research.md, "se añaden al final").

## Fixtures (verificadas a mano con una fuente de aleatoriedad guionizada, no el PRNG real)

Todas usan una función `rng` de prueba que devuelve una secuencia fija de valores conocidos, para
poder verificar el resultado exacto sin depender de mulberry32 (research.md, "inyección de
aleatoriedad").

**1. Un único lanzamiento, verde, sin cascada** (US1 AC1):
- Parámetros: `launchCount:1`, `availableColors:['green']`, `seed` irrelevante (rng guionizado).
- Guion: objetivo = `(4,4)`, color `green`. Golpeador del objetivo: `green` es el único
  disponible, dirección `E`. `X = inverse-green(E,(4,4)) = (4,3)`. Obligación defensor `(4,3,
  green)` → cierra como mobiliario (guionizado, ya que `launchCount` es 1). Origen del golpeador
  verde: dirección heredada `E`, cierra como lanzamiento de mano — carril 4, camino despejado
  desde el borde hasta `(4,3)` (nada colocado ahí todavía).
- Resultado esperado: `pieces:[{at:{row:4,col:3},color:'green'}]`, `hand:['green']`,
  `goal:{color:'green',cell:{row:4,col:4}}`, `solution:[{direction:'E',lane:4,pieceIndex:0}]`.
  Reproducido con `resolveLaunch`: entra en `(4,0)`, viaja hasta `(4,3)`, empuja a `(4,4)` (vacía)
  → `result:'won'`. Coincide exactamente con la forma del nivel 1 del prototipo.

**2. Un único lanzamiento, marrón, modo "asentamiento directo"** (US1 AC2 — el caso que expone
por qué marrón solo puede aterrizar en el borde lejano):
- Parámetros: `launchCount:1`, `availableColors:['brown']`.
- Guion: objetivo = `(2,7)` [borde lejano del carril 2 en dirección E], color `orange`. Golpeador:
  `brown` (único disponible), dirección `E`. Como la casilla de llegada debe quedar vacía, se usa
  el modo "asentamiento directo" de marrón — válido porque `(2,7)` ES el borde lejano de su
  carril. `X` elegido: `(2,3)` (cualquier casilla del carril con camino despejado sirve; el guion
  elige esta). Obligación defensor `(2,3, orange)` → mobiliario. Origen del golpeador marrón:
  dirección heredada `E`, cierra como lanzamiento de mano — carril 2, camino despejado desde el
  borde hasta `(2,3)`.
- Resultado esperado: `pieces:[{at:{row:2,col:3},color:'orange'}]`, `hand:['brown']`,
  `goal:{color:'orange',cell:{row:2,col:7}}`, `solution:[{direction:'E',lane:2,pieceIndex:0}]`.
  Reproducido: marrón camina desde `(2,3)` sin toparse con nada, se detiene en el borde lejano
  `(2,7)` → `result:'won'`. Misma forma que el nivel 12 del prototipo.

**3. Un lanzamiento con cascada de dos eslabones** (US1 AC3 — ejercita la obligación de origen
del golpeador como una obligación propia, distinta e independiente de la del defensor):
- Parámetros: `launchCount:1`, `availableColors:['green','orange']`.
- Guion:
  1. Objetivo = `(6,4)`, color `green`.
  2. Se resuelve con golpeador `orange`, dirección `E`. `X = inverse-orange(E,(6,4)) = (6,2)`.
     Se encolan dos obligaciones independientes: defensor `(6,2, green)`, y origen del golpeador
     `orange` (misma casilla `(6,2)` donde ocurre el golpe, dirección heredada `E`).
  3. Defensor `(6,2, green)`: cierra directamente como mobiliario — coincide con el green real,
     ya sentado ahí desde el principio, sin necesitar ningún empuje propio.
  4. Origen del golpeador `orange`: el guion decide CONTINUACIÓN (no mano todavía). Golpeador
     previo elegido: `green` (≠ `orange`, la propia obligación en curso), misma dirección `E`.
     `X = inverse-green(E, (6,2)) = (6,1)`. Se encolan: defensor `(6,1, orange)` — mobiliario
     (coincide con el orange real) — y origen del golpeador `green`: dirección heredada `E`,
     cierra como lanzamiento de mano — carril 6, camino despejado desde el borde hasta `(6,1)`.
- Resultado esperado: `pieces:[{at:{row:6,col:1},color:'orange'},{at:{row:6,col:2},color:'green'}]`,
  `hand:['green']`, `goal:{color:'green',cell:{row:6,col:4}}`,
  `solution:[{direction:'E',lane:6,pieceIndex:0}]`. Reproducido: verde golpea orange@(6,1),
  orange empujado por verde (distancia 1) a `(6,2)`, ocupada por green → orange (ahora golpeador,
  su propia distancia 2) empuja green a `(6,4)` (vacía) → green se asienta ahí; orange se asienta
  en `(6,2)` (vacada por green) → `result:'won'`. Coincide exactamente con la forma del nivel 8
  del prototipo — la misma traza que ya está verificada por `prototype-levels.test.ts`.

## Verificación cruzada

Las tres fixtures, deliberadamente, reproducen la FORMA exacta de niveles ya existentes y ya
verificados del prototipo (1, 12, y 8) — no es casualidad: es la forma más fiable de confirmar
que el algoritmo de construcción inversa es correcto, comparándolo contra niveles cuya
resolubilidad ya está probada de forma independiente por `prototype-levels.test.ts`.
