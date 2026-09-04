# Research: Ficha Arcoíris (Cambio de Color)

## Decisión 1: cómo pausar `resolveChain` sin romper Principio I (motor puro, sin dependencias de UI)

**Contexto**: es la primera feature en la que la resolución de un lanzamiento necesita una
decisión que solo el jugador puede tomar (qué color elegir), a mitad de una cadena que hoy se
resuelve de un tirón, síncrona, en `resolveChain` (`src/engine/events.ts`) — un `while` sobre una
cola (`queue: ImpactSite[]`) que llama a `applyImpact`/`applyMutualImpact` hasta vaciarse.

Alternativas consideradas:

- **Callback síncrono** (`resolveLaunch(level, action, { chooseColor: (options) => color })`):
  descartado. El disparo real (un clic del jugador en un diálogo de Phaser) es intrínsecamente
  asíncrono — no puede resolverse dentro de la misma pila de llamadas síncrona sin bloquear el
  hilo único de JS. No es viable para el caso de uso real.
- **Generadores** (`function* resolveLaunch(...)`, el llamador conduce con `.next(color)`):
  técnicamente correcto y headless-testeable, pero `resolveLaunch` se usa hoy en 17 archivos de
  test más `session.ts` (el driver real del renderer), todos asumiendo hoy una llamada síncrona
  que devuelve el resultado directamente. Convertirla en generador rompe la firma para TODOS esos
  llamadores aunque nunca toquen arcoíris — coste de migración desproporcionado frente al
  beneficio.
- **Excepciones como señal de "pausa"**: descartado. Evita tocar firmas, pero cambia control flow
  legítimo por excepciones -- sin ningún chequeo del compilador que obligue a un llamador nuevo a
  gestionar el caso, justo el tipo de fallo silencioso que el Principio II existe para evitar.
- **Tipo de retorno enriquecido con un campo opcional adicional, cero cambios a los campos
  existentes** (elegida): ver más abajo.

**Decisión**: `resolveChain` (y por tanto `resolveLaunch`) sigue siendo una función síncrona
normal. Cuando la cadena necesita una elección de color, en vez de terminar devuelve un resultado
que incluye, además de los campos habituales, una función `resume(color)` que continúa
exactamente esa misma cadena desde donde se quedó. El motor nunca llama a nada de renderer -- es
el LLAMADOR (el renderer) quien decide cuándo invocar `resume`, con el valor que el jugador eligió
en su propia UI. Esto es indistinguible, en espíritu, de un generador (`.next(value)`), pero se
expresa como datos + closures en vez de como una construcción de lenguaje nueva, y no obliga a
ningún llamador existente a cambiar una sola línea mientras no encuentre arcoíris.

**Por qué el tipo de retorno de `LaunchOutcome` NO se convierte en una unión discriminada**:
`LaunchOutcome` (`resolve-launch.ts`) se usa hoy en 17 archivos de test más `session.ts`. Todos
ellos leen `outcome.board`/`outcome.hand`/`outcome.events`/`outcome.missclick`/`outcome.result`
directamente, sin ningún `status` que comprobar. Convertir `LaunchOutcome` en
`{status:'resolved',...} | {status:'pending',...}` obligaría a añadir un chequeo de `status` en
cada uno de esos 17+ sitios aunque NINGUNO de ellos vaya a lanzar jamás una arcoíris -- una
migración desproporcionada para una feature que, por diseño, no cambia el comportamiento de
ningún color existente (FR-013). En su lugar, `LaunchOutcome` gana un único campo NUEVO y
OPCIONAL:

```ts
export type PendingColorChoice = {
  /** Casilla de la ficha que va a cambiar de color. */
  at: Coordinate;
  /** Todos los colores elegibles, en un orden fijo (todos excepto 'rainbow'). */
  options: PieceColor[];
  /** Aplica la elección y continúa la MISMA cadena. Puede devolver otro
   * LaunchOutcome con su propio pendingColorChoice si la cadena, ya
   * desbloqueada, encuentra otro impacto de arcoíris más adelante. */
  resume: (color: PieceColor) => LaunchOutcome;
};

export type LaunchOutcome = {
  board: Board;
  hand: Hand;
  events: EventLog;
  missclick: boolean;
  result: LevelResult;
  pendingColorChoice?: PendingColorChoice;
};
```

Cuando `pendingColorChoice` está presente, `board`/`events` reflejan el estado resuelto SOLO
hasta ese punto (todavía no es el resultado final) y `result`/`missclick` no deben usarse todavía
-- ningún llamador existente los lee de otra forma, y los nuevos (BoardScene, session.ts) deben
comprobar `pendingColorChoice` ANTES de tratar el resultado como terminal (FR-005). `events`
siempre es ACUMULATIVO: cada `LaunchOutcome` sucesivo (el inicial, y cada uno que devuelve
`resume`) contiene TODO lo resuelto hasta ese momento, nunca solo lo nuevo -- así el renderer no
necesita ningún estado especial para "unir" tramos, solo reproducir `events.slice(playedCount)` y
actualizar `playedCount` tras cada tramo.

**Consecuencia para `resolveChain`/`applyImpact`**: mismo patrón, aplicado en la capa interna.

- `ImpactHandler` (el tipo de `applyImpact`) SÍ se convierte en una unión discriminada real (no un
  campo opcional), porque su superficie de uso es pequeña y acotada: solo 2 archivos de test
  (`black.test.ts`, `push.test.ts`, 16 llamadas directas en total) y un único punto de producción
  (`resolveChain`, que ya lo invoca dentro de su propio `while`). Aquí SÍ vale la pena la unión
  discriminada con chequeo exhaustivo del compilador, dado el coste de migración bajo:

  ```ts
  export type ImpactResolution =
    | { status: 'resolved'; board: Board; events: ChainEvent[]; nextSites: ImpactSite[] }
    | { status: 'pending-color-choice'; board: Board; events: ChainEvent[]; at: Coordinate;
        options: PieceColor[]; resume: (color: PieceColor) => ImpactResolution };

  export type ImpactHandler = (board: Board, site: ImpactSite) => ImpactResolution;
  ```

  Los 16 sitios de test existentes (que nunca disparan arcoíris) se actualizan una sola vez con un
  pequeño helper (`expectResolved(result)`) que estrecha el tipo y lanza si alguna vez, por error,
  dejaran de recibir `'resolved'` -- migración mecánica, sin cambio de comportamiento.

- `resolveChain` (`events.ts`) envuelve ese mismo patrón en su propio bucle: si `handleImpact`
  devuelve `'pending-color-choice'` en vez de `'resolved'`, el bucle se detiene ahí mismo y
  devuelve `{status:'pending-color-choice', board, events (acumulados), at, options, resume}`,
  donde `resume(color)` llama al `resume` del `ImpactResolution` pendiente, obtiene un
  `ImpactResolution` de vuelta (que puede volver a ser `'pending-color-choice'` si esa misma
  ficha recolorada desencadena... no, un cambio de color nunca genera un nuevo impacto por sí
  mismo, FR-007 -- pero SÍ puede serlo si el resto de la cola, al continuar, encuentra OTRO
  impacto de arcoíris más adelante), fusiona el resultado con `currentBoard`/`events`/`queue`
  (la cola tal y como quedó, capturada por clausura) y **continúa el mismo `while`** desde ahí.
  `resolveChain` gana el mismo `status: 'resolved' | 'pending-color-choice'` en su propio tipo de
  retorno (antes `{board, events}` a secas) -- este SÍ es un cambio de firma visible para sus 2
  llamadores de producción (`resolve-launch.ts`, y `resolveRedSplit` en `push.ts`) y sus 2
  archivos de test (`events.test.ts`, `push.test.ts`), migración igualmente mecánica y acotada.

- **Composición con la cola anidada de `resolveRedSplit`** (`push.ts`): `resolveRedSplit` llama a
  `resolveChain` internamente (su propia cola con las dos ramas perpendiculares). Como
  `resolveChain` devuelve ahora el mismo `status`, `resolveRedSplit` simplemente REENVÍA ese
  resultado tal cual -- si es `'pending-color-choice'`, lo devuelve sin envolver; su firma pasa de
  `{board, events}` a la misma unión que `resolveChain`. El sitio donde `applyImpact` invoca a
  `resolveRedSplit` (la rama de rojo) debe entonces comprobar ese `status` y, si está pendiente,
  reenviarlo como su PROPIO `'pending-color-choice'` (con un `resume` que llama al de
  `resolveRedSplit`, y si el resultado ya no está pendiente, lo empaqueta de vuelta como
  `{status:'resolved', board, events, nextSites: []}` -- igual que hace hoy sin arcoíris, ya que
  la cola interna de un split siempre se drena entera antes de devolver algo a la cola externa,
  research.md 009). Esto es el único punto de reenvío manual necesario en todo el motor: el resto
  de colores (verde, naranja, marrón, negro) nunca llaman a nada que pueda devolver `pending`, así
  que su código en `applyImpact` no cambia en absoluto.

**Verificado por qué ninguna otra ruta puede llegar a arcoíris de forma inesperada**:
`applyMutualImpact`/`strikeMutualSide` (colisiones mutuas entre dos trayectorias YA en vuelo) NO
necesita ningún cambio: arcoíris nunca genera un `MOVE_STEP` (FR-007), así que nunca puede ser una
de las dos trayectorias en vuelo que protagonizan una colisión mutua. Y `findCoincidingPair`
(events.ts) ya exige que la casilla compartida esté VACÍA en el tablero real para considerarla una
colisión mutua -- si esa casilla tiene una arcoíris asentada, ya cae por la rama normal de
`applyImpact` de una en una, como cualquier otro defensor asentado (comentario ya existente en
`findCoincidingPair`, sin cambios).

## Decisión 2: qué ficha cambia de color

Resuelto con el usuario (ver spec.md, sección Clarifications): siempre la defensora del impacto
-- la ficha que YA estaba en la casilla del impacto antes de que llegara la otra. Coincide con el
documento de diseño original ("cambia el color de la ficha impactada"). Implementado como una
rama en `applyImpact`, análoga a la de negro: `if (defender.color === 'rainbow' ||
site.piece.color === 'rainbow')`, comprobada DESPUÉS de la regla de mismo color y de la rama de
negro (FR-009: negro domina sobre arcoíris en cualquier rol, sin cambios respecto a research.md
023 Decisión 3) pero ANTES de la comprobación de rojo (FR-010: arcoíris domina sobre la
ramificación de rojo).

## Decisión 3: prioridad entre fichas especiales (negro, arcoíris, rojo)

Orden de comprobación dentro de `applyImpact`, de mayor a menor prioridad (ninguna regla existente
cambia de posición, arcoíris se inserta como un nuevo escalón):

1. Regla de mismo color (ya existente) -- ambas desaparecen, ningún efecto de color se ejecuta.
2. Negro implicada en cualquier rol -- limpieza de línea (ya existente, sin cambios).
3. **Arcoíris implicada en cualquier rol (nueva)** -- cambio de color, defensora gana.
4. Rojo como defensora -- ramificación (ya existente, sin cambios).
5. Resto de mecánicas por color (empuje, salto, marrón) -- ya existentes, sin cambios.

Justificación del orden 2 antes de 3: es un valor por defecto conservador (spec.md, Assumptions)
que preserva el comportamiento ya implementado y probado de negro sin modificarlo, ya que el
usuario no especificó esta interacción cruzada entre dos fichas especiales nuevas.

## Decisión 4: la ficha que no cambia de color desaparece igual que en negro

Mismo patrón que la ficha disparadora de la limpieza de línea (spec.md 023, FR-004/FR-005): la
ficha que no sobrevive nunca llega a asentarse ni ejecuta su propio efecto, desaparece en
silencio. Se representa con un evento `ANNIHILATION` con `from === to` de esa ficha (mismo
mecanismo, mismo guard `from === at` ya existente en `launch-animation.ts` para el desvanecido sin
recorrido). La ficha recoloreada, en cambio, no genera ningún evento de movimiento -- su cambio de
color se representa con un evento nuevo (ver data-model.md).

## Decisión 5: la elección de color no reabre el impacto original con el nuevo color

Aunque la redacción de la feature ("incluyendo cualquier reacción en cadena que ese nuevo color
pueda producir") podría sugerir que, tras elegir p.ej. "rojo", la ficha recolorada debería
dividirse inmediatamente como si un rojo real acabara de golpearla -- se descarta esa lectura
(documentado en spec.md, Assumptions). El impacto de arcoíris en sí mismo NO genera ningún
movimiento (FR-007, explícito en la descripción original de la feature) y por tanto no deja
ningún `nextSites` propio. "La reacción en cadena que ese nuevo color pueda producir" se refiere
al resto de sitios YA pendientes en la cola (por ejemplo, la otra rama de una división de rojo
anterior en la misma cadena, o un impacto posterior contra la MISMA ficha ya recolorada en un
lanzamiento FUTURO) -- no a una reevaluación inmediata del propio impacto de arcoíris con el color
elegido.

## Decisión 6: integración con `session.ts`/`BoardScene.ts`

`applySessionLaunch` (session.ts) hoy comete (`this.session = nextSession`) el resultado de
`resolveLaunch` incondicionalmente. Si `outcome.pendingColorChoice` está presente, NO debe
cometerse nada todavía -- se extrae la lógica de "aplicar un resultado ya resuelto a la sesión" a
una función nueva, `commitLaunchOutcome(session, outcome): LevelSession`, y `applySessionLaunch`
pasa a:

```ts
export function applySessionLaunch(session, launch) {
  const outcome = resolveLaunch(session.current, launch, session.selectedHandIndex ?? 0);
  if (outcome.pendingColorChoice) return { session, outcome }; // sesión SIN tocar
  return { session: commitLaunchOutcome(session, outcome), outcome };
}
```

`BoardScene.launch()` (el único consumidor real, fuera de tests) pasa de una única llamada a un
bucle: reproduce el tramo nuevo de `outcome.events` (`playEventLog` ya soporta reproducir un
tramo; se le pasa `events.slice(playedCount)` y se actualiza `playedCount`), y si
`outcome.pendingColorChoice` está presente, abre el diálogo flotante de color anclado en
`pendingColorChoice.at`; al elegir, llama a `pendingColorChoice.resume(color)`, obtiene un nuevo
`outcome` y repite. Cuando ya no hay `pendingColorChoice`, comete la sesión
(`commitLaunchOutcome`) y sigue con el flujo ya existente (redraw, comprobación de victoria/derrota).

## Decisión 7: sonido y color visual

Igual que negro (`board-view.ts`'s `PIECE_COLOR`, `launch-animation.ts`'s sonidos por tipo de
evento): arcoíris recibe un color de renderer propio (un degradado no es viable con un
`Phaser.GameObjects.Circle` de color sólido -- se usa un color sólido representativo, p.ej. un
violeta/magenta claramente distinto de los 5 colores ya usados, a falta de textura). El nuevo
evento de cambio de color (ver data-model.md) dispara un efecto de sonido propio
(`playRainbowSound`, nuevo asset), nunca `playImpactSound` ni ningún otro sonido existente.

## Decisión 8 (encontrada en verificación visual, no prevista en el plan original): elegir un color dejaba la animación congelada para siempre

**Contexto**: T026 (verificación visual manual) reprodujo un lanzamiento real de arcoíris contra
una ficha asentada y encontró un bug real: tras elegir un color en el diálogo flotante, la
resolución quedaba congelada de forma permanente -- ambos círculos temporales (el de la ficha que
desaparece y el de la que cambia de color) quedaban visibles para siempre, sin viajar, sin
desvanecerse, sin cambiar de color, y sin ningún error en la consola. Es la primera vez que esta
feature (o cualquier feature anterior) reanuda una animación DESDE DENTRO del propio manejador de
clic de un elemento que ese mismo manejador destruye.

**Causa**: `showColorChoiceDialog`'s `circle.on('pointerdown', ...)` llamaba a `cleanup()`
(destruye el propio círculo que se acaba de pulsar, junto al resto del diálogo) y, en la misma
línea, a `onChoose(color)` -- que en `BoardScene` reanuda la cadena y crea NUEVOS
`scene.tweens.add(...)` para el siguiente tramo de animación, todo ello todavía DENTRO del propio
despacho de Phaser para ese evento `pointerdown`. Verificado con `console.log`: los nuevos tweens
se añadían con éxito (`scene.tweens.paused === false`, la escena activa), pero nunca avanzaban ni
un solo frame -- destruir un objeto interactivo desde dentro de su propio evento de entrada y, en
la misma pila de llamadas, registrar tweens nuevos antes de que ese despacho termine de
desenrollarse, los deja permanentemente colgados sin ningún error observable.

**Arreglo**: `onChoose(color)` se difiere un tick (`scene.time.delayedCall(0, () => onChoose(color))`)
tras `cleanup()`, en vez de llamarse en la misma línea -- se ejecuta en un frame propio, fuera de
la pila de despacho de entrada de Phaser, lo que resuelve el problema por completo. Verificado en
vivo dos veces (eligiendo `'red'` y `'black'` en sesiones distintas): la ficha atacante viaja y se
desvanece, la defensora hace su "flip" de color correctamente, y el objetivo se evalúa bien contra
el resultado final en ambos casos (una victoria, una derrota, según coincidiera o no con el color
elegido).

**Rationale**: Ningún otro punto de este motor o renderer vuelve a disparar animación desde dentro
del propio manejador de clic de un elemento que se autodestruye -- el resto de interacciones
(lanzar, seleccionar mano) siempre disparan desde marcadores/zonas que NO se destruyen a sí mismas
en el mismo gesto. Documentado aquí como descubrimiento legítimo de esta feature (primera en tener
un punto de pausa/reanudación real), mismo patrón que 023 documentó sus propios bugs de renderer
encontrados en vivo (Decisión 5).

## Decisión 9: generador de niveles

Igual que negro (spec.md 023): no se integra en `tools/generator`. Se añade el mismo guard
defensivo (`if (striker === 'rainbow') continue;` o equivalente) donde `obligations.ts` itera
`availableColors`, por si en el futuro alguien lo añade sin querer a un nivel generado
automáticamente -- un no-op en la práctica hoy, igual que el guard ya existente para negro.

## Decisión 10 (reportada por el usuario tras la PR/entrega inicial): faltaba la animación de
## trayecto antes de abrir el diálogo de color

**Contexto**: el usuario probó un lanzamiento real de arcoíris y confirmó que el resto funciona
correctamente, pero el diálogo de color aparecía INSTANTÁNEAMENTE al lanzar -- sin ver primero a
la ficha viajar hasta el punto de impacto, a diferencia de cualquier otro color.

**Causa**: el evento `ANNIHILATION` de la propia atacante (su viaje real hasta `at`, y su
desaparición) se construía DENTRO de `resume(color)` -- es decir, no existía ningún evento
todavía cuando `applyImpact` devolvía el resultado `'pending-color-choice'` (`events: []`).
`playEventLog`, al recibir un array vacío, llama a `onDone` de inmediato (mismo guard que ya
gestiona el missclick, FR-004) -- así que el diálogo se abría sin haber reproducido nada.

**Arreglo**: el `ANNIHILATION` de la atacante se construye y se devuelve como parte del propio
resultado `'pending-color-choice'` (`events: [vanishedEvent]`), no dentro de `resume`. Esto
reproduce el viaje completo ANTES de que se abra el diálogo, exactamente como cualquier otro
impacto se resuelve por completo antes de mostrar su consecuencia -- y sigue beneficiándose de la
protección `isFirstEvent` para un `from` fuera de tablero, porque sigue siendo `events[0]` cuando
esta es la primera resolución del lanzamiento. `resume(color)` pasa a devolver únicamente el
`COLOR_CHOICE` (`events: [colorChoiceEvent]`).

Esto implica que el tablero devuelto en el estado `'pending-color-choice'` ya NO es el original sin
tocar -- `at` queda vacío (`setPieceAt(board, at, null)`) desde ese mismo momento, reflejando en
los datos del motor exactamente lo que el renderer ya muestra durante la pausa: la atacante
desapareció, la defensora (con su color antiguo) también se ha ido de esa casilla, y lo que
aparezca ahí lo decide el jugador. `resume` construye la ficha recoloreada sobre ESE tablero
(`boardDuringPause`), no sobre el original.

**Bug relacionado encontrado al arreglar este** (`pendingFrom`, `src/engine/events.ts`): la
función que reanuda una cadena pausada acumulaba `resolvedSoFar` (lo resuelto ANTES de la pausa)
pero olvidaba sumar `pending.events` (los eventos de ESTA pausa en concreto) al reanudar -- un bug
ya presente desde la implementación original de la Decisión 1, pero invisible mientras
`pending.events` fuera siempre `[]` (el diseño anterior a esta Decisión 10). En cuanto
`vanishedEvent` pasó a viajar dentro de `pending.events`, el `EventLog` final perdía ese evento
al reanudar. Arreglado sumando también `pending.events` al construir `eventsSoFar` en `resume`,
tanto para el caso resuelto como para una posible pausa anidada.

**Verificado**: los 7 tests de `rainbow.test.ts` actualizados para reflejar la nueva distribución
de eventos (el `ANNIHILATION` de la atacante ahora vive en el resultado pendiente, no en
`resume`), `npm test` en verde (254/254), y en vivo en el navegador: la ficha arcoíris viaja
visiblemente hasta la casilla de impacto antes de que aparezca el diálogo.

## Decisión 11 (preguntada al usuario tras la misma ronda de feedback): la fragilidad de la
## defensora no cambia con el impacto de arcoíris

**Pregunta**: ¿debería el impacto de arcoíris avanzar la fragilidad de la defensora (como hacen
verde/naranja/marrón/rojo), o dejarla intacta (como ya estaba implementado)?

**Respuesta del usuario**: dejarla intacta -- confirmando el valor por defecto ya implementado --
pero pidiendo verificar explícitamente que la ficha recoloreada conserva la fragilidad que ya
tenía la defensora (ni avanza, ni se resetea a `'new'`).

**Razonamiento (compartido con el usuario antes de preguntar)**: arcoíris es un repintado mágico,
categoría distinta de verde/naranja/marrón/rojo (que sí desplazan o dividen físicamente). Avanzar
la fragilidad habría obligado además a decidir qué hacer si llega a `'broken'` -- lo natural
(mismo patrón que `settleOrVanish`) sería que la ficha recoloreada desapareciera en vez de
asentarse, lo que a veces habría hecho que elegir un color no produjera ninguna ficha visible,
rompiendo la promesa central de la feature. Negro tampoco toca fragilidad (elimina en vez de
avanzarla), así que esto no introduce ninguna inconsistencia nueva en el motor.

**Verificado**: `resume(color)` ya construía la ficha recoloreada como `{color, fragility:
defender.fragility}` -- `defender` se lee del tablero ANTES de la pausa y nunca se muta, así que
su fragilidad original (`'new'`, `'cracked'`, lo que fuera) se conserva intacta. Dos tests nuevos
en `rainbow.test.ts` (uno por cada rol -- arcoíris atacante y arcoíris asentada) fijan esto
explícitamente con una defensora `'cracked'`, confirmando que el resultado final sigue siendo
`'cracked'` con el color elegido, no `'new'` ni avanzada a `'broken'`.

## Decisión 12 (reportada por el usuario, negro -- no arcoíris, encontrada en la misma ronda de
## pruebas): la limpieza de línea de negro se disparaba ANTES de que la propia ficha la golpeara

**Contexto**: el usuario, probando en un nivel 2 modificado a mano (negra colocada en el tablero),
reportó que lanzar cualquier ficha hacia una negra disparaba la limpieza de línea INSTANTÁNEAMENTE,
antes de que la ficha lanzada llegara siquiera a tocarla -- y siempre, tanto si la negra terminaba
siendo la atacante (lanzada) como la defensora (asentada, golpeada por otra). Reproducido primero
a nivel de motor (`resolveLaunch`, headless) confirmando que los DATOS del `EventLog` eran
correctos (el evento disparador, con su `from`/`direction` reales, siempre `events[0]`) -- el bug
estaba puramente en `computeEventParents` (`launch-animation.ts`), no en el motor.

**Causa**: `wasOrphan[0]` estaba sembrado como `true` a propósito, pensado para la propagación de
"una tanda de orphans consecutivos debe colapsar en un único grupo de hermanos" (Decisión 5 de
023). Pero para `j=1` (el primer evento barrido), esa semilla hacía que
`parents[1] = wasOrphan[0] ? parents[0] : 0` tomara la rama `parents[0]` (= `null`) -- convirtiendo
al evento barrido en un SEGUNDO ROOT independiente, hermano del propio disparador, en vez de HIJO
suyo. Como los eventos barridos usan el camino de distancia cero (`from === at`, se desvanecen casi
al instante) y ambos "roots" arrancan a la vez, la limpieza entera se veía completar mientras la
ficha disparadora TODAVÍA estaba viajando (o incluso antes de que su propio glide de entrada
empezara) -- exactamente lo reportado.

**Arreglo**: se deja `wasOrphan[0]` en su valor por defecto (`false`). Así, para `j=1`, la rama
`else` de la propagación (`parents[j] = j - 1`) encadena el primer evento barrido al disparador
como su HIJO real -- y el resto de la tanda barrida (`j=2,3,...`), al ver que `wasOrphan[j-1]` ya
es `true`, siguen colapsando en el MISMO padre (`parents[1]`), preservando exactamente el
comportamiento ya arreglado en 023 (todos los barridos, simultáneos entre sí) pero ahora
correctamente supeditados a que el disparador termine de llegar primero.

**Verificado**: no rompe ninguno de los 4 tests de regresión ya existentes de
`computeEventParents` (el caso de colisión mutua de 022 nunca dependía de `wasOrphan[0]`, ya que su
propia cadena de orphans empieza en un índice posterior) -- solo el test que codificaba
literalmente el comportamiento incorrecto (`[null,null,null,null]`) necesitó actualizarse a
`[null,0,0,0]`. Se añadió un test nuevo cubriendo el repro exacto del usuario (una ficha DISTINTA
lanzada contra una negra ya asentada, no negra lanzada) para fijar que el arreglo funciona en
ambos roles. `npm test` en verde (257/257).

**Nota**: este bug es de negro (023-black-piece-line-clear), no de arcoíris -- documentado aquí
porque se encontró y arregló en esta misma rama/sesión, en código compartido
(`computeEventParents`) que arcoíris también usa.
