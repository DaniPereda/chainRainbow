# Phase 0 Research: Prototipo Frontend de Niveles

## Decisión: Phaser Scenes para las 4 pantallas (inicio, selector, tablero, resultado)

- **Decisión**: cada pantalla de la spec (inicio, selector, tablero+juego, éxito/fallo) es una
  `Phaser.Scene` separada (o, para éxito/fallo, un overlay superpuesto sobre la escena del
  tablero en vez de una escena a pantalla completa, para no perder el estado del tablero
  detrás).
- **Rationale**: es el mecanismo nativo de Phaser para pantallas discretas dentro de un único
  canvas — no hace falta introducir un router aparte ni múltiples páginas HTML. Encaja
  directamente con el mandato de la constitución de usar Phaser 3 como capa de presentación.
- **Alternatives considered**: HTML/DOM superpuesto sobre el canvas para menús — descartado por
  añadir un segundo sistema de UI (DOM + Canvas) a un prototipo que se quiere sencillo; las
  Scenes de Phaser ya cubren esta necesidad sin dependencias adicionales.

## Decisión: el punto de lanzamiento en el borde codifica dirección+carril

- **Decisión**: el jugador lanza tocando/clicando una de las 32 casillas justo fuera de un borde
  del tablero (8 por lado). Esa posición determina tanto la dirección (qué borde) como el carril
  (qué fila/columna) sin necesidad de un selector de dirección independiente.
- **Rationale**: es una traducción 1:1 del propio modelo conceptual del juego ("las fichas se
  lanzan desde fuera del tablero", documentation/game_design_context.pdf §3) a interacción
  táctil — no inventa un mecanismo nuevo, solo lo hace tocable. Resuelve FR-005 con la interfaz
  más simple posible.
- **Alternatives considered**: botones separados de dirección (N/S/E/O) + un input numérico de
  carril — más pasos por lanzamiento y no aporta nada que la ubicación por sí sola no resuelva
  ya.

## Decisión: renombrar `createTestLevel` → `createLevel`

- **Decisión**: el builder declarativo de niveles en `src/engine/level.ts` pasa a llamarse
  `createLevel`. Comportamiento idéntico — es un renombrado puro. Las fixtures existentes del
  motor (`testLevelGreen01`, etc.) lo siguen usando sin cambios de comportamiento.
- **Rationale**: los 10 niveles de este prototipo son contenido real del juego, no fixtures de
  test. Seguir llamando a la función que los construye `createTestLevel` sería un nombre que
  miente sobre su propósito para cualquiera que lo lea desde `src/levels/`. Coherente con el
  cuidado ya mostrado en el proyecto por el naming preciso (renombrados previos:
  `collisionResolved`→`hasCollision`, `defenderAt`→`position`).
- **Alternatives considered**: mantener `createTestLevel` y añadir un alias `createLevel` — se
  descarta por dejar dos nombres para la misma función sin motivo real, lo que confunde más de
  lo que ayuda.

## Decisión: `LevelSession` vive en `src/engine/`, no en `src/renderer/`

- **Decisión**: el seguimiento de una partida en curso sobre un nivel (aplicar lanzamientos
  sucesivos, saber si terminó en éxito/fallo, reiniciar) se implementa como un módulo puro y
  headless (`src/engine/session.ts`), no como estado interno de una Phaser Scene.
- **Rationale**: es exactamente el tipo de lógica que el Principio I protege — determinista,
  sin dependencia de Phaser/DOM, testeable sin navegador. Ponerla en `renderer/` obligaría a
  levantar Phaser (o simularlo) solo para testear "¿qué pasa si lanzo esta ficha dos veces
  seguidas?", que es un test de lógica pura, no de presentación.
- **Alternatives considered**: gestionar el estado de la partida directamente dentro de
  `BoardScene` (patrón común en muchos juegos Phaser pequeños) — descartado explícitamente
  porque viola el Principio I de este proyecto en concreto: el propio diseño del motor ya
  separa "qué pasa" (headless, testeado) de "cómo se ve" (Phaser), y esta feature no es una
  excusa para romper esa línea solo porque es "un prototipo sencillo".

## Decisión: piezas y tablero como formas geométricas de Phaser (sin assets de arte)

- **Decisión**: el tablero se dibuja como una cuadrícula 8×8 de rectángulos, las fichas como
  círculos de color (verde/naranja) y la casilla objetivo con un borde o marca distintiva —
  todo con `Phaser.GameObjects.Graphics`/formas primitivas, sin sprites de imagen.
- **Rationale**: no hay ningún asset de arte definido todavía en el proyecto, y la spec no pide
  fidelidad visual — solo "visualizar el tablero y las interacciones". Formas primitivas
  desbloquean el prototipo sin bloquear en un pipeline de arte que no existe.
- **Alternatives considered**: sprites de imagen placeholder — descartado por añadir trabajo de
  producción de assets a una feature que la constitución define explícitamente como "algo
  sencillo" (Fase 2); se puede sustituir por sprites reales más adelante sin tocar la lógica.

## Decisión: build con Vite, sin Capacitor en esta feature

- **Decisión**: se añade Vite como dev server/build del prototipo web; no se integra Capacitor
  en esta feature.
- **Rationale**: la constitución exige que el build web sea ejecutable directamente en
  navegador durante el prototipado ("to keep iteration fast during prototyping") — eso es
  exactamente lo que entrega Vite solo. Capacitor entra en juego para empaquetar como app móvil
  de cara a un release, que no es el objetivo de esta Fase 2.
- **Alternatives considered**: integrar Capacitor ya — descartado por scope creep frente a lo
  que pide spec.md (nada en ella menciona necesitar un build instalable todavía).
