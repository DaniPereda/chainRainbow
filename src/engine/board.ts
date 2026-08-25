export type Coordinate = { row: number; col: number };

export type PieceColor = 'green' | 'orange' | 'brown' | 'red';

export type Fragility = 'new' | 'cracked' | 'broken';

export type Piece = { color: PieceColor; fragility: Fragility };

export type Board = {
  size: 8;
  cells: (Piece | null)[][];
};

const BOARD_SIZE = 8;

export function createBoard(): Board {
  const cells: (Piece | null)[][] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    cells.push(new Array(BOARD_SIZE).fill(null));
  }
  return { size: BOARD_SIZE, cells };
}

export function isInBounds(coord: Coordinate): boolean {
  return (
    coord.row >= 0 &&
    coord.row < BOARD_SIZE &&
    coord.col >= 0 &&
    coord.col < BOARD_SIZE
  );
}

export function getPieceAt(board: Board, coord: Coordinate): Piece | null {
  if (!isInBounds(coord)) {
    return null;
  }
  return board.cells[coord.row][coord.col];
}

export function setPieceAt(
  board: Board,
  coord: Coordinate,
  piece: Piece | null,
): Board {
  const cells = board.cells.map((row) => row.slice());
  cells[coord.row][coord.col] = piece;
  return { size: board.size, cells };
}

export function cloneBoard(board: Board): Board {
  return { size: board.size, cells: board.cells.map((row) => row.slice()) };
}

export function wrapCoordinate(coord: Coordinate): Coordinate {
  const wrap = (n: number) => ((n % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  return { row: wrap(coord.row), col: wrap(coord.col) };
}
