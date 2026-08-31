# Feature Specification: Fragilidad como Factor de Dificultad del Generador

**Feature Branch**: `013-generator-fragility-difficulty`

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "Extender el generador de niveles (tools/generator/) para que el estado inicial de fragilidad (NEW/CRACKED/BROKEN) de cada ficha sea un factor de generación de primera clase, igual que el color o la posición, en vez de ser solo declarable a mano vía createLevel. Decisiones ya cerradas: (1) romper una ficha de forma inesperada a mitad de la solución, por desgaste acumulado entre lanzamientos, es una señal de dificultad intencionada, no un bug; (2) la dificultad NO se mide en dureza media / número medio de golpes -- se mide en la heterogeneidad de estados de fragilidad DENTRO de cada grupo de rol (fichas de tablero por un lado, fichas de mano por otro): un nivel donde todas las fichas de tablero comparten un mismo estado y todas las de mano comparten otro es MÁS FÁCIL que uno con estados mezclados dentro de un mismo grupo; (3) la dificultad se expone como un pequeño conjunto de perfiles discretos con nombre (p. ej. fácil/media/difícil) en vez de un parámetro numérico continuo 0-1; (4) restricción de seguridad innegociable: ninguna ficha que la propia solución construida por el generador golpee más de una vez a lo largo de toda la cadena de lanzamientos puede quedar asignada (por estado inicial, o por acumulación de los golpes ya previstos) a un estado que la rompa (BROKEN) antes de completar su papel en esa solución -- si no, el nivel generado deja de ser más difícil y pasa a ser irresoluble; (5) de la restricción anterior se sigue un reparto natural: las fichas críticas para la solución reciben una fragilidad inicial acotada/derivada de cuántas veces la propia cadena construida las golpea (parte de seguridad), mientras que las fichas señuelo (de tablero y de mano -- concepto ya existente de la feature 011-level-generator-basic) nunca son tocadas por la reproducción garantizada, así que son el lugar libre y seguro donde vive de verdad la heterogeneidad que decide la dificultad. Contexto ya vigente en el código (informativo, no a re-especificar): Piece.fragility es un campo obligatorio ('new'|'cracked'|'broken'); createLevel ya admite declarar fragilidad inicial por ficha de tablero y de mano (012-piece-fragility, ya en producción); una ficha de tablero declarada 'broken' al autoría se omite en silencio por createLevel (comportamiento FR-016 ya existente) -- así que un 'señuelo de tablero roto' desaparecería sin más y dejaría de ser un señuelo, caso límite que esta spec debe abordar explícitamente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La fragilidad asignada nunca rompe la propia solución construida (Priority: P1)

Quien opera el generador activa la asignación de fragilidad para un nivel. El generador, antes de entregar el nivel como válido, se asegura de que ninguna ficha crítica para su propia secuencia de lanzamientos de referencia recibe un estado inicial que la haría romperse (BROKEN) antes de haber cumplido su papel en esa secuencia -- teniendo en cuenta cuántas veces esa misma ficha física va a ser golpeada a lo largo de toda la cadena construida.

**Why this priority**: Es la garantía sin la cual activar fragilidad sería peligroso -- sin esto, "más difícil" podría en realidad significar "irresoluble" en algunos niveles generados, lo cual invalida el propósito mismo del generador (FR-006/FR-007 de 011-level-generator-basic). Todo lo demás de esta feature se apoya en que esto se cumpla siempre.

**Independent Test**: Generar un lote grande de niveles con fragilidad activada y varios lanzamientos por nivel (para maximizar la probabilidad de que una misma ficha sea golpeada más de una vez a lo largo de la cadena), y comprobar que el 100% de los niveles entregados como válidos siguen resolviéndose (`resultado: 'won'`) al reproducir su secuencia de referencia con el motor real.

**Acceptance Scenarios**:

1. **Given** la solución construida golpea una misma ficha física dos veces a lo largo de dos lanzamientos distintos, **When** el generador evalúa esa construcción, **Then** descarta el intento -- ninguna ficha golpeada más de una vez por la solución tiene un estado inicial que le permita sobrevivir a ambos golpes (ver Nota de diseño).
2. **Given** una ficha crítica para la solución (de tablero) que la cadena construida golpea exactamente una vez, **When** el generador le asigna fragilidad inicial, **Then** parte siempre de NEW -- es el único estado que sobrevive a ese golpe obligatorio sin dejarla BROKEN antes de asentarse donde la solución la necesita.
3. **Given** un nivel generado con fragilidad activada, **When** se reproduce su secuencia de referencia completa con el motor real, **Then** el resultado final es exactamente `'won'`, igual que si la fragilidad no se hubiera activado.

**Nota de diseño**: dentro de la solución construida, solo hay dos categorías de ficha crítica: las que la cadena golpea (como defensoras) alguna vez, y las que se lanzan desde la mano y nunca vuelven a ser golpeadas por la propia construcción. Como cada golpe exige que la ficha sobreviva (si no, la casilla que esa obligación necesita no queda con el color correcto), una ficha golpeada exactamente una vez no tiene margen: solo NEW sobrevive. Una ficha golpeada dos o más veces no tiene NINGÚN estado inicial seguro (ni siquiera NEW sobrevive a dos golpes). El único margen real de elección está en las fichas lanzadas desde la mano, que la construcción nunca vuelve a golpear -- ver Historia 2.

---

### User Story 2 - La dificultad se controla mediante un perfil discreto, aplicado a los señuelos y a las fichas lanzadas (Priority: P2)

Quien opera el generador elige uno de un pequeño conjunto de perfiles de dificultad con nombre. El generador usa ese perfil para decidir cuánta variedad de estados de fragilidad introduce dentro de cada uno de tres grupos: señuelos de tablero, señuelos de mano, y las propias fichas que la solución lanza desde la mano (las únicas fichas críticas con margen real de elección -- ver Nota de diseño de la Historia 1) -- un perfil más difícil produce más mezcla de estados dentro de cada grupo; un perfil más fácil mantiene cada grupo en un estado uniforme entre sí. Las fichas de tablero que la solución golpea quedan siempre fuera de este control (forzadas a NEW por la Historia 1).

**Why this priority**: Es donde vive el valor real de la feature para quien diseña niveles -- sin esto, la Historia 1 por sí sola solo garantiza seguridad, pero no ofrece ningún control de dificultad real.

**Independent Test**: Generar niveles con señuelos y con cada perfil disponible, y comprobar sobre la salida que el perfil más difícil produce, en agregado sobre muchos niveles, más variedad de estados de fragilidad dentro de cada uno de los tres grupos (señuelos de tablero, señuelos de mano, fichas lanzadas de la solución) que el perfil más fácil, sin que ningún señuelo aparezca nunca en la secuencia de referencia y sin que ninguna ficha de tablero golpeada por la solución varíe de NEW.

**Acceptance Scenarios**:

1. **Given** se pide un nivel con señuelos y el perfil más fácil, **When** el generador asigna fragilidad, **Then** todos los señuelos de tablero comparten un mismo estado entre sí, todos los señuelos de mano comparten un mismo estado entre sí, y todas las fichas lanzadas por la solución comparten un mismo estado entre sí (los tres grupos pueden diferir entre ellos).
2. **Given** se pide un nivel con señuelos y el perfil más difícil, **When** el generador asigna fragilidad, **Then** aparece más de un estado de fragilidad distinto dentro de al menos uno de los tres grupos, con una probabilidad sensiblemente mayor que con el perfil más fácil.
3. **Given** cualquier perfil de dificultad, **When** se reproduce la secuencia de referencia completa (incluyendo las fichas lanzadas, ahora con su fragilidad inicial variable) con el motor real, **Then** el nivel se resuelve exactamente igual a `'won'` -- variar entre NEW y CRACKED en una ficha lanzada nunca le impide completar su empuje, porque su propia fragilidad no afecta a si golpea o empuja, solo a si sobrevive a ser golpeada (y estas fichas, por definición, la construcción nunca vuelve a golpearlas).
4. **Given** cualquier perfil de dificultad, **When** se asigna fragilidad a una ficha de tablero que la solución golpea, **Then** el perfil no tiene ningún efecto sobre ella -- permanece siempre en NEW, por la restricción de la Historia 1.

---

### User Story 3 - Ningún señuelo de tablero se asigna en estado que lo haga desaparecer (Priority: P3)

Al asignar fragilidad a un señuelo de tablero según el perfil elegido, el generador nunca lo deja en estado BROKEN, porque una ficha de tablero declarada BROKEN se omite en silencio al guardar el nivel (comportamiento ya existente) -- un "señuelo roto" así dejaría de estar en el tablero y dejaría de cumplir su función de señuelo.

**Why this priority**: Es un caso límite concreto de la Historia 2 que, si no se trata explícitamente, produciría niveles con menos señuelos de tablero de los pedidos, de forma silenciosa e impredecible según el perfil elegido.

**Independent Test**: Generar muchos niveles con señuelos de tablero y el perfil más difícil (el que más heterogeneidad introduce), y comprobar que el número de fichas de tablero en el nivel entregado coincide siempre con el número de señuelos de tablero pedidos más las fichas críticas de la solución -- ninguna desaparece por haber sido asignada BROKEN.

**Acceptance Scenarios**:

1. **Given** el perfil de dificultad elegido decidiría BROKEN para un señuelo si este estuviera en la mano, **When** ese mismo señuelo está en el tablero, **Then** el generador le asigna en su lugar el estado más severo posible que siga siendo visible (CRACKED), nunca BROKEN.
2. **Given** un nivel con señuelos de mano, **When** el perfil de dificultad decide BROKEN para alguno de ellos, **Then** ese señuelo de mano sí se entrega en estado BROKEN -- la restricción de esta historia aplica únicamente a señuelos de tablero.

---

### Edge Cases

- ¿Qué ocurre si una ficha crítica de tablero es golpeada dos o más veces a lo largo de la cadena? Ningún estado inicial la salva -- ni siquiera NEW sobrevive a dos golpes (ver Nota de diseño, Historia 1). El intento de construcción se descarta como cualquier otro fallo de generación (política de fallos ya existente, FR-007 de 011-level-generator-basic), no es un caso especial.
- ¿Qué ocurre si se piden señuelos de tablero pero no se activa ningún perfil de dificultad (fragilidad no solicitada)? Los señuelos, como cualquier ficha, se entregan en el estado por defecto (NEW) -- el comportamiento del generador sin esta feature activada no cambia.
- ¿Qué ocurre si el perfil de dificultad elegido no encuentra ningún señuelo ni ficha lanzada sobre la que introducir heterogeneidad (por ejemplo, `decoyCount` en 0, ningún señuelo de tablero, y `launchCount` en 1)? El perfil no tiene ningún efecto observable en ese nivel -- no es un fallo de generación.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE asegurarse de que el estado de fragilidad inicial de cada ficha de tablero crítica para la solución es coherente con cuántas veces la secuencia de lanzamientos de referencia construida la golpea a lo largo de toda la cadena -- sin necesidad de que esto se resuelva mediante un mecanismo dedicado nuevo, si el comportamiento ya existente del generador (asignación por defecto + verificación de reproducción completa) ya lo garantiza.
- **FR-002**: El sistema NO DEBE asignar a ninguna ficha de tablero crítica para la solución un estado de fragilidad inicial que, sumado a los golpes que la propia secuencia de referencia le tiene previstos antes de completar su papel, la deje BROKEN en algún punto intermedio de esa secuencia -- en la práctica, cualquier ficha de tablero golpeada exactamente una vez DEBE partir de NEW (es el único estado que sobrevive), y ninguna ficha de tablero golpeada dos o más veces tiene ningún estado inicial válido.
- **FR-003**: Si no existe ningún estado de fragilidad inicial válido para una ficha de tablero crítica que respete FR-002 (es decir, la solución la golpea dos o más veces), el sistema DEBE tratarlo como un fallo de construcción de ese intento (misma política de descarte y reintento ya existente en el generador), nunca como un nivel entregado con una ficha en riesgo.
- **FR-004**: El sistema DEBE aceptar, como parámetro de generación adicional y opcional, un perfil de dificultad elegido entre un conjunto pequeño y con nombre (como mínimo: fácil, media, difícil); si no se indica, el comportamiento DEBE ser el mismo que sin esta feature (todas las fichas en NEW).
- **FR-005**: El sistema DEBE usar el perfil de dificultad elegido para decidir la fragilidad inicial de las fichas señuelo (de tablero y de mano) Y de las fichas que la propia solución lanza desde la mano -- estas últimas nunca vuelven a ser golpeadas por la construcción, así que partir de NEW o CRACKED es siempre seguro para ellas (FR-002 no las restringe). El perfil NUNCA DEBE decidir la fragilidad de una ficha de tablero que la solución golpea -- esa queda gobernada exclusivamente por FR-001/FR-002 (siempre NEW).
- **FR-006**: Con el perfil más fácil, el sistema DEBE asignar un único estado de fragilidad compartido a todos los señuelos de tablero entre sí, un único estado de fragilidad compartido a todos los señuelos de mano entre sí, y un único estado de fragilidad compartido a todas las fichas lanzadas por la solución entre sí (los tres grupos pueden diferir entre ellos, cada uno respetando sus propios estados permitidos).
- **FR-007**: Con perfiles más difíciles, el sistema DEBE aumentar la probabilidad de que aparezca más de un estado de fragilidad distinto dentro de un mismo grupo (señuelos de tablero, señuelos de mano, o fichas lanzadas de la solución), respecto al perfil más fácil.
- **FR-008**: El sistema NUNCA DEBE asignar el estado BROKEN a un señuelo de tablero, incluso cuando el perfil de dificultad elegido produciría BROKEN si esa misma ficha estuviera en la mano -- DEBE usar en su lugar el estado severo más alto que permanezca visible en el tablero (CRACKED).
- **FR-009**: El sistema SÍ DEBE poder asignar el estado BROKEN a un señuelo de mano, cuando el perfil de dificultad lo decida así.
- **FR-010**: El sistema NUNCA DEBE asignar el estado BROKEN a una ficha lanzada por la solución, aunque sea técnicamente segura para la reproducción (FR-005) -- se reserva BROKEN exclusivamente para señuelos de mano (FR-009), para que una ficha visualmente rota en la mano siga siendo señal de "no participa en la solución" y no genere ambigüedad con quien diseña o juega el nivel.
- **FR-011**: El sistema DEBE seguir reproduciendo con éxito (`resultado: 'won'`) la secuencia de lanzamientos de referencia de cualquier nivel entregado como válido, con fragilidad activada, exactamente igual que exige ya el generador sin esta feature (FR-006/FR-007 de 011-level-generator-basic) -- esta feature no releva esa garantía.
- **FR-012**: Dada la misma semilla, los mismos parámetros y el mismo perfil de dificultad, el sistema DEBE producir siempre el mismo nivel, incluyendo los mismos estados de fragilidad (reproducibilidad, ya exigida sin esta feature).
- **FR-013**: El sistema NO DEBE requerir ningún cambio en el motor de simulación existente (`src/engine/`) -- toda la lógica de esta feature vive en el generador, que ya consume fragilidad exclusivamente a través de la API pública existente de `createLevel` (012-piece-fragility).

### Key Entities

- **Ficha crítica de la solución**: cualquier ficha física que la secuencia de lanzamientos de referencia golpea, empuja o coloca en algún momento de la cadena construida. Se divide en dos categorías con reglas de fragilidad distintas:
  - **Ficha de tablero golpeada**: la solución la golpea (como defensora) una o más veces -- fragilidad forzada a NEW si la golpea una sola vez, o construcción rechazada si la golpea más de una (FR-001/FR-002/FR-003).
  - **Ficha lanzada de la solución**: sale de la mano hacia el tablero como parte de la secuencia de referencia; la construcción nunca vuelve a golpearla -- fragilidad gobernada por el perfil de dificultad, igual que un señuelo, pero sin poder llegar a BROKEN (FR-005/FR-010).
- **Ficha señuelo**: ficha de tablero o de mano, ya existente como concepto desde 011-level-generator-basic, que la secuencia de referencia nunca toca -- su fragilidad está gobernada por el perfil de dificultad elegido (FR-004 a FR-009).
- **Perfil de dificultad**: parámetro de generación con nombre (fácil/media/difícil como mínimo) que decide cuánta heterogeneidad de estados de fragilidad introduce el generador dentro de cada uno de los tres grupos que gobierna: señuelos de tablero, señuelos de mano, y fichas lanzadas de la solución.
- **Recuento de golpes de una ficha de tablero**: cuántas veces, a lo largo de toda la cadena de lanzamientos construida por el generador, esa ficha física concreta actúa como defensora -- determina si su fragilidad inicial está forzada a NEW (una vez) o si la construcción debe rechazarse (dos o más veces), según FR-002.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los niveles entregados como válidos por el generador, con fragilidad activada y cualquier perfil de dificultad, se resuelven (`resultado: 'won'`) al reproducir su secuencia de referencia con el motor real -- ni un solo nivel entregado se vuelve irresoluble por causa de la fragilidad asignada.
- **SC-002**: El 100% de los señuelos de tablero entregados en niveles generados, con cualquier perfil de dificultad, tienen un estado de fragilidad distinto de BROKEN.
- **SC-003**: Sobre un lote grande de niveles generados con señuelos y varios lanzamientos, la proporción de niveles donde aparece más de un estado de fragilidad dentro de un mismo grupo (señuelos de tablero, señuelos de mano, o fichas lanzadas de la solución) es sensiblemente mayor con el perfil más difícil que con el perfil más fácil.
- **SC-004**: El 100% de las peticiones con la misma semilla, los mismos parámetros y el mismo perfil de dificultad producen exactamente el mismo nivel, incluidos los mismos estados de fragilidad iniciales.

## Assumptions

- Los tres perfiles de dificultad con nombre (fácil/media/difícil) son un punto de partida razonable para el conjunto mínimo pedido por el usuario ("un pequeño conjunto de perfiles discretos") -- el número exacto y sus nombres definitivos se confirman en la fase de planificación si hiciera falta ajustarlos.
- Esta feature no cambia qué colores o piezas están disponibles para el generador (sigue limitado a verde/naranja/marrón, igual que 011-level-generator-basic) -- rojo sigue fuera de alcance del generador.
- Un futuro parámetro numérico continuo (0-1) para controlar la heterogeneidad, mencionado como posible evolución, queda explícitamente fuera de alcance de esta feature.
- Las fichas de tablero golpeadas por la solución no tienen ningún margen de elección real (siempre NEW si reciben un único golpe -- ver Nota de diseño, Historia 1); todo el margen de heterogeneidad entre NEW/CRACKED para piezas críticas vive en las fichas lanzadas por la solución, gobernadas por el mismo perfil de dificultad que los señuelos (FR-005).
- Igual que el resto del generador, esta feature es una herramienta de desarrollo/autoría sin interfaz gráfica -- se opera mediante parámetros de entrada, con salida en el mismo formato JSON ya existente (ahora incluyendo fragilidad por ficha, ya soportado por `createLevel` desde 012-piece-fragility).
