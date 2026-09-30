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
    // Phaser 4 TimeStep config — start at 1fps idle
    fps: { min: 1, target: 1, forceSetTimeOut: false, deltaHistory: 10 },
    scene: [BattleScene],
    disableContextMenu: true,
    input: {
      activePointers: 4,
      // CRITICAL fix: 'capture' is the correct key in Phaser 4 (not 'prevent')
      // capture: false → Phaser does NOT call event.preventDefault() on touch events
      // → mobile browser can focus inputs and show keyboard normally
      touch: {
        capture: false,   // ← Phaser 4: Config reads 'input.touch.capture'
      },
      mouse: {
        preventDefaultDown: false,
        preventDefaultUp: false,
        preventDefaultMove: false,
        preventDefaultWheel: false,
      },
      // keyboard capture: [] means no keys have preventDefault (allows typing in inputs)
      keyboard: {
        capture: [],
      },
    },
    render: { pixelArt: false, antialias: true },
    autoStart: false,
  });
}
