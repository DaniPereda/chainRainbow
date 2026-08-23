# Quickstart: Validar el Wrap-around

Guía de validación end-to-end una vez implementada esta historia. Complementa (no sustituye) las
de las features 001-003.

## Prerrequisitos

Los mismos que en features anteriores — sin dependencias nuevas.

## Ejecutar toda la suite

```bash
npm test
```

**Resultado esperado**: las seis suites existentes (`launch`, `chain`, `objective`,
`determinism`, `orange`, `same-color`) siguen en verde sin haber sido modificadas, más dos
nuevas:

- `wrap-around.test.ts` → FR-001 (wrap a destino vacío, con la ficha lanzadora asentándose donde
  estaba la residente).
- `move-step.test.ts` → prueba `stepBy` en aislado (sin tablero): la coordenada envuelta se
  calcula bien para cada dirección. Junto con `orange.test.ts`/`same-color.test.ts` (que ya
  prueban la regla universal para cualquier destino ocupado), esto cubre FR-002 por composición
  — ver data-model.md para el razonamiento de por qué no hay un fixture end-to-end dedicado a
  "wrap aterriza en casilla ocupada".

## Validación manual rápida (opcional)

```ts
import { resolveLaunch, testLevelWrapToEmpty01 } from './src/engine';

const outcome = resolveLaunch(testLevelWrapToEmpty01, { direction: 'E', lane: 2 });
console.log(outcome.board.cells[2][7]); // { color: 'green' } -- el lanzador se asienta aquí
console.log(outcome.board.cells[2][0]); // { color: 'orange' } -- reapareció al otro lado
console.log(outcome.result); // 'won'
```

## Criterio de "hecho" para esta historia

- [ ] `wrap-around.test.ts` y `move-step.test.ts` pasan.
- [ ] Las seis suites existentes siguen pasando **sin haber sido modificadas**.
- [ ] Un missclick (viaje inicial de lanzamiento) sigue comportándose exactamente igual que antes
      — verificado por `launch.test.ts`, sin tocar.
- [ ] `src/engine/` sigue sin importar nada externo, `package.json` sigue sin dependencias de
      runtime.
