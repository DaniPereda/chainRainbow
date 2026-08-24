# Quickstart: Validar la Selección Libre de Ficha en Mano

## Validación headless — automatizada

```bash
npm test
npm run typecheck
npm run build
```

**Resultado esperado**: las suites existentes siguen en verde sin cambios de comportamiento
(ningún call site de `resolveLaunch`/`applySessionLaunch` existente pasa un `pieceIndex`
explícito, así que todos siguen usando el índice 0 por defecto). `session.test.ts` y
`launch.test.ts` (ampliados) cubren los 9 escenarios de data-model.md. `npm run build` confirma
que `BoardScene.ts`/`hand-panel.ts` siguen compilando tras el cambio de firma de `drawHand`.

## Validación manual del renderer (obligatoria — no hay cobertura Vitest para dibujo/toques)

```bash
npm run dev
```

1. Abrir el nivel 3 (`hand: ['green', 'orange']`).
2. Sin tocar ninguna ficha del panel: comprobar que la PRIMERA ficha (green) aparece con el
   anillo de resaltado — selección por defecto, cero toques adicionales (FR-005).
3. Tocar la SEGUNDA ficha (orange) en el panel: el anillo se mueve a orange, green deja de
   estarlo (FR-004).
4. Lanzar por cualquier marcador de borde que impacte: comprobar que el impacto se resuelve como
   si hubiera lanzado orange (empuje de distancia 2), no green — y que el panel, tras el
   lanzamiento, muestra solo green YA con el anillo puesto encima (avance automático, FR-006).
5. Repetir el paso 3 (seleccionar una ficha que no es la primera) y lanzar hacia un carril vacío
   a propósito (missclick): comprobar que el panel no cambia — ni las fichas ni cuál tiene el
   anillo (FR-007).
6. Reiniciar el nivel desde la ventana de resultado o volver a entrar: comprobar que el anillo
   vuelve a la primera ficha de la mano inicial (FR-005 vía reinicio).
7. Abrir cualquiera de los 11 niveles con una sola ficha en mano (p. ej. nivel 1): comprobar que
   se puede lanzar con un único toque en el borde, sin necesitar tocar el panel primero (SC-003).

## Criterio de "hecho" para esta feature

- [ ] Los 9 escenarios de `data-model.md` pasan en `session.test.ts`/`launch.test.ts`.
- [ ] Las suites existentes del motor siguen pasando sin haber sido modificadas en su intención.
- [ ] `npm run build` sigue limpio tras los cambios de firma de `drawHand`/`resolveLaunch`.
- [ ] Los 7 pasos de validación manual del renderer, de arriba, se han comprobado en el navegador.
- [ ] `src/engine/` sigue sin importar nada de `src/renderer/` (mismo chequeo de siempre).
