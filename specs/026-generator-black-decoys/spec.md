# Feature Specification: Generador -- Negro como Eliminador de Bloqueantes

**Feature Branch**: `026-generator-black-decoys`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "Añadir soporte para negro en el generador de niveles (tools/generator/), como mecanismo independiente de la cadena de obligaciones de verde/naranja/marrón/rojo: negro nunca explica una obligación existente (no reposiciona nada, borra una línea entera), así que su único papel es un lanzamiento EXTRA que hace aparecer entre 1 y 7 fichas bloqueantes en una fila o columna, y las elimina de un solo golpe. Negro se lanza directamente desde la mano, contando dentro de launchCount (compite por el presupuesto de lanzamientos). Los bloqueantes usan colores de availableColors y la misma convención de fragilidad que los señuelos de tablero ya existentes (nunca broken, gobernada por fragilityProfile). Activado por un parámetro nuevo, apagado por defecto (mismo patrón que boardDecoyProbability), para no alterar ninguna secuencia de rng() de un nivel que no lo pida. Los bloqueantes bloquean activamente algo que la solución necesita despejado: (a) el carril de otro lanzamiento de mano de la solución, o (b) una celda de aterrizaje intermedia que otro empuje de la solución necesita vacía. Como negro limpia la línea ENTERA que recorre (no solo hasta el punto de impacto), y esa línea es siempre colineal con lo que protege, negro debe acercarse siempre en PERPENDICULAR al eje protegido -- nunca por el mismo eje, o se llevaría también el objetivo/origen real. La seguridad de cada candidato se decide reproduciendo la solución completa (con negro insertado) con el motor real (validatesForward), nunca con un registro estático de señuelos. Si ninguna estrategia encuentra una oportunidad válida, el nivel se genera igualmente, simplemente sin usar negro esa vez -- oportunista, nunca fuerza un uso decorativo ni hace fallar el intento completo. Negro nunca es el color del objetivo ni de ningún eslabón de la cadena de obligaciones. Una variante -- negro ya colocado en el tablero, empujado indirectamente por otra ficha hasta convertirse en atacante -- queda fuera de alcance de esta feature."

## Clarifications

### Session 2026-09-04

- Q: ¿Cómo encaja negro en el modelo de obligaciones existente (verde/naranja/marrón/rojo se eligen para EXPLICAR una obligación empujando un defensor a una celda)? → A: no encaja -- negro no reposiciona nada, borra una línea entera, así que no puede explicar ninguna obligación. Su único papel en el generador es un lanzamiento extra, independiente de la cadena de obligaciones, que hace aparecer y luego elimina bloqueantes.
- Q: ¿Cuántos bloqueantes hace aparecer, y de qué color? → A: entre 1 y 7, colores tomados de `availableColors`.
- Q: ¿El lanzamiento de negro cuenta dentro de `launchCount`? → A: sí, compite por el mismo presupuesto que los lanzamientos "de verdad" de la solución.
- Q: ¿Fragilidad de los bloqueantes? → A: la misma convención que los señuelos de tablero ya existentes -- nunca `broken`, gobernada por `fragilityProfile`.
- Q: ¿Puede negro ser alguna vez el color del objetivo o de algún eslabón de la cadena de obligaciones? → A: no, nunca.
- Q: ¿Los bloqueantes son siempre decorativos, o pueden bloquear activamente algo que la solución necesita? → A: pueden bloquear activamente -- es la única forma que se construye. El lanzamiento de negro se coloca en el punto de la secuencia que haga falta, siempre que dispare ANTES de que el elemento que protege lo necesite despejado.
- Q: ¿De qué forma concreta pueden "bloquear"? → A: dos formas: (1) ocupando el carril de aproximación de OTRO lanzamiento de mano de la solución; (2) ocupando directamente una celda de aterrizaje intermedia que otro empuje de la solución necesita vacía.
- Q: **(Corrección importante)** Al construir la primera versión, se descubrió que colocar los bloqueantes en el MISMO eje que lo que protegen es estructuralmente inviable: negro limpia la línea ENTERA que recorre, y esa línea es siempre colineal con el objetivo/origen real (viajar en línea recta implica compartir carril) -- limpiarla se lleva también lo que se quería proteger. → A (confirmado por el usuario): negro debe acercarse siempre en PERPENDICULAR al eje que protege, nunca por el mismo eje. Esto limita a un bloqueante "obligatorio" por uso (uno por disparo de negro); la riqueza de "1 a 7" se recupera con bloqueantes decorativos adicionales en la MISMA línea perpendicular que negro ya recorre.
- Q: ¿Cómo se verifica que una línea/celda es segura de usar -- comprobando el tablero inicial, o el estado real en el momento en que negro actuaría? → A (confirmado por el usuario): el estado real en ese momento, no la foto inicial -- "no se trata de la foto del inicio del nivel sino la foto actual del nivel". Esto se resuelve reproduciendo la solución candidata completa (con negro) con el motor real (`validatesForward`) en vez de mantener un registro estático de señuelos -- si valida, es segura; si no, se descarta ese candidato (nunca todo el intento de generación).
- Q: ¿Qué pasa si ninguna estrategia encuentra una oportunidad válida? → A: el nivel se genera igualmente, sin usar negro esa vez -- oportunista, nunca fuerza un uso decorativo ni hace fallar el intento de generación completo.
- Q: ¿Negro puede estar ya colocado en el tablero y ser empujado indirectamente por otra ficha hasta convertirse en atacante? → A: no en esta feature -- negro siempre se lanza directamente desde la mano; esa variante queda fuera de alcance, para una feature futura.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Negro protege el carril de aproximación de otro lanzamiento, acercándose en perpendicular (Priority: P1)

Al generar un nivel con el nuevo parámetro activado, el generador identifica un lanzamiento de mano ya discutido con un carril despejado, y coloca un bloqueante en una celda libre de ese carril (entre su entrada y su objetivo real) -- el bloqueo real: sin negro, ese lanzamiento golpearía el bloqueante en vez de su objetivo. Negro se acerca a ese bloqueante por el eje PERPENDICULAR al carril protegido (nunca por el mismo eje, o se llevaría también el objetivo real), y puede llevarse de paso otros bloqueantes puramente decorativos repartidos por esa misma línea perpendicular. Insertado ANTES del lanzamiento protegido en el orden de juego, negro limpia esa línea perpendicular a tiempo.

**Why this priority**: Es la forma más interesante de esta feature -- convierte a negro en un paso genuinamente necesario, no decorativo.

**Independent Test**: Generar un nivel con esta estrategia activa y comprobar que, sin el lanzamiento de negro, el lanzamiento protegido golpearía el bloqueante en vez de su objetivo real; que negro viaja por un eje distinto al del carril protegido; y que reproducida con el motor real, la secuencia completa (negro primero, el lanzamiento protegido después) termina en `'won'` sin ningún missclick.

**Acceptance Scenarios**:

1. **Given** un lanzamiento de mano ya discutido con un carril despejado, **When** el generador activa esta estrategia, **Then** coloca un bloqueante en una celda de ese carril (entre su entrada y su objetivo, nunca sobre el objetivo).
2. **Given** ese bloqueante, **When** el generador construye el lanzamiento de negro, **Then** viaja por el eje PERPENDICULAR al del carril protegido, nunca por el mismo eje.
3. **Given** ese nivel, **When** se reproduce con el motor real, **Then** negro ocurre ANTES que el lanzamiento protegido, limpia su línea perpendicular, y el lanzamiento protegido después alcanza su objetivo real sin missclick -- la ficha objetivo, al estar en el eje protegido (no en el perpendicular), nunca se ve afectada por la limpieza de negro.

---

### User Story 2 - Negro protege una celda de aterrizaje intermedia, acercándose en perpendicular a la dirección del empuje (Priority: P1)

El generador identifica una celda de aterrizaje intermedia -- una celda donde, según la solución ya construida, una ficha se asienta como resultado de un empuje anterior -- y coloca un bloqueante DIRECTAMENTE sobre ella. Negro se acerca por el eje perpendicular a la dirección de ESE empuje (nunca por el mismo eje, o se llevaría también la ficha que está a punto de ser empujada, que por construcción está en esa misma línea). Insertado ANTES de ese empuje en el orden de juego, negro limpia la línea a tiempo -- incluida la propia celda de aterrizaje, dejándola vacía para cuando el empuje real la necesite.

**Why this priority**: Extiende la misma idea de la User Story 1 a un punto intermedio de la cadena de obligaciones.

**Independent Test**: Generar un nivel con esta estrategia activa y comprobar que la celda de aterrizaje tiene un bloqueante antes de que negro actúe; que negro viaja por el eje perpendicular a la dirección del empuje que la llena; y que reproducida con el motor real, ese empuje solo ocurre después de que negro haya limpiado la línea, sin haber afectado a la ficha que estaba a punto de ser empujada.

**Acceptance Scenarios**:

1. **Given** una celda de aterrizaje intermedia, **When** el generador activa esta estrategia, **Then** coloca un bloqueante directamente sobre ella.
2. **Given** ese bloqueante, **When** el generador construye el lanzamiento de negro, **Then** viaja por el eje perpendicular a la dirección del empuje que llena esa celda, nunca por el mismo eje.
3. **Given** ese nivel, **When** se reproduce con el motor real, **Then** negro ocurre ANTES que ese empuje, limpia la línea perpendicular (incluida la celda de aterrizaje), y el empuje posterior se asienta ahí correctamente -- la ficha que estaba a punto de ser empujada, al estar en el eje del empuje (no en el perpendicular), nunca se ve afectada.

---

### User Story 3 - La seguridad de cada candidato se decide reproduciendo la solución completa con el motor real (Priority: P1)

Antes de aceptar cualquier candidato con negro (User Story 1 o 2), el generador construye el nivel completo que resultaría (bloqueante(s) + negro insertado) y lo reproduce de principio a fin con el motor real, exactamente igual que ya hace con cualquier solución "de verdad". Solo si esa reproducción termina en `'won'` sin ningún missclick ni victoria/derrota prematura se acepta el candidato.

**Why this priority**: Es lo que hace segura esta feature de verdad -- no basta con mirar el tablero inicial, porque una celda vacía al principio puede recibir una ficha real durante la partida antes de que negro dispare. Reproducir la solución completa con el motor real es la única forma fiable de saberlo.

**Independent Test**: Construir un candidato cuya línea perpendicular coincida, en algún punto de la partida (no en el tablero inicial), con una ficha real de la solución, y comprobar que el generador lo descarta -- sin hacer fallar el intento de generación completo, y sin usar negro para ese nivel.

**Acceptance Scenarios**:

1. **Given** un candidato con negro construido, **When** el generador lo reproduce con el motor real, **Then** solo lo acepta si el resultado es idéntico al de cualquier solución válida -- ningún missclick, ninguna victoria/derrota antes de tiempo, `'won'` exactamente en el último paso.
2. **Given** que ningún candidato (ni Estrategia A ni B) valida, **When** el generador continúa, **Then** usa la solución real original, sin negro, sin que eso haga fallar el intento.

---

### Edge Cases

- ¿Qué pasa si `launchCount` no deja presupuesto suficiente para el lanzamiento extra de negro? Ese candidato simplemente no se acepta (no valida, `pieceIndex`/presupuesto ya está agotado) -- no hace fallar el intento por sí solo.
- ¿Qué pasa si `availableColors` no incluye suficientes colores distintos para los bloqueantes? No hay problema -- los bloqueantes pueden repetir color entre sí libremente.
- ¿Pueden los bloqueantes coincidir en color con la ficha objetivo o con alguna ficha de la cadena de obligaciones? Sí, sin ningún problema.
- ¿Puede colocarse más de un lanzamiento de negro en el mismo nivel generado? No -- esta feature añade como mucho uno por nivel.
- ¿Qué pasa si el carril/línea perpendicular elegido es demasiado corto para 7 bloqueantes? Se coloca el máximo que quepa (como mínimo 1, el obligatorio).
- ¿Qué pasa si esta feature está desactivada (comportamiento por defecto)? Ningún cambio -- ni un nivel adicional, ni ninguna llamada nueva a `rng()`, idéntico al generador actual.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El generador DEBE soportar un parámetro nuevo que activa esta feature, apagado por defecto -- sin consumir ninguna llamada a `rng()` cuando no se solicita.
- **FR-002**: Cuando está activado, DESPUÉS de que la solución real ya haya validado por sí sola, el generador DEBE intentar construir, en este orden de prioridad, un candidato de: (a) proteger el carril de un lanzamiento de mano ya discutido (User Story 1), (b) proteger una celda de aterrizaje intermedia (User Story 2).
- **FR-003**: Si ningún candidato válido (User Story 3) resulta de ninguna estrategia, el generador NO DEBE usar negro para este intento -- el nivel DEBE generarse igualmente con la solución real original, y esta ausencia NO DEBE hacer fallar el intento de generación por sí sola.
- **FR-004**: Para la estrategia (a), el bloqueante obligatorio DEBE ir en una celda libre del carril del lanzamiento protegido, estrictamente entre su punto de entrada y su objetivo real, nunca sobre la celda objetivo.
- **FR-005**: Para la estrategia (b), el bloqueante obligatorio DEBE ir DIRECTAMENTE sobre la celda de aterrizaje intermedia elegida.
- **FR-006**: En cualquiera de las dos estrategias, negro DEBE acercarse al bloqueante obligatorio por el eje PERPENDICULAR al eje protegido (el carril del lanzamiento en (a), o la dirección del empuje que llena la celda en (b)) -- nunca por el mismo eje.
- **FR-007**: El generador DEBE poder añadir entre 0 y 6 bloqueantes decorativos adicionales (hasta un total de 7) en celdas vacías de la MISMA línea perpendicular que negro recorre, nunca en el eje protegido -- con colores de `availableColors` y la misma convención de fragilidad que los señuelos de tablero ya existentes (nunca `broken`, gobernada por `fragilityProfile`).
- **FR-008**: El lanzamiento de negro DEBE ocurrir, en el orden de juego real, ANTES del lanzamiento o empuje que protege.
- **FR-009**: El lanzamiento de negro DEBE contar dentro del presupuesto de `launchCount`.
- **FR-010**: El generador DEBE aceptar un candidato con negro únicamente si, al reproducir la secuencia completa resultante con el motor real, el resultado es `'won'` exactamente en el último paso, sin ningún missclick ni victoria/derrota prematura (User Story 3) -- nunca basándose en una comprobación estática del tablero inicial.
- **FR-011**: Negro NO DEBE poder ser elegido como color de objetivo ni como color de ningún eslabón de la cadena de obligaciones.
- **FR-012**: Como mucho UN lanzamiento de negro DEBE añadirse por nivel generado con esta feature.
- **FR-013**: La variante -- negro ya colocado en el tablero, activado indirectamente por el empuje de otra ficha de la solución hasta convertirse en atacante -- NO DEBE implementarse como parte de esta feature.
- **FR-014**: Ningún nivel generable hoy (sin esta feature activada) DEBE cambiar de comportamiento como consecuencia de esta feature.

### Key Entities

- **Bloqueante**: ficha de color arbitrario (`availableColors`) colocada para que negro la elimine -- el obligatorio ocupa la celda que de verdad bloquea algo (FR-004/FR-005); los decorativos (0 a 6) van en la misma línea perpendicular que negro ya recorre. Nunca `broken`.
- **Eje protegido**: el carril de un lanzamiento de mano (Estrategia A) o la dirección de un empuje (Estrategia B) -- nunca es el eje que negro recorre.
- **Eje perpendicular**: el eje que negro SÍ recorre -- perpendicular al eje protegido, nunca colineal con el objetivo/origen real que se protege.
- **Candidato**: una combinación completa (tablero + bloqueante(s) + lanzamiento de negro insertado) que solo se acepta si reproducirla de principio a fin con el motor real termina en `'won'` sin incidentes (User Story 3).
- **Lanzamiento de negro**: un paso de `solution` -- un lanzamiento normal (mano → impacto) por el eje perpendicular, insertado justo antes de lo que protege. Ausente por completo cuando ningún candidato valida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cuando el generador acepta un candidato (estrategia (a) o (b)), el nivel resultante incluye un lanzamiento de negro que limpia entre 1 y 7 fichas bloqueantes, en el 100% de esos casos.
- **SC-002**: Negro viaja siempre por el eje PERPENDICULAR al que protege, nunca por el mismo eje, en el 100% de los niveles que lo incluyen.
- **SC-003**: El lanzamiento de negro ocurre siempre antes de lo que protege, en el 100% de los niveles que lo incluyen.
- **SC-004**: Todo candidato aceptado, reproducido con el motor real, termina en `'won'` exactamente en el último paso, sin ningún missclick ni victoria/derrota prematura, en el 100% de los casos.
- **SC-005**: Activar esta feature nunca reduce la tasa de éxito de generación de niveles por debajo de la que tendría sin ella.
- **SC-006**: Ningún nivel ya generable sin esta feature cambia de comportamiento -- 0 regresiones en la suite existente del generador.

## Assumptions

- La variante -- negro empujado indirectamente por otra ficha hasta convertirse en atacante -- queda fuera de alcance explícito de esta feature.
- Negro nunca es el color del objetivo ni de ningún eslabón de la cadena de obligaciones -- ya excluido implícitamente hoy porque nunca aparece en `availableColors`.
- El orden de prioridad exacto entre la estrategia (a) y la (b) es una decisión de diseño técnico (research.md); esta especificación solo exige que ambas se intenten antes de asumir que no hay oportunidad.
- Como mucho un lanzamiento de negro por nivel (FR-012): una simplificación deliberada para esta primera versión, no una limitación permanente.
- El nombre exacto del parámetro nuevo, y si participa en el reparto de `complexityScore`, es una decisión de diseño técnico -- esta especificación solo exige que exista, esté apagado por defecto, y no altere ninguna secuencia de `rng()` ya existente cuando no se activa.
- Los bloqueantes son fichas de TABLERO (parte de `pieces`, no de `hand`).
- La Estrategia B, en esta primera versión, solo protege celdas de aterrizaje cuyo empuje viene de un lanzamiento de mano directo -- no de un eslabón más profundo de una cadena (research.md).
