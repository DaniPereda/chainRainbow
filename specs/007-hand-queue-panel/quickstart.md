# Quickstart: Validar el Panel de Fichas en Mano

## Validación headless — automatizada

```bash
npm test
npm run typecheck
npm run build
```

**Resultado esperado**: las 10 suites del motor siguen en verde sin cambios (este feature no
toca `src/engine/` en absoluto); typecheck y build limpios tras añadir `hand-panel.ts` y
extender `BoardScene.ts`.

## Validación visual — manual

```bash
npm run dev
```

1. Cargar el nivel 3 o el 10 (mano de 2 fichas) — el panel bajo el tablero debe mostrar 2
   círculos de color, en el mismo orden que la mano declarada del nivel.
2. Lanzar la primera ficha de la cola — el panel debe pasar a mostrar solo 1 círculo, con el
   color de la ficha que quedaba.
3. Provocar un missclick (tocar un borde que no golpee nada) — el panel no debe cambiar.
4. Lanzar la última ficha — el panel debe quedar completamente vacío, coincidiendo con el
   momento en que ya no se puede lanzar nada más.
5. Reiniciar el nivel desde la ventana de resultado (o desde antes de terminarlo) — el panel
   debe volver a mostrar la mano inicial completa.

## Criterio de "hecho" para esta feature

- [ ] `npm test`, `npm run typecheck`, `npm run build` limpios.
- [ ] Los 5 pasos de validación visual recorridos en el navegador.
