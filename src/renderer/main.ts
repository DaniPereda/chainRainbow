import Phaser from 'phaser';
import { StartScene } from './scenes/StartScene.js';
import { LevelSelectScene } from './scenes/LevelSelectScene.js';
import { BoardScene } from './scenes/BoardScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 480,
  height: 600,
  backgroundColor: '#1e1e1e',
  scene: [StartScene, LevelSelectScene, BoardScene],
});
