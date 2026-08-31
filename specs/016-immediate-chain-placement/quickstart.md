# Quickstart: validar la resolución de cadenas por cola de fichas en tránsito

## Prerrequisitos

- Node.js + dependencias del proyecto ya instaladas (`npm install`).
- Rama `016-immediate-chain-placement`, implementación completada.

## Validación de tests y tipos

```sh
npm run typecheck
npm test
```

Qué debe cumplirse:

- **Regresión completa del motor** (features 001-012): todos los tests existentes en `tests/unit/engine/` siguen pasando con los mismos valores esperados -- el cambio es puramente interno a `applyImpact`/`push.ts` (SC-001).
- **`applyImpact` resuelve un único impacto por invocación** (`resolveStrike`/`resolveBranch`/`resolveSplit` ya no existen): tests dedicados cubren los cuatro casos de `applyImpact` (destino vacío, mismo color, distinto color con destino libre tras el desplazamiento, distinto color con destino ocupado → `nextSites` con una entrada) y las dos ramas de rojo vía `resolveRedSplit` (drenadas secuencialmente).
- **Auto-colisión resuelta como colisión real, no atravesada** (SC-002, SC-005): el caso del nivel 56 (o una cascada sintética equivalente) -- una ficha empujada por un paseo de marrón que daría la vuelta completa al tablero ahora encuentra, como ficha real, la que su propia cascada ya asentó antes, y la colisión se resuelve con la regla normal (aniquilación o empuje adicional) en vez de atravesarla.
- **Rojo sin regresión** (SC-004): los niveles 14 y 15 del prototipo se reproducen con `resolveLaunch` y su `result`/`events` son idénticos a una captura tomada antes del cambio.
- **140 niveles regenerados** (SC-003): tras borrar `levels/` y regenerar con `tools/generator/batch.ts`, el 100% de los niveles entregados se resuelven `'won'` al reproducir su secuencia de referencia con el motor real.

## Validación manual rápida (opcional)

```sh
# Capturar el comportamiento del nivel 56 tras el cambio -- debería mostrar la
# naranja original chocando (aniquilación) contra la naranja lanzada en fila 5,
# en vez de dar la vuelta completa hasta la fila 0.
npx tsx -e "
import { createLevel, resolveLaunch } from './src/engine/index.js';
import { readFileSync } from 'node:fs';
const file = JSON.parse(readFileSync('./levels/56.json', 'utf-8'));
// (nota: levels/56.json se regenera en esta feature -- puede que ya no exista
// exactamente este nivel/id; usar cualquier nivel con una cascada de 3+ fichas
# de tablero en la misma fila/columna para observar el mismo efecto)
"
```

```sh
# Regenerar el lote completo tras el cambio de motor
rm -rf levels/
npx tsx tools/generator/batch.ts --count 10 --complexity-score 7  --max-attempts 20000
npx tsx tools/generator/batch.ts --count 10 --complexity-score 8  --max-attempts 20000
# ... (repetir para 9 a 20, o usar un script que itere como en la sesión de
# generación original -- ver specs/014-generation-complexity/quickstart.md)
```

## Qué NO valida este quickstart

- La resolución simultánea de las dos ramas de rojo -- explícitamente fuera de alcance (spec.md, Assumptions).
- Ningún cambio en `tools/generator/` -- no se esperan (research.md, Decisión 6); si el quickstart revela que sí hacen falta, eso es una señal para revisar esa decisión antes de continuar.
