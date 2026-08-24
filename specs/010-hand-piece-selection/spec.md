# Feature Specification: Selección Libre de Ficha en Mano

**Feature Branch**: `010-hand-piece-selection`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Permitir que el jugador elija libremente qué ficha de la mano lanzar, en vez de que el motor siempre use la primera de la cola. El jugador puede tocar cualquier ficha visible en el panel de mano en cualquier momento, y esa es la ficha que se lanza en el siguiente lanzamiento -- sin restricción de orden. Las fichas restantes conservan su orden relativo tras el lanzamiento, igual que hoy."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elegir qué ficha lanzar, no solo la primera de la cola (Priority: P1)

Mientras juega un nivel con dos o más fichas en mano, el jugador toca la ficha que quiere lanzar
a continuación (no necesariamente la primera de la cola) y luego confirma el lanzamiento con la
dirección/carril de siempre. La ficha que se lanza es la que tocó, no la que estaba primera.

**Why this priority**: Es la razón de ser de esta feature — sin esto, el jugador sigue
condicionado a un orden que el motor decide por él, exactamente el comportamiento que se quiere
cambiar.

**Independent Test**: Cargar un nivel con dos fichas de colores distintos en mano (p. ej. el
nivel 3, `['green', 'orange']`), tocar la segunda ficha (orange), lanzarla, y comprobar que el
impacto resultante es el de una ficha orange — no el de green — y que la ficha que queda en mano
es green.

**Acceptance Scenarios**:

1. **Given** el jugador está jugando un nivel con varias fichas en mano, **When** toca una ficha
   del panel que no es la primera de la cola, **Then** esa ficha queda marcada como la que se
   usará en el próximo lanzamiento.
2. **Given** una ficha del panel está marcada para el próximo lanzamiento, **When** el jugador
   confirma un lanzamiento por el borde del tablero, **Then** el motor resuelve el impacto usando
   exactamente esa ficha, y las demás permanecen en mano sin cambios.

---

### User Story 2 - Saber en todo momento qué ficha se lanzaría (Priority: P2)

El jugador ve, en el propio panel, cuál de las fichas restantes está marcada como la que se usará
si confirma un lanzamiento ahora mismo — sin tener que recordarlo ni deducirlo por la posición.

**Why this priority**: La feature 007 asumía que el orden de la cola ya comunicaba
implícitamente cuál era la próxima ficha, sin ningún indicador adicional. Al permitir elegir
libremente, esa suposición deja de sostenerse — sin un indicador, el jugador ya no puede saber
con certeza cuál se lanzaría.

**Independent Test**: Cargar un nivel con varias fichas en mano, tocar una que no es la primera,
y comprobar visualmente que el panel distingue esa ficha de las demás.

**Acceptance Scenarios**:

1. **Given** el jugador aún no ha tocado ninguna ficha del panel en esta partida, **When**
   observa el panel, **Then** ve marcada la primera ficha de la cola como selección por defecto
   — el mismo comportamiento de un solo toque que ya existía, sin ningún paso adicional.
2. **Given** el jugador toca una ficha distinta a la marcada actualmente, **When** eso ocurre,
   **Then** la marca se mueve a la ficha tocada y deja de marcar la anterior.

---

### User Story 3 - La selección se mantiene coherente tras cada lanzamiento (Priority: P2)

Después de cada lanzamiento (con o sin missclick), la selección sigue apuntando a una ficha real
y disponible, nunca a una que ya se usó o que nunca existió.

**Why this priority**: Sin esto, un jugador podría quedarse con una selección "fantasma" tras
consumir la ficha elegida, rompiendo la garantía de la Historia 2.

**Independent Test**: Cargar un nivel con dos fichas, seleccionar y lanzar la segunda, y
comprobar que el panel pasa a marcar automáticamente la única ficha que queda (antes la primera
de la cola) sin que el jugador tenga que volver a tocarla.

**Acceptance Scenarios**:

1. **Given** la ficha actualmente marcada se acaba de lanzar (sin missclick), **When** el panel
   se actualiza, **Then** queda marcada la primera de las fichas restantes, como nueva selección
   por defecto.
2. **Given** un lanzamiento resulta en missclick, **When** eso ocurre, **Then** ni la mano ni la
   selección cambian — la misma ficha sigue marcada.
3. **Given** el jugador lanza la última ficha que le quedaba en mano, **When** ese lanzamiento se
   resuelve, **Then** el panel queda vacío y sin ninguna selección, igual que la mano.

---

### Edge Cases

- ¿Qué ocurre si el jugador toca la ficha que ya está marcada? No pasa nada — sigue marcada, no
  se dispara ningún lanzamiento por sí sola (tocar una ficha del panel nunca lanza; solo el borde
  del tablero lanza, igual que hoy).
- ¿Qué ocurre si el jugador reinicia el nivel o vuelve a entrar a él? La selección se reconstruye
  al estado por defecto (primera ficha de la mano inicial declarada), igual que el resto del
  estado de sesión (FR-012, spec.md 005).
- ¿Qué ocurre con los niveles 3, 7, 10 y 13 del prototipo, cuyo puzzle de dos lanzamientos
  depende hoy de que la mano se consuma en un orden fijo (primero limpiar un obstáculo por
  aniquilación de mismo color, luego alcanzar el objetivo)? Con selección libre, esos niveles
  siguen siendo resolubles lanzando en el mismo orden de siempre — el motor no cambia sus reglas
  de empuje/aniquilación — pero ese orden deja de estar forzado: un jugador podría lanzar la
  ficha "equivocada" primero y fallar el puzzle. Es una consecuencia conocida y deliberada de
  esta feature, no un defecto a corregir aquí.
- ¿Qué ocurre en los 11 niveles con una sola ficha en mano? El comportamiento no cambia en
  absoluto — con una única ficha, la selección por defecto y la única opción posible coinciden
  siempre; el jugador puede seguir jugando con un solo toque en el borde, exactamente igual que
  antes de esta feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir al jugador marcar como seleccionada cualquier ficha
  actualmente disponible en su mano, tocándola en el panel, sin restricción de posición en la
  cola.
- **FR-002**: Tocar una ficha del panel DEBE únicamente cambiar cuál queda marcada — NUNCA debe
  iniciar un lanzamiento por sí solo; el lanzamiento sigue requiriendo la interacción ya existente
  con el borde del tablero (dirección + carril).
- **FR-003**: Cuando el jugador confirma un lanzamiento, el sistema DEBE usar exactamente la
  ficha marcada en ese momento, sea o no la primera de la cola.
- **FR-004**: El panel DEBE mostrar en todo momento, con una indicación visual distinta al resto,
  cuál ficha está actualmente marcada — sustituye la suposición de la feature 007 de que el orden
  por sí solo ya comunicaba esa información.
- **FR-005**: Si el jugador no ha tocado ninguna ficha todavía (entrada al nivel, o justo después
  de que la ficha marcada se haya lanzado), el sistema DEBE marcar por defecto la primera ficha
  de la cola restante — preserva el flujo de un solo toque para quien no necesita reordenar nada.
- **FR-006**: Tras un lanzamiento que consume la ficha marcada (sin missclick), el sistema DEBE
  actualizar la marca automáticamente a la primera ficha restante, sin dejarla nunca apuntando a
  una ficha ya usada.
- **FR-007**: Un lanzamiento que resulte en missclick NO DEBE cambiar la mano, su orden, ni cuál
  ficha está marcada — extiende el FR-005 de spec.md 007 a la selección.
- **FR-008**: Cuando la mano quede vacía, el sistema NO DEBE dejar ninguna ficha marcada ni
  permitir iniciar ningún lanzamiento — consistente con el comportamiento ya existente
  (spec.md 005/007).
- **FR-009**: Esta feature SUSTITUYE explícitamente el FR-005 de spec.md 005 ("lanzar la primera
  ficha disponible de su mano") y el FR-007 + la suposición de "panel puramente informativo, mano
  siempre consumida en orden" de spec.md 007 — ambos quedan corregidos por esta feature, no
  contradichos en silencio.
- **FR-010**: Las reglas de empuje/aniquilación del motor (verde, naranja, marrón, rojo, mismo
  color, wrap-around) NO DEBEN cambiar de ningún modo como consecuencia de esta feature — solo
  cambia CUÁL ficha de la mano se usa en cada lanzamiento, nunca qué ocurre una vez lanzada.

### Key Entities

- **Selección de mano**: qué ficha, de las actualmente disponibles en la mano, se usará en el
  próximo lanzamiento. Existe siempre que la mano no esté vacía (con un valor por defecto cuando
  el jugador no ha elegido explícitamente); desaparece cuando la mano se vacía.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de los lanzamientos, la ficha realmente usada por el motor coincide con
  la que el panel mostraba marcada justo antes de confirmar ese lanzamiento.
- **SC-002**: Un jugador puede lanzar cualquier ficha de una mano de 2 o más, en cualquier orden
  que elija, sin verse nunca obligado a consumir antes las fichas que la preceden en la cola.
- **SC-003**: Jugar cualquiera de los 11 niveles del prototipo con una sola ficha en mano requiere
  exactamente el mismo número de toques que antes de esta feature (ninguno adicional).
- **SC-004**: Tras el 100% de los lanzamientos (con o sin missclick) y tras reiniciar un nivel, el
  panel muestra siempre una marca válida (o ninguna, si la mano está vacía) — nunca una selección
  que ya no existe en la mano.

## Assumptions

- Modelo de selección elegido: "por defecto la primera de la cola, sobreescribible tocando
  cualquier otra" (no "sin selección hasta que el jugador toque algo") — preserva el flujo de un
  solo toque ya validado para los 11 niveles de una sola ficha, y evita que elegir libremente
  imponga un toque extra a quien no lo necesita.
- El diseño visual concreto del indicador de selección (borde, halo, elevación, etc.) es un
  detalle de la fase de planificación/implementación, no de esta especificación.
- Esta feature es motor + frontend a la vez: el motor gana la capacidad de extraer una ficha
  concreta de la mano por posición, no solo la primera; el panel de mano pasa de ser puramente
  informativo (spec.md 007) a interactivo. No introduce ningún color de ficha ni regla de
  impacto nueva.
- Los niveles 3, 7, 10 y 13 no se rediseñan en esta feature — su dependencia de un orden fijo
  pasa de ser una garantía forzada por el motor a una sugerencia que el jugador puede seguir o no;
  siguen siendo resolubles lanzando en su orden original.
