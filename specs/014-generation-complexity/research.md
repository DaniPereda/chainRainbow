# Research: Puntuación de Complejidad de Generación

## Decisión 1 — El rename es puramente mecánico, sin lógica nueva

**Decisión**: `difficultyProfile` → `fragilityProfile` en `GenerationParams` (`generate.ts`), `ResolutionContext` (`obligations.ts`), y el flag `--difficulty-profile` → `--fragility-profile` en `cli.ts`/`batch.ts`. El tipo `FragilityProfile` (`tools/generator/fragility.ts`) no cambia de nombre ni de forma -- solo el campo que lo transporta. Toda referencia interna (`ctx.difficultyProfile`, comentarios que lo mencionan) se actualiza al nuevo nombre.

**Rationale**: FR-002 exige cero cambio de comportamiento -- es un rename de campo, no un cambio de tipo ni de lógica. La suite de 013 (`fragility.test.ts`, más los fixtures mecánicamente actualizados de `generate.test.ts`) sigue verificando exactamente los mismos valores esperados, solo con el nombre de campo nuevo en las llamadas.

**Alternativas consideradas**: mantener `difficultyProfile` como alias retrocompatible del nuevo nombre -- descartado porque esta feature vive en una rama que aún no se ha fusionado a `develop` (013 tampoco), así que no hay ningún consumidor externo real que romper; un alias sin uso sería complejidad sin beneficio (Principio V).

## Decisión 2 — El archivo de configuración es JSON plano, cargado con `readFileSync` + `JSON.parse`

**Decisión**: las horquillas viven en `tools/generator/complexity-config.json`, cargado en `tools/generator/complexity.ts` vía `readFileSync(new URL('./complexity-config.json', import.meta.url), 'utf-8')` + `JSON.parse`. No se usa `import ... with { type: 'json' }` (sintaxis de import-attributes, todavía inestable entre versiones de Node/TS del proyecto) ni ninguna dependencia nueva.

**Rationale**: mismo patrón que `batch.ts` ya usa para leer/escribir `levels/index.json` con `node:fs` -- cero dependencias nuevas (igual que el resto del generador), y JSON es el formato de datos declarativo más simple posible (Principio IV: "niveles como datos declarativos", extendido aquí a "la configuración de complejidad también es dato, no código").

**Alternativas consideradas**: un módulo `.ts` que exporta un objeto literal -- descartado porque mezclaría datos con código TypeScript, exactamente lo que FR-010 pide evitar ("no hardcodeadas en la lógica del generador"); aunque técnicamente editable sin *lógica* nueva, sigue exigiendo que quien ajusta una horquilla toque un fichero `.ts` y pase por el mismo pipeline de build que el resto del código, en vez de un dato aislado.

## Decisión 3 — Esquema de configuración: unión discriminada por tipo de horquilla

**Decisión**: cada factor en `complexity-config.json` es una de tres formas, discriminadas por un campo `kind`:

```json
{
  "launchCount": { "kind": "integerRange", "levels": [{ "min": 1, "max": 2 }, { "min": 3, "max": 4 }, { "min": 5, "max": 6 }] },
  "chainOriginProbability": { "kind": "floatRange", "levels": [{ "min": 0.0, "max": 0.3 }, { "min": 0.3, "max": 0.6 }, { "min": 0.6, "max": 0.9 }] },
  "defenderContinuationProbability": { "kind": "floatRange", "levels": [{ "min": 0.0, "max": 0.3 }, { "min": 0.3, "max": 0.5 }, { "min": 0.5, "max": 0.7 }] },
  "decoyCount": { "kind": "integerRange", "levels": [{ "min": 0, "max": 1 }, { "min": 2, "max": 3 }, { "min": 4, "max": 6 }] },
  "boardDecoyProbability": { "kind": "floatRange", "levels": [{ "min": 0.0, "max": 0.1 }, { "min": 0.1, "max": 0.3 }, { "min": 0.3, "max": 0.5 }] },
  "availableColors": { "kind": "discreteSet", "levels": [{ "value": ["green", "orange"] }, { "value": ["green", "orange", "brown"] }] },
  "fragilityProfile": { "kind": "discreteSet", "levels": [{ "value": "easy" }, { "value": "medium" }, { "value": "hard" }] }
}
```

- `integerRange`: `Math.floor(rng() * (max - min + 1)) + min` -- entero uniforme inclusivo (1 llamada a `rng()`).
- `floatRange`: `min + rng() * (max - min)` -- flotante uniforme continuo (1 llamada a `rng()`).
- `discreteSet`: el nivel resuelve directamente a `levels[i].value` -- no hay rango que sortear dentro del nivel, así que consume 0 llamadas a `rng()` (FR-009 ya lo permite implícitamente: "sortear uniformemente dentro de la horquilla" de un conjunto de un solo valor es una operación determinista).

**Rationale**: `launchCount`/`decoyCount` son conteos enteros; `chainOriginProbability`/`defenderContinuationProbability`/`boardDecoyProbability` son probabilidades continuas; `availableColors`/`fragilityProfile` son valores discretos, no rangos. Forzar los tres casos a una única forma numérica perdería información (¿qué significa "el mínimo de un conjunto de colores"?) o exigiría convenciones ad-hoc. Una unión discriminada de tres formas, cada una con su propia regla de muestreo, es la primitiva mínima que cubre los tres casos reales sin triplicar la lógica del generador (Principio V) -- toda la ramificación vive en una única función, `sampleLevel`, no en siete implementaciones por factor.

**Alternativas consideradas**: modelar `availableColors`/`fragilityProfile` como "rango" con `min`/`max` sobre un índice numérico arbitrario -- descartado porque obliga a inventar un orden numérico sin significado real (¿es `'easy'` "menor" que `'medium'` en algún sentido más allá del propio nivel?) y complica la configuración para quien la edita a mano, sin ninguna ganancia sobre declarar el valor directamente.

## Decisión 4 — Algoritmo de reparto: presupuesto aleatorio con exclusión de factores ya fijados explícitamente

**Decisión**: dado un `complexityScore` objetivo y el conjunto de factores que **no** tienen ya un valor explícito en `GenerationParams`, todos esos factores arrancan en su nivel 1 (índice 0); en cada paso se elige uniformemente al azar UNO de los factores que aún no ha alcanzado su propio tope de niveles, y se le sube un nivel; se repite hasta que la suma de niveles asignados iguale `complexityScore`. Los factores con un valor explícito en la llamada quedan completamente fuera de este reparto -- ni consumen presupuesto, ni aparecen en el cálculo de mínimo/máximo válido de `complexityScore` para esa llamada concreta.

```ts
function resolveComplexity(
  complexityScore: number,
  config: ComplexityConfig,
  excludedFactors: ReadonlySet<ComplexityFactorName>,
  rng: () => number,
): Partial<Record<ComplexityFactorName, unknown>> {
  const included = factorNames(config).filter((name) => !excludedFactors.has(name));
  const levelIndex = new Map(included.map((name) => [name, 0])); // todos en nivel 1

  let sum = included.length;
  while (sum < complexityScore) {
    const eligible = included.filter((name) => levelIndex.get(name)! + 1 < config[name].levels.length);
    const pick = eligible[Math.floor(rng() * eligible.length)];
    levelIndex.set(pick, levelIndex.get(pick)! + 1);
    sum++;
  }

  return Object.fromEntries(included.map((name) => [name, sampleLevel(config[name], levelIndex.get(name)!, rng)]));
}
```

**Rationale**: es la lectura más consistente de FR-013 ("el valor explícito prevalece para ese factor concreto") -- si un factor ya está fijado, no tiene sentido ni gastarle presupuesto de complejidad (cuyo resultado se descartaría) ni contarlo en el rango válido de `complexityScore` (el usuario no debería tener que "pagar" puntos de complejidad por una dimensión que ya decidió a mano). SC-002 (todo entero del rango es alcanzable) se cumple por construcción: mientras `sum < max` (suma de topes de los factores incluidos), existe al menos un factor `eligible` -- el bucle nunca se queda sin candidatos antes de alcanzar el objetivo.

**Alternativas consideradas**:
- *Incluir los factores fijados en el reparto pero descartar su valor sorteado al final*: más simple de escribir, pero desperdicia llamadas a `rng()` en un resultado que nunca se usa, y hace que el rango válido de `complexityScore` dependa de factores cuyo valor real el usuario ya fijó -- confuso desde fuera ("¿por qué mi complexityScore mínimo sube si ya te dije qué launchCount quiero?").
- *Repartir por orden de prioridad fijo en vez de al azar*: ya evaluado y descartado en la conversación de diseño previa a esta especificación -- el usuario pidió explícitamente reparto aleatorio (más variedad real a igual `complexityScore`, coherente con cómo ya funciona `'hard'` frente a `'easy'` en `assignGroupFragility`).

## Decisión 5 — La resolución de complejidad ocurre UNA vez por llamada, antes del bucle de reintentos

**Decisión**: `generateLevelWithRng` resuelve `complexityScore` (si está presente) en una única pasada, al principio de la función, produciendo un `GenerationParams` totalmente concreto (todos los campos numéricos/discretos ya decididos). El bucle existente de `maxGenerationAttempts` sigue exactamente igual que hoy, reutilizando esos mismos valores concretos en cada intento -- solo la construcción del tablero (`attemptOnce`) sigue consumiendo `rng()` fresco por intento, como ya hacía antes de esta feature.

**Rationale**: mantiene FR-011 (reproducibilidad) con la disciplina de determinismo ya establecida en 013 (research.md, Decisión 3) -- resolver una sola vez, no en cada intento, evita que un nivel entregado dependa de CUÁNTOS intentos hicieron falta para tener éxito. También es la interpretación más simple de "un complexityScore describe UN nivel pedido", no "una familia de valores distintos que se prueban hasta que uno funcione".

**Alternativas consideradas**: re-resolver la complejidad en cada intento fallido (como una forma de "variar" automáticamente hasta encontrar algo que funcione) -- descartado por romper la reproducibilidad de forma sutil (el resultado dependería del número de intentos fallidos previos, que a su vez depende del propio azar) y por no estar pedido en ningún lugar de spec.md.

## Decisión 6 — `GenerationParams` amplía su superficie opcional; validación en runtime, no en tipos

**Decisión**: `launchCount`, `availableColors`, `chainOriginProbability`, y `decoyCount` pasan de obligatorios a opcionales en `GenerationParams`. Tras la resolución de complejidad (Decisión 4/5) y el merge con cualquier valor explícito ya dado, `generateLevelWithRng` valida en runtime que los cuatro queden definidos -- si falta alguno (ni parámetro individual ni `complexityScore` lo cubre), lanza un error explícito, mismo estilo que el `throw` ya existente para `launchCount < 1`.

**Rationale**: TypeScript no puede expresar limpiamente "estos campos son obligatorios A MENOS que `complexityScore` esté presente" sin una unión de tipos incómoda de usar desde `cli.ts`/tests (habría que discriminar manualmente en cada call-site). Una validación en runtime, con un mensaje de error claro, sigue el mismo patrón ya establecido en el propio archivo y no introduce ninguna filosofía de manejo de errores nueva.

**Alternativas consideradas**: una unión de tipos discriminada (`{ complexityScore: number; ... } | { launchCount: number; availableColors: PieceColor[]; ... }`) -- descartada por ser mucho más incómoda para el caso ya cubierto por FR-013 (mezclar `complexityScore` CON algunos parámetros explícitos), que necesitaría estar representado en AMBOS lados de la unión o en una tercera variante -- la validación en runtime cubre exactamente los mismos casos con una sola forma de tipo.

## Cambio de semántica de resolución de cadenas

Ninguno. Esta feature no toca `src/engine/` en absoluto (FR-014) -- ni `resolveStrike`, ni `applyImpact`, ni ninguna otra función de resolución de cadenas. Toda la lógica vive en `tools/generator/`.
