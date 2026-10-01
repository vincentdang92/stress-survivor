/** dailySeed.js — Daily challenge seed + state helpers */

/** Get current date string in ICT (UTC+7) — format YYYY-MM-DD */
export function getDailyKey() {
  const ict = new Date(Date.now() + 7 * 3600 * 1000);
  const y = ict.getUTCFullYear();
  const m = String(ict.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ict.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Deterministic uint32 seed from today's date */
export function getDailySeed() {
  const key = getDailyKey();
  // Simple hash: multiply & XOR each char code
  let h = 0x811C9DC5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = (Math.imul(h, 0x01000193) >>> 0);
  }
  return h;
}

/** How many ms until midnight ICT */
export function getMsUntilMidnightICT() {
  const now = Date.now();
  const ict = new Date(now + 7 * 3600 * 1000);
  const midnight = new Date(ict);
  midnight.setUTCHours(17, 0, 0, 0); // 17:00 UTC = 00:00 ICT next day
  if (midnight.getTime() <= ict.getTime()) {
    midnight.setUTCDate(midnight.getUTCDate() + 1);
  }
  return midnight.getTime() - ict.getTime();
}

/** Format countdown "Xh Ym" */
export function formatCountdown(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}g ${m}p`;
  if (m > 0) return `${m}p ${s}s`;
  return `${s}s`;
}

const STORE_KEY = 'ss_daily_v1';

/** Get today's daily play state { key, score, played } */
export function getDailyState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!raw || raw.key !== getDailyKey()) return { key: getDailyKey(), played: false, score: 0 };
    return raw;
  } catch {
    return { key: getDailyKey(), played: false, score: 0 };
  }
}

/** Save result for today */
export function saveDailyResult(score) {
  const state = getDailyState();
  // Only update if new score is higher (allow replays)
  if (score > (state.score || 0)) {
    const next = { key: getDailyKey(), played: true, score };
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
    return next;
  }
  state.played = true;
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  return state;
}
