import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { CLASSES } from '../game/data/gameData.js';
import { portraitDataURL, enemyPortraitDataURL } from '../game/art/SpriteFactory.js';
import { updateDisplayName } from '../supabase.js';
import { TiltPortrait } from '../components/TiltPortrait.jsx';
import { AnimatedPortrait } from '../components/AnimatedPortrait.jsx';
import { getUpgradeTier } from './UpgradeScreen.jsx';
import { getDailyState, formatCountdown, getMsUntilMidnightICT, getDailyKey } from '../utils/dailySeed.js';

const PLAYABLE = Object.keys(CLASSES).filter(k => !CLASSES[k].soon);

function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem('ss_profile_v1'));
    if (p && Array.isArray(p.owned)) return p;
  } catch { }
  return { owned: [], wins: 0, best: { score: 0, combo: 0 } };
}
function saveProfile(p) { try { localStorage.setItem('ss_profile_v1', JSON.stringify(p)); } catch { } }

const SLOTS = [
  { time: '08:00', title: 'Hộp thư đầy',        sub: 'Email và thông báo dồn dập',      enemies: ['email', 'notif'] },
  { time: '08:40', title: 'Họp liên miên',       sub: 'Cuộc họp trâu máu, bug bò ra',   enemies: ['meeting', 'bug'] },
  { time: '09:20', title: 'Khách hàng nổi giận', sub: 'Gồng lên rồi lao thẳng vào bạn', enemies: ['customer'] },
  { time: '10:00', title: 'BOSS · Deadline',     sub: 'Bắn giấy tờ theo vòng, nổi điên ở 50% máu', enemies: ['boss'], boss: true },
];

export function MenuScreen({ onStart, onDailyStart, onTrial, onBook, onLeaderboard, onUpgrade, onAuth, player, onPlayerUpdate }) {
  const [profile, setProfile] = useState(loadProfile);
  const [sel, setSel] = useState(() => {
    const p = loadProfile();
    return p.owned[0] || 'developer';
  });
  const [confirm, setConfirm] = useState(false);
  const [portraits, setPortraits] = useState({});
  const [enemyPortraits, setEnemyPortraits] = useState({});
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef(null);

  // Daily challenge state
  const [dailyState, setDailyState] = useState(() => getDailyState());
  const [countdown, setCountdown] = useState(() => formatCountdown(getMsUntilMidnightICT()));

  // Refresh daily state + countdown every 30s
  useEffect(() => {
    const tick = () => {
      setDailyState(getDailyState());
      setCountdown(formatCountdown(getMsUntilMidnightICT()));
    };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Re-check daily state when returning from battle
  useEffect(() => { setDailyState(getDailyState()); }, [player?.id]);

  // Reload profile khi player thay đổi (sau login/logout)
  // signOut xóa ss_profile_v1 → cần load lại để hiện data mới
  useEffect(() => {
    const fresh = loadProfile();
    setProfile(fresh);
    setSel(fresh.owned[0] || 'developer');
  }, [player?.id]);


  useEffect(() => {
    // Compute developer tier from upgrades
    const tier = getUpgradeTier();

    // Generate portraits — developer gets tier-specific portrait
    const pt = {};
    for (const cls of Object.keys(CLASSES)) {
      try { pt[cls] = portraitDataURL(cls, 28, cls === 'developer' ? tier : 0); } catch { }
    }
    setPortraits(pt);

    const ep = {};
    for (const type of ['email', 'notif', 'meeting', 'bug', 'customer', 'boss']) {
      try { ep[type] = enemyPortraitDataURL(type, 22); } catch { }
    }
    setEnemyPortraits(ep);

    // Ensure developer is owned by default
    const p = loadProfile();
    if (p.owned.length === 0) {
      p.owned = ['developer'];
      saveProfile(p);
      setProfile(p);
    }
  }, [player?.id]); // re-run when player changes (includes return from UpgradeScreen)

  const canAddLine = profile.owned.length === 0 || profile.wins >= profile.owned.length;
  const cls = CLASSES[sel];

  const handleStart = () => {
    if (!profile.owned.includes(sel)) { setConfirm(true); return; }
    onStart(sel);
  };

  const handleConfirmStart = () => {
    const p = { ...profile, owned: [...profile.owned, sel] };
    saveProfile(p); setProfile(p); setConfirm(false);
    onStart(sel);
  };

  const handleReset = () => {
    if (!window.confirm('Xoá toàn bộ dữ liệu prototype?')) return;
    localStorage.removeItem('ss_profile_v1');
    setProfile({ owned: ['developer'], wins: 0, best: { score: 0, combo: 0 } });
  };

  const handleSaveName = async () => {
    const name = (nameInputRef.current?.value || '').trim();
    if (!name) return;
    await updateDisplayName(name);
    // Update localStorage
    try {
      const p = JSON.parse(localStorage.getItem('ss_profile_v1') || '{}');
      p.displayName = name;
      localStorage.setItem('ss_profile_v1', JSON.stringify(p));
    } catch { }
    setEditingName(false);
    if (onPlayerUpdate) onPlayerUpdate(prev => prev ? { ...prev, display_name: name } : prev);
  };

  return (
    <div class="ov">
      <div class="menu-screen">
        {/* Left panel */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div class="eyebrow">Chapter 1 · Monday Morning · Prototype</div>
            <button class="auth-badge-btn" onClick={onAuth} style={{ marginLeft: 'auto', fontSize: 11 }}>
              👤 Tài khoản
            </button>
          </div>
          <h1><span class="s1">Stress</span><em>Survivor</em></h1>
          <p class="lede">
            Ca làm bắt đầu lúc <b>08:00</b>. Deadline tới lúc <b>10:00</b>.
            Vũ khí tự bắn, bạn lo chạy, <b>tap để đập</b> và chọn thẻ ghép build.
            Bị đánh sẽ đầy <b>Stress</b>, đầy rồi thì <b>RAGE</b>.
          </p>

          {/* ── Daily Challenge Banner ── */}
          {onDailyStart && (
            <div class="daily-banner">
              <div class="daily-left">
                <span class="daily-dot" />
                <div>
                  <div class="daily-title">📅 Thử thách hôm nay</div>
                  <div class="daily-sub">
                    {dailyState.played
                      ? <>Điểm của bạn: <b>{dailyState.score.toLocaleString('vi-VN')}</b> · <span class="daily-countdown">Reset trong {countdown}</span></>
                      : <>Fixed seed · Hôm nay chưa chơi · <span class="daily-countdown">Còn {countdown}</span></>}
                  </div>
                </div>
              </div>
              <button
                class={`btn daily-play-btn ${dailyState.played ? '' : 'primary'}`}
                onClick={() => { onDailyStart('developer'); }}
              >
                {dailyState.played ? '🔄 Chơi lại' : '▶ Chơi ngay'}
              </button>
            </div>
          )}

          <div class="row">
            <button class="btn primary" onClick={handleStart}>Vào ca · 08:00</button>
            <button class="btn" onClick={() => onTrial(sel)}>Chơi thử 30 giây</button>
            <button class="btn" onClick={onBook}>Sổ tay nhân vật</button>
            <button class="btn" onClick={onLeaderboard}>🏆 Xếp hạng</button>
            <button class="btn" style={{ background: '#fff0e0', borderColor: '#FF8A3D', color: '#FF8A3D' }}
              onClick={onUpgrade}>⬆ Nâng cấp</button>
          </div>

          {confirm && (
            <div class="confirm">
              <p>Chọn dòng <b>{cls?.name}</b> làm dòng chính? Không thể đổi lại nhưng có thể mở thêm dòng sau.</p>
              <div class="row">
                <button class="btn primary" onClick={handleConfirmStart}>Chốt &amp; vào ca</button>
                <button class="btn" onClick={() => setConfirm(false)}>Huỷ</button>
              </div>
            </div>
          )}
          <div class="keys">
            <span><kbd>WASD</kbd> / <kbd>←↑↓→</kbd> chạy</span>
            <span><kbd>Click</kbd> / <kbd>J</kbd> đập</span>
            <span><kbd>Shift</kbd> né</span>
            <span><kbd>Space</kbd> rage</span>
            <span><kbd>P</kbd> tạm dừng</span>
            <span>Điện thoại: nửa trái kéo để chạy, nửa phải tap để đập</span>
          </div>
          {profile.best?.combo > 0 && (
            <div class="best-line">Kỷ lục combo: <b>x{profile.best.combo}</b>{profile.best.score > 0 && <> · Điểm: <b>{profile.best.score.toLocaleString()}</b></>}</div>
          )}

          {/* Player info & name editor */}
          {player && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ font: '700 11px var(--mono)', background: 'var(--paper)', border: 'var(--bd)', borderRadius: 6, padding: '2px 8px', boxShadow: '2px 2px 0 var(--ink)' }}>
                🆔 {player.public_id || 'STRESS-LOCAL'}
              </span>
              {!editingName ? (
                <button class="linkbtn" onClick={() => setEditingName(true)}>
                  ✏️ {player.display_name || 'Đặt tên'}
                </button>
              ) : (
                <span style={{ display: 'flex', gap: 6 }}>
                  <input
                    ref={nameInputRef}
                    style={{ font: '700 13px var(--mono)', border: 'var(--bd)', borderRadius: 8, padding: '4px 10px', outline: 'none', fontSize: 16, touchAction: 'manipulation' }}
                    defaultValue={player?.display_name || ''}
                    maxLength={30}
                    inputmode="text"
                    autocorrect="off"
                    autocapitalize="words"
                    spellcheck={false}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                    autoFocus
                  />
                  <button class="btn primary" style={{ padding: '4px 12px', fontSize: 13 }} onClick={handleSaveName}>Lưu</button>
                  <button class="btn" style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => setEditingName(false)}>Huỷ</button>
                </span>
              )}
            </div>
          )}

          <button class="linkbtn" onClick={handleReset}>Xoá dữ liệu prototype (cho người test)</button>
        </div>

        {/* Right panel */}
        <div class="side">
          {/* Agenda */}
          <div class="agenda">
            <h3>Lịch hôm nay</h3>
            {SLOTS.map(s => (
              <div key={s.time} class={`slot${s.boss ? ' boss' : ''}`}>
                <time>{s.time}</time>
                <div><b>{s.title}</b><small>{s.sub}</small></div>
                <span style={{ display: 'flex', gap: '4px' }}>
                  {s.enemies.map(e => enemyPortraits[e] ? <img key={e} src={enemyPortraits[e]} alt={e} style={{ width: 36, height: 36 }} /> : <span key={e}>{e}</span>)}
                </span>
              </div>
            ))}
          </div>

          {/* Class picker */}
          <div class="picker">
            <h3>
              <span>Dòng nhân vật</span>
              <span>{profile.owned.length} đang có</span>
            </h3>
            <div class="classes">
              {Object.entries(CLASSES).map(([key, c]) => {
                const owned = profile.owned.includes(key);
                const locked = !owned && !canAddLine && !c.soon;
                return (
                  <button
                    key={key}
                    class={`cls${c.soon ? ' soon' : ''}${owned ? ' owned' : ''}${sel === key ? ' sel' : ''}`}
                    onClick={() => !c.soon && setSel(key)}
                    disabled={c.soon}
                  >
                    {portraits[key] ? <img src={portraits[key]} alt={c.name} /> : <span style={{ fontSize: 32 }}>👤</span>}
                    {c.name}
                    <small>{c.soon ? 'SẮP RA' : owned ? 'ĐÃ MỞ' : 'CHƯA MỞ'}</small>
                  </button>
                );
              })}
            </div>

            {/* Class detail */}
            {cls && !cls.soon && (
              <div class="cdetail">
                <div class="cd-head">
                  {portraits[sel] && (
                    sel === 'developer'
                      ? <AnimatedPortrait tier={getUpgradeTier()} size={96} />
                      : <img src={portraits[sel]} alt={cls.name} />
                  )}
                  <div>
                    <b>{cls.name}</b>
                    <span>{cls.line}</span>
                    {sel === 'developer' && (() => {
                      const tier = getUpgradeTier();
                      const TIER_NAMES = ['Rookie', 'Experienced', 'Veteran', 'Elite', 'Legendary'];
                      const TIER_COLORS = ['#888', '#2EC4B6', '#7B5CFF', '#FF8A3D', '#FFD447'];
                      return (
                        <span style={{
                          display: 'inline-block', marginTop: 4,
                          font: '700 11px var(--mono)',
                          color: TIER_COLORS[tier],
                          background: 'var(--paper2)',
                          border: `1.5px solid ${TIER_COLORS[tier]}`,
                          borderRadius: 6, padding: '1px 7px',
                        }}>
                          {['⚪','🟢','🔵','🟠','⭐'][tier]} {TIER_NAMES[tier]}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                {cls.passive && (
                  <>
                    <div class="k">Passive: {cls.passive}</div>
                    <div>{cls.pdesc}</div>
                  </>
                )}
                {cls.tap && (
                  <>
                    <div class="k">Tap</div>
                    <div>{cls.tap}</div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
