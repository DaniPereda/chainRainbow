import type { Board, Coordinate, Piece } from './board.js';
import { getPieceAt, isInBounds } from './board.js';
import { step, type Direction } from './move-step.js';

export type Hand = { pieces: Piece[] };

export type Launch = { direction: Direction; lane: number };

export function hasAvailablePiece(hand: Hand): boolean {
  return hand.pieces.length > 0;
}

export function takeFirstPiece(hand: Hand): { piece: Piece; hand: Hand } {
  const [piece, ...rest] = hand.pieces;
  return { piece, hand: { pieces: rest } };
}

export function returnPiece(hand: Hand, piece: Piece): Hand {
  return { pieces: [piece, ...hand.pieces] };
}

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

export type TravelResult = { hitAt: Coordinate | null; missclick: boolean };

export function travelLaunch(board: Board, launch: Launch): TravelResult {
  let current = entryCoordinate(launch.direction, launch.lane);

  while (isInBounds(current)) {
    if (getPieceAt(board, current) !== null) {
      return { hitAt: current, missclick: false };
    }
    current = step(current, launch.direction);
  }

  return { hitAt: null, missclick: true };
}
