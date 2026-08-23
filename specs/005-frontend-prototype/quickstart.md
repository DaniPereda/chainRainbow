# Quickstart: Validar el Prototipo Frontend de Niveles

Guía de validación una vez implementada esta historia. Complementa (no sustituye) las de las
features 001-004 (el motor en sí no cambia de comportamiento, solo gana un nuevo consumidor).

## Prerrequisitos

- Node.js 20+ (ya usado por el motor).
- Dependencias nuevas instaladas: `phaser`, `vite` (`npm install` tras añadirlas a
  `package.json` en la fase de implementación).

## Validación headless (motor) — automatizada

```bash
npm test
npm run typecheck
```

**Resultado esperado**: las seis suites existentes del motor (`launch`, `chain`, `objective`,
`determinism`, `orange`, `same-color`, `wrap-around`, `move-step`) siguen en verde sin
modificaciones de comportamiento, más dos nuevas:

- `tests/unit/engine/session.test.ts` → cubre US2/US3: lanzar actualiza el estado, un
  missclick no cambia nada y no dispara ninguna ventana, alcanzar el objetivo marca `'won'`,
  vaciar la mano sin objetivo marca `'lost'`, y `restartSession` siempre reproduce el nivel
  inicial exacto.
- `tests/unit/levels/prototype-levels.test.ts` → cada uno de los 10 niveles es una definición
  válida (tablero 8×8, al menos una ficha en mano, objetivo dentro del tablero) y usa solo
  colores de Fase 1 (verde/naranja).

## Validación visual (renderer) — manual

```bash
npm run dev   # levanta Vite; abrir la URL que imprime en el navegador
```

Recorrer, para AL MENOS 3 de los 10 niveles (y los 10 antes de dar la feature por cerrada, per
SC-003):

1. **US1** — Desde la pantalla de inicio, abrir el selector, elegir el nivel, y comprobar que el
   tablero mostrado coincide con la definición de ese nivel en `prototype-levels.ts` (misma
   posición/color de cada ficha, misma casilla/color objetivo). Sin haber lanzado nada, usar la
   acción de volver (FR-014) y confirmar que regresa al selector.
2. **US2** — Tocar/clicar una casilla del borde que SÍ alcance una ficha: el tablero debe
   reflejar el estado final tal cual lo devolvería `resolveLaunch` para ese lanzamiento (se
   puede verificar en paralelo con un test manual headless usando ese mismo nivel/lanzamiento).
   Tocar/clicar un borde que NO encuentre ninguna ficha (missclick): el tablero no cambia y no
   aparece ninguna ventana.
3. **US3** — Jugar un nivel hasta 'won' (comprobar que aparece la ventana de éxito) y otro hasta
   'lost' (ventana de fallo). Desde cada ventana, comprobar que "reiniciar" deja el tablero
   exactamente como al entrar al nivel, y que "volver al selector" regresa a la lista de 10.
4. **Sin persistencia (FR-012)** — Tras lanzar alguna ficha en un nivel (sin llegar a 'won'/
   'lost'), volver al selector (FR-014) y volver a entrar al mismo nivel: debe mostrarse otra
   vez en su estado inicial declarado, no en el estado a medio jugar que se dejó atrás.

## Criterio de "hecho" para esta historia

- [ ] `session.test.ts` y `prototype-levels.test.ts` pasan.
- [ ] Volver al selector desde el tablero (FR-014) funciona en cualquier momento, no solo desde
      la ventana de resultado, y reentrar a un nivel siempre lo muestra en su estado inicial
      (FR-012, paso 4 de arriba).
- [ ] Las suites existentes del motor siguen pasando **sin modificaciones de comportamiento**
      (el renombrado `createTestLevel`→`createLevel` es un cambio de nombre, no de
      comportamiento — las fixtures que lo usan deben seguir produciendo los mismos niveles).
- [ ] `src/engine/` (incluido `session.ts`) sigue sin importar nada de `src/renderer/` ni de
      `phaser` — verificable con el mismo `grep` de imports externos usado en features previas.
- [ ] Los 10 niveles se han jugado manualmente al menos una vez cada uno hasta `'won'`
      (SC-003).
- [ ] Las 3 historias de usuario (US1, US2, US3) se han recorrido manualmente en el navegador
      siguiendo los pasos de arriba.
