# Quickstart: Arcoíris Solo Actúa Como Atacante

## Prerrequisitos

- Implementación completa: `applyImpact` sin la mitad `defender.color === 'rainbow'` de su condición;
  `buildColorChoicePause`/`clearLineFrom` extraídas y reutilizadas; `MutualImpactHandler` unificado
  con `ImpactResolution`; `applyMutualImpact`'s nueva rama de arcoíris; `strikeMutualSide`'s nueva
  rama de negro.
- `npm test` en verde para `tests/unit/engine/rainbow.test.ts` y `tests/unit/engine/push.test.ts`.

## Escenario 1 -- Arcoíris asentada golpeada por cada color normal se comporta como cualquier defensora (SC-001)

Colocar una ficha arcoíris en el tablero. Golpearla, por separado, con verde, naranja y marrón.
Confirmar en cada caso: la arcoíris avanza su fragilidad y se desplaza la distancia propia de ese
color (`PUSH_STRATEGY`), continuando como una ficha de color `'rainbow'` -- sin abrir ningún selector
de color en ningún momento.

## Escenario 2 -- Rojo golpeando una arcoíris asentada la divide (SC-002, inversión deliberada de FR-010 de 024)

Colocar una ficha arcoíris en el tablero. Golpearla con una ficha roja. Confirmar: se divide en dos
ramas perpendiculares, ambas todavía de color `'rainbow'`, sin abrir ningún selector de color --
resultado opuesto al que producía esta misma situación antes de esta feature.

## Escenario 3 -- Negro golpeando una arcoíris asentada sigue limpiando la línea completa (sin cambios)

Colocar una ficha arcoíris en el tablero. Golpearla con una ficha negra. Confirmar: su línea completa
se elimina, exactamente igual que antes de esta feature -- ningún selector de color se abre en ningún
momento de esta secuencia.

## Escenario 4 -- Una arcoíris desplazada que golpea una defensora real actúa como atacante, igual que siempre (SC-003)

Colocar una ficha arcoíris de forma que, al ser golpeada por una ficha verde, quede empujada hasta
encontrar una TERCERA ficha real asentada más adelante en la misma cadena. Confirmar: al llegar a esa
tercera ficha, se abre el selector de color de siempre, señalando a esa ficha real (no a la propia
arcoíris); al elegir un color, esa ficha pasa a tenerlo y la arcoíris desaparece, consumida --
exactamente el mismo resultado que produciría una arcoíris lanzada directamente desde la mano contra
esa misma ficha.

## Escenario 5 -- Colisión mutua entre arcoíris y verde: secuencia de dos pasos (SC-004)

Construir una colisión mutua (dos trayectorias en vuelo convergiendo en la misma celda en el mismo
tick) entre una arcoíris y una ficha verde. Confirmar, en este orden:

1. Se abre el selector de color, señalando a la ficha verde (no a arcoíris).
2. Al elegir un color (por ejemplo, naranja), la ficha verde se asienta en la celda de encuentro con
   el color elegido y su fragilidad SIN cambios.
3. Inmediatamente después, arcoíris queda empujada la distancia propia de naranja, con su fragilidad
   YA avanzada -- sin ningún selector adicional.

## Escenario 6 -- Colisión mutua entre arcoíris y rojo: el color elegido divide a arcoíris (SC-004)

Igual que el Escenario 5, pero el otro lado es una ficha roja. Confirmar: tras el selector de color
(señalando a la ficha roja), esta se asienta con el color elegido por el jugador; inmediatamente
después, ARCOÍRIS (no la ficha roja) queda dividida en dos ramas perpendiculares -- porque el color
elegido en el paso 1 es el que determina el mecanismo del paso 2, y ese color puede ser cualquiera de
los cinco, incluido rojo.

## Escenario 7 -- Colisión mutua entre arcoíris y negro: negro limpia la línea de arcoíris (SC-004, FR-007)

Igual que el Escenario 5, pero el color elegido por el jugador en el paso 1 es negro. Confirmar: tras
el paso 1, la ficha no-arcoíris se asienta recoloreada a negro; inmediatamente después, la línea
completa de arcoíris se elimina (trigger + barrido, igual que cualquier impacto de negro), y la
colisión termina sin ninguna continuación para ningún lado.

## Escenario 8 -- Colisión mutua entre dos arcoíris: aniquilación por mismo color, sin cambios (SC-005)

Construir una colisión mutua entre dos trayectorias arcoíris. Confirmar: ambas desaparecen
inmediatamente (dos eventos `ANNIHILATION`, uno por lado), sin que se abra ningún selector de color
-- idéntico al comportamiento ya validado para cualquier otro par del mismo color.

## Escenario 9 -- Ninguna regla existente para el resto de colores cambia (SC-006)

Ejecutar la suite completa de `tests/unit/engine/` existente antes de esta feature. Confirmar: 0
regresiones -- ningún test que no mencione arcoíris cambia de resultado.
