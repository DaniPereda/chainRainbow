# Quickstart: Validar la Animación de Movimientos de Ficha

## Validación headless — automatizada

```bash
npm test
npm run typecheck
npm run build
```

**Resultado esperado**: `tests/unit/renderer/launch-animation.test.ts` (nuevo) pasa -- `replayEvent` reproduce cualquier `EventLog` conocido y produce exactamente el mismo `Board` final que ya devuelve `resolveLaunch` para ese caso (data-model.md). Ninguna suite de `src/engine/` cambia -- `src/engine/` no se toca. `npm run build` confirma que `BoardScene.ts` sigue compilando tras añadir el flag `animating` y la llamada a `playEventLog`.

## Validación manual del renderer (obligatoria — no hay cobertura Vitest para Phaser/dibujo)

```bash
npm run dev
```

1. Abrir un nivel con una cadena de al menos dos eslabones (p. ej. nivel 8 del prototipo, o cualquier nivel generado con marrón/naranja que empuje una segunda ficha). Lanzar. Comprobar que se ve, en orden, cada ficha implicada desplazarse de su casilla de origen a la de destino -- no un salto instantáneo al resultado final (US1).
2. Cargar (o construir a mano) un lanzamiento que produzca una `ANNIHILATION` (dos fichas del mismo color chocando). Comprobar que la ficha se desvanece con un efecto visual antes de desaparecer, no instantáneamente (US1, Acceptance Scenario 2).
3. Lanzar hacia un carril vacío (missclick). Comprobar que no hay ninguna animación -- el tablero se comporta exactamente igual que antes de esta feature (US1, Acceptance Scenario 3).
4. Al terminar la animación de cualquier lanzamiento, comparar visualmente el tablero mostrado contra lo que antes de esta feature se veía tras un `redraw()` instantáneo para ese mismo lanzamiento -- deben coincidir exactamente (US1, Acceptance Scenario 4 / SC-003).
5. Mientras una animación de varios pasos está en marcha: intentar tocar otro marcador de borde (nuevo lanzamiento) y tocar una ficha distinta del panel de mano. Comprobar que ninguna de las dos acciones tiene ningún efecto hasta que la animación en curso termina (US2).
6. Confirmar un lanzamiento que resuelve el nivel (victoria o derrota). Comprobar que la ventana de resultado NO aparece hasta que la animación completa de ese lanzamiento ha terminado de reproducirse (US3).
7. Repetir el paso 1 en el visor de niveles generados (`dev-levels.html` / `GeneratedLevelSelectScene`), para confirmar que la animación funciona igual ahí (spec.md, Edge Cases -- `BoardScene` es compartida).
8. Tocar "< Niveles" (volver al selector) mientras una animación está en marcha: comprobar que la navegación funciona con normalidad (no está bloqueada -- ver Assumptions de research.md/spec.md) y que no queda ningún error en consola por un tween huérfano.

## Criterio de "hecho" para esta feature

- [ ] `replayEvent` cubierto por Vitest, incluyendo el caso `fragility: 'broken'` (no se asienta) y una reproducción completa de un `EventLog` real comparada contra el `board` final de `resolveLaunch`.
- [ ] Los 8 pasos de validación manual del renderer, de arriba, se han comprobado en el navegador.
- [ ] `src/engine/` sigue sin ningún cambio -- confirmado por `git diff` antes de dar la feature por terminada.
- [ ] Ningún control de velocidad/pausa/scrubbing se ha añadido (FR-010) -- la animación es automática y de duración fija.
