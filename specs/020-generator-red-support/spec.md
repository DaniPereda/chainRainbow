# Feature Specification: Ficha Roja en el Generador de Niveles

**Feature Branch**: `020-generator-red-support`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Extender el generador de niveles (tools/generator/) para que pueda construir niveles usando la ficha roja -- hoy rojo solo existe en el motor y en los dos niveles del prototipo escritos a mano; el generador está explícitamente limitado a verde/naranja/marrón desde 011-level-generator-basic, reafirmado en 016/017/019. Mecánica a invertir: cuando rojo golpea una ficha defensora D en una casilla C, D se divide en DOS fichas del mismo color, cada una viajando en una dirección perpendicular a la del golpe; rojo se asienta en C; ambas ramas comparten la misma fragilidad ya avanzada (FR-015 de 009-red-piece) -- si la D original ya estaba 'cracked', ambas ramas nacen 'broken' y desaparecen sin asentarse, así que una rama constructiva exige que D partiera de 'new'. Desde 019-synchronous-tick-resolution, las dos ramas pueden colisionar entre sí de verdad. Alcance decidido: (1) la rama secundaria (la que no lleva directamente al objetivo) puede resolverse como cualquier obligación normal del generador, incluida su propia cadena (chainOriginProbability), no solo como mobiliario fijo -- respetando que ambas ramas comparten la fragilidad ya avanzada del split; (2) el generador NO razona sobre las colisiones cruzadas reales de 019 -- se ignoran deliberadamente (mismo criterio que el wrap-around de marrón desde 011), cualquier construcción inválida por eso se descarta vía la validación hacia delante y política de reintento ya existentes (FR-007 de 011), y queda anotado como mejora futura. Además: complexity-config.json's availableColors (hoy 2 niveles) gana un nivel adicional al incluir rojo, como el mismo factor, no uno nuevo. Fuera de alcance: cualquier cambio al motor; explotar o evitar activamente las colisiones cruzadas de 019 (mejora futura); fichas nuevas (ítem siguiente del roadmap)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El generador puede construir un nivel cuya solución pasa por una división de rojo (Priority: P1)

Quien opera el generador pide un nivel con rojo disponible entre los colores permitidos, y el generador es capaz de construir -- por reconstrucción hacia atrás, igual que ya hace para verde/naranja/marrón -- un nivel cuya solución requiere golpear con rojo, dividiendo una ficha en dos ramas, una de las cuales lleva al objetivo.

**Why this priority**: Es la razón de ser de esta feature -- sin esto, rojo sigue sin poder aparecer en ningún nivel generado, exactamente la limitación que motivó pedirla.

**Independent Test**: Generar un lote de niveles con `availableColors` incluyendo rojo y `complexityScore`/parámetros que favorezcan su aparición, y confirmar que al menos algunos de los niveles resultantes tienen una `solution` que, al reproducirse con el motor real, pasa por un golpe de rojo -- y que el 100% de los niveles generados (con o sin rojo) siguen resolviendo `'won'` con su secuencia de referencia.

**Acceptance Scenarios**:

1. **Given** una obligación de tipo 'defender' que el generador decide resolver mediante un golpe de rojo, **When** se construye hacia atrás, **Then** se genera una ficha roja en su propio 'striker-origin' (igual que cualquier otro color) más una obligación para la rama secundaria (misma casilla de origen, dirección perpendicular), y la ficha original (antes de la división) se coloca con fragilidad `'new'` -- nunca `'cracked'` -- para que la rama que lleva al objetivo pueda asentarse de verdad (si estuviera `'cracked'`, ambas ramas nacerían `BROKEN` y ninguna llegaría a asentarse).
2. **Given** una construcción que usa rojo, **When** se reproduce con el motor real (`validatesForward`), **Then** resuelve a `'won'` exactamente como cualquier otro nivel generado -- misma garantía de siempre (FR-006 de 011), ahora también para construcciones con rojo.
3. **Given** `availableColors` NO incluye rojo (el caso de hoy, sin cambios), **When** se genera un nivel, **Then** el comportamiento es idéntico al actual -- cero regresión para quien no pide rojo.

---

### User Story 2 - La rama secundaria puede tener su propia cadena, no solo ser mobiliario fijo (Priority: P2)

Quien opera el generador puede obtener niveles donde la rama de una división de rojo que NO lleva directamente al objetivo sea, a su vez, el resultado de un golpe anterior -- con la misma probabilidad ya existente que decide si cualquier otra obligación se resuelve como mobiliario o como el eslabón de una cadena -- en vez de estar siempre limitada a ser una ficha ya colocada sin más historia.

**Why this priority**: Amplía la variedad real de niveles con rojo que el generador puede producir -- sin esto, toda división de rojo generada tendría siempre una "mitad" trivial, reduciendo la utilidad de la propia mecánica que se está añadiendo.

**Independent Test**: Generar un lote suficientemente grande con rojo disponible y confirmar que, entre los niveles cuya solución pasa por una división de rojo, al menos algunos tienen la rama secundaria explicada por su propia cadena (una obligación de tipo 'striker-origin' propia, no solo mobiliario), respetando en todo momento que ambas ramas comparten la fragilidad ya avanzada del split original.

**Acceptance Scenarios**:

1. **Given** la obligación de la rama secundaria de una división de rojo, **When** el generador decide cómo resolverla, **Then** se somete al mismo sorteo de continuación de cadena (`chainOriginProbability`/`defenderContinuationProbability`) que cualquier otra obligación -- ningún caso especial que la fuerce siempre a ser mobiliario.
2. **Given** la rama secundaria resuelta como mobiliario, **When** se coloca en el tablero, **Then** su fragilidad es la ya avanzada por el split (nunca `'new'` por defecto, a diferencia del mobiliario normal) -- consistente con FR-015 de 009-red-piece.
3. **Given** la rama secundaria resuelta como el resultado de un golpe anterior (su propia cadena), **When** esa cadena se construye, **Then** el eslabón que golpea la posición de la rama secundaria debe producir, en ese punto, exactamente la fragilidad ya avanzada del split -- no una fragilidad libre.

---

### User Story 3 - Los niveles ya generados se regeneran para poder incluir rojo (Priority: P3, añadida durante la implementación)

Quien opera el generador borra los niveles ya generados en `levels/` y vuelve a generar el mismo
tipo de lote (10 niveles por cada valor válido de `complexityScore`) contra el generador ya
extendido con rojo -- en vez de conservar el lote anterior (que nunca pudo incluir rojo) y
limitarse a reverificarlo. Añade también un valor más de `complexityScore` al rango válido, ya
que `availableColors` ganó un nivel (FR-006).

**Why this priority**: El plan original de esta feature asumía que reverificar bastaba, porque
ninguno de los 140 niveles existentes usaba rojo. El usuario pidió explícitamente ir más allá:
sin regenerar, ningún nivel entregado usaría nunca la mecánica que esta feature acaba de añadir.

**Independent Test**: Borrar `levels/` por completo, regenerar 10 niveles por cada valor de
`complexityScore` en el rango válido actualizado (ahora incluye un valor más que antes de esta
feature, por el nuevo nivel de `availableColors`), y confirmar que el 100% resuelve `'won'` al
reproducir su secuencia de referencia con el motor real -- misma garantía que 016 ya estableció
para esta misma operación.

**Acceptance Scenarios**:

1. **Given** el lote de niveles ya generado antes de esta feature, **When** se borra y regenera
   con rojo disponible, **Then** el nuevo lote tiene 10 niveles por cada valor válido de
   `complexityScore` (uno más que antes, por el nuevo nivel de `availableColors`).
2. **Given** el nuevo lote regenerado, **When** se reproduce la secuencia de referencia de cada
   nivel con el motor real, **Then** el 100% resuelve `'won'`.
3. **Given** el nuevo lote regenerado, **When** se inspecciona cuántos niveles usan rojo (en
   mano, tablero, u objetivo), **Then** una fracción no trivial lo hace -- confirmando que rojo
   realmente aparece en el lote entregado, no solo en teoría.

---

### Edge Cases

- ¿Qué ocurre si la ficha original (antes de dividirse) necesitaría ser `'cracked'` para encajar en el resto de la construcción? Esa combinación no es constructivamente válida (ambas ramas nacerían `BROKEN` y desaparecerían) -- el generador la descarta como cualquier otra combinación inviable y reintenta (FR-007 de 011), no es un caso especial de esta feature.
- ¿Qué ocurre si, por las direcciones/casillas elegidas, las dos ramas de una división generada resultarían -- de construirse -- colisionando entre sí de verdad (019-synchronous-tick-resolution)? El generador no lo detecta ni lo evita a propósito (fuera de alcance, ver Assumptions) -- si la construcción resultante deja de resolver `'won'` por esto, se descarta igual que cualquier otro fallo de validación hacia delante.
- ¿Qué ocurre con los niveles ya generados (`levels/`) tras esta feature? Actualización tras implementar: el plan original decía "se reverifica, no se regenera" (ninguno de los 140 usaba rojo). El usuario pidió explícitamente ir más allá y regenerar el lote completo desde cero para que rojo pueda aparecer en él -- ver Historia 3 (añadida).
- ¿Qué ocurre con los dos niveles del prototipo (14/15) que ya usan rojo? No se tocan -- siguen siendo hand-authored, ajenos al generador (mismo alcance que 016/017/019 ya establecieron).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El generador DEBE poder resolver una obligación de tipo 'defender' mediante un golpe de rojo, cuando rojo está entre los colores disponibles -- produciendo una obligación de origen para la ficha roja y una obligación adicional para la rama secundaria (misma casilla, dirección perpendicular a la de la ficha que lleva al objetivo).
- **FR-002**: La ficha original golpeada por rojo (antes de dividirse) DEBE construirse siempre con fragilidad `'new'` -- nunca `'cracked'` -- ya que solo así ambas ramas resultantes pueden asentarse de verdad (FR-015 de 009-red-piece: `'cracked'` produce dos ramas `BROKEN` que nunca se asientan, inválido para cualquier construcción que necesite una rama real).
- **FR-003**: La rama secundaria de una división de rojo DEBE poder resolverse mediante el mismo mecanismo de decisión ya existente para cualquier obligación (mobiliario vs. continuación de cadena, `chainOriginProbability`/`defenderContinuationProbability`) -- sin un caso especial que la limite siempre a mobiliario.
- **FR-004**: Cualquier resolución de la rama secundaria (mobiliario o cadena) DEBE producir, en el punto donde esa rama existe, exactamente la fragilidad ya avanzada por el split original -- nunca la fragilidad libre/por defecto que rige el mobiliario u obligaciones normales.
- **FR-005**: El generador NO DEBE razonar sobre, evitar, ni explotar activamente las colisiones cruzadas reales entre las dos ramas de una división que introdujo 019-synchronous-tick-resolution -- cualquier construcción inválida por esa causa se descarta mediante la validación hacia delante y política de reintento ya existentes (FR-007 de 011).
- **FR-006**: El fichero de configuración de horquillas de complejidad (`tools/generator/complexity-config.json`) DEBE ganar un nivel adicional en el factor `availableColors` existente que incluya rojo -- no un factor nuevo separado.
- **FR-007**: Ninguna construcción con `availableColors` que NO incluya rojo DEBE cambiar de comportamiento como consecuencia de esta feature -- cero regresión para el caso ya existente.
- **FR-008**: El motor (`src/engine/`) NO DEBE cambiar como consecuencia de esta feature -- toda la mecánica de rojo que se invierte ya existe y está estable (009/016/017/019).
- **FR-009** (Historia 3, añadida): los niveles ya generados en `levels/` DEBEN borrarse y regenerarse desde cero (10 por cada valor válido de `complexityScore`, rango actualizado tras FR-006) -- no basta con reverificarlos, ya que ninguno de los existentes podía usar rojo.

### Key Entities

- **Obligación de rama secundaria**: la obligación que explica la ficha que una división de rojo produce y que NO se usa para llegar directamente al objetivo -- se resuelve con el mismo mecanismo que cualquier obligación normal (mobiliario o cadena), pero con su fragilidad de partida fijada a la ya avanzada por el split, no libre.
- **Fragilidad compartida del split**: el estado de fragilidad (siempre `'cracked'`, ya que la ficha original debe partir de `'new'` por FR-002) que ambas ramas de una misma división comparten -- una restricción que se propaga a cómo se resuelve la rama secundaria (FR-004), no solo a la que lleva al objetivo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Generando un lote con `availableColors` incluyendo rojo, al menos una fracción no trivial de los niveles resultantes tiene una `solution` que pasa por un golpe de rojo, verificado reproduciendo esa secuencia con el motor real.
- **SC-002**: El 100% de los niveles generados (con o sin rojo) siguen resolviendo `'won'` al reproducir su secuencia de referencia con el motor real.
- **SC-003**: El 100% de las construcciones con rojo colocan la ficha original golpeada con fragilidad `'new'`, nunca `'cracked'`.
- **SC-004**: Entre los niveles generados cuya solución pasa por una división de rojo, al menos algunos tienen la rama secundaria explicada por su propia cadena, no solo por mobiliario.
- **SC-005**: El 100% de las construcciones sin rojo en `availableColors` producen resultados idénticos a los de antes de esta feature -- cero regresión.
- **SC-006** (Historia 3, añadida): tras borrar y regenerar `levels/`, el lote tiene 10 niveles por cada uno de los valores válidos de `complexityScore` (7 a 21, uno más que antes por FR-006), el 100% resuelve `'won'`, y una fracción no trivial de los niveles usa rojo (en mano, tablero, u objetivo).

## Assumptions

- El generador NO razona sobre las colisiones cruzadas reales entre las dos ramas (019-synchronous-tick-resolution) -- se ignoran deliberadamente, mismo criterio que el wrap-around de marrón desde 011. Cualquier intento inválido por esta causa se descarta y reintenta como cualquier otro. Mejorar esto (detectarlas, evitarlas, o explotarlas a propósito como mecanismo de dificultad) queda anotado como una mejora futura separada del generador, no parte de esta feature.
- `complexity-config.json` gana un nivel adicional en `availableColors` (no un factor nuevo) -- las horquillas concretas de los demás factores no cambian como consecuencia de esta feature, salvo que la fase de planificación encuentre una razón concreta para ajustarlas.
- El motor (`src/engine/`) ya soporta todo lo necesario (rojo, su división, la resolución síncrona de sus dos ramas) -- esta feature es exclusivamente del generador (`tools/generator/`).
- (SUPERADA por Historia 3) Los 140 niveles ya generados no usan rojo -- inicialmente se planeó solo reverificarlos; el usuario pidió explícitamente borrarlos y regenerarlos desde cero para que rojo pueda aparecer en el lote entregado. Ver research.md, "Decisión 11" para la tasa de fallo observada en los valores altos de `complexityScore` y cómo se resolvió.
