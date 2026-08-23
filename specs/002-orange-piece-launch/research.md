# Phase 0 Research: Lanzamiento de Ficha Naranja

Sin `NEEDS CLARIFICATION` pendientes en el Technical Context. La investigación de esta fase se
centra en una pregunta de diseño que apareció al intentar implementar naranja de forma consistente
con la ficha verde ya construida: **¿de qué color depende la distancia de empuje en una cadena que
mezcla varias fichas?**

## Decisión 1: Empuje generalizado por distancia, no por color

**Decision**: Sustituir `applyGreenImpact` (feature 001) por un único `applyImpact` genérico,
parametrizado por una tabla `PUSH_DISTANCE: Record<PieceColor, number>` (`green: 1, orange: 2`).
`pieces/green.ts` se elimina; su lógica pasa a `pieces/push.ts`, compartida.

**Rationale**: Releyendo el documento de diseño del juego, cada ficha describe su propio
comportamiento "en la dirección del impacto" — verde empuja 1 casilla con resolución de colisión,
naranja salta una casilla y empuja 2. Implementar esto en la feature 001 con `applyGreenImpact`
como una función dedicada funcionaba porque, con un solo color en juego, era indistinguible de la
alternativa correcta. Al añadir naranja queda claro que ambos comportamientos son la MISMA
operación (empujar N casillas, comprobando colisión solo en la casilla final, sin tocar las
intermedias) con una N distinta — exactamente lo que el Principio V pide evitar duplicar.

**Alternatives considered**:
- *`pieces/orange.ts` como copia adaptada de `pieces/green.ts`*: descartada — habría duplicado
  íntegramente el algoritmo recursivo de cascada (feature 001) cambiando solo una constante,
  violando directamente el Principio V ("primitivas composables sobre casos especiales").

## Decisión 2: En una cascada, cada eslabón usa la distancia de la ficha que en ese momento "llega"

**Decision**: Cuando una ficha empujada aterriza sobre otra y se desencadena una nueva
interacción, la distancia de ESE empuje la determina el color de la ficha que acaba de ser
empujada (la que ahora "llega" a la siguiente casilla ocupada) — no el color de la ficha lanzada
originalmente, ni el color de la ficha que recibe el empujón.

**Rationale**: La regla universal de interacción del documento de diseño dice que se desencadena
"la mecánica de la ficha que llega, contra la ficha que ya estaba allí". En una cascada de varios
pasos, en cada paso hay una ficha distinta "llegando" (la que se acaba de mover) — así que su
propio color, no el del disparador original de la cadena, determina cómo empuja al siguiente
obstáculo. Con esta regla, una cadena de verde que en algún punto empuja una ficha naranja
continúa esa cascada con distancia 2 a partir de ahí, y viceversa. Este comportamiento no era
observable en la feature 001 (todas las fichas eran verdes), pero la implementación recursiva ya
construida se generaliza a esta regla sin cambiar su forma, solo recalculando la distancia en cada
nivel de recursión a partir de `getPieceAt(board, at).color`.

**Alternatives considered**:
- *La distancia la fija el color de la ficha lanzada originalmente, para toda la cascada*:
  descartada — contradice la lectura literal de "la mecánica de la ficha que llega" aplicada paso
  a paso, y además haría que el comportamiento de una ficha dependiera de qué la golpeó en vez de
  depender solo de sí misma, lo cual no es lo que describe el documento de diseño para ninguna
  ficha individual.

**Nota de alcance**: esta historia implementa la regla (es la generalización correcta y evita
duplicar código para cuando haga falta), pero su nivel de prueba (`testLevelOrange01`) no incluye
una cascada — la casilla de aterrizaje queda vacía a propósito (decisión explícita: no cubrir
cascadas en esta historia, ver spec.md → Assumptions). La regla por tanto queda implementada pero
no verificada por un test hasta una historia posterior que sí ejercite una cascada real.

## Decisión 3: La casilla intermedia nunca se lee ni se escribe

**Decision**: El salto de naranja se implementa calculando la casilla de aterrizaje directamente
(`distance` pasos en la dirección, sin pasos intermedios) y solo se comprueba/escribe ocupación en
la casilla de origen y en la casilla final. La rama `collision=false` de `moveStep` (feature 001,
nunca ejercitada hasta ahora) sigue sin usarse — no hace falta, y su semántica actual de
"sobrescribir lo que hubiera en el destino" habría sido incorrecta para lo que pide naranja
("sin destruir ni desplazar lo que hay en la casilla intermedia").

**Rationale**: Evita tener que decidir ahora qué significa exactamente `collision=false` de forma
genérica (pregunta que quedó señalada como no resuelta al implementar verde). Como ninguna ficha
de este roadmap lo necesita todavía, se deja esa rama tal cual, sin tocarla ni depender de ella.

**Alternatives considered**:
- *Redefinir la semántica de `collision=false` en `moveStep` para que "pase de largo" sin tocar el
  destino, y usarla para el primer salto de naranja*: descartada por ahora — cambiaría el
  contrato de una primitiva ya probada sin necesidad real, cuando calcular el destino final
  directamente resuelve el requisito de forma más simple y sin tocar código existente.
