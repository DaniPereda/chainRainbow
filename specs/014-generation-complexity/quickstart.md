# Quickstart: validar la puntuación de complejidad de generación

## Prerrequisitos

- Node.js + dependencias del proyecto ya instaladas (`npm install`).
- Rama `014-generation-complexity` (apilada sobre `013-generator-fragility-difficulty`) con la implementación completada. Puramente headless (`tools/generator/`) -- no requiere `npm run dev`.

## Validación de tests y tipos

```sh
npm run typecheck
npm test
```

Qué debe cumplirse:

- **Rename sin regresión (Historia 1)**: todos los tests que antes referenciaban `difficultyProfile`/`--difficulty-profile` siguen pasando con `fragilityProfile`/`--fragility-profile`, con los mismos valores esperados -- ningún cambio de comportamiento, solo de nombre (FR-002).
- **`resolveComplexity` (Historia 2, nuevo `complexity.test.ts`)**: cubre, como mínimo:
  - El reparto siempre suma exactamente el `complexityScore` pedido, y ningún factor supera su propio número de niveles.
  - Todo entero dentro de `[min, max]` (derivado de la configuración) es alcanzable -- ninguna semilla queda sin reparto válido (SC-002).
  - Un factor con más de 3 niveles en la configuración puede subir por encima de 3 durante el reparto.
  - Mismo seed + mismos parámetros + mismo `complexityScore` → mismo reparto de niveles y mismos valores concretos sorteados (SC-001).
  - Con `complexityScore` ausente, cero llamadas nuevas a `rng()` y comportamiento idéntico al de antes de esta feature (SC-003).
- **Compatibilidad y overrides explícitos (Historia 3)**: un factor con valor explícito nunca participa en el reparto ni en el cálculo de `[min, max]` para esa llamada; modificar una horquilla en `complexity-config.json` cambia el resultado sin ningún cambio de código.

## Validación manual rápida (opcional, vía CLI)

```sh
# Con complexityScore -- reparto aleatorio determinista por semilla
npx tsx tools/generator/cli.ts --complexity-score 10 --seed 7

# Con parámetros individuales, sin complexityScore -- comportamiento idéntico a antes de esta feature
npx tsx tools/generator/cli.ts --launches 3 --colors green,orange,brown \
  --chain-origin-probability 0.6 --fragility-profile hard --seed 7

# Mezclando ambos -- launches queda fijo en 2 pase lo que pase el reparto de complexityScore
npx tsx tools/generator/cli.ts --complexity-score 10 --launches 2 --seed 7
```

Inspeccionar el JSON de salida:

1. Con `--complexity-score`, `params` en la salida refleja los valores concretos ya resueltos (no el `complexityScore` original tal cual) para cada factor.
2. Repetir la misma llamada con el mismo `--seed` produce exactamente el mismo JSON completo (reproducibilidad).
3. Editar una horquilla en `tools/generator/complexity-config.json` (por ejemplo, ampliar el rango de `launchCount` del nivel más alto) y repetir la primera llamada -- el valor de `launchCount` en la salida puede ahora caer en el rango ampliado, sin haber tocado ningún `.ts`.

## Qué NO valida este quickstart

- Ningún cambio de motor (`src/engine/`) -- esta feature no lo toca (FR-014).
- El futuro algoritmo de dificultad real basado en el resultado construido -- explícitamente fuera de alcance (spec.md).
- Un formato de configuración distinto de JSON -- fuera de alcance salvo que planificación decida lo contrario.
