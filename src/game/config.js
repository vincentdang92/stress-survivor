/** Phaser game config */
import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene.js';

export function createPhaserGame(parent) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#E7EDF5',
    width: window.innerWidth || 800,
    height: window.innerHeight || 600,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Chạy ở 1fps khi idle — startBattle() sẽ boost lên 60fps
    fps: { min: 1, target: 1, forceSetTimeOut: false, deltaHistory: 10 },
    scene: [BattleScene],
    disableContextMenu: true,
    input: { activePointers: 4 },
    render: { pixelArt: false, antialias: true },
    autoStart: false,
  });
}
