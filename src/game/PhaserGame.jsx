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

/** Start a battle in Phaser */
export function startBattle(cls, seed, trial = false) {
  if (!phaserInstance) return;
  if (phaserInstance.scene.isActive('BattleScene')) {
    phaserInstance.scene.stop('BattleScene');
  }
  phaserInstance.scene.start('BattleScene', { cls, seed, trial });
}

export function stopBattle() {
  if (!phaserInstance) return;
  try { phaserInstance.scene.stop('BattleScene'); } catch (e) { /* ignore */ }
}

/** Tạm dừng Phaser loop — gọi khi mở modal để giải phóng main thread */
export function pauseGame() {
  if (!phaserInstance) return;
  try { phaserInstance.loop?.sleep(); } catch (e) {
    try { phaserInstance.pause(); } catch (_) {}
  }
}

/** Tiếp tục Phaser loop — gọi khi đóng modal */
export function resumeGame() {
  if (!phaserInstance) return;
  try { phaserInstance.loop?.wake(); } catch (e) {
    try { phaserInstance.resume(); } catch (_) {}
  }
}
