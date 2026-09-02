# Implementation Plan: Ficha Roja en el Generador de Niveles

**Branch**: `020-generator-red-support` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-generator-red-support/spec.md`

## Summary

Extender `tools/generator/obligations.ts` para que una obligación de tipo `'defender'` pueda
resolverse invirtiendo el split de rojo (además de la vía existente: una obligación de tipo
`'defender'` explicada por un empuje normal de verde/naranja/marrón), en lugar de únicamente esa
vía. El origen de rojo (`C`, el punto de la división) se calcula con la MISMA matemática que ya
usa el inverso de verde (`stepBackward(to, direction, 1)`) porque cada rama de un split SIEMPRE
viaja exactamente 1 casilla desde `C` en su primer salto -- de ahí que la rama que lleva al
objetivo solo pueda explicar un `to` situado exactamente a 1 casilla de `C` (research.md,
Decisión 1). Resolver esta obligación mediante rojo empuja tres obligaciones nuevas en lugar de
las dos habituales: la ficha original `D` en `C` (forzada a mobiliario con fragilidad `'new'`,
FR-002), rojo mismo como `'striker-origin'` en `C` (con una dirección de golpe perpendicular
recién sorteada), y la rama secundaria como una obligación `'defender'` normal en su propia
casilla de aterrizaje -- reutilizando el mecanismo de mobiliario-vs-cadena ya existente
(`defenderContinuationProbability`) sin ningún caso especial, salvo que su fragilidad de
mobiliario es la ya avanzada del split (`'cracked'`) en vez de `'new'` (research.md, Decisión 2).
El motor no cambia (FR-008); toda la extensión vive en `tools/generator/`.

## Technical Context

**Language/Version**: TypeScript (Node.js), mismo stack que el resto de `tools/generator/`.

**Primary Dependencies**: Ninguna nueva -- reutiliza `src/engine/board.ts`,
`src/engine/move-step.ts` y las funciones ya existentes de `tools/generator/obligations.ts` /
`inverses.ts` / `generate.ts`.

**Storage**: N/A (el generador escribe JSON de niveles bajo `levels/`, sin cambios de formato).

**Testing**: Vitest, mismo patrón que 011/013/014/016/017/019 -- fixtures con `rng` guionado
(`tests/unit/tools/generator/`).

**Target Platform**: Herramienta de línea de comandos / tests, Node.js -- sin superficie de UI.

**Project Type**: Extensión de una herramienta headless existente (`tools/generator/`), no un
proyecto nuevo.

**Performance Goals**: N/A -- mismo régimen de reintentos acotados (`maxGenerationAttempts`, por
defecto 200) que el resto del generador; ningún nuevo límite de tiempo.

**Constraints**: FR-008 -- `src/engine/` no cambia como consecuencia de esta feature. FR-007 --
cero regresión cuando `availableColors` no incluye rojo.

**Scale/Scope**: Un solo fichero de lógica (`tools/generator/obligations.ts`), una extensión de
tipo (`InverseColor`/`inverseCandidates` en `tools/generator/inverses.ts`), y una entrada nueva en
`tools/generator/complexity-config.json`. Sin cambios en `src/engine/`, `src/renderer/`, ni en
los 140 niveles existentes (se reverifican, no se regeneran).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (motor puro, independiente de UI)**: No aplica un cambio -- el motor no se toca
  (FR-008). El generador ya vive fuera del motor, como herramienta de autoría (Principio IV).
- **Principio II (test-first)**: Se añaden fixtures de Vitest para el nuevo camino de resolución
  de `'defender'` vía rojo, antes/junto con la implementación (mismo patrón que 011/017/019).
- **Principio III (determinismo)**: Sin cambios -- toda la aleatoriedad nueva (elección de rojo
  como candidato, dirección de golpe perpendicular) pasa por el mismo `rng()` inyectado que ya
  usa el resto del generador; el motor de resolución en sí sigue siendo 100% determinista.
- **Principio IV (niveles como datos declarativos)**: Sin cambios -- el generador sigue
  produciendo el mismo formato de nivel JSON; rojo aparece como cualquier otro color en
  `pieces`/`hand`.
- **Principio V (primitivas composables, no casos especiales)**: Cumplido explícitamente --
  la rama secundaria se resuelve reutilizando el `Obligation` de tipo `'defender'` YA EXISTENTE
  (mismo mecanismo de mobiliario-vs-cadena), no un tipo de obligación nuevo. El único añadido
  genuinamente nuevo es la elección del origen de rojo (matemáticamente idéntica a la de verde) y
  el paso de "empujar 3 obligaciones en vez de 2" cuando el resultado de
  `chooseStrikerAndOrigin` es rojo -- ver research.md, Decisión 3, para por qué esto no encaja
  como una composición 100% libre de ramas nuevas en el código (justificación de la única
  desviación real de este principio).

**Resultado**: PASA. Ninguna violación requiere la tabla de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/020-generator-red-support/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
tools/generator/
├── obligations.ts        # Obligation gana forceFurniture?/furnitureFragility?; nueva rama
│                          # "resolved.striker === 'red'" en la resolución de 'defender';
│                          # chooseStrikerAndOrigin excluye 'red' del contexto 'occupied'.
├── inverses.ts            # InverseColor gana 'red'; inverseCandidates('red', ...) reutiliza
│                          # exactamente la fórmula de 'green' para context==='settle'.
├── generate.ts            # goalColor: sin cambios (research.md, Decisión 8 -- una exclusión de
│                          # 'red' aquí se intentó y se revirtió por ser un error).
└── complexity-config.json # availableColors gana un 3er nivel: [green, orange, brown, red].

tests/unit/tools/generator/
├── obligations.test.ts    # (o el fichero equivalente ya existente) -- nuevos casos para la
│                          # rama roja: fragilidad forzada de D, dirección perpendicular,
│                          # fragilidad compartida de la rama secundaria (mobiliario y cadena).
└── generate.test.ts       # Nuevo caso end-to-end: un lote con rojo disponible produce al menos
                           # un nivel cuya solution pasa por rojo, y valida 'won' con el motor real.

levels/                    # Sin cambios de contenido esperados -- se reverifican los 140
                            # existentes (ninguno usa rojo hoy), no se regeneran salvo que la
                            # reverificación encuentre lo contrario.
```

**Structure Decision**: Extensión in-place de `tools/generator/` -- ningún directorio ni proyecto
nuevo. Sigue exactamente el patrón de 011/013/014/017/019 (todas ellas también extendieron estos
mismos ficheros sin reestructurar el árbol).

## Complexity Tracking

> No violations to justify -- table intentionally omitted.
