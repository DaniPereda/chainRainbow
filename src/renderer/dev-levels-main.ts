import Phaser from 'phaser';
import { GeneratedLevelSelectScene } from './scenes/GeneratedLevelSelectScene.js';
import { BoardScene } from './scenes/BoardScene.js';

// Punto de entrada de desarrollo aparte de main.ts -- solo alcanzable vía
// dev-levels.html, nunca enlazado desde index.html ni empaquetado en
// `npm run build` (Vite solo procesa el HTML declarado como entrada; un
// segundo .html suelto en la raíz no se incluye salvo que se declare
// explícitamente, y aquí no se hace).
new Phaser.Game({
  type: Phaser.AUTO,
  width: 480,
  height: 600,
  backgroundColor: '#1e1e1e',
  scene: [GeneratedLevelSelectScene, BoardScene],
});
