# Feature Specification: Arcoíris Solo Actúa Como Atacante

**Feature Branch**: `027-rainbow-attacker-only`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "Cambiar el motor (src/engine/) para que el efecto de arcoíris (recolorear) solo se dispare cuando arcoíris es la ATACANTE de un impacto, nunca cuando es simplemente la defensora golpeada -- eliminando la regla actual por la cual una defensora puede disparar su propio efecto especial con solo ser golpeada. Una arcoíris asentada, al ser golpeada, pasa a comportarse como una defensora normal (fragilidad avanza, se desplaza según el color que la golpeó, continúa la cadena como una ficha 'rainbow' en movimiento) -- invirtiendo deliberadamente la prioridad de 024 ('arcoíris asentada gana a rojo'). Si esa arcoíris desplazada golpea después a una defensora real, sí actúa como atacante (recolorea, desaparece), igual que siempre. Colisión mutua con arcoíris en uno de los dos lados: mismo color se anula igual que cualquier otro par; colores distintos se resuelve en dos pasos dando ventaja al jugador -- primero arcoíris recolorea a la otra ficha (que se asienta ahí mismo, sin avanzar su fragilidad), luego el color recién elegido actúa como atacante sobre arcoíris (empuja, divide, o limpia línea si es negro -- caso nuevo que hay que soportar), avanzando la fragilidad de arcoíris en ese segundo paso. Alcance puramente de motor, sin tocar el generador ni el renderer."

## Clarifications

### Session 2026-09-04

- Q: ¿Debería una arcoíris asentada, al ser golpeada, seguir recoloreándose a sí misma (comportamiento actual de 024-rainbow-color-change), o comportarse como cualquier otra defensora (desplazarse, con su efecto reservado solo para cuando ella misma ataca)? → A: comportarse como cualquier otra defensora -- ninguna defensora debe disparar un efecto especial por el simple hecho de ser golpeada; solo la identidad de la ATACANTE decide qué mecanismo se aplica en un impacto (igual que ya ocurre con rojo y con negro).
- Q: Esto invierte FR-010 de 024 ("arcoíris asentada gana a rojo") -- rojo golpeando una arcoíris asentada, ¿debería ahora dividirla en dos ramas perpendiculares en vez de abrir el diálogo de color? → A: confirmado, sí -- ese es exactamente el efecto deseado de este cambio.
- Q: En una colisión mutua (dos trayectorias en vuelo que convergen en la misma celda) donde ambos lados son arcoíris, ¿qué ocurre? → A: se anulan las dos, exactamente igual que cualquier otro par del mismo color -- sin selector de color, sin caso especial.
- Q: En una colisión mutua donde un lado es arcoíris y el otro es un color real distinto, ¿en qué orden se resuelve? → A: se da ventaja al jugador con una secuencia de dos pasos -- primero arcoíris actúa como atacante sobre la otra ficha (se elige el color, esa ficha se asienta ahí mismo con su fragilidad intacta); después, esa ficha ya recoloreada actúa como atacante sobre arcoíris (empuje, división, o limpieza de línea según el color elegido), avanzando la fragilidad de arcoíris con normalidad en ese segundo paso.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Una arcoíris asentada, al ser golpeada, se desplaza como cualquier otra defensora (Priority: P1)

Una ficha arcoíris ya asentada en el tablero es golpeada por otra ficha en movimiento (lanzada desde la mano, o desplazada como parte de una cadena en curso). En vez de recolorearse a sí misma (comportamiento actual), la arcoíris asentada reacciona exactamente como cualquier otra defensora: su fragilidad avanza, y se desplaza según el mecanismo propio de quien la golpeó (empujada si es un color normal, dividida en dos ramas perpendiculares si es roja, con su línea completa eliminada si es negra), continuando la cadena como una ficha de color 'rainbow' en movimiento.

**Why this priority**: Es el cambio de comportamiento que define esta feature -- sin él, ninguna de las otras historias tiene sentido, porque arcoíris nunca llegaría a estar "en vuelo".

**Independent Test**: Colocar una ficha arcoíris en el tablero, golpearla con una ficha roja, y comprobar que se divide en dos ramas perpendiculares (ambas todavía de color 'rainbow'), sin que se abra ningún selector de color.

**Acceptance Scenarios**:

1. **Given** una ficha arcoíris asentada en el tablero es golpeada por una ficha de un color normal (verde, naranja o marrón), **When** se resuelve el impacto, **Then** la arcoíris avanza su fragilidad y se desplaza según el mecanismo de empuje de ese color, sin abrir ningún selector.
2. **Given** una ficha arcoíris asentada es golpeada por una ficha roja, **When** se resuelve el impacto, **Then** se divide en dos ramas perpendiculares, ambas de color 'rainbow', sin abrir ningún selector -- invirtiendo el comportamiento anterior de 024 (FR-010), confirmado deliberadamente.
3. **Given** una ficha arcoíris asentada es golpeada por una ficha negra, **When** se resuelve el impacto, **Then** su línea completa se elimina, exactamente igual que ya ocurría antes de esta feature (la prioridad de negro no depende de la regla que se elimina aquí).
4. **Given** una ficha arcoíris desplazada no encuentra ninguna otra ficha en su nuevo trayecto, **When** llega a su destino, **Then** se asienta como una ficha 'rainbow' corriente, con la fragilidad ya avanzada por el golpe que la desplazó.
5. **Given** una ficha arcoíris desplazada llega a un destino con su fragilidad ya en `'broken'`, **When** intentaría asentarse, **Then** desaparece sin haber llegado nunca a aplicar su propio efecto -- igual que cualquier otra ficha rota.

---

### User Story 2 - Una arcoíris ya en vuelo, si golpea a una defensora real, actúa como atacante igual que siempre (Priority: P1)

Una ficha arcoíris que quedó en vuelo tras ser desplazada (User Story 1) continúa la cadena y, en algún punto, golpea a una ficha real asentada en el tablero. En ese impacto, arcoíris es quien ataca -- se comporta exactamente igual que una arcoíris lanzada directamente desde la mano: la defensora cambia al color que el jugador elija, y arcoíris desaparece, consumida.

**Why this priority**: Sin esto, una arcoíris desplazada nunca podría ejercer su propio efecto sobre nada -- quedaría reducida a una ficha inerte que solo puede ser empujada, nunca actuar. Junto con la primera historia, esto es lo que hace que arcoíris pueda llegar a un punto de la partida distinto de su lanzamiento original y seguir siendo relevante.

**Independent Test**: Desplazar una arcoíris hasta que su trayecto la lleve a golpear una ficha real asentada, y comprobar que se abre el selector de color de siempre, señalando a esa ficha real -- no a la propia arcoíris.

**Acceptance Scenarios**:

1. **Given** una ficha arcoíris en vuelo (ya sea lanzada directamente desde la mano, o desplazada tras haber sido golpeada, User Story 1) encuentra una ficha real asentada en su camino, **When** se produce el impacto, **Then** se abre el selector de color de siempre, señalando a esa ficha real.
2. **Given** el jugador elige un color en ese selector, **When** se aplica el cambio, **Then** esa ficha pasa a tener el color elegido y la arcoíris desaparece, consumida -- sin ningún cambio respecto al comportamiento ya existente de arcoíris como atacante.

---

### User Story 3 - Colisión mutua entre arcoíris y otro color: primero arcoíris actúa, luego el color elegido actúa sobre arcoíris (Priority: P1)

Dos trayectorias en vuelo -- una arcoíris y otra de un color real distinto -- convergen en la misma celda en el mismo instante. En vez de tratarlas simétricamente (como ya ocurre entre dos colores normales), se resuelve en dos pasos que dan ventaja al jugador: primero arcoíris actúa como atacante sobre la otra ficha (se abre el selector de color, esa ficha se asienta ahí mismo con el color elegido, sin que su fragilidad avance); después, esa ficha ya recoloreada actúa como atacante sobre arcoíris -- empujándola, dividiéndola, o eliminando su línea completa según el color elegido -- avanzando la fragilidad de arcoíris con normalidad en este segundo paso.

**Why this priority**: Sin esto, una colisión mutua que involucre a arcoíris no tendría ninguna resolución definida -- hoy el motor lo trata como un caso estructuralmente imposible (lanza una excepción), y con la User Story 1 deja de serlo: una arcoíris desplazada puede legítimamente cruzarse con otra trayectoria en vuelo.

**Independent Test**: Construir una colisión mutua entre una arcoíris en vuelo y una ficha verde en vuelo, elegir un color en el selector, y comprobar que primero la ficha verde queda recoloreada y asentada en la celda de encuentro, y que inmediatamente después arcoíris queda empujada (o dividida, o con su línea eliminada, según el color elegido) por esa ficha ya recoloreada.

**Acceptance Scenarios**:

1. **Given** dos trayectorias en vuelo de colores distintos convergen en la misma celda, y una de ellas es arcoíris, **When** se resuelve la colisión, **Then** se abre primero el selector de color para la ficha NO arcoíris, señalándola a ella.
2. **Given** el jugador elige un color en ese selector, **When** se aplica el cambio, **Then** esa ficha se asienta en la celda de encuentro con el color elegido y su fragilidad sin cambios, y arcoíris queda inmediatamente sujeta al mecanismo propio de ese color: empujada si es verde, naranja o marrón; dividida en dos ramas perpendiculares si es roja; con su línea completa eliminada si es negra.
3. **Given** el color elegido es negro, **When** se aplica su mecanismo sobre arcoíris, **Then** su línea completa se elimina y la colisión termina sin continuación para ningún lado -- igual que negro siempre termina, sea cual sea el contexto en el que actúa.
4. **Given** el color elegido no es negro, **When** se aplica su mecanismo sobre arcoíris, **Then** la fragilidad de arcoíris avanza con normalidad, como la de cualquier defensora golpeada en una colisión mutua.

---

### User Story 4 - Colisión mutua entre dos arcoíris sigue siendo una aniquilación por mismo color (Priority: P2)

Cuando las dos trayectorias en vuelo que convergen en la misma celda son ambas arcoíris, se aplica la regla de aniquilación por mismo color ya existente -- ambas desaparecen inmediatamente, sin ningún selector de color.

**Why this priority**: Mantiene la prioridad ya establecida de la regla de mismo color sobre cualquier comportamiento específico de color, exactamente igual que ya se decidió para arcoíris en un impacto normal (024, User Story 3) -- sin esto, este caso quedaría indefinido.

**Independent Test**: Construir una colisión mutua entre dos trayectorias arcoíris y comprobar que ambas desaparecen sin que se abra ningún selector de color.

**Acceptance Scenarios**:

1. **Given** dos trayectorias arcoíris convergen en la misma celda, **When** se resuelve la colisión, **Then** ambas desaparecen inmediatamente, sin selector de color -- sin ninguna lógica nueva más allá de la regla de mismo color ya existente.

---

### Edge Cases

- ¿Qué ocurre si arcoíris asentada es golpeada por negro? Se elimina su línea completa, exactamente igual que antes de esta feature -- la prioridad de negro nunca dependió de la regla que aquí se elimina (se decide por el orden de comprobación, no por ser arcoíris la defensora).
- ¿Qué ocurre si arcoíris asentada es golpeada por otra arcoíris? Se aplica la aniquilación por mismo color ya existente (024, User Story 3) -- sin cambios.
- ¿Qué ocurre con una arcoíris desplazada que, en su nuevo trayecto, golpea a una ficha negra asentada? Sigue las reglas ya existentes de prioridad de negro como defensora -- sin cambios introducidos por esta feature.
- ¿Qué ocurre si la ficha ya recoloreada en el primer paso de una colisión mutua (User Story 3) resulta ser, tras el mecanismo del segundo paso, otra ficha en vuelo (por ejemplo, si el color elegido la empuja más allá)? Sigue exactamente el mismo patrón ya establecido para cualquier ficha desplazada -- continúa la cadena con normalidad, sin ningún caso especial adicional.
- ¿Qué ocurre si, en una colisión mutua con arcoíris, la ficha NO arcoíris ya está con fragilidad `'broken'` antes de que arcoíris intente recolorearla? Sigue la regla ya existente para cualquier lado `'broken'` de una colisión mutua -- desaparece sin recibir ningún efecto, y arcoíris no llega a aplicar su recoloreo sobre ella.
- ¿Cambia en algo el comportamiento de arcoíris lanzada directamente desde la mano contra una defensora real, fuera de una colisión mutua? No -- ese camino (arcoíris como atacante en un impacto normal) sigue exactamente igual que hoy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cuando una ficha arcoíris ya asentada en el tablero es golpeada por cualquier atacante (fuera de una colisión mutua), el sistema NO DEBE recolorear a la propia arcoíris -- DEBE tratarla como cualquier otra defensora: avanzar su fragilidad y desplazarla según el mecanismo propio de quien la golpeó (empuje, división si es rojo, limpieza de línea si es negro), continuando la cadena como una ficha de color 'rainbow' en movimiento.
- **FR-002**: Esto DEBE invertir el comportamiento de FR-010 de 024-rainbow-color-change ("arcoíris asentada gana a rojo") -- una ficha roja que golpea una arcoíris asentada DEBE dividirla en dos ramas perpendiculares, nunca abrir el selector de color.
- **FR-003**: El comportamiento de negro golpeando una arcoíris asentada (limpieza de línea completa) NO DEBE cambiar -- sigue determinado por el orden de comprobación ya existente, no por la regla que se elimina en FR-001.
- **FR-004**: Cuando una ficha arcoíris (lanzada desde la mano, o ya en vuelo tras haber sido desplazada por FR-001) golpea a una ficha real asentada, el sistema DEBE seguir comportándose exactamente igual que hoy: la defensora cambia al color elegido por el jugador, y arcoíris desaparece, consumida. Este camino no cambia por esta feature.
- **FR-005**: En una colisión mutua entre dos trayectorias en vuelo del mismo color, incluyendo cuando ambas son arcoíris, el sistema DEBE aplicar la regla de aniquilación por mismo color ya existente, sin abrir ningún selector de color.
- **FR-006**: En una colisión mutua entre una trayectoria arcoíris y una trayectoria de un color real distinto, el sistema DEBE resolverla en dos pasos, en este orden: (a) arcoíris actúa como atacante sobre la otra trayectoria -- se abre el selector de color, esa ficha se asienta en la celda de encuentro con el color elegido, sin que su fragilidad avance; (b) la ficha ya recoloreada actúa como atacante sobre arcoíris -- se le aplica el mecanismo propio de ese color (empuje si es verde/naranja/marrón, división en dos ramas perpendiculares si es rojo, limpieza de línea completa si es negro), avanzando la fragilidad de arcoíris con normalidad en este segundo paso.
- **FR-007**: El sistema DEBE soportar que negro actúe como el mecanismo del segundo paso de FR-006 -- hoy esto no está soportado (negro nunca podía ser uno de los dos lados ya en vuelo de una colisión mutua); el resultado DEBE ser la eliminación de la línea completa de arcoíris, terminando la colisión sin continuación para ningún lado, igual que negro siempre termina.
- **FR-008**: Una ficha arcoíris desplazada (FR-001) que se asienta sin haber golpeado nada más DEBE comportarse a partir de ese momento exactamente como cualquier ficha de color 'rainbow' asentada -- sujeta de nuevo a FR-001 si algo la golpea, y sujeta a la regla existente de desaparecer si su fragilidad llega a `'broken'`, sin haber llegado nunca a aplicar su propio efecto.
- **FR-009**: Ninguna regla ya existente para el resto de colores (verde, naranja, marrón, rojo, negro, mismo color, wrap-around), ni el comportamiento de arcoíris fuera de los casos descritos en esta especificación, DEBE cambiar como consecuencia de esta feature.
- **FR-010**: Esta feature es puramente de motor (`src/engine/`) -- NO DEBE modificar el generador de niveles (`tools/generator/`) ni el renderer (`src/renderer/`). El soporte de generador para arcoíris queda fuera de alcance, para una feature posterior.

### Key Entities

- **Colisión mutua arcoíris-vs-color-real**: la nueva secuencia de dos pasos (FR-006) -- distinta de la colisión mutua simétrica ya existente entre dos colores normales, y distinta también del impacto normal de arcoíris (que nunca tiene dos pasos, solo el recoloreo).
- **Arcoíris en vuelo**: una ficha de color 'rainbow' que ha sido desplazada (FR-001) y todavía no se ha asentado ni ha vuelto a actuar como atacante -- un estado que antes de esta feature no podía existir.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una arcoíris asentada golpeada por cualquier atacante fuera de una colisión mutua se comporta exactamente como cualquier otra defensora de ese color (empuje/división/limpieza de línea, según corresponda), sin abrir ningún selector de color, en el 100% de los casos.
- **SC-002**: Una ficha roja que golpea una arcoíris asentada la divide en dos ramas perpendiculares, en el 100% de los casos -- comportamiento invertido respecto a 024, confirmado deliberadamente.
- **SC-003**: Una arcoíris en vuelo que golpea a una ficha real asentada, sea cual sea el origen de ese vuelo (lanzamiento directo o desplazamiento previo), produce el mismo resultado ya validado de arcoíris como atacante, en el 100% de los casos.
- **SC-004**: Una colisión mutua entre arcoíris y otro color real se resuelve siempre con la secuencia de dos pasos de FR-006, en el orden exacto especificado, en el 100% de los casos.
- **SC-005**: Una colisión mutua entre dos arcoíris produce la misma aniquilación por mismo color ya validada para el resto de colores, en el 100% de los casos.
- **SC-006**: Ningún nivel ni comportamiento ya validado para el resto de colores cambia como consecuencia de esta feature -- 0 regresiones en la suite existente.

## Assumptions

- El diálogo de selección de color (posición, estilo, animación) no cambia -- esta feature solo cambia CUÁNDO se abre y sobre qué ficha, nunca cómo se presenta.
- La fragilidad de la ficha recoloreada en el primer paso de una colisión mutua (FR-006a) sigue exactamente el mismo criterio ya establecido para el impacto normal de arcoíris (Decisión 11 de 024): no avanza, no se resetea.
- La inversión de FR-010 de 024 (arcoíris ya no gana a rojo como defensora) es un cambio de comportamiento deliberado y confirmado explícitamente por el usuario, no un descuido -- cualquier test que dependiera del comportamiento anterior debe actualizarse, no preservarse.
- El caso "negro como mecanismo del segundo paso de una colisión mutua" (FR-007) es la única pieza de plomería genuinamente nueva de esta feature -- reutiliza la misma lógica de limpieza de línea (`clearLine`/`lineFromImpact`) ya usada por el impacto normal de negro, sin inventar un mecanismo nuevo.
- Esta feature no introduce ningún nuevo estado de pausa/selección de color más allá del ya existente (024) -- la colisión mutua de dos pasos usa el mismo mecanismo de pausa-y-reanudación, solo con un paso intermedio adicional antes de continuar.
- Igual que 023/024/025/026: el generador de niveles y el renderer quedan fuera de alcance -- el soporte de generador para arcoíris es una feature posterior que se construirá sobre este comportamiento ya corregido.
