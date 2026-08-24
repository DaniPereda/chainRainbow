# Quickstart: Validar la Ficha Marrón

## Validación headless — automatizada

```bash
npm test
npm run typecheck
npm run build
```

**Resultado esperado**: las 10 suites existentes del motor siguen en verde sin cambios de
comportamiento, más dos nuevas/ampliadas:

- `move-step.test.ts` → cubre `stepUntilBlocked` directamente (sin tablero de por medio, como ya
  hace con `stepBy`): bloqueo inmediato, bloqueo tras varios pasos, tope de dos cruces de borde
  en un camino despejado, y el caso `isSelf` (no se bloquea contra su propia casilla de
  partida).
- `brown.test.ts` (nuevo) → los 6 escenarios de data-model.md, a través de `resolveLaunch`.

`npm run build` confirma que `board-view.ts` sigue compilando tras añadir `'brown'` a
`PieceColor` (plan.md → Constraints).

## Validación manual rápida (opcional)

```ts
import { resolveLaunch, createLevel } from './src/engine/index.js';

const level = createLevel({
  pieces: [
    { at: { row: 0, col: 1 }, color: 'green' },
    { at: { row: 0, col: 5 }, color: 'orange' },
  ],
  hand: ['brown'],
  objective: { at: { row: 0, col: 5 }, color: 'green' },
});

const outcome = resolveLaunch(level, { direction: 'E', lane: 0 });
console.log(outcome.board.cells[0][5]); // { color: 'green' } -- empujada mucho más lejos que orange (2)
console.log(outcome.result); // 'won'
```

## Criterio de "hecho" para esta feature

- [ ] `stepUntilBlocked` probado en aislado en `move-step.test.ts`, incluido el caso `isSelf`.
- [ ] Los 6 escenarios de `brown.test.ts` pasan.
- [ ] Las 10 suites existentes del motor siguen pasando **sin haber sido modificadas** (salvo el
      propio `move-step.test.ts`, que se amplía).
- [ ] `npm run build` sigue limpio tras añadir `'brown'` a `PieceColor`.
- [ ] `src/engine/` sigue sin importar nada de `src/renderer/` (mismo chequeo de siempre).
