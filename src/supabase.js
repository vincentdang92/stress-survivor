/**
 * supabase.js — Supabase client & data layer
 * Handles: auth, player identity, score submission, leaderboard queries
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const IS_CONFIGURED = SUPABASE_URL && SUPABASE_URL !== 'https://your-project.supabase.co';

export const supabase = IS_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

// ─── Auth ─────────────────────────────────────────────────

/**
 * Khởi tạo auth: nếu chưa có session thì sign in ẩn danh.
 * Trả về { user, isAnon, isNew }
 */
export async function initAuth() {
  if (!supabase) return { user: null, isAnon: true, isNew: false };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return {
        user: session.user,
        isAnon: session.user.is_anonymous ?? !session.user.email,
        isNew: false,
      };
    }
    // Thử sign in ẩn danh (chỉ hoạt động nếu đã bật trong Supabase Dashboard)
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      // Anonymous chưa bật → không crash, chỉ return no-session state
      console.info('[Auth] Anonymous login not available:', error.message);
      return { user: null, isAnon: true, isNew: false };
    }
    return { user: data.user, isAnon: true, isNew: true };
  } catch (e) {
    console.info('[Auth] initAuth skipped:', e.message);
    return { user: null, isAnon: true, isNew: false };
  }
}


/** Helper: extract readable message từ bất kỳ dạng error nào */
function _errMsg(e) {
  if (!e) return null;
  if (typeof e === 'string') {
    // Supabase enumeration protection trả về "{}" làm message
    if (e === '{}' || e === '' || e === 'null') return '__ENUM_PROTECT__';
    return e;
  }
  const raw = e.message || e.error_description || e.msg || e.code;
  if (raw && typeof raw === 'string') {
    if (raw === '{}' || raw === '' || raw === 'null') return '__ENUM_PROTECT__';
    return raw;
  }
  try {
    const s = JSON.stringify(e);
    if (s === '{}' || s === '' || s === 'null') return '__ENUM_PROTECT__';
    return s;
  } catch { return 'Lỗi không xác định'; }
}

/** Đăng nhập bằng email + password */
export async function signInWithEmail(email, password) {
  if (!supabase) return { error: 'Offline — chưa cấu hình Supabase' };
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      // Email chưa xác nhận — Supabase trả "Email not confirmed"
      if (msg.includes('not confirmed') || msg.includes('email not confirmed')) {
        return { error: 'EMAIL_NOT_CONFIRMED' };
      }
      // Invalid credentials
      return { error: 'WRONG_PASSWORD' };
    }
    return { user: data?.user, error: null };
  } catch (e) { return { error: e.message || 'Lỗi không xác định' }; }
}

/** Đăng ký tài khoản mới bằng email + password */
export async function signUpWithEmail(email, password) {
  if (!supabase) return { error: 'Offline — chưa cấu hình Supabase' };
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });

    // Log full error object for debugging
    if (error) {
      console.log('[Auth] signUp raw error:', {
        message: error.message,
        status: error.status,
        code: error.code,
        name: error.name,
        full: JSON.stringify(error),
      });

      const rawMsg = error.message || '';
      const msg = rawMsg.toLowerCase().trim();
      const status = error.status || 0;

      // Supabase trả "{}" → thường do: email đã tồn tại (enumeration protection)
      // hoặc SMTP rate limit (free tier giới hạn ~3 email/giờ)
      if (rawMsg === '{}' || rawMsg === '' || rawMsg === 'null' || rawMsg === 'undefined') {
        return { error: 'AMBIGUOUS', _raw: { msg: rawMsg, status, code: error.code } };
      }

      // Email đã tồn tại — Supabase 422 hoặc message rõ ràng
      if (status === 422 || msg.includes('already') || msg.includes('registered')) {
        return { error: 'EMAIL_EXISTS' };
      }

      // Email không hợp lệ
      if (msg.includes('valid') || msg.includes('format') || msg.includes('invalid email')) {
        return { error: 'Email không hợp lệ.' };
      }

      return { error: rawMsg || 'Đăng ký thất bại' };
    }

    // Không có user → enumeration protection masking (cả 2 case đều giống nhau)
    if (!data?.user) {
      return { error: null, needConfirm: true };
    }

    // Có session ngay → email confirmation bị tắt → đăng nhập luôn
    if (data.session) {
      return { user: data.user, error: null, needConfirm: false };
    }

    // Có user, không có session → cần xác nhận email
    return { user: data.user, error: null, needConfirm: true };
  } catch (e) { return { error: e.message || 'Lỗi không xác định' }; }
}

/**
 * Upgrade tài khoản ẩn danh thành tài khoản email.
 * Giữ nguyên auth.uid() → data không mất.
 */
export async function upgradeAnonToEmail(email, password) {
  if (!supabase) return { error: 'Offline — chưa cấu hình Supabase' };
  try {
    const { data, error } = await supabase.auth.updateUser({ email, password });
    if (!error) await pushPlayerData();
    return { user: data?.user, error: _errMsg(error) };
  } catch (e) { return { error: _errMsg(e) }; }
}


/** Đăng xuất */
export async function signOut() {
  if (!supabase) return;
  // 1. Push local upgrades lên cloud trước khi logout
  await pushPlayerData().catch(() => {});
  // 2. Sign out Supabase
  await supabase.auth.signOut();
  // 3. Clear player cache (có auth_user_id của user cũ)
  localStorage.removeItem(PLAYER_KEY);
  // 4. Reset anon_id → session tiếp theo là identity mới, tránh leak data
  localStorage.removeItem(ANON_KEY);
}

/** Lắng nghe thay đổi auth state */
export function onAuthChange(callback) {
  if (!supabase) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}

/** Lấy user hiện tại */
export async function getCurrentUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Pull player_data từ Supabase về localStorage.
 * Merge theo giá trị lớn hơn (tránh mất data).
 */
export async function pullPlayerData() {
  if (!supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: player } = await supabase
      .from('players')
      .select('player_data, public_id, display_name, class, level, total_wins, total_kills')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!player) return;

    // Merge local vs remote (take max numeric values)
    const local = _getLocalUpgrades();
    const remote = player.player_data || {};
    const merged = {
      gold:         Math.max(local.gold || 0,         remote.gold || 0),
      hp:           Math.max(local.hp || 0,           remote.hp || 0),
      atk:          Math.max(local.atk || 0,          remote.atk || 0),
      spd:          Math.max(local.spd || 0,          remote.spd || 0),
      crit:         Math.max(local.crit || 0,         remote.crit || 0),
      stressResist: Math.max(local.stressResist || 0, remote.stressResist || 0),
    };
    localStorage.setItem('ss_upgrades_v1', JSON.stringify(merged));

    // Cache player profile
    cachePlayer({ ...player, auth_user_id: user.id });
  } catch (e) {
    console.warn('[Auth] pullPlayerData failed:', e.message);
  }
}

/** Push local player_data lên Supabase */
export async function pushPlayerData() {
  if (!supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const local = _getLocalUpgrades();
    await supabase
      .from('players')
      .update({ player_data: local, updated_at: new Date().toISOString() })
      .eq('auth_user_id', user.id);
  } catch (e) {
    console.warn('[Auth] pushPlayerData failed:', e.message);
  }
}

function _getLocalUpgrades() {
  try { return JSON.parse(localStorage.getItem('ss_upgrades_v1') || '{}'); } catch { return {}; }
}


// ─── Player Identity ──────────────────────────────────────
const ANON_KEY = 'ss_anon_id';
const PLAYER_KEY = 'ss_player_v1';

/** Lấy hoặc tạo anon_id (UUID v4) lưu trong localStorage */
export function getAnonId() {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

/** Lấy player profile từ localStorage cache */
export function getCachedPlayer() {
  try { return JSON.parse(localStorage.getItem(PLAYER_KEY)); } catch { return null; }
}

function cachePlayer(p) {
  try { localStorage.setItem(PLAYER_KEY, JSON.stringify(p)); } catch { }
}

/**
 * Lấy hoặc tạo player trên Supabase.
 * Trả về { id, public_id, display_name, class, level, ... }
 */
export async function getOrCreatePlayer(displayName, cls = 'developer') {
  if (!supabase) return getCachedPlayer() || _localPlayer(displayName, cls);

  const anonId = getAnonId();

  // Lấy auth user hiện tại (nếu đã đăng nhập)
  let authUserId = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    authUserId = user?.id || null;
  } catch { }

  // Thử lấy từ DB
  const { data: existing } = await supabase
    .from('players')
    .select('*')
    .eq('anon_id', anonId)
    .maybeSingle();

  if (existing) {
    // Nếu đã login nhưng chưa link auth_user_id → update
    if (authUserId && !existing.auth_user_id) {
      await supabase
        .from('players')
        .update({ auth_user_id: authUserId })
        .eq('anon_id', anonId);
      existing.auth_user_id = authUserId;
    }
    cachePlayer(existing); return existing;
  }

  // Tạo mới — include auth_user_id nếu có
  const insertData = {
    anon_id: anonId,
    display_name: displayName,
    class: cls,
    ...(authUserId ? { auth_user_id: authUserId } : {}),
  };
  const { data: created, error: createErr } = await supabase
    .from('players')
    .insert(insertData)
    .select()
    .single();

  if (createErr) {
    console.warn('[Supabase] create player failed:', createErr.message);
    const fallback = _localPlayer(displayName, cls);
    cachePlayer(fallback); return fallback;
  }

  cachePlayer(created); return created;
}

/** Đổi display_name */
export async function updateDisplayName(newName) {
  if (!supabase) return;
  const anonId = getAnonId();
  await supabase.from('players').update({ display_name: newName }).eq('anon_id', anonId);
  const p = getCachedPlayer();
  if (p) { p.display_name = newName; cachePlayer(p); }
}

// ─── Score Submission ──────────────────────────────────────
/**
 * Tính score từ stats trận đấu.
 * Formula: kills × 10 + dmgDealt ÷ 100 + maxCombo × 5 + (won ? 500 : 0)
 */
export function calcScore({ kills = 0, dmg = 0, dmgDealt = 0, combo = 0, maxCombo = 0, won = false } = {}) {
  const d = dmgDealt || dmg || 0;
  const c = maxCombo || combo || 0;
  return Math.max(0, Math.round((kills || 0) * 10 + d / 100 + c * 5 + (won ? 500 : 0)));
}

/**
 * Ghi điểm sau mỗi trận.
 * Sanity-check cơ bản ở client trước khi gửi.
 */
export async function submitScore({ player, stats, cards, synActive, won, cls }) {
  const score = calcScore({ ...stats, won });
  const payload = {
    player_id:   player?.id,
    anon_id:     getAnonId(),
    display_name: player?.display_name || 'Nhân viên ẩn danh',
    class:       cls,
    score,
    kills:       stats.kills || 0,
    max_combo:   stats.combo || 0,
    taps:        stats.taps || 0,
    dmg_dealt:   Math.round(stats.dmg || 0),
    duration_s:  Math.round(stats.time || 0),
    player_lvl:  stats.lvl || 1,
    cards:       cards || {},
    syn_active:  synActive ? [...synActive] : [],
    won,
  };

  // Client sanity check
  if (payload.max_combo > payload.kills + 10) {
    console.warn('[Supabase] score sanity fail: combo > kills');
    return { score, error: 'sanity' };
  }

  // Update localStorage best
  try {
    const p = JSON.parse(localStorage.getItem('ss_profile_v1') || '{}');
    p.best = p.best || {};
    if (score > (p.best.score || 0)) p.best.score = score;
    if (payload.max_combo > (p.best.combo || 0)) p.best.combo = payload.max_combo;
    if (payload.kills > (p.best.kills || 0)) p.best.kills = payload.kills;
    if (won) p.wins = (p.wins || 0) + 1;
    localStorage.setItem('ss_profile_v1', JSON.stringify(p));
  } catch { }

  if (!supabase || !player?.id) return { score, offline: true };

  const { error } = await supabase.from('scores').insert(payload);
  if (error) console.warn('[Supabase] score insert failed:', error.message);

  return { score, error: error?.message };
}

// ─── Leaderboard Queries ──────────────────────────────────

export const LEADERBOARD_MODES = [
  { id: 'score',       label: '🏆 Điểm cao nhất',   col: 'score',     display: v => v.toLocaleString() },
  { id: 'combo',       label: '⚡ Combo cao nhất',    col: 'max_combo', display: v => 'x' + v },
  { id: 'kills',       label: '💀 Hạ địch nhiều nhất', col: 'kills',   display: v => v.toLocaleString() },
  { id: 'daily_score', label: '📅 Hôm nay (điểm)',    col: 'score',    display: v => v.toLocaleString(), daily: true },
  { id: 'daily_combo', label: '📅 Hôm nay (combo)',   col: 'max_combo',display: v => 'x' + v, daily: true },
];

/**
 * Lấy bảng xếp hạng từ bảng scores (best per player)
 */
export async function fetchLeaderboard(mode, limit = 20, myAnonId = '') {
  if (!supabase) return { data: _mockLeaderboard(mode, limit), offline: true };

  const m = LEADERBOARD_MODES.find(x => x.id === mode) || LEADERBOARD_MODES[0];

  try {
    let query = supabase
      .from('scores')
      .select('anon_id, display_name, class, score, max_combo, kills, created_at')
      .order(m.col, { ascending: false })
      .limit(limit * 3); // fetch extra to dedupe per player

    if (m.daily) {
      const today = new Date().toISOString().slice(0, 10);
      query = query.gte('created_at', today + 'T00:00:00Z');
    }

    const { data, error } = await query;
    if (error) throw error;

    // Dedupe: keep best per anon_id
    const seen = new Map();
    for (const row of (data || [])) {
      const cur = seen.get(row.anon_id);
      if (!cur || row[m.col] > cur[m.col]) seen.set(row.anon_id, row);
    }

    const sorted = [...seen.values()]
      .sort((a, b) => b[m.col] - a[m.col])
      .slice(0, limit);

    return {
      data: sorted.map((row, i) => ({
        rank: i + 1,
        publicId: '—',
        displayName: row.display_name || 'Nhân viên ẩn danh',
        class: row.class || 'developer',
        value: row[m.col] || 0,
        displayValue: m.display(row[m.col] || 0),
        isMe: row.anon_id === myAnonId,
      })),
    };
  } catch (err) {
    console.warn('[Supabase] leaderboard failed:', err.message);
    return { data: [], error: err.message };
  }
}

/**
 * Lấy xếp hạng của player hiện tại
 */
export async function fetchMyRank(mode, myAnonId) {
  if (!supabase || !myAnonId) return null;
  const m = LEADERBOARD_MODES.find(x => x.id === mode) || LEADERBOARD_MODES[0];

  try {
    // My best value
    let q = supabase.from('scores').select(m.col).eq('anon_id', myAnonId).order(m.col, { ascending: false }).limit(1);
    if (m.daily) {
      const today = new Date().toISOString().slice(0, 10);
      q = q.gte('created_at', today + 'T00:00:00Z');
    }
    const { data: myRows } = await q;
    if (!myRows?.length) return null;

    const myVal = myRows[0][m.col] || 0;

    // Count distinct anon_ids with better score
    const { data: betterRows } = await supabase
      .from('scores')
      .select('anon_id')
      .gt(m.col, myVal);

    const distinctBetter = new Set((betterRows || []).map(r => r.anon_id)).size;
    return distinctBetter + 1;
  } catch { return null; }
}


/**
 * Tìm player theo public_id (STRESS-XXXXXX)
 */
export async function searchPlayerByPublicId(publicId) {
  if (!supabase) return null;
  const { data } = await supabase.from('players').select('*').eq('public_id', publicId.toUpperCase()).maybeSingle();
  return data;
}

/**
 * Lấy lịch sử 10 trận gần nhất của player
 */
export async function fetchPlayerHistory(anonId, limit = 10) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('scores')
    .select('score, kills, max_combo, class, won, duration_s, created_at')
    .eq('anon_id', anonId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

// ─── Local fallbacks ──────────────────────────────────────
function _localPlayer(name, cls) {
  return {
    id: null,
    anon_id: getAnonId(),
    public_id: 'STRESS-LOCAL',
    display_name: name || 'Nhân viên ẩn danh',
    class: cls,
    level: 1,
    total_wins: 0,
    total_kills: 0,
  };
}

function _mockLeaderboard(mode, limit) {
  const names = ['Nguyễn Dev', 'Trần Manager', 'Lê Sales', 'Phạm Designer', 'Hoàng Chef'];
  return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
    rank: i + 1,
    publicId: `STRESS-${(0xA1B2C3 + i * 7).toString(16).toUpperCase().slice(0, 6)}`,
    displayName: names[i] || `Nhân viên ${i + 1}`,
    class: ['developer', 'manager', 'designer'][i % 3],
    value: 10000 - i * 1200,
    displayValue: (10000 - i * 1200).toLocaleString(),
    isMe: false,
  }));
}
