import type { Board, Coordinate, Fragility, PieceColor } from '../../src/engine/board.js';
import { getPieceAt, setPieceAt } from '../../src/engine/board.js';
import { opposite, step, stepBy, type Direction } from '../../src/engine/move-step.js';
import { inverseCandidates, type InverseContext } from './inverses.js';
import { assignGroupFragility, type FragilityProfile } from './fragility.js';

export type ObligationKind = 'defender' | 'striker-origin';

export type Obligation = {
  cell: Coordinate;
  color: PieceColor;
  kind: ObligationKind;
  direction: Direction | null; // heredada si kind==='striker-origin'; null si 'defender'
  chainDepth: number; // solo relevante para 'striker-origin' (research.md, tope de profundidad)
  isRoot?: boolean; // la obligación del objetivo -- SIEMPRE se resuelve con un empuje
  // 017-striker-visibility-gap: cierto solo para una obligación 'striker-origin' de
  // marrón creada a partir de un contexto 'settle' -- un asentamiento limpio de
  // marrón (sin obstáculo real de por medio) solo es alcanzable si ESTE golpeador
  // concreto nunca llega a asentarse (research.md, Decisión 4: el hueco de
  // visibilidad corregido hace que un golpeador real SIEMPRE choque consigo mismo
  // tras una vuelta completa, para cualquier distancia). Cuando esta obligación se
  // resuelve, se fuerza el lanzamiento directo desde mano (nunca una cadena) con
  // fragilidad 'broken'.
  mustBeBroken?: boolean;
  // 020-generator-red-support: forces this 'defender' obligation to resolve
  // as furniture, skipping the defenderContinuationProbability draw entirely
  // (checked BEFORE it, short-circuited, same discipline as mustBeBroken --
  // zero new rng() calls for any case that doesn't use red). Its only use:
  // the pre-split defender D, which FR-002 requires to always be 'new' --
  // 'cracked' would make both resulting branches BROKEN (FR-015 of
  // 009-red-piece), never settling.
  forceFurniture?: boolean;
  // 020-generator-red-support: overrides the 'new' default fragility used
  // when a 'defender' obligation resolves as furniture. Its only use: a red
  // split's secondary branch, which shares the split's already-advanced
  // fragility ('cracked', since D is forced 'new' -- research.md Decisión 5)
  // rather than the free 'new' any other furniture piece gets.
  furnitureFragility?: Fragility;
  // 026-generator-black-decoys: presente solo en una obligación 'striker-origin'
  // cuyo eventual lanzamiento de mano es responsable de empujar una ficha hasta
  // ESTA celda (la del 'defender' padre que la originó) -- permite, cuando esa
  // obligación resuelve por lanzamiento directo (chooseHand), registrar un
  // LandingCell candidato para la Estrategia B (research.md Decisión 3/6).
  explainsLandingAt?: Coordinate;
};

export type RawLaunch = {
  direction: Direction;
  lane: number;
  color: PieceColor;
  // 017-striker-visibility-gap: presente solo cuando mustBeBroken forzó este
  // lanzamiento -- generate.ts lo usa para anular la fragilidad normal (siempre
  // NEW/CRACKED para fichas de la solución) únicamente en este caso.
  forcedFragility?: 'broken';
  // 026-generator-black-decoys, research.md Decisión 2: la celda exacta contra
  // la que este lanzamiento impacta -- ya conocida en el momento en que se
  // descubre. Necesaria para que la Estrategia A (proteger el carril de
  // aproximación) sepa dónde termina, sin volver a recorrer el tablero.
  target: Coordinate;
};

// 026-generator-black-decoys, research.md Decisión 3: una celda de aterrizaje
// candidata para la Estrategia B -- una celda donde, según la solución ya
// construida, una ficha se asienta como resultado de un empuje anterior.
// `launchIndex` apunta al lanzamiento de mano (en `rawLaunches`) responsable de
// ese empuje -- solo se registra cuando ese striker resuelve por lanzamiento
// directo (research.md Decisión 6, alcance v1: nunca cuando es él mismo el
// eslabón de una cadena más profunda).
export type LandingCell = {
  cell: Coordinate;
  launchIndex: number;
};

export type ResolutionContext = {
  board: Board;
  rng: () => number;
  availableColors: PieceColor[];
  launchCount: number;
  defenderContinuationProbability: number;
  chainOriginProbability: number; // FR-005: prob. de que el origen de un golpeador sea cadena
  maxChainDepth: number;
  // Probabilidad de colocar una ficha señuelo extra en el tablero, sorteada de
  // nuevo en CADA paso de construcción (a diferencia de las señuelo en mano,
  // cuya cantidad es fija -- ver research.md). Opcional y con valor por defecto
  // 0 para no alterar ninguna secuencia de `rng` ya existente cuando no se pide.
  boardDecoyProbability?: number;
  // 013-generator-fragility-difficulty: gobierna la fragilidad de los señuelos
  // de tablero (nunca la de fichas de tablero golpeadas por la solución, que
  // siempre parten de 'new' -- FR-001/FR-002).
  fragilityProfile?: FragilityProfile;
};

export type ResolutionOutcome = {
  board: Board;
  rawLaunches: RawLaunch[]; // en orden de DESCUBRIMIENTO -- el llamador las invierte (data-model.md)
  // 026-generator-black-decoys, research.md Decisión 3: candidatas para la
  // Estrategia B, en el orden en que se descubrieron. La seguridad de usar
  // cualquiera de ellas se decide reproduciendo la solución candidata con el
  // motor real (validatesForward, generate.ts) -- no hace falta ningún
  // registro de señuelos separado (research.md Decisión 4, revisada).
  landingCells: LandingCell[];
  ok: boolean;
};

const DIRECTIONS: Direction[] = ['N', 'S', 'E', 'O'];

function pickDirection(rng: () => number): Direction {
  return DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)];
}

/**
 * 020-generator-red-support: the inverse of push.ts's own PERPENDICULAR_DIRECTIONS
 * (which maps a red strike's own direction to its two branch directions) --
 * given a KNOWN branch direction, which red strike directions could have
 * produced it. Both entries for a given branch direction always yield the SAME
 * branch pair (research.md Decisión 7), so which one gets picked doesn't affect
 * the secondary branch's own direction (always `opposite(direction)`). Defined
 * locally rather than imported/exported from the engine -- same established
 * precedent as entryCoordinate below, a tiny stable mapping duplicated instead
 * of touching src/engine/ (FR-008).
 */
const RED_STRIKE_DIRECTIONS_FOR_BRANCH: Record<Direction, [Direction, Direction]> = {
  E: ['N', 'S'],
  O: ['N', 'S'],
  N: ['E', 'O'],
  S: ['E', 'O'],
};

function pickRandomEmptyCell(board: Board, rng: () => number): Coordinate | null {
  const empty: Coordinate[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (getPieceAt(board, { row, col }) === null) empty.push({ row, col });
    }
  }
  return empty.length === 0 ? null : empty[Math.floor(rng() * empty.length)];
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Picks a striker color (never the same as `obligationColor`, research.md) and one
 * of its valid inverse candidates for landing on `to`. Tries every available color
 * in random order and returns the first that has at least one valid candidate --
 * `null` if none work (contributes to the whole generation attempt failing,
 * spec.md FR-007).
 */
export function chooseStrikerAndOrigin(
  obligationColor: PieceColor,
  direction: Direction,
  to: Coordinate,
  board: Board,
  availableColors: PieceColor[],
  context: InverseContext,
  rng: () => number,
): { striker: PieceColor; origin: Coordinate } | null {
  const candidates = availableColors.filter((color) => color !== obligationColor);
  const order = shuffle(candidates, rng);

  for (const striker of order) {
    // 023-black-piece-line-clear/024-rainbow-color-change/025-purple-attraction-piece
    // deliberately do NOT add generator support for negro/arcoíris/púrpura
    // (out of scope, each feature's own plan.md -- same sequential pattern as
    // 009-red-piece's own engine-only spec, followed later by
    // 020-generator-red-support) -- `InverseColor` (inverses.ts) has no
    // 'black'/'rainbow'/'purple' entry, so skip all three here rather than
    // widen that type to colors this generator can't yet invert.
    // `availableColors` never actually contains any of them today (no caller
    // offers them), so this is a defensive no-op in practice, not a real
    // behavior change.
    if (striker === 'black' || striker === 'rainbow' || striker === 'purple') continue;
    const origins = inverseCandidates(striker, direction, to, board, context);
    if (origins.length > 0) {
      const origin = origins[Math.floor(rng() * origins.length)];
      return { striker, origin };
    }
  }
  return null;
}

function laneOf(cell: Coordinate, direction: Direction): number {
  return direction === 'E' || direction === 'O' ? cell.row : cell.col;
}

/** Mirrors launch.ts's private entryCoordinate -- same tiny, stable mapping. */
function entryCoordinate(direction: Direction, lane: number): Coordinate {
  switch (direction) {
    case 'N':
      return { row: 7, col: lane };
    case 'S':
      return { row: 0, col: lane };
    case 'E':
      return { row: lane, col: 0 };
    case 'O':
      return { row: lane, col: 7 };
  }
}

/**
 * Whether a hand launch, entering the board and travelling in `direction`, would
 * reach `to` without hitting anything else first -- travelLaunch's own semantics
 * (research.md, "camino despejado desde el borde"), independent of any color.
 */
function clearPathFromEdge(board: Board, to: Coordinate, direction: Direction): boolean {
  const lane = laneOf(to, direction);
  let current = entryCoordinate(direction, lane);
  while (!(current.row === to.row && current.col === to.col)) {
    if (getPieceAt(board, current) !== null) return false;
    current = step(current, direction);
  }
  return true;
}

export function resolveObligations(initial: Obligation, ctx: ResolutionContext): ResolutionOutcome {
  let board = ctx.board;
  let launchesUsed = 0;
  const rawLaunches: RawLaunch[] = [];
  const landingCells: LandingCell[] = [];
  const queue: Obligation[] = [initial];

  // 013-generator-fragility-difficulty: el estado compartido de 'easy' se
  // sortea una sola vez, la primera vez que se coloca un señuelo de tablero
  // dentro de ESTE intento, y se reutiliza para el resto (research.md,
  // Decisión 3) -- nunca escapa de esta llamada a resolveObligations.
  let cachedEasyBoardDecoyFragility: Fragility | undefined;
  const BOARD_DECOY_ALLOWED_STATES: readonly Fragility[] = ['new', 'cracked']; // FR-008: nunca BROKEN

  function pickBoardDecoyFragility(): Fragility {
    if (ctx.fragilityProfile === undefined) return 'new'; // cero rng() nuevas cuando no se pide
    if (ctx.fragilityProfile === 'easy') {
      if (cachedEasyBoardDecoyFragility === undefined) {
        cachedEasyBoardDecoyFragility = assignGroupFragility('easy', 1, BOARD_DECOY_ALLOWED_STATES, ctx.rng)[0];
      }
      return cachedEasyBoardDecoyFragility;
    }
    return assignGroupFragility(ctx.fragilityProfile, 1, BOARD_DECOY_ALLOWED_STATES, ctx.rng)[0];
  }

  while (queue.length > 0) {
    const obligation = queue.shift()!;

    // Ficha señuelo de tablero: se sortea de nuevo en cada paso (a diferencia de
    // las señuelo en mano, que son una cantidad fija) -- el `>0` evita consumir
    // ningún `rng()` cuando no se pide, para no alterar ninguna secuencia ya
    // existente (research.md, misma disciplina que el resto del generador). Una
    // colisión con una casilla que otra obligación aún pendiente necesita se
    // resuelve como cualquier otra inconsistencia: la reproducción hacia
    // delante la descarta y el intento entero se reintenta (FR-007).
    const boardDecoyProbability = ctx.boardDecoyProbability ?? 0;
    if (boardDecoyProbability > 0 && ctx.rng() < boardDecoyProbability) {
      const cell = pickRandomEmptyCell(board, ctx.rng);
      if (cell !== null) {
        const color = ctx.availableColors[Math.floor(ctx.rng() * ctx.availableColors.length)];
        board = setPieceAt(board, cell, { color, fragility: pickBoardDecoyFragility() });
      }
    }

    if (obligation.kind === 'defender') {
      if (!obligation.isRoot) {
        const mustFurniture = obligation.forceFurniture || launchesUsed >= ctx.launchCount;
        const chooseFurniture = mustFurniture || ctx.rng() >= ctx.defenderContinuationProbability;
        if (chooseFurniture) {
          board = setPieceAt(board, obligation.cell, {
            color: obligation.color,
            fragility: obligation.furnitureFragility ?? 'new',
          });
          continue;
        }
      }

      const direction = pickDirection(ctx.rng);
      const resolved = chooseStrikerAndOrigin(
        obligation.color,
        direction,
        obligation.cell,
        board,
        ctx.availableColors,
        'settle',
        ctx.rng,
      );
      if (resolved === null) return { board, rawLaunches, landingCells, ok: false };

      // 020-generator-red-support: a red split explains obligation.cell
      // completely differently -- three new obligations instead of the usual
      // two (research.md, "Resumen del algoritmo de inversión").
      if (resolved.striker === 'red') {
        const [brA, brB] = RED_STRIKE_DIRECTIONS_FOR_BRANCH[direction];
        const redStrikeDirection = ctx.rng() < 0.5 ? brA : brB;
        const secondaryDirection = opposite(direction);
        const landingCell = stepBy(resolved.origin, secondaryDirection, 1);

        queue.push({
          cell: resolved.origin,
          color: obligation.color,
          kind: 'defender',
          direction: null,
          chainDepth: 0,
          forceFurniture: true,
        });
        queue.push({
          cell: resolved.origin,
          color: 'red',
          kind: 'striker-origin',
          direction: redStrikeDirection,
          chainDepth: 0,
        });
        queue.push({
          cell: landingCell,
          color: obligation.color,
          kind: 'defender',
          direction: null,
          chainDepth: 0,
          furnitureFragility: 'cracked',
        });
        continue;
      }

      queue.push({
        cell: resolved.origin,
        color: obligation.color,
        kind: 'defender',
        direction: null,
        chainDepth: 0,
      });
      queue.push({
        cell: resolved.origin,
        color: resolved.striker,
        kind: 'striker-origin',
        direction,
        chainDepth: 0,
        // 017-striker-visibility-gap: solo marrón, en contexto 'settle', necesita
        // este mecanismo -- verde/naranja nunca miran el tablero (su distancia es
        // fija), así que su asentamiento limpio ya era y sigue siendo alcanzable
        // con un golpeador real.
        mustBeBroken: resolved.striker === 'brown',
        // 026-generator-black-decoys: si este striker resuelve por lanzamiento
        // directo, ES el empuje que llena obligation.cell -- candidato a
        // LandingCell para la Estrategia B.
        explainsLandingAt: obligation.cell,
      });
      continue;
    }

    // kind === 'striker-origin': never furniture.
    // 017-striker-visibility-gap: mustBeBroken siempre se resuelve por lanzamiento
    // directo -- nunca por cadena (no hay forma de garantizar que una ficha a mitad
    // de cadena llegue exactamente BROKEN a este golpe concreto) -- así que se
    // comprueba ANTES del sorteo de chainOriginProbability, sin consumir su rng()
    // (research.md, Decisión 4): ningún fixture existente puede activar esta rama,
    // así que esto no cambia el conteo de llamadas a rng() de ningún caso ya cubierto.
    const forceHand = obligation.mustBeBroken || obligation.chainDepth >= ctx.maxChainDepth;
    const chooseHand = forceHand || ctx.rng() >= ctx.chainOriginProbability;

    if (chooseHand) {
      if (launchesUsed >= ctx.launchCount) return { board, rawLaunches, landingCells, ok: false };
      if (!clearPathFromEdge(board, obligation.cell, obligation.direction!)) {
        return { board, rawLaunches, landingCells, ok: false };
      }
      rawLaunches.push({
        direction: obligation.direction!,
        lane: laneOf(obligation.cell, obligation.direction!),
        color: obligation.color,
        forcedFragility: obligation.mustBeBroken ? 'broken' : undefined,
        target: obligation.cell,
      });
      if (obligation.explainsLandingAt !== undefined) {
        landingCells.push({ cell: obligation.explainsLandingAt, launchIndex: rawLaunches.length - 1 });
      }
      launchesUsed++;
      continue;
    }

    // 020-generator-red-support: red is never tried here -- explaining how an
    // already-known striker itself started moving via a red split (a striker
    // that is itself a split branch) is deliberately out of scope
    // (research.md Decisión 4). inverseCandidates('red', ..., 'occupied')
    // already returns [] too (belt and braces); filtering it out of the
    // candidate list here documents the decision at the call site itself.
    const resolved = chooseStrikerAndOrigin(
      obligation.color,
      obligation.direction!,
      obligation.cell,
      board,
      ctx.availableColors.filter((color) => color !== 'red'),
      'occupied',
      ctx.rng,
    );
    if (resolved === null) return { board, rawLaunches, landingCells, ok: false };

    queue.push({
      cell: resolved.origin,
      color: obligation.color,
      kind: 'defender',
      direction: null,
      chainDepth: 0,
    });
    queue.push({
      cell: resolved.origin,
      color: resolved.striker,
      kind: 'striker-origin',
      direction: obligation.direction,
      chainDepth: obligation.chainDepth + 1,
    });
  }

  return { board, rawLaunches, landingCells, ok: launchesUsed >= ctx.launchCount };
}
