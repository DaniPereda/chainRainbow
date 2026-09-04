import type { Board, Coordinate, PieceColor } from '../../src/engine/board.js';
import { getPieceAt, setPieceAt } from '../../src/engine/board.js';
import { step, type Direction } from '../../src/engine/move-step.js';
import type { RawLaunch, LandingCell } from './obligations.js';
import { assignGroupFragility, type FragilityProfile } from './fragility.js';

const MAX_BLOCKERS = 7;

/** Mirrors launch.ts's private entryCoordinate -- same tiny, stable mapping
 * already duplicated once in obligations.ts. */
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
 * The axis PERPENDICULAR to `direction` -- same N/S-vs-E/O convention already
 * established by red's own branching (push.ts's PERPENDICULAR_DIRECTIONS) and
 * reused by the generator's own red-split support. Central to this whole
 * feature (research.md Decisión 1 revisada): negro must always approach a
 * blocker from the axis perpendicular to whatever it protects, never the SAME
 * axis -- travelling the same axis would clear the protected thing itself too
 * (both a striker's own approach lane and a push's own destination are, by
 * construction, colinear with the thing being protected).
 */
const PERPENDICULAR: Record<Direction, [Direction, Direction]> = {
  E: ['N', 'S'],
  O: ['N', 'S'],
  N: ['E', 'O'],
  S: ['E', 'O'],
};

/**
 * `count` distinct random elements of `items`, via a PARTIAL Fisher-Yates
 * (only `count` swaps, not the usual `items.length - 1`) -- consumes exactly
 * `count` calls to `rng()`, zero when `count` is 0. A full shuffle-then-slice
 * would consume `items.length - 1` calls regardless of how many are actually
 * used, wasteful when only a handful of decorative blockers are wanted out of
 * a whole 8-cell lane.
 */
function pickRandomSubset<T>(items: T[], count: number, rng: () => number): T[] {
  const copy = items.slice();
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function sameCell(a: Coordinate, b: Coordinate): boolean {
  return a.row === b.row && a.col === b.col;
}

/** Every cell strictly from `entry` up to (but not including) `target`,
 * walking `direction`. */
function laneCellsBeforeTarget(direction: Direction, lane: number, target: Coordinate): Coordinate[] {
  const cells: Coordinate[] = [];
  let current = entryCoordinate(direction, lane);
  while (!sameCell(current, target)) {
    cells.push(current);
    current = step(current, direction);
  }
  return cells;
}

/** All 8 cells of a lane, from its own entry to the far edge. */
function fullLane(direction: Direction, lane: number): Coordinate[] {
  const cells: Coordinate[] = [];
  let current = entryCoordinate(direction, lane);
  for (let i = 0; i < 8; i++) {
    cells.push(current);
    current = step(current, direction);
  }
  return cells;
}

export type BlackDecoyCandidate = { board: Board; rawLaunches: RawLaunch[] };

/**
 * Builds one candidate: `blockerCell` (the one that genuinely blocks
 * something, spec.md FR-004/005) gets a mandatory blocker; negro approaches
 * it from the axis perpendicular to `riskyDirection` (the direction of
 * whatever `blockerCell` is colinear with and must NOT be swept -- a
 * striker's own approach lane for the Estrategia A, or a push's own travel
 * direction for the Estrategia B, research.md Decisión 6). Up to
 * `MAX_BLOCKERS - 1` additional decorative blockers are scattered along
 * negro's OWN perpendicular lane (never along `riskyDirection`'s lane) --
 * purely for richness, since negro clears that whole lane in one sweep
 * regardless of how many of them there are. Never validates anything itself
 * -- the caller (generate.ts) is the one that knows how to build a full
 * `Level`/`solution` and run `validatesForward` (research.md Decisión 4
 * revisada: ese es el único árbitro de seguridad, no un registro estático).
 */
function buildPerpendicularCandidate(
  board: Board,
  rawLaunches: RawLaunch[],
  protectedIndex: number,
  blockerCell: Coordinate,
  riskyDirection: Direction,
  availableColors: PieceColor[],
  fragilityProfile: FragilityProfile | undefined,
  rng: () => number,
): BlackDecoyCandidate {
  const [perpA, perpB] = PERPENDICULAR[riskyDirection];
  const negroDirection = rng() < 0.5 ? perpA : perpB;
  const negroLane = negroDirection === 'N' || negroDirection === 'S' ? blockerCell.col : blockerCell.row;

  const extraCandidates = fullLane(negroDirection, negroLane).filter(
    (cell) => !sameCell(cell, blockerCell) && getPieceAt(board, cell) === null,
  );
  const extraMax = Math.min(MAX_BLOCKERS - 1, extraCandidates.length);
  const extraCount = Math.floor(rng() * (extraMax + 1)); // 0..extraMax
  const extras = pickRandomSubset(extraCandidates, extraCount, rng);

  const allBlockers = [blockerCell, ...extras];
  const fragilities = assignGroupFragility(fragilityProfile, allBlockers.length, ['new', 'cracked'], rng);

  let nextBoard = board;
  allBlockers.forEach((cell, i) => {
    const color = availableColors[Math.floor(rng() * availableColors.length)];
    nextBoard = setPieceAt(nextBoard, cell, { color, fragility: fragilities[i] });
  });

  const negroLaunch: RawLaunch = {
    direction: negroDirection,
    lane: negroLane,
    color: 'black',
    target: blockerCell,
  };

  const nextRawLaunches = rawLaunches.slice();
  nextRawLaunches.splice(protectedIndex + 1, 0, negroLaunch);

  return { board: nextBoard, rawLaunches: nextRawLaunches };
}

/**
 * Estrategia A (spec.md User Story 1): protege el carril de aproximación de
 * un `RawLaunch` ya descubierto -- el bloqueante va en una celda libre entre
 * su entrada y su `target` real; negro se acerca en perpendicular a esa
 * misma dirección (nunca por el mismo carril, o se llevaría también el
 * objetivo real, research.md Decisión 1 revisada).
 */
function buildStrategyACandidate(
  board: Board,
  rawLaunches: RawLaunch[],
  availableColors: PieceColor[],
  fragilityProfile: FragilityProfile | undefined,
  rng: () => number,
): BlackDecoyCandidate | null {
  const candidates = rawLaunches
    .map((launch, index) => ({
      index,
      direction: launch.direction,
      cells: laneCellsBeforeTarget(launch.direction, launch.lane, launch.target),
    }))
    .filter(({ cells }) => cells.length > 0);

  if (candidates.length === 0) return null;

  const chosen = candidates[Math.floor(rng() * candidates.length)];
  const blockerCell = chosen.cells[Math.floor(rng() * chosen.cells.length)];

  return buildPerpendicularCandidate(
    board,
    rawLaunches,
    chosen.index,
    blockerCell,
    chosen.direction,
    availableColors,
    fragilityProfile,
    rng,
  );
}

/**
 * Estrategia B (spec.md User Story 2): protege una celda de aterrizaje
 * intermedia -- el bloqueante va DIRECTAMENTE sobre ella; negro se acerca en
 * perpendicular a la dirección del empuje que la llena (`rawLaunches[
 * launchIndex].direction` -- el propio striker viaja en la MISMA dirección
 * que el empuje que causa, research.md Decisión 6: nunca hace falta un campo
 * separado para esto).
 */
function buildStrategyBCandidate(
  board: Board,
  rawLaunches: RawLaunch[],
  landingCells: LandingCell[],
  availableColors: PieceColor[],
  fragilityProfile: FragilityProfile | undefined,
  rng: () => number,
): BlackDecoyCandidate | null {
  if (landingCells.length === 0) return null;

  const chosen = landingCells[Math.floor(rng() * landingCells.length)];
  const riskyDirection = rawLaunches[chosen.launchIndex].direction;

  return buildPerpendicularCandidate(
    board,
    rawLaunches,
    chosen.launchIndex,
    chosen.cell,
    riskyDirection,
    availableColors,
    fragilityProfile,
    rng,
  );
}

/**
 * Genera hasta dos candidatos (Estrategia A y B, spec.md) para que
 * `generate.ts` los pruebe en orden, construyendo el nivel completo y
 * validándolo con el motor real (`validatesForward`) -- ninguno de los dos
 * se valida aquí (research.md Decisión 4 revisada). Si una estrategia no
 * encuentra ninguna oportunidad, simplemente no aporta candidato -- nunca un
 * error, nunca bloquea a la otra (spec.md FR-002/FR-003).
 */
export function buildBlackDecoyCandidates(
  board: Board,
  rawLaunches: RawLaunch[],
  landingCells: LandingCell[],
  availableColors: PieceColor[],
  fragilityProfile: FragilityProfile | undefined,
  rng: () => number,
): BlackDecoyCandidate[] {
  const candidates: BlackDecoyCandidate[] = [];

  const a = buildStrategyACandidate(board, rawLaunches, availableColors, fragilityProfile, rng);
  if (a !== null) candidates.push(a);

  const b = buildStrategyBCandidate(board, rawLaunches, landingCells, availableColors, fragilityProfile, rng);
  if (b !== null) candidates.push(b);

  return candidates;
}
