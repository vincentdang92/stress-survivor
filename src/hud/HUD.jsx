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

export function HUD() {
  const [hud, setHud] = useState({ hp: 100, maxHp: 100, stress: 0, lvl: 1, xp: 0, nextXp: 10, kills: 0, taps: 0, combo: 0, rageActive: false, dashCd: 0, clock: '08:00', wave: '', rageReady: false });
  const [loadout, setLoadout] = useState({ cards: {}, synActive: new Set() });
  const [boss, setBoss] = useState(null);
  const comboRef = useRef(null);
  const prevCombo = useRef(0);

  useEffect(() => {
    const offs = [
      bus.on('HUD_TICK', data => setHud(prev => ({ ...prev, ...data }))),
      bus.on('LOADOUT_UPDATE', data => setLoadout(data)),
      bus.on('BOSS_HP', data => setBoss(data)),
      bus.on('BOSS_PHASE_CHANGED', data => setBoss(data)),
      bus.on('BATTLE_STARTED', () => setBoss(null)),
    ];
    return () => offs.forEach(off => off());
  }, []);

  useEffect(() => {
    if (hud.combo > prevCombo.current && comboRef.current) {
      comboRef.current.classList.remove('pop');
      void comboRef.current.offsetWidth;
      comboRef.current.classList.add('pop');
    }
    prevCombo.current = hud.combo;
  }, [hud.combo]);

  const xpPct = hud.nextXp > 0 ? Math.min(100, (hud.xp / hud.nextXp) * 100) : 0;
  const hpPct = hud.maxHp > 0 ? Math.min(100, (hud.hp / hud.maxHp) * 100) : 0;
  const stPct = Math.min(100, hud.stress);
  const clockLate = hud.clock && hud.clock >= '09:30';

  const handleDash = useCallback(() => bus.emit('DASH_PRESSED'), []);
  const handleRage = useCallback(() => bus.emit('RAGE_PRESSED'), []);
  const handlePause = useCallback(() => bus.emit('PAUSE'), []);

  return (
    <>
      {/* XP Bar */}
      <div class="xpbar"><i class="xp-fill" style={{ width: xpPct + '%' }} /></div>

      {/* Main HUD */}
      <div class="hud">
        <div class="hud-top">
          <div class="hud-left">
            <div class={`bar hp`}>
              <i style={{ width: hpPct + '%' }} />
              <span>{Math.ceil(hud.hp)} / {hud.maxHp}</span>
            </div>
            <div class={`bar st${stPct >= 100 ? ' full' : ''}`}>
              <i style={{ width: stPct + '%' }} />
              <span>STRESS {Math.round(stPct)}%</span>
            </div>
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
                <>
                  x{hud.combo}
                  <small>COMBO</small>
                </>
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
        <button class={`act rage-btn${hud.rageReady ? ' ready' : ''}`} onClick={handleRage} aria-label="Rage">
          RAGE<small>SPACE</small>
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
