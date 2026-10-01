/** ResultScreen.jsx — Screenshot-worthy run summary */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { bus } from '../bus.js';
import { CARD, SYN, CLASSES } from '../game/data/gameData.js';
import { calcScore } from '../supabase.js';

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function fmtNum(n) { return (n || 0).toLocaleString('vi-VN'); }

const WIN_QUOTES = [
  'Works on my machine. 🤷',
  'Ship it. No bugs found. (ở local)',
  'Code review passed lúc 11:59.',
  'Refactor sau. Mãi mãi là sau.',
  'Tech debt? Chưa thấy bao giờ.',
  'Senior dev không giải thích. Senior dev merge.',
  'Deploy xong là của tương lai lo.',
  '"Tại sao pass?" – "Tại sao không?"',
  'Đúng deadline. Chưa từng sai. (lần này)',
];
const LOSE_QUOTES = [
  'It works on my machine... 💻🔥',
  'Blame môi trường production.',
  'Đã push hotfix. Lại rollback.',
  'Jira ticket mở từ Q2. Vẫn đang open.',
  'Meeting đáng lẽ là email. Email đáng lẽ là không có gì.',
  'Stack trace 47 dòng. Fix được 1.',
  'Sprint velocity âm. Kỷ lục mới.',
  '"Urgent!" từ lúc 8 giờ sáng. Nhận lúc 5 chiều.',
  'Burn out không phải lỗi của tôi. Của dependency.',
];

// ── Share image generator ─────────────────────────────────────────────────
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

async function generateShareCanvas(data, score) {
  const W = 640, H = 360;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  const won = data.won;
  const INK = '#1D1B2E';

  // Background
  g.fillStyle = won ? '#FFD447' : '#1D1B2E';
  g.fillRect(0, 0, W, H);

  // Shadow card
  g.fillStyle = INK;
  rrect(g, 26, 26, W - 48, H - 48, 20); g.fill();

  // White card
  g.fillStyle = '#FFFFFF';
  rrect(g, 20, 20, W - 40, H - 40, 20); g.fill();
  g.strokeStyle = INK; g.lineWidth = 3;
  rrect(g, 20, 20, W - 40, H - 40, 20); g.stroke();

  // Game name
  g.fillStyle = won ? '#2EC4B6' : '#FF4D6D';
  g.font = '700 13px monospace'; g.textAlign = 'left';
  g.fillText('STRESS SURVIVOR', 36, 50);

  // Outcome
  g.fillStyle = INK;
  g.font = `900 ${won ? 38 : 34}px Arial`;
  g.textAlign = 'left';
  g.fillText(won ? '🏆 DEADLINE ĐÃ HẠ!' : '💀 BURN OUT...', 36, 95);

  // Score
  g.fillStyle = '#7B5CFF';
  g.font = '900 64px Arial'; g.textAlign = 'right';
  g.fillText(fmtNum(score), W - 36, 95);
  g.fillStyle = '#888'; g.font = '700 11px monospace';
  g.fillText('ĐIỂM', W - 36, 110);

  // Divider
  g.strokeStyle = '#E8E4F2'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(36, 120); g.lineTo(W - 36, 120); g.stroke();

  // Stats row
  const stats = [
    { label: 'Hạ địch', value: fmtNum(data.stats.kills), icon: '💀' },
    { label: 'Combo', value: `×${data.stats.combo}`, icon: '⚡' },
    { label: 'Thời gian', value: fmtTime(data.stats.time), icon: '⏱️' },
    { label: 'Sát thương', value: fmtNum(data.stats.dmg), icon: '⚔️' },
    { label: 'Vàng kiếm', value: `+${data.stats.gold || 0} 🪙`, icon: '' },
  ];
  const colW = (W - 72) / stats.length;
  stats.forEach((st, i) => {
    const cx = 36 + i * colW + colW / 2;
    g.textAlign = 'center';
    g.font = '600 11px monospace'; g.fillStyle = '#888';
    g.fillText(st.label.toUpperCase(), cx, 148);
    g.font = '800 18px Arial'; g.fillStyle = INK;
    g.fillText(st.icon + st.value, cx, 170);
  });

  // Divider
  g.strokeStyle = '#E8E4F2'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(36, 182); g.lineTo(W - 36, 182); g.stroke();

  // Cards row
  const cardEntries = Object.entries(data.cards || {}).slice(0, 7);
  g.textAlign = 'left';
  g.font = '600 11px monospace'; g.fillStyle = '#888';
  g.fillText('BUILD', 36, 202);
  cardEntries.forEach(([id, lv], i) => {
    const card = CARD[id];
    if (!card) return;
    const x = 36 + i * 78;
    g.fillStyle = '#F7F5FF'; rrect(g, x, 208, 72, 32, 8); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.5; rrect(g, x, 208, 72, 32, 8); g.stroke();
    g.font = '14px Arial'; g.fillStyle = INK; g.textAlign = 'left';
    g.fillText(card.icon, x + 6, 229);
    g.font = '700 10px Arial'; g.fillStyle = '#7B5CFF';
    g.fillText(`Lv${lv}`, x + 52, 229);
  });

  // Active synergies
  const syns = (data.synActive || []).slice(0, 3);
  if (syns.length > 0) {
    syns.forEach((sid, i) => {
      const syn = SYN[sid];
      if (!syn) return;
      const x = 36 + i * 140;
      g.fillStyle = '#FFD447'; rrect(g, x, 250, 132, 22, 6); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.5; rrect(g, x, 250, 132, 22, 6); g.stroke();
      g.font = '700 10px Arial'; g.fillStyle = INK; g.textAlign = 'center';
      g.fillText(syn.name, x + 66, 265);
    });
  }

  // Quote
  const quotes = won ? WIN_QUOTES : LOSE_QUOTES;
  const quote = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;
  g.textAlign = 'center'; g.font = 'italic 12px Arial'; g.fillStyle = '#888';
  g.fillText(quote, W / 2, 300);

  // Watermark
  g.textAlign = 'right'; g.font = '700 10px monospace'; g.fillStyle = '#ccc';
  g.fillText('stress-survivor.vercel.app', W - 36, 320);

  return c;
}

// ── Confetti particles (pure CSS, 12 pieces) ─────────────────────────────
function Confetti() {
  const COLORS = ['#FFD447','#2EC4B6','#FF4D6D','#7B5CFF','#FF8A3D'];
  return (
    <div class="confetti-wrap" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <div key={i} class="conf-piece" style={{
          left: `${5 + i * 6}%`,
          background: COLORS[i % COLORS.length],
          animationDelay: `${(i * 0.11).toFixed(2)}s`,
          animationDuration: `${1.4 + (i % 3) * 0.3}s`,
          width: i % 3 === 0 ? '10px' : '8px',
          height: i % 3 === 0 ? '10px' : '14px',
          borderRadius: i % 2 === 0 ? '50%' : '2px',
        }} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export function ResultScreen({ onRestart, onMenu, onLeaderboard, player }) {
  const [result, setResult] = useState(null);
  const [score, setScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState('');

  useEffect(() => {
    const off = bus.on('BATTLE_COMPLETED', data => {
      if (data.trial) return;
      setResult(data);
      const s = calcScore({ kills: data.stats?.kills, dmgDealt: data.stats?.dmg, maxCombo: data.stats?.combo, won: data.won });
      setScore(s);
      setDisplayScore(0);
      // Save best
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

  // Score count-up animation
  useEffect(() => {
    if (!score) return;
    let current = 0;
    const step = Math.ceil(score / 40);
    const id = setInterval(() => {
      current = Math.min(current + step, score);
      setDisplayScore(current);
      if (current >= score) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [score]);

  const restart = useCallback(() => { setResult(null); setShareMsg(''); onRestart?.(); }, [onRestart]);
  const menu    = useCallback(() => { setResult(null); setShareMsg(''); onMenu?.(); }, [onMenu]);

  const handleShare = useCallback(async () => {
    if (!result || sharing) return;
    setSharing(true);
    try {
      const canvas = await generateShareCanvas(result, score);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));

      // Web Share API (mobile)
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'x.png', { type: 'image/png' })] })) {
        await navigator.share({
          title: 'Stress Survivor',
          text: `Tôi vừa ${result.won ? 'hạ Deadline' : 'bị burn out'} với ${score.toLocaleString()} điểm! 🎮`,
          files: [new File([blob], 'stress-survivor.png', { type: 'image/png' })],
        });
        setShareMsg('Đã chia sẻ! 🎉');
      } else {
        // Fallback: download PNG
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `stress-survivor-${score}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setShareMsg('Đã tải ảnh! 📸');
      }
    } catch (e) {
      if (e.name !== 'AbortError') setShareMsg('Lỗi chia sẻ 😅');
    } finally {
      setSharing(false);
      setTimeout(() => setShareMsg(''), 3000);
    }
  }, [result, score, sharing]);

  if (!result) return null;
  const { won, stats, cards, synActive, cls } = result;
  const clsData = CLASSES[cls] || CLASSES.developer;
  const cardList = Object.entries(cards || {});
  const activeSyns = (synActive || []).map(id => SYN[id]).filter(Boolean);
  const quote = won
    ? WIN_QUOTES[Math.floor(Math.random() * WIN_QUOTES.length)]
    : LOSE_QUOTES[Math.floor(Math.random() * LOSE_QUOTES.length)];

  return (
    <div class="ov" style={{ zIndex: 150, overflowY: 'auto', alignItems: 'flex-start', paddingTop: 0 }}>
      {won && <Confetti />}

      <div class={`res-card ${won ? 'win' : 'lose'}`}>

        {/* ── Header ── */}
        <div class="res-header">
          <div>
            <div class="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {won ? '✅ Chiến thắng!' : '💀 Thất bại'}
              {daily && (
                <span style={{ background: '#1D1B2E', color: '#FFD447', font: '800 9px var(--mono)', letterSpacing: '.1em', padding: '2px 7px', borderRadius: 6 }}>
                  📅 DAILY {new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </span>
              )}
            </div>
            <h2 class="res-title">{won ? '🏆 Deadline đã hạ!' : '💀 Burn out!'}</h2>
            <p class="res-sub">
              {won
                ? `${clsData.name} hạ Deadline sau ${fmtTime(stats.time)}. Thần kinh thép.`
                : `Trụ được ${fmtTime(stats.time)} trước khi stress quật ngã.`}
            </p>
          </div>
          {/* Score block */}
          <div class="res-score-block">
            <span class="res-score-num">{displayScore.toLocaleString('vi-VN')}</span>
            <span class="res-score-label">điểm</span>
          </div>
        </div>

        {/* ── Stats grid ── */}
        <div class="res-stats">
          {[
            { icon: '💀', label: 'Hạ địch',    val: fmtNum(stats.kills) },
            { icon: '⚡', label: 'Combo max',  val: `×${stats.combo}` },
            { icon: '⏱️', label: 'Thời gian',  val: fmtTime(stats.time) },
            { icon: '⚔️', label: 'Sát thương', val: fmtNum(stats.dmg) },
            { icon: '💰', label: 'Vàng kiếm',  val: `+${stats.gold || 0} 🪙` },
            { icon: '🎮', label: 'Cấp đạt',    val: `Lv ${stats.lvl}` },
          ].map(({ icon, label, val }) => (
            <div class="res-stat" key={label}>
              <span class="res-stat-icon">{icon}</span>
              <div>
                <div class="res-stat-val">{val}</div>
                <div class="res-stat-label">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Build used ── */}
        {cardList.length > 0 && (
          <div class="res-build">
            <div class="eyebrow" style={{ marginBottom: 8 }}>Build cuối</div>
            <div class="res-cards">
              {cardList.map(([id, lv]) => {
                const c = CARD[id];
                return c ? (
                  <div key={id} class={`res-chip r-${c.rarity}`}>
                    <span>{c.icon}</span>
                    <span class="res-chip-name">{c.name}</span>
                    <span class="res-chip-lv">Lv{lv}</span>
                  </div>
                ) : null;
              })}
            </div>
            {activeSyns.length > 0 && (
              <div class="res-syns">
                {activeSyns.map(syn => (
                  <span key={syn.id} class="res-syn-badge">⚡ {syn.name}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Quote ── */}
        <div class="res-quote">"{quote}"</div>

        {/* ── Share feedback ── */}
        {shareMsg && <div class="res-share-msg">{shareMsg}</div>}

        {/* ── Actions ── */}
        <div class="res-actions">
          <button class="btn res-share-btn" onClick={handleShare} disabled={sharing}>
            {sharing ? '⏳' : '📸'} Chia sẻ
          </button>
          <button class="btn primary" onClick={restart}>🔄 Chơi lại</button>
          <button class="btn" onClick={menu}>🏠 Menu</button>
          {onLeaderboard && (
            <button class="btn" onClick={onLeaderboard}>🏆 Xếp hạng</button>
          )}
        </div>

      </div>
    </div>
  );
}
