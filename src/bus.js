/**
 * bus.js — Typed event bus (Preact ↔ Phaser contract)
 *
 * Phaser → UI: BATTLE_STARTED, HUD_TICK, LEVEL_UP, BOSS_PHASE_CHANGED,
 *              PLAYER_DIED, BATTLE_COMPLETED, BANNER, MASH_START, MASH_END
 * UI → Phaser: CARD_PICKED, PAUSE, RESUME, RAGE_PRESSED, DASH_PRESSED
 */

const listeners = {};

export const bus = {
  on(event, fn) {
    (listeners[event] ||= []).push(fn);
    return () => this.off(event, fn);
  },
  off(event, fn) {
    listeners[event] = (listeners[event] || []).filter(f => f !== fn);
  },
  emit(event, data) {
    (listeners[event] || []).forEach(fn => fn(data));
  }
};
