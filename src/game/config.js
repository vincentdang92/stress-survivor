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
    // NO physics needed — we do manual movement
    scene: [BattleScene],
    disableContextMenu: true,
    input: { activePointers: 4 },
    render: { pixelArt: false, antialias: true },
    // Don't auto-start first scene; we call startBattle manually
    autoStart: false,
  });
}
