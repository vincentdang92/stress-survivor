/** ResultScreen.jsx */
import { useState, useEffect, useCallback } from 'preact/hooks';
import { bus } from '../bus.js';
import { CARD } from '../game/data/gameData.js';
import { calcScore } from '../supabase.js';


function fmtTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function ResultScreen({ onRestart, onMenu, onLeaderboard, player }) {
  const [result, setResult] = useState(null);
  const [score, setScore] = useState(0);


  useEffect(() => {
    const off = bus.on('BATTLE_COMPLETED', data => {
      if (data.trial) return;
      setResult(data);
      const s = calcScore({ kills: data.stats?.kills, dmgDealt: data.stats?.dmg, maxCombo: data.stats?.combo, won: data.won });
      setScore(s);
      // Save best score
      try {
        const p = JSON.parse(localStorage.getItem('ss_profile_v1') || '{}');
        const best = p.best || {};
        if (s > (best.score || 0)) best.score = s;
        if ((data.stats?.combo || 0) > (best.combo || 0)) best.combo = data.stats.combo;
        if (data.won) p.wins = (p.wins || 0) + 1;
        p.best = best;
        localStorage.setItem('ss_profile_v1', JSON.stringify(p));
      } catch { }
    });
    return off;
  }, []);


  const restart = useCallback(() => { setResult(null); onRestart?.(); }, [onRestart]);
  const menu = useCallback(() => { setResult(null); onMenu?.(); }, [onMenu]);

  if (!result) return null;
  const { won, stats, cards } = result;

  return (
    <div class="ov" style={{ zIndex: 150 }}>
      <div class={`res ${won ? 'win' : 'lose'}`}>
        <div class="eyebrow">{won ? 'Chiến thắng!' : 'Thất bại · Deadline thắng...'}</div>
        <h2>{won ? '🏆 Xong ca rồi!' : '💀 Burn out!'}</h2>
        <p>
          {won
            ? `Bạn đã hạ được DEADLINE sau ${fmtTime(stats.time)}! Thần kinh thép thật sự.`
            : `Bạn trụ được ${fmtTime(stats.time)} trước khi bị stress quật ngã.`}
        </p>

        <div class="stats">
          <div class="stat hi" style={{ gridColumn: '1/-1', background: 'var(--sticky-soft)' }}>
            <small>Tổng điểm</small>
            <b style={{ fontSize: 32, color: 'var(--grape)' }}>{score.toLocaleString()}</b>
          </div>
          <div class="stat hi">
            <small>Combo cao nhất</small>
            <b>x{stats.combo}</b>
          </div>
          <div class="stat">
            <small>Số hạ</small>
            <b>{stats.kills}</b>
          </div>
          <div class="stat">
            <small>Số đập</small>
            <b>{stats.taps}</b>
          </div>
          <div class="stat">
            <small>Sát thương</small>
            <b>{(stats.dmg || 0).toLocaleString()}</b>
          </div>
          <div class="stat">
            <small>Cấp đạt</small>
            <b>Lv {stats.lvl}</b>
          </div>
          <div class="stat">
            <small>Thời gian</small>
            <b>{fmtTime(stats.time)}</b>
          </div>
        </div>


        {/* Cards used */}
        <div class="chips">
          {Object.entries(cards || {}).map(([id, lv]) => {
            const c = CARD[id];
            return c ? <span key={id} class="chip">{c.icon} {c.name} <b>Lv{lv}</b></span> : null;
          })}
        </div>

        <div class="row">
          <button class="btn primary" onClick={restart}>Chơi lại</button>
          <button class="btn" onClick={menu}>Về menu</button>
          {onLeaderboard && <button class="btn" onClick={onLeaderboard}>🏆 Xếp hạng</button>}
        </div>

      </div>
    </div>
  );
}
