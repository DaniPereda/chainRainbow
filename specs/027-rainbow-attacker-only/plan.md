# Implementation Plan: Arcoíris Solo Actúa Como Atacante

**Branch**: `027-rainbow-attacker-only` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/027-rainbow-attacker-only/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Eliminar la regla actual por la cual una arcoíris ASENTADA dispara su propio efecto de recoloreo con solo ser golpeada (`applyImpact`, `defender.color === 'rainbow'`) -- a partir de esta feature, solo la identidad de la ATACANTE decide qué mecanismo se aplica en un impacto (igual que ya ocurre con rojo y negro). Una arcoíris asentada golpeada se comporta como cualquier otra defensora: avanza su fragilidad y se desplaza según el color que la golpeó, incluyendo dividirse si es rojo (invirtiendo deliberadamente FR-010 de 024-rainbow-color-change) y perder su línea completa si es negro (sin cambios, ya dominaba por orden de comprobación). Esto hace estructuralmente posible que una arcoíris quede "en vuelo" tras ser desplazada -- si en ese vuelo golpea una defensora real, actúa como atacante exactamente igual que siempre (recolorea, desaparece). El caso genuinamente nuevo es la colisión mutua (`applyMutualImpact`/`strikeMutualSide`) cuando uno de los dos lados es arcoíris: mismo color (dos arcoíris) se anula igual que cualquier otro par, sin lógica nueva; colores distintos se resuelven en una secuencia de dos pasos que da ventaja al jugador -- primero arcoíris recolorea a la otra ficha (que se asienta en la celda de encuentro, fragilidad intacta), luego esa ficha ya recoloreada actúa como atacante sobre arcoíris con su propio mecanismo (empuje, división, o limpieza de línea si es negro -- este último un caso nuevo de verdad, ya que negro nunca podía antes ser uno de los dos lados ya en vuelo de una colisión mutua). Alcance puramente de motor (`src/engine/`), sin tocar el generador ni el renderer.

## Technical Context

**Language/Version**: TypeScript (Node.js), mismo stack que el resto del motor (`src/engine/`).

**Primary Dependencies**: Ninguna nueva. Toca exclusivamente `src/engine/pieces/push.ts` (`applyImpact`, `strikeMutualSide`, `applyMutualImpact`) y reutiliza primitivas ya existentes ahí mismo: `PUSH_STRATEGY`, `advance` (fragilidad), `resolveRedSplit`, `clearLine`/`lineFromImpact` (negro), `settleOrVanish`. No introduce ningún tipo nuevo en `src/engine/board.ts` ni `src/engine/events.ts` más allá de, posiblemente, un nuevo variante de evento para el segundo paso de la colisión mutua de dos pasos (a confirmar en Phase 1).

**Storage**: N/A.

**Testing**: Vitest, mismo patrón que el resto del motor (`tests/unit/engine/rainbow.test.ts` para los casos de impacto normal ya existentes, extendido; `tests/unit/engine/push.test.ts` para la colisión mutua, mismo archivo que ya cubre `applyMutualImpact`/`strikeMutualSide` para el resto de colores).

**Target Platform**: Node.js (motor headless) -- sin cambios de plataforma.

**Project Type**: Single project (motor + renderer + herramientas en el mismo repo, ya establecido). Esta feature es enteramente `src/engine/`, no toca `src/renderer/` ni `tools/generator/`.

**Performance Goals**: N/A -- el cambio es de lógica de despacho dentro de un impacto ya existente, sin ningún coste computacional adicional relevante.

**Constraints**: Debe preservar el Principio III (determinismo): la secuencia de dos pasos de la colisión mutua con arcoíris depende únicamente de la elección explícita del jugador (la misma pausa-y-reanudación ya usada por 024), nunca de aleatoriedad. Debe preservar el Principio V (primitivas composables): el segundo paso de la colisión mutua reutiliza `PUSH_STRATEGY`/`resolveRedSplit`/`clearLine` ya existentes, en vez de inventar un mecanismo de desplazamiento nuevo para arcoíris.

**Scale/Scope**: Dos ramas de código modificadas (`applyImpact`: quitar `defender.color === 'rainbow'` de la condición; `strikeMutualSide`: añadir el caso negro, hoy inexistente), una reescritura de `applyMutualImpact`'s manejo del caso "un lado es arcoíris" (hoy un `throw` de invariante, pasa a ser una secuencia real de dos pasos con posible pausa de color intermedia). Ningún cambio en `src/engine/board.ts`, `src/engine/launch.ts`, `src/engine/goal.ts`, `src/renderer/`, ni `tools/generator/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (motor puro, sin dependencias de UI)** -- trivialmente satisfecho: esta feature toca exclusivamente `src/engine/pieces/push.ts`, sin ninguna dependencia de renderizado. La pausa de color intermedia reutiliza el mismo mecanismo `PendingColorChoice`/`resume` ya existente desde 024, que ya respeta este principio (el motor expone el estado de pausa como datos, la decisión de CÓMO mostrarlo es del renderer). **PASA**.
- **Principio II (test-first)** -- `tests/unit/engine/rainbow.test.ts` y `tests/unit/engine/push.test.ts` cubren cada escenario de la spec (arcoíris asentada golpeada por cada color, arcoíris en vuelo golpeando una defensora real, colisión mutua mismo-color y distinto-color con cada color posible como resultado del primer paso) antes/junto con la implementación. **PASA** (verificar en tasks.md que los tests se escriben en la misma tarea o justo antes que cada pieza de implementación).
- **Principio III (determinismo)** -- la secuencia de dos pasos de la colisión mutua depende únicamente de la elección del jugador (mismo mecanismo de pausa ya determinista de 024), nunca de aleatoriedad; con la misma elección, el resultado es siempre idéntico. **PASA**.
- **Principio IV (niveles como datos declarativos)** -- sin cambios; esta feature no toca la representación de niveles. **PASA**.
- **Principio V (primitivas composables sobre casos especiales)** -- el núcleo de esta feature es EXACTAMENTE eliminar un caso especial (una defensora disparando su propio efecto por ser golpeada) y sustituirlo por la regla ya general "solo la atacante decide el mecanismo", reutilizando `PUSH_STRATEGY`/`resolveRedSplit`/`clearLine` en vez de inventar nada nuevo para el desplazamiento de arcoíris. El único código genuinamente nuevo (negro como mecanismo dentro de una colisión mutua) reutiliza la lógica de limpieza de línea ya existente, no introduce una primitiva nueva. **PASA**.

Todas las gates pasan, sin ninguna desviación que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/027-rainbow-attacker-only/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md  # /speckit-specify quality gate
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/engine/pieces/push.ts
├── applyImpact           # quita `defender.color === 'rainbow'` de la condición de
│                          # línea 556 -- una arcoíris asentada golpeada cae ahora en
│                          # la rama genérica de empuje (o en la de rojo/negro si
│                          # corresponde), como cualquier otra defensora
├── strikeMutualSide       # nuevo caso `strikerSite.piece.color === 'black'` (hoy un
│                          # `throw` de invariante) -- reutiliza `clearLine`/
│                          # `lineFromImpact` para eliminar la línea completa del
│                          # lado golpeado, terminando sin `nextSite`
└── applyMutualImpact      # el `throw` "rainbow cannot be one side of a mutual
                           # collision" se sustituye por la secuencia real de dos
                           # pasos cuando exactamente uno de los dos lados es
                           # arcoíris (mismo color, incluyendo dos arcoíris, sigue
                           # cubierto por la comprobación de aniquilación ya
                           # existente, sin cambios)

src/engine/events.ts      # posible ajuste de tipos si el segundo paso de la
                           # colisión mutua necesita distinguir su propio evento de
                           # recoloreo del ya existente (a confirmar en Phase 1)

tests/unit/engine/
├── rainbow.test.ts        # nuevos casos: arcoíris asentada golpeada por cada color
│                          # (verde/naranja/marrón/rojo/negro), arcoíris en vuelo
│                          # golpeando una defensora real
└── push.test.ts           # nuevos casos de colisión mutua: dos arcoíris (mismo
                           # color), arcoíris contra cada color real distinto,
                           # incluyendo negro como resultado del primer paso

# Sin cambios en tools/generator/ ni src/renderer/
```

**Structure Decision**: Single project ya establecido. Esta feature vive enteramente en `src/engine/pieces/push.ts` (más un posible ajuste de tipos en `src/engine/events.ts`) -- ninguna estructura nueva, solo la eliminación de una condición y la extensión de dos funciones ya existentes.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Ninguna -- todas las gates pasan sin desviaciones.
