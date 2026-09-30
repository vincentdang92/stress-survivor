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
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: visible ? 1 : -1,
      }}
    />
  );
}

/** Boost Phaser lên 60fps + enable input — gọi khi bắt đầu battle */
export function startBattle(cls, seed, trial = false) {
  if (!phaserInstance) return;
  // Boost FPS + enable input cho battle
  try {
    if (phaserInstance.loop) { phaserInstance.loop.targetFps = 60; phaserInstance.loop.wake?.(); }
    if (phaserInstance.input) phaserInstance.input.enabled = true;
    // Show canvas
    const c = phaserInstance.canvas;
    if (c) { c.style.display = ''; c.style.pointerEvents = 'auto'; }
  } catch {}
  if (phaserInstance.scene.isActive('BattleScene')) phaserInstance.scene.stop('BattleScene');
  phaserInstance.scene.start('BattleScene', { cls, seed, trial });
}

/** Throttle về 1fps + disable input khi rời battle */
export function stopBattle() {
  if (!phaserInstance) return;
  try { phaserInstance.scene.stop('BattleScene'); } catch {}
  try {
    if (phaserInstance.loop) phaserInstance.loop.targetFps = 1;
    // Disable Phaser input khi không battle
    if (phaserInstance.input) phaserInstance.input.enabled = false;
    // Hide canvas element hoàn toàn
    const c = phaserInstance.canvas;
    if (c) { c.style.display = 'none'; }
  } catch {}
}

/**
 * Dừng Phaser hoàn toàn khi mở modal UI:
 * 1. Sleep game loop  2. Disable input  3. Hide canvas  4. Stop scale resize listener
 */
export function pauseGame() {
  if (!phaserInstance) return;
  try {
    const loop = phaserInstance.loop;
    if (typeof loop?.sleep === 'function') loop.sleep();
    else if (loop) loop.targetFps = 1;

    if (phaserInstance.input) phaserInstance.input.enabled = false;

    const c = phaserInstance.canvas;
    if (c) { c.style.display = 'none'; }

    // Stop scale manager resize listener — khi keyboard mở/đóng trên mobile
    // window resize event sẽ không wake Phaser nữa
    if (phaserInstance.scale) phaserInstance.scale.stopListeners?.();
  } catch (e) { console.warn('[Phaser] pauseGame:', e.message); }
}

/** Wake Phaser loop khi đóng modal UI */
export function resumeGame() {
  if (!phaserInstance) return;
  try {
    const loop = phaserInstance.loop;
    if (typeof loop?.wake === 'function') loop.wake();
    if (loop) loop.targetFps = 1;

    const c = phaserInstance.canvas;
    if (c) { c.style.display = ''; }

    // Re-enable scale manager
    if (phaserInstance.scale) phaserInstance.scale.startListeners?.();
  } catch (e) { console.warn('[Phaser] resumeGame:', e.message); }
}
