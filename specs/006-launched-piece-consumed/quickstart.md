# Quickstart: Validar Que la Ficha Lanzada Nunca Permanece en el Tablero

## Validación headless (motor) — automatizada

```bash
npm test
npm run typecheck
```

**Resultado esperado**: las suites existentes del motor pasan tras haberse actualizado para
reflejar la regla corregida (`orange.test.ts`, `same-color.test.ts`, `wrap-around.test.ts`), y
el resto (`chain`, `launch`, `objective`, `determinism`, `move-step`, `session`,
`prototype-levels`) pasan sin haber sido tocadas — prueba de que el cambio está realmente
acotado a lo que spec.md dice que debe cambiar.

## Validación manual rápida (opcional)

```ts
import { resolveLaunch, testLevelGreen01 } from './src/engine/index.js';

const outcome = resolveLaunch(testLevelGreen01, { direction: 'E', lane: 4 });
console.log(outcome.board.cells[4][4]); // null -- la ficha verde lanzada NO aparece aquí
console.log(outcome.board.cells[4][5]); // { color: 'orange' } -- la ficha empujada, sin cambios
```

## Validación visual (prototipo Fase 2)

```bash
npm run dev
```

Jugar el nivel 3 y el nivel 7 (los rediseñados) hasta el final: cada uno requiere DOS
lanzamientos ahora (antes uno). Confirmar que tras el primer lanzamiento ninguna ficha queda
visible en la casilla del impacto (el obstáculo y la ficha lanzada desaparecen juntas), y que el
segundo lanzamiento sí deja una ficha real asentada en el objetivo.

## Criterio de "hecho" para esta feature

- [ ] `npm test` y `npm run typecheck` en verde.
- [ ] `orange.test.ts`, `same-color.test.ts`, `wrap-around.test.ts` actualizados y en verde.
- [ ] El resto de suites del motor y de `prototype-levels.test.ts` pasan sin haberse modificado.
- [ ] Los 10 niveles del prototipo siguen siendo superables (SC-003) -- reverificado
      programáticamente igual que en la feature 005.
- [ ] Niveles 3 y 7 jugados manualmente en el navegador hasta `'won'`.
