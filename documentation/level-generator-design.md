# Diseño del generador de niveles por construcción inversa

Documento de trabajo, fruto de una sesión de diseño conjunta. Recoge las decisiones tomadas
hasta ahora sobre cómo generar niveles con solución garantizada, cómo puntuar su dificultad, y
cómo encaja todo con el motor y el almacenamiento de niveles. Es un documento de exploración,
anterior a convertirse en specs concretas de `/speckit-specify` — algunas partes (rojo, multi-goal)
siguen abiertas.

## 1. Idea central: construcción inversa, no generar-y-verificar

En vez de generar un tablero al azar y usar un solver para comprobar si es resoluble (lo cual no
escala: con manos grandes, la búsqueda exhaustiva hacia delante es inviable — ver sección 7), el
nivel se construye **hacia atrás desde el objetivo**. Se decide primero qué ficha debe acabar en
la casilla del goal, y se va reconstruyendo, un paso cada vez, qué tuvo que pasar antes para que
eso ocurriera. El resultado final es, por construcción, siempre resoluble — y además ya se conoce
la solución exacta (o al menos una), sin necesidad de buscarla.

Este es el mismo patrón que usan los buenos generadores de Sokoban o de puzzles deslizantes:
construir hacia atrás desde el estado resuelto, no generar hacia delante y esperar que funcione.

## 2. Modelo de construcción: cola de obligaciones

En vez de pensar la construcción como una pila (un único hilo que se remonta hacia atrás), se
modela como una **cola de obligaciones abiertas**. Una obligación es "esta casilla debe terminar
con una ficha de este color". Se van sacando obligaciones de la cola y resolviéndolas, en
cualquier orden, hasta que la cola queda vacía. Resolver una obligación puede:

- **Cerrarla como mobiliario inicial**: se coloca la ficha ahí directamente, como parte del
  estado inicial del tablero. No genera ninguna obligación nueva (hoja del árbol).
- **Cerrarla con un empuje hacia atrás** (verde/naranja/marrón, ver sección 3): genera
  exactamente UNA obligación nueva (de dónde viene la ficha que fue empujada).
- **Cerrarla con una división de rojo** (ver sección 4): genera DOS obligaciones nuevas — una por
  la rama que no nos interesa, y otra por el origen de la propia ficha roja que golpea.
- **Cerrarla contra un bloqueante** (ver sección 5): genera una obligación de "limpiar" ese
  bloqueante con un lanzamiento anterior.

Cada color añade a la cola, además, la obligación implícita de "¿de dónde viene el propio
lanzador de este paso?" — con dos respuestas posibles: viene de la mano (empieza una cadena
nueva ahí), o es el resultado de un empuje anterior (hay que seguir construyendo hacia atrás su
propio origen).

## 3. Inversos por color

| Color | Inverso | Grado de libertad del generador |
|---|---|---|
| Verde | Unívoco — retroceder exactamente 1 casilla en la dirección de impacto (con wrap-around) | Solo la dirección de impacto (aleatoria) |
| Naranja | Unívoco — retroceder exactamente 2 casillas | La dirección, y opcionalmente una ficha decorativa en la casilla intermedia (que naranja nunca comprueba — `stepBy` no mira el tablero — así que es puramente cosmético, no cambia el resultado) |
| Marrón | Un CONJUNTO de candidatos, no una única respuesta — cualquier casilla de origen cuyo paseo hacia delante llegaría al destino sin toparse con nada antes, respetando wrap-around | Dirección, distancia dentro de ese conjunto, y verificar que el camino intermedio esté despejado en el tablero que se lleva construido hasta ese momento |
| Rojo | Ver sección 4 — no es una bifurcación simple, genera dos obligaciones simultáneas | — |

## 4. Rojo: dos obligaciones simultáneas, no una bifurcación simple

Vista hacia atrás, la división de rojo no colapsa nunca a una única línea — ni siquiera desde las
dos ramas hacia arriba: convergen en un punto, pero ese punto vuelve a bifurcarse en dos
historias independientes (la de la ficha golpeada y la del propio rojo que golpea). El modelo de
cola de obligaciones (sección 2) absorbe esto sin necesitar ningún mecanismo especial: rojo es
simplemente el único color que, al resolver una obligación con él, mete dos obligaciones nuevas
en la cola en vez de una.

**Receta concreta**:
1. Elegir una dirección de impacto D (aleatoria) — fija el par de direcciones perpendiculares
   (N/S → ramas E/O; E/O → ramas N/S).
2. Decidir cuál de las dos ramas es la que nos interesa (Q, la que continúa hacia el objetivo).
3. El punto de división es un paso atrás desde Q en la dirección perpendicular contraria —
   tan simple como el inverso de verde.
4. Colocar ahí una ficha del color a dividir.
5. Cerrar la obligación de la OTRA rama (la que no es Q) con una de estas tres opciones:
   - **Pieza muerta**: se acepta que aterrice ahí sin construir nada más — cierre gratis.
   - **Aniquilación**: se coloca otra ficha del mismo color exactamente en su casilla de
     aterrizaje (un paso en su dirección) — mismo patrón "hoja" de siempre.
   - **Nuevo goal**: la rama satisface un segundo objetivo — depende de soporte multi-goal en el
     motor (no existe todavía, ver sección 8).
6. Construir, como con cualquier otro color, el origen del propio rojo que golpea (mano o cadena
   anterior).

## 5. Bloqueantes

### 5.1. Bloqueantes deliberados

No son señuelos en caminos alternativos — se colocan directamente en el mecanismo del paso que
se está construyendo, haciendo que ese paso sea irrealizable hasta que el bloqueante se resuelva.
Esto convierte la construcción en un grafo de dependencias de orden entre lanzamientos ("el
lanzamiento que limpia el bloqueante B tiene que ocurrir antes que el lanzamiento que depende de
esa casilla"), no en una secuencia estricta — el mecanismo real detrás de la sensación de "árbol,
no línea" que se buscaba, más que los señuelos decorativos.

**Regla de construcción**: la subcadena que limpia un bloqueante nunca puede depender, directa o
indirectamente, del propio paso al que ese bloqueante bloquea — así el grafo de dependencias es
acíclico por construcción, sin necesidad de comprobarlo aparte.

### 5.2. Limpiar un bloqueante: aniquilar o desplazar

- **Aniquilación**: limpia y sin efectos secundarios — el bloqueante desaparece, no genera ningún
  hecho nuevo que rastrear. La opción barata.
- **Desplazamiento**: el bloqueante se reubica en vez de desaparecer — genera un hecho nuevo en
  el tablero que hay que validar igual que cualquier otra pieza (no puede caer sobre algo ya
  construido, ni sobre algo que se necesite después). A cambio, permite aprovechar dónde aterriza
  para otra parte del puzzle (resolver dos problemas con un lanzamiento).

Huella de cada color al desplazar un bloqueante:

| Color usado para desplazar | Huella que deja |
|---|---|
| Verde | 1 casilla más allá — predecible |
| Naranja | 2 casillas más allá, SIN comprobar la intermedia — puede haber cualquier cosa ahí, incluso otro bloqueante, sin que afecte |
| Marrón | La más arriesgada — paseo largo con wrap-around, punto de aterrizaje menos controlable, más riesgo de chocar con algo ya construido en otra parte |
| Rojo | No desplaza, DIVIDE — el bloqueante desaparece de su celda y aparecen dos fichas nuevas de su color (una por dirección perpendicular) — dos huellas nuevas en vez de una, pero también dos oportunidades de aprovechamiento |

### 5.3. Bloqueantes emergentes (no solo deliberados)

Al cerrar la obligación de "pieza muerta" de una rama de rojo (sección 4, opción 1), no es
gratis por defecto: hay que comprobar si esa casilla coincide con algo que otra obligación, ya
construida, necesita. Esta comprobación es barata — no hace falta esperar a la repetición
completa hacia delante, basta con mirar el tablero construido hasta ese momento.

Si hay conflicto, **no se descarta el nivel** — se cierra la obligación como bloqueante en vez de
como pieza muerta, reutilizando la misma maquinaria de la sección 5.2. Efecto colateral bueno:
los tableros más densos generan este tipo de bloqueantes por sí solos, sin colocarlos a
propósito, alimentando el dial de dificultad de forma orgánica.

Tres niveles de resolución, no dos:
1. Cerrar limpio (sin conflicto).
2. Conflicto → promocionar a bloqueante y encolar su limpieza (secciones 5.1/5.2).
3. Ni siquiera eso es posible (p. ej. el orden de aparición no admite insertar un lanzamiento de
   limpieza antes) → ahí sí, abortar el nivel entero (sección 6).

## 6. Validación y política de fallos

Cada vez que se cierra un paso de construcción, se reanda el puzzle hacia delante (sin contar
bloqueantes) para comprobar que la traza sigue coincidiendo con lo esperado.

**Decisión**: sin reintentos locales ni backtracking selectivo — si algo falla de verdad (más
allá de lo que la sección 5.3 ya sabe resolver), se descarta el nivel completo y se empieza de
cero con una nueva construcción aleatoria. Cada intento es barato (una simulación determinista,
no una búsqueda), así que un ratio de descarte alto es aceptable a cambio de un algoritmo mucho
más simple, sin gestión de estado parcial que deshacer.

## 7. Por qué no fuerza bruta

El motor ya es puro y determinista (Principios I/III de la constitución), lo cual hace tentador
un solver por búsqueda exhaustiva hacia delante — pero no escala. Con una mano de 20 fichas, el
árbol de acciones es del orden de `colores_distintos × 4 direcciones × 8 carriles` de ramificación
por nodo, elevado a una profundidad de hasta 20 — inabarcable incluso con poda agresiva y
memoización (una estimación optimista sigue dando ~10^13 estados). La construcción inversa evita
el problema por completo: nunca se busca una solución, se construye directamente.

El solver hacia delante sigue teniendo un papel, pero distinto: no "encontrar una solución" sino
**verificar que la solución construida es la única/mínima razonable** — con la longitud de la
solución conocida como cota superior desde el primer momento (branch-and-bound), la búsqueda de
"¿hay algo mejor o igual de bueno que esto?" es mucho más pequeña que una búsqueda a ciegas.

## 8. Parámetros de entrada del generador

- Número de fichas que no sirven en la mano (señuelos).
- Tipos de fichas disponibles en mano.
- Tipos de fichas disponibles en el tablero.
- Porcentaje de aparición de bloqueantes deliberados.
- Porcentaje de que el desencadenante de un paso sea un lanzamiento (inicio de cadena) o parte de
  una cadena ya en curso.
- Número de goals (futuro — depende de soporte multi-goal, sección 9).

## 9. Puntuación de dificultad

Derivada de los propios datos de la construcción (no adivinada por separado):

- Número de lanzamientos.
- Tipos de fichas usadas.
- Número de fichas inútiles en mano.
- Número de fichas inútiles en el tablero.
- Longitud de cada una de las cadenas.
- Número de goals (futuro).

Estos datos, combinados con el resultado del solver de verificación (sección 7) — densidad de
soluciones alternativas cerca de la construida, profundidad de bloqueantes anidados — dan una
puntuación de dificultad basada en datos reales de búsqueda, no en pesos ajustados a mano por
color.

## 10. Almacenamiento y distribución

La salida del generador es JSON con la misma forma que ya consume `createLevel()`
(`pieces`/`hand`/`goal`), más metadatos del propio generador (secuencia de lanzamientos de
referencia, puntuación de dificultad, semilla/parámetros) en el mismo fichero o en uno hermano.
Al ser datos declarativos puros (Principio IV), ese JSON sirve sin traducción para:

- **Base de datos**: columna JSONB, sin transformar nada.
- **Paquetes descargables**: el mismo fichero es directamente el contenido de un paquete que el
  cliente descarga tras pago/anuncio, y juega en local sin conexión — el servicio solo se usa
  para descargar paquetes nuevos y guardar progreso periódicamente (cada N niveles).
- **Motor gráfico**: vía un loader en runtime (fetch del paquete) o, para el prototipo actual, un
  pequeño paso de build que vuelca los JSON al array `PROTOTYPE_LEVELS`.
- **Visor de cadenas** ("Consola de Cadenas", herramienta de tests manuales — ver artefacto de
  esta sesión): hoy solo reproduce una selección fija de 10 niveles del prototipo, con las
  trazas precalculadas a mano. Pendiente: poder pedirle el ID de un nivel generado y que cargue
  su traza — el mismo JSON de salida del generador (pieces/hand/goal + secuencia de lanzamientos
  de referencia) ya trae todo lo necesario para reconstruirla sin volver a ejecutar el motor
  aparte; solo falta el mecanismo de carga por ID (fichero/DB) en vez de la lista embebida
  actual.

## 11. Preguntas abiertas / trabajo futuro

- **Multi-goal**: `Goal` en el motor es hoy un único `{targetColor, targetCell}`. Necesario para
  la opción "nuevo goal" de una rama de rojo (sección 4) y para el parámetro de número de goals
  (secciones 8/9). Es un cambio de motor aparte, no cubierto por este documento.
- **Invertibilidad como restricción de diseño para fichas futuras**: cualquier ficha nueva
  (arcoíris, negro, azul, púrpura — consideradas en el documento de diseño del juego pero no
  implementadas) necesita un inverso razonable para poder participar en la construcción hacia
  atrás. Negro (selección directa de casilla, sin cadena) probablemente no tiene inverso de
  cadena y tendría que tratarse como pieza de mano sin historial ascendente. Arcoíris (el jugador
  elige el color resultante) amplía el espacio de acciones del solver, pero de forma contenida
  (un parámetro más por lanzamiento, no un rediseño).
- **Diseño detallado del solver de verificación** (sección 7): heurística de branch-and-bound,
  cómo explorar señuelos plausibles cerca de la solución conocida sin volver a caer en fuerza
  bruta completa.
