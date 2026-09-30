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

    phaserInstance.events.once('ready', () => {
      // Start in fully paused state — keyboard listener off until battle
      _stopKeyboard();
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

// ── Internal helpers ─────────────────────────────────────────────────────────

function _stopKeyboard() {
  // Remove Phaser's keydown/keyup listeners from window
  // This prevents ANY Phaser keyboard processing while UI is shown
  try { phaserInstance?.input?.keyboard?.stopListeners?.(); } catch {}
}

function _startKeyboard() {
  try { phaserInstance?.input?.keyboard?.startListeners?.(); } catch {}
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Boost Phaser lên 60fps + enable keyboard — gọi khi bắt đầu battle */
export function startBattle(cls, seed, trial = false) {
  if (!phaserInstance) return;
  try {
    // Wake loop to 60fps
    if (phaserInstance.loop.running === false) phaserInstance.loop.wake();
    phaserInstance.loop.targetFps = 60;
    // Re-enable input + keyboard for battle
    phaserInstance.input.enabled = true;
    _startKeyboard();
    // Show canvas
    const c = phaserInstance.canvas;
    if (c) { c.style.display = ''; c.style.pointerEvents = 'auto'; }
    // Unpause game logic
    phaserInstance.isPaused = false;
  } catch {}
  if (phaserInstance.scene.isActive('BattleScene')) phaserInstance.scene.stop('BattleScene');
  phaserInstance.scene.start('BattleScene', { cls, seed, trial });
}

/** Throttle + disable input khi rời battle */
export function stopBattle() {
  if (!phaserInstance) return;
  try { phaserInstance.scene.stop('BattleScene'); } catch {}
  pauseGame(); // full pause when leaving battle
}

/**
 * Full pause: sleep loop + disable all input + hide canvas + remove keyboard listener
 * Called when ANY input gets focus (via global focusin handler in App.jsx)
 */
export function pauseGame() {
  if (!phaserInstance) return;
  try {
    // 1. Pause game logic (skip step() even if loop runs)
    phaserInstance.isPaused = true;
    // 2. Sleep the RAF loop entirely
    if (phaserInstance.loop.running !== false) phaserInstance.loop.sleep();
    // 3. Disable input manager (touch/mouse)
    phaserInstance.input.enabled = false;
    // 4. Remove keydown/keyup from window — definitive keyboard fix
    _stopKeyboard();
    // 5. Hide canvas
    const c = phaserInstance.canvas;
    if (c) { c.style.display = 'none'; }
  } catch (e) { console.warn('[Phaser] pauseGame:', e.message); }
}

/** Resume to idle (1fps, no keyboard) after modal closes */
export function resumeGame() {
  if (!phaserInstance) return;
  try {
    phaserInstance.isPaused = false;
    // Wake at 1fps idle — keyboard stays OFF until startBattle
    phaserInstance.loop.wake();
    phaserInstance.loop.targetFps = 1;
    phaserInstance.input.enabled = false; // keep input disabled in menu
    // Show canvas (at 1fps, hidden via visibility)
    const c = phaserInstance.canvas;
    if (c) { c.style.display = ''; }
  } catch (e) { console.warn('[Phaser] resumeGame:', e.message); }
}
