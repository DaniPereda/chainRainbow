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
`determinism`, `orange`, `same-color`) siguen en verde sin haber sido modificadas, más el nuevo
`wrap-around.test.ts`:

- `wrap-around.test.ts` → FR-001, FR-002 (wrap a destino vacío, a color distinto, y al mismo
  color, con la regla universal de interacción aplicándose igual en los tres casos).

## Validación manual rápida (opcional)

```ts
import { resolveLaunch, testLevelWrapToEmpty01 } from './src/engine';

const outcome = resolveLaunch(testLevelWrapToEmpty01, { direction: 'E', lane: 2 });
console.log(outcome.board.cells[2][7]); // null -- la ficha ya no está en el borde
console.log(outcome.board.cells[2][0]); // { color: 'orange' } -- reapareció al otro lado
console.log(outcome.result); // 'won'
```

## Criterio de "hecho" para esta historia

- [ ] `wrap-around.test.ts` pasa, cubriendo los tres casos (vacío, color distinto, mismo color).
- [ ] Las seis suites existentes siguen pasando **sin haber sido modificadas**.
- [ ] Un missclick (viaje inicial de lanzamiento) sigue comportándose exactamente igual que antes
      — verificado por `launch.test.ts`, sin tocar.
- [ ] `src/engine/` sigue sin importar nada externo, `package.json` sigue sin dependencias de
      runtime.
