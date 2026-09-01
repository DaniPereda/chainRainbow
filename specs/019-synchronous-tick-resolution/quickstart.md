# Quickstart: Validar la Resolución Síncrona de Trayectorias Simultáneas

## Validación headless — automatizada

```bash
npm run typecheck && npm test
```

**Resultado esperado**: las suites nuevas (`resolveChain` con múltiples sitios, `applyMutualImpact`) pasan; el 100% de las suites ya existentes (001-018) siguen pasando sin ningún valor esperado cambiado (FR-006/SC-002) -- confirmado, no solo esperado, porque el mecanismo nuevo colapsa exactamente al de hoy cuando la cola nunca supera 1 entrada activa.

## Demostrar el caso real que motiva la feature

1. Construir (o localizar) una división de rojo cuyas dos ramas, avanzadas tick a tick, lleguen a coincidir en la misma casilla -- típicamente vía wrap-around (una rama retrasada por un obstáculo real mientras la otra completa una vuelta al tablero).
2. Reproducir ese caso con el motor YA CAMBIADO (`resolveLaunch`) y confirmar que ambas ramas colisionan entre sí (evento de aniquilación si coinciden en color, o intercambio de dirección/mecanismo de empuje si no) en vez de que una atraviese a la otra.
3. Confirmar, por comparación directa (git stash / branch anterior, o simplemente razonando sobre el código anterior a esta feature), que el motor SECUENCIAL de antes de esta feature producía un resultado distinto para ese mismo caso -- la prueba de que esta feature realmente cambia algo, no solo añade código muerto.

## Reverificar el batch de niveles y el prototipo

```bash
npx tsx -e "
import { PROTOTYPE_LEVELS } from './src/levels/prototype-levels.js';
import { resolveLaunch } from './src/engine/index.js';
const level14 = PROTOTYPE_LEVELS.find((e) => e.id === 14)!.level;
const level15 = PROTOTYPE_LEVELS.find((e) => e.id === 15)!.level;
console.log('14:', resolveLaunch(level14, { direction: 'S', lane: 3 }).result);
console.log('15:', resolveLaunch(level15, { direction: 'S', lane: 3 }).result);
"
```

Ambos deben seguir resolviendo `'won'` -- confirmando que sus dos ramas nunca coinciden en la misma casilla (SC-002/FR-006 aplicados a los únicos dos niveles reales que usan rojo hoy). Repetir la reproducción de los 140 niveles generados (mismo script que en 016/017) -- 100% `'won'` esperado, sin regenerar ninguno.

## Criterio de "hecho" para esta feature

- [ ] `resolveChain` acepta un array de sitios iniciales y detecta coincidencias antes de cada `shift()`, con `applyMutualImpact` implementando la regla simétrica confirmada por el usuario (intercambio de dirección).
- [ ] `resolveRedSplit` siembra ambas ramas en una única llamada a `resolveChain`, sin lógica de secuenciación propia.
- [ ] El 100% de los tests existentes (001-018) siguen pasando sin cambios.
- [ ] Un test de integración real demuestra el cruce por wrap-around resuelto como colisión simétrica.
- [ ] Los niveles 14/15 del prototipo y los 140 niveles generados siguen resolviendo `'won'`.
- [ ] Una prueba sintética con 3+ sitios activos confirma que el mecanismo no asume N=2 (Historia 2).
