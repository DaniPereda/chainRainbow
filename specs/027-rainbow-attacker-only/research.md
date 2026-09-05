# Research: Arcoíris Solo Actúa Como Atacante

## Decisión 1: quitar `defender.color === 'rainbow'` de `applyImpact` es mecánico, pero reabre un camino que antes nunca ocurría (rojo dividiendo arcoíris, negro empujada por otro color, etc.)

**Contexto**: hoy, `applyImpact` (push.ts:556) comprueba `defender.color === 'rainbow' || site.piece.color === 'rainbow'` ANTES de llegar a cualquier otra rama específica de color (rojo divide, negro limpia línea, empuje genérico). Quitar la mitad `defender.color === 'rainbow'` de esa condición hace que una arcoíris asentada, al ser golpeada, caiga ahora en TODAS las ramas que ya existían para cualquier otra defensora -- incluida la de rojo (dividir) y la de negro (que ya la alcanzaba antes por otro motivo, sin cambios).

**Decisión**: el cambio en `applyImpact` es efectivamente una sola línea (la condición de la línea 556). Todo el comportamiento resultante (empuje genérico, división de rojo, limpieza de negro) ya existe y no necesita ningún código nuevo -- arcoíris, como defensora, simplemente dejó de ser un caso especial.

## Decisión 2: unificar el tipo de retorno de `MutualImpactHandler` con `ImpactResolution` -- la pieza de plomería que de verdad hace falta

**Contexto**: hoy `MutualImpactHandler` (events.ts) devuelve un objeto plano `{board, events, nextSites}`, nunca una pausa -- `drive`'s propia rama de colisión mutua (events.ts, dentro de `drive`) nunca comprueba ningún `status`, solo desestructura el resultado directamente. Con arcoíris pudiendo ahora quedar en vuelo (Decisión 1), una colisión mutua puede necesitar detenerse a mitad de camino para pedir un color al jugador -- algo que hoy no tiene ningún cauce: `strikeMutualSide`'s propio comentario ("Extremely rare, undiscussed nesting") ya documentaba esto como "not supported", lanzando una excepción en vez de soportarlo.

**Decisión**: `MutualImpactHandler` pasa a devolver `ImpactResolution` directamente -- exactamente el mismo tipo que ya usa `ImpactHandler`, en vez de su propio objeto plano. Las dos ramas "resueltas" de `applyMutualImpact` (mismo color se anula; colores distintos se empujan mutuamente) solo necesitan añadir `status: 'resolved'` a lo que ya devuelven -- cambio mecánico. En `drive`, la rama de colisión mutua pasa a comprobar `result.status` exactamente igual que ya hace la rama de impacto simple, y reutiliza el MISMO `pendingFrom` ya existente para envolver la pausa -- `pendingFrom` ya es agnóstico de qué handler produjo la pausa (solo la reenvía y sabe cómo reanudar `drive`), así que no hace falta ninguna función nueva, solo pasar `handleMutualImpact` como ya se pasa hoy.

**Alternativas consideradas**: crear un tipo `MutualImpactResolution` paralelo y una función `pendingFromMutual` duplicada -- descartado, ya que el propio tipo y la propia lógica de reanudación de `pendingFrom` son honestamente idénticos; duplicarlos solo para mantener una distinción de tipos que ya no aporta nada habría violado el Principio V (primitivas composables) sin ninguna ganancia real.

## Decisión 3: la secuencia de dos pasos vive dentro de `applyMutualImpact`, reutilizando (y extrayendo) la lógica que ya existe

**Contexto**: cuando exactamente uno de los dos lados de una colisión mutua es arcoíris (el caso de dos arcoíris ya lo cubre la comprobación de mismo color, sin cambios), hace falta: (a) arcoíris recolorea a la otra ficha, que se asienta en la celda de encuentro con su fragilidad intacta; (b) el color recién elegido actúa como atacante sobre arcoíris, con SU propio mecanismo.

**Decisión**: se extraen dos piezas ya existentes en `applyImpact` a helpers reutilizables:

- `buildColorChoicePause(defender: Piece, at: Coordinate, vanishedAttacker: ChainEvent)`: la construcción de la pausa (opciones de color, el evento de desaparición de la atacante, y el `resume(color)` que escribe la ficha recoloreada en `at` con la fragilidad de `defender` sin cambios) -- hoy vive inline dentro de la rama `defender.color === 'rainbow' || site.piece.color === 'rainbow'` de `applyImpact`; se extrae para poder invocarla también desde `applyMutualImpact` sin duplicar la construcción del diálogo.
- `clearLineFrom(board: Board, at: Coordinate, direction: Direction, trigger: ChainEvent)`: la construcción del evento disparador más los eventos de barrido (`clearLine`/`lineFromImpact`) -- hoy vive inline dentro de la rama `site.piece.color === 'black'` de `applyImpact`; se extrae para poder invocarla también desde el paso 2 de la secuencia de arcoíris, cuando el color elegido es negro.

Con estos dos helpers, `applyMutualImpact`'s nueva rama (exactamente un lado arcoíris) queda así, conceptualmente:

1. Identifica cuál de los dos lados es arcoíris (`rainbowSite`) y cuál no (`otherSite`).
2. Llama a `buildColorChoicePause(otherSite.piece, otherSite.to, vanishedRainbowEvent)` -- produce la pausa. `otherSite.to === rainbowSite.to` siempre (es la definición de colisión mutua), así que la ficha recoloreada se asienta exactamente en la celda de encuentro.
3. En `resume(color)`: escribe la ficha recoloreada en el tablero, y aplica el mecanismo de `color` sobre `rainbowSite` (Decisión 4) -- el resultado combinado (eventos de ambos pasos, `nextSites` de lo que arcoíris produzca en el paso 2, nunca de la otra ficha, que ya se asentó en el paso 1) es el `ImpactResolution` final, normalmente `'resolved'`.

## Decisión 4: el paso 2 reutiliza `strikeMutualSide` para verde/naranja/marrón/rojo; negro necesita una rama nueva de verdad ahí

**Contexto**: `strikeMutualSide(board, hitSite, strikerSite)` ya sabe calcular "qué le pasa a `hitSite` al ser golpeada por el mecanismo de `strikerSite.piece.color`" -- exactamente lo que hace falta para el paso 2 (`hitSite = rainbowSite`, `strikerSite` sintetizada con el color elegido). Ya soporta verde/naranja/marrón (empuje genérico) y rojo (`resolveRedSplit`). Lo único que hoy NO soporta es `strikerSite.piece.color === 'black'` -- lanza `'invariant violated: black cannot be one side of a mutual collision'`, porque hasta ahora negro nunca podía haber llegado ahí en vuelo (su propio impacto siempre termina, nunca produce un `nextSite`).

**Decisión**: se añade una rama real para `strikerSite.piece.color === 'black'` dentro de `strikeMutualSide`, usando `clearLineFrom` (Decisión 3) sobre `hitSite.to`/`strikerSite.direction` -- termina con `nextSite: null`, igual que negro siempre termina. Esta rama nunca se alcanza por el camino ORIGINAL que la invariante eliminada protegía (negro real como uno de los dos lados YA en vuelo sigue siendo estructuralmente imposible, sin cambios) -- solo se alcanza por el nuevo camino sintético del paso 2, documentado explícitamente en un comentario para que quede claro que la invariante antigua sigue siendo cierta para su caso original.

**Verificado**: no hace falta ningún cambio en `resolveRedSplit` ni en el resto de `strikeMutualSide` -- rojo y los colores genéricos ya funcionan sin tocarlos.

## Decisión 5: el anidamiento "colisión mutua → rojo divide → una de sus ramas alcanza otra pausa de arcoíris" se deja explícitamente fuera de alcance, igual que hoy

**Contexto**: `strikeMutualSide`'s rama de rojo ya contempla que `resolveRedSplit`'s propio `resolveChain` interno podría, en teoría, alcanzar una interacción de arcoíris que requiera pausa -- y hoy lanza una excepción explícita en vez de soportarlo ("pausing for a color choice mid-mutual-collision is not supported"). Con esta feature, ese anidamiento sigue siendo posible (de hecho ligeramente más alcanzable, ya que ahora una arcoíris asentada puede aparecer en más sitios tras ser desplazada) pero es un caso DISTINTO del que el usuario pidió resolver (el usuario pidió la colisión mutua directa, no una pausa anidada dos niveles más adentro).

**Decisión**: se mantiene ese `throw` sin cambios -- documentado explícitamente como una limitación conocida, no como un descuido. Si en el futuro un nivel real necesita ese anidamiento, es una feature aparte, no parte de esta.

## Decisión 6: fragilidad -- exactamente dos reglas distintas, cada una donde ya se esperaría

**Contexto**: hay dos momentos distintos en la secuencia de dos pasos donde la fragilidad de una ficha podría (o no) avanzar, y hay que confirmar que cada uno sigue la regla correcta.

**Decisión**:
- Paso 1 (arcoíris recolorea a la otra ficha): la fragilidad de esa ficha NO avanza -- exactamente la misma regla ya confirmada para el impacto normal de arcoíris (Decisión 11 de 024-rainbow-color-change: "es un repintado mágico, categoría distinta... avanzar la fragilidad habría obligado además a decidir qué hacer si llega a 'broken'"). `buildColorChoicePause` (Decisión 3) preserva esto por construcción, igual que ya hace el código que reemplaza.
- Paso 2 (el color elegido actúa sobre arcoíris): la fragilidad de arcoíris SÍ avanza con normalidad -- ya no es un efecto de arcoíris, es un golpe corriente de un color normal, exactamente la misma regla que ya aplica `strikeMutualSide` a cualquier `hitSite` (línea `advance(hitSite.piece.fragility)`, sin excepción para ningún color). Si el color elegido es negro, no aplica ninguna regla de fragilidad -- negro nunca avanza fragilidad, elimina directamente (igual que su rama ya existente en `applyImpact`).

## Decisión 7: dos arcoíris en colisión mutua no necesitan ningún código nuevo

**Contexto**: la comprobación `if (siteA.piece.color === siteB.piece.color)` al principio de `applyMutualImpact` ya se ejecuta ANTES que cualquier lógica específica de color, y ya produce dos eventos `ANNIHILATION` (uno por lado, corregido en 025-purple-attraction-piece). Dos arcoíris cumplen esta condición igual que cualquier otro par del mismo color.

**Decisión**: ninguna -- se confirma explícitamente que este caso ya está cubierto, sin tocar nada.
