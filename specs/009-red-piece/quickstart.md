# Quickstart: Validar la Ficha Roja

## Validación headless — automatizada

```bash
npm test
npm run typecheck
npm run build
```

**Resultado esperado**: las suites existentes del motor siguen en verde sin cambios de
comportamiento, más `tests/unit/engine/red.test.ts` (nuevo) cubriendo los 7 escenarios de
data-model.md. `npm run build` confirma que `board-view.ts` sigue compilando tras añadir
`'red'` a `PieceColor`.

## Validación manual rápida (opcional)

```ts
import { resolveLaunch, createLevel } from './src/engine/index.js';

const level = createLevel({
  pieces: [{ at: { row: 4, col: 3 }, color: 'green' }],
  hand: ['red'],
  goal: { at: { row: 4, col: 4 }, color: 'green' },
});

const outcome = resolveLaunch(level, { direction: 'S', lane: 3 });
console.log(outcome.board.cells[4][2]); // { color: 'green' } -- rama oeste
console.log(outcome.board.cells[4][3]); // null -- casilla del impacto, vacía
console.log(outcome.board.cells[4][4]); // { color: 'green' } -- rama este
console.log(outcome.result); // 'won'
```

## Criterio de "hecho" para esta feature

- [ ] Los 7 escenarios de `red.test.ts` pasan.
- [ ] Las suites existentes del motor siguen pasando sin haber sido modificadas.
- [ ] `npm run build` sigue limpio tras añadir `'red'` a `PieceColor`.
- [ ] `src/engine/` sigue sin importar nada de `src/renderer/` (mismo chequeo de siempre).
