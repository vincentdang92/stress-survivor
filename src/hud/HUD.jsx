/** HUD.jsx — Preact overlay for battle HUD */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { bus } from '../bus.js';
import { SYNERGIES, SYN, CARD } from '../game/data/gameData.js';

function Chip({ id, lv, syn }) {
  const c = CARD[id];
  if (!c) return null;
  if (syn) return <span class="chip syn">⚡ {syn}</span>;
  return (
    <span class="chip">
      {c.icon} {c.name} <b>Lv{lv}</b>
    </span>
  );
}

function BossBar({ hp, maxHp, phase }) {
  if (!hp || !maxHp) return null;
  const pct = Math.max(0, (hp / maxHp) * 100);
  return (
    <div class="bossbar">
      <div class="bossbar-name">
        <span>⏰ DEADLINE</span>
        <span>PHASE {phase}</span>
      </div>
      <div class="bossbar-track">
        <i class="bossbar-fill" style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}

// Developer COMPILE bar
function CompileBar({ count, max }) {
  const slots = Array.from({ length: max }, (_, i) => i < count);
  const remaining = max - count;
  const flashWarn = remaining > 0 && remaining <= 3;
  const isReady = count >= max;
  return (
    <div class={`compile-bar${flashWarn ? ' flash' : ''}${isReady ? ' ready' : ''}`}>
      <span class="compile-label">COMPILE</span>
      <div class="compile-slots">
        {slots.map((filled, i) => (
          <div key={i} class={`compile-slot${filled ? ' filled' : ''}`} />
        ))}
      </div>
      {isReady && <span class="compile-ready-tag">READY ✓</span>}
    </div>
  );
}

// Achievement unlock toast
function AchievementToast({ ach }) {
  if (!ach) return null;
  return (
    <div class="ach-toast" key={ach.key}>
      <span class="ach-icon">{ach.icon}</span>
      <div class="ach-body">
        <div class="ach-name">🏅 Thành tích mở khoá!</div>
        <div class="ach-title">{ach.name}</div>
        {ach.reward && <div class="ach-reward">{ach.reward}</div>}
      </div>
    </div>
  );
}

export function HUD() {
  const [hud, setHud] = useState({
    hp: 100, maxHp: 100, stress: 0, lvl: 1, xp: 0, nextXp: 10,
    kills: 0, taps: 0, combo: 0, rageActive: false, dashCd: 0,
    clock: '08:00', wave: '', rageReady: false,
    stressZone: 'calm', compilePct: 0, exhausted: false,
  });
  const [loadout, setLoadout] = useState({ cards: {}, synActive: new Set() });
  const [boss, setBoss] = useState(null);
  const [streak, setStreak] = useState(null);
  const [compile, setCompile] = useState({ count: 0, max: 20 });
  const [cls, setCls] = useState('');
  const [ach, setAch] = useState(null);
  const comboRef = useRef(null);
  const prevCombo = useRef(0);
  const streakTimerRef = useRef(null);
  const achTimerRef = useRef(null);

  useEffect(() => {
    const offs = [
      bus.on('HUD_TICK', data => setHud(prev => ({ ...prev, ...data }))),
      bus.on('LOADOUT_UPDATE', data => setLoadout(data)),
      bus.on('BOSS_HP', data => setBoss(data)),
      bus.on('BOSS_PHASE_CHANGED', data => setBoss(data)),
      bus.on('BATTLE_STARTED', ({ cls: c }) => {
        setBoss(null); setStreak(null); setCls(c || '');
        setCompile({ count: 0, max: 20 });
      }),
      bus.on('COMPILE_TICK', ({ count, max }) => setCompile({ count, max })),
      bus.on('ACHIEVEMENT_UNLOCKED', ({ name, icon, reward }) => {
        clearTimeout(achTimerRef.current);
        setAch({ name, icon, reward, key: Date.now() });
        achTimerRef.current = setTimeout(() => setAch(null), 4000);
      }),
    ];
    return () => offs.forEach(off => off());
  }, []);

  // Combo pop
  useEffect(() => {
    if (hud.combo > prevCombo.current && comboRef.current) {
      comboRef.current.classList.remove('pop');
      void comboRef.current.offsetWidth;
      comboRef.current.classList.add('pop');
    }
    prevCombo.current = hud.combo;
  }, [hud.combo]);

  // Kill streak
  useEffect(() => {
    const c = hud.combo;
    let msg = null;
    if      (c === 5)  msg = { text: '🔥 COMBO × 5!',      color: '#FFD447' };
    else if (c === 10) msg = { text: '⚡ KILLING SPREE!',   color: '#FF8A3D' };
    else if (c === 20) msg = { text: '☄️ UNSTOPPABLE!',     color: '#FF4D6D' };
    else if (c === 40) msg = { text: '💀 GODLIKE!',         color: '#7B5CFF' };
    else if (c > 40 && c % 20 === 0) msg = { text: `👑 × ${c} COMBO!`, color: '#7B5CFF' };
    if (msg) {
      clearTimeout(streakTimerRef.current);
      setStreak({ ...msg, key: Date.now() });
      streakTimerRef.current = setTimeout(() => setStreak(null), 2100);
    }
  }, [hud.combo]);

  const xpPct = hud.nextXp > 0 ? Math.min(100, (hud.xp / hud.nextXp) * 100) : 0;
  const hpPct  = hud.maxHp > 0 ? Math.min(100, (hud.hp / hud.maxHp) * 100) : 0;
  const stPct  = Math.min(100, hud.stress);
  const clockLate = hud.clock && hud.clock >= '09:30';
  const isLowHp = hpPct > 0 && hpPct < 30;
  const zone = hud.stressZone || 'calm';

  const handleDash  = useCallback(() => bus.emit('DASH_PRESSED'), []);
  const handleRage  = useCallback(() => bus.emit('RAGE_PRESSED'), []);
  const handlePause = useCallback(() => bus.emit('PAUSE'), []);

  const isEarlyRage = hud.stress >= 80 && hud.stress < 100 && !hud.rageActive && hud.rageReady;
  const isDev = cls === 'developer';

  return (
    <>
      {/* Stress zone vignettes */}
      {hud.rageActive && <div class="rage-vignette" />}
      {zone === 'adrenaline' && !hud.rageActive && <div class="adrenaline-vignette" />}
      {zone === 'overload'   && !hud.rageActive && <div class="overload-vignette" />}
      {hud.exhausted && <div class="exhausted-overlay" />}
      {isLowHp && !hud.rageActive && zone === 'calm' && <div class="hp-danger-vignette" />}

      {/* Kill streak */}
      {streak && (
        <div key={streak.key} class="streak-msg" style={{ color: streak.color }}>
          {streak.text}
        </div>
      )}

      {/* Achievement toast */}
      <AchievementToast ach={ach} />

      {/* XP Bar */}
      <div class="xpbar"><i class="xp-fill" style={{ width: xpPct + '%' }} /></div>

      {/* Main HUD */}
      <div class="hud">
        <div class="hud-top">
          <div class="hud-left">
            <div class="bar hp">
              <i style={{ width: hpPct + '%' }} />
              <span>{Math.ceil(hud.hp)} / {hud.maxHp}</span>
            </div>
            <div class={`bar st${stPct >= 100 ? ' full' : ''} st-${zone}`}>
              <i style={{ width: stPct + '%' }} />
              <span>STRESS {Math.round(stPct)}%</span>
            </div>
            {/* COMPILE bar — developer only */}
            {isDev && (
              <CompileBar count={compile.count} max={compile.max} />
            )}
            {hud.exhausted && (
              <div class="exhausted-tag">💤 KIỆT SỨC</div>
            )}
            <div class="lvl-line">LV <b>{hud.lvl}</b> · {hud.kills} hạ · {hud.taps} đập</div>
          </div>

          <div class="hud-center">
            <div class={`clock${clockLate ? ' late' : ''}`}>{hud.clock}</div>
            <div class="wave-label">{hud.wave || 'Deadline 10:00'}</div>
          </div>

          <div class="hud-right">
            <button class="icon-btn" onClick={handlePause} aria-label="Tạm dừng">❚❚</button>
            <div class="combo-display" ref={comboRef}>
              {hud.combo >= 2 && (
                <>x{hud.combo}<small>COMBO</small></>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Boss bar */}
      {boss && <BossBar hp={boss.hp} maxHp={boss.maxHp} phase={boss.phase} />}

      {/* Loadout */}
      <div class="loadout">
        <div class="chips">
          {Object.entries(loadout.cards || {}).map(([id, lv]) => (
            <Chip key={id} id={id} lv={lv} />
          ))}
          {[...(loadout.synActive || [])].map(sid => (
            <Chip key={sid} syn={SYN[sid]?.name} />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div class="actions">
        <button class={`act${hud.dashCd > 0 ? ' cooldown' : ''}`} onClick={handleDash} aria-label="Né">
          NÉ<small>SHIFT</small>
        </button>
        <button
          class={`act rage-btn${hud.rageReady && !hud.rageActive ? ' ready' : ''}${isEarlyRage ? ' early' : ''}`}
          onClick={handleRage}
          aria-label="Rage"
        >
          {isEarlyRage
            ? <><span>RAGE</span><small>SỚM</small></>
            : <><span>RAGE</span><small>SPACE</small></>}
        </button>
      </div>
    </>
  );
}

export function Banner() {
  const [banner, setBanner] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const off = bus.on('BANNER', ({ title, sub, kind }) => {
      setBanner({ title, sub, kind });
      if (ref.current) {
        ref.current.classList.remove('show');
        void ref.current.offsetWidth;
        ref.current.classList.add('show');
      }
    });
    return off;
  }, []);

  if (!banner) return null;
  return (
    <div class={`banner ${banner.kind || ''}`} ref={ref}>
      <b>{banner.title}</b>
      {banner.sub && <span>{banner.sub}</span>}
    </div>
  );
}

export function MashOverlay() {
  const [mash, setMash] = useState(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const offs = [
      bus.on('MASH_START', () => { setMash(true); setCount(0); }),
      bus.on('MASH_UPDATE', ({ count }) => setCount(count)),
      bus.on('MASH_END', () => setMash(false)),
      bus.on('BATTLE_COMPLETED', () => setMash(false)),
    ];
    return () => offs.forEach(o => o());
  }, []);

  if (!mash) return null;
  const pct = Math.min(100, count * 2);
  return (
    <div class="mash">
      <span>Tap liên tục · đập vỡ Deadline</span>
      <b>{count}</b>
      <div class="mash-track"><i class="mash-fill" style={{ width: pct + '%' }} /></div>
    </div>
  );
}
