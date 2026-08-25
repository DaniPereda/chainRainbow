# Quickstart: validar la feature de fragilidad

## Prerrequisitos

- Node.js + dependencias del proyecto ya instaladas (`npm install`, ya hecho en este repo).
- Rama `012-piece-fragility` con la implementación de las Historias 1 y 2 (motor) al menos completada — la Historia 3 (visual) y la 4 (autoría de niveles) pueden validarse por separado, más abajo.

## Validación del motor (Historias 1, 2 y 4 — headless, sin interfaz)

```sh
npm run typecheck
npm test
```

Qué debe cumplirse:

- **Regresión completa**: todos los tests ya existentes en `tests/unit/engine/` (brown, orange, red, same-color, wrap-around, chain, launch, session, goal, determinism, move-step) siguen pasando sin modificar sus aserciones de resultado final — solo pueden cambiar, como mucho, las construcciones de nivel que ahora incluyen fragilidad explícita donde el escenario lo exige (ver `data-model.md`, "Compatibilidad"). Ningún nivel que NO mencione fragilidad debe cambiar de comportamiento.
- **Suite nueva de fragilidad** (`tests/unit/engine/fragility.test.ts` o equivalente) cubre, como mínimo, cada escenario Given/When/Then de `spec.md`:
  - Historia 1, escenarios 1-4 (avance de estado, eliminación al asentarse, eliminación incremental por eslabón, exclusión de una eliminación de la evaluación del goal).
  - Historia 2, escenarios 1-3 (ficha lanzada se asienta, ficha lanzada ya BROKEN se elimina, missclick no cambia el estado).
  - Historia 4, escenarios 1-2 (nivel con estado inicial declarado se respeta; nivel sin declarar nada usa NEW por defecto).
  - FR-010 (mismo color, aniquilación instantánea, fragilidad no participa) — reutilizando/extendiendo `same-color.test.ts`.
  - FR-015 (rojo: la defensora avanza una vez, ambas ramas heredan) — extendiendo `red.test.ts`, incluida la consecuencia emergente de la Fixture 3 (`data-model.md`): una ficha CRACKED golpeada por rojo pierde ambas ramas.
  - FR-016 (ficha de tablero declarada BROKEN se normaliza a casilla vacía en `createLevel`, nunca llega a existir como ficha golpeable).
- Las tres trazas de `data-model.md` ("Fixture 1/2/3") replicadas como tests concretos, verificando tablero final exacto (no solo "no lanza excepción") — mismo estilo que las fixtures hand-verified de `specs/011-level-generator-basic/data-model.md`.

## Validación visual (Historia 3 — requiere interfaz)

```sh
npm run dev
```

1. Cargar (o construir manualmente, vía el visor de desarrollo si sigue disponible) un nivel con al menos dos fichas del mismo color pero distinto estado de fragilidad.
2. Confirmar a simple vista, sin ninguna acción adicional, cuál de las dos ha recibido ya al menos un golpe (SC-001).
3. Jugar un lanzamiento que rompa una ficha y confirmar que desaparece del tablero exactamente en el momento en que le tocaría asentarse (no antes, no en una limpieza al final del turno).

## Validación de build

```sh
npm run build
```

Debe completarse sin errores y sin que ningún artefacto de `tools/generator/` aparezca en `dist/` (mismo criterio ya aplicado en features anteriores de esta sesión) — esta feature no toca `tools/generator/`, así que no debería haber ninguna diferencia aquí respecto al build actual.

## Qué NO valida este quickstart

- Rebalanceo de los niveles prototipo ya existentes — explícitamente fuera de alcance (`spec.md`, Assumptions).
- `tools/generator/` — no se toca en esta feature.
