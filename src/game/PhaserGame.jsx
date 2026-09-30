/** PhaserGame.jsx — mounts Phaser inside a div, bridges bus events */
import { useEffect, useRef } from 'preact/hooks';
import { createPhaserGame } from './config.js';

let phaserInstance = null;

export function PhaserGame({ onReady, visible = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (phaserInstance) { phaserInstance.destroy(true); phaserInstance = null; }

    phaserInstance = createPhaserGame(containerRef.current);

    // Wait for Phaser boot complete before signaling ready
    phaserInstance.events.once('ready', () => {
      if (onReady) onReady(phaserInstance);
    });

    return () => {
      if (phaserInstance) { phaserInstance.destroy(true); phaserInstance = null; }
    };
  }, []);

  return (
    <div
      id="phaser-container"
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        // Ẩn hoàn toàn khi không ở battle — canvas không thể nhận events
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: visible ? 1 : -1,
      }}
    />
  );
}

/** Boost Phaser lên 60fps — gọi khi bắt đầu battle */
export function startBattle(cls, seed, trial = false) {
  if (!phaserInstance) return;
  // Boost FPS cho battle
  try { if (phaserInstance.loop) { phaserInstance.loop.targetFps = 60; phaserInstance.loop.wake?.(); } } catch {}
  if (phaserInstance.scene.isActive('BattleScene')) phaserInstance.scene.stop('BattleScene');
  phaserInstance.scene.start('BattleScene', { cls, seed, trial });
}

/** Throttle về 1fps khi rời battle */
export function stopBattle() {
  if (!phaserInstance) return;
  try { phaserInstance.scene.stop('BattleScene'); } catch {}
  try { if (phaserInstance.loop) phaserInstance.loop.targetFps = 1; } catch {}
}

/** Sleep Phaser loop khi mở modal UI */
export function pauseGame() {
  if (!phaserInstance) return;
  try {
    const loop = phaserInstance.loop;
    if (typeof loop?.sleep === 'function') { loop.sleep(); }
    else if (loop) { loop.targetFps = 1; }
    else { phaserInstance.pause?.(); }
  } catch (e) { console.warn('[Phaser] pauseGame:', e.message); }
}

/** Wake Phaser loop khi đóng modal UI */
export function resumeGame() {
  if (!phaserInstance) return;
  try {
    const loop = phaserInstance.loop;
    if (typeof loop?.wake === 'function') { loop.wake(); }
    // Keep at 1fps idle after wake
    if (loop) loop.targetFps = 1;
    else { phaserInstance.resume?.(); }
  } catch (e) { console.warn('[Phaser] resumeGame:', e.message); }
}
