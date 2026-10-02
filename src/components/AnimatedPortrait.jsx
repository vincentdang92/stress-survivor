/**
 * AnimatedPortrait.jsx
 * 3D-look animated developer character portrait.
 * Canvas-based with idle animations + CSS 3D tilt (gyro/mouse).
 *
 * Animations:
 *   - Breathing bob (Y + scale)
 *   - Eye blinking (random 3-5s interval)
 *   - Eyebrow micro-raise
 *   - Typing hands (alternating phase)
 *   - Glasses screen glow pulse
 *   - Laptop code lines + cursor blink
 *   - Coffee steam particles (tier >= 1)
 *   - Floating tier badge (tier >= 2)
 *   - Legendary gold aura (tier 4)
 *   - CSS 3D perspective tilt on hover / gyroscope
 */
import { useEffect, useRef, useState, useCallback } from 'preact/hooks';

const TAU   = Math.PI * 2;
const cl    = v => Math.max(0, Math.min(255, Math.round(v)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function parseHex(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function lightenHex(hex, amt) {
  const [r,g,b] = parseHex(hex);
  return `rgb(${cl(r+255*amt)},${cl(g+255*amt)},${cl(b+255*amt)})`;
}
function darkenHex(hex, amt) {
  const [r,g,b] = parseHex(hex);
  return `rgb(${cl(r-255*amt)},${cl(g-255*amt)},${cl(b-255*amt)})`;
}
function rr(ctx, x, y, w, h, rad) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x+w, y, x+w, y+h, rad);
  ctx.arcTo(x+w, y+h, x, y+h, rad);
  ctx.arcTo(x, y+h, x, y, rad);
  ctx.arcTo(x, y, x+w, y, rad);
  ctx.closePath();
}

// ── Tier config ───────────────────────────────────────────────────────────
const TIERS = [
  { hoodie:'#3A4A5A', shirt:'#E2EAF5', hair:'#2D2D3A', badge:null,  aura:null      }, // 0 Rookie
  { hoodie:'#1A6EA0', shirt:'#C8E8FF', hair:'#1A1A2E', badge:'☕',   aura:null      }, // 1 Experienced
  { hoodie:'#5A3A8A', shirt:'#E8D8FF', hair:'#5A3A8A', badge:'🎧',   aura:null      }, // 2 Veteran
  { hoodie:'#B06020', shirt:'#FFF0C8', hair:'#803A10', badge:'⚡',   aura:'#FF8A3D' }, // 3 Elite
  { hoodie:'#8A6010', shirt:'#FFFAE0', hair:'#6A4A00', badge:'👑',   aura:'#FFD447' }, // 4 Legendary
];

// ── Main draw function ────────────────────────────────────────────────────
function drawChar(ctx, sz, tier, t, blinkAmt, steam) {
  const cfg = TIERS[Math.min(tier, 4)];
  const r   = sz * 0.27;   // base size unit

  // ── Ground shadow ───────────────────────────────────────────
  {
    const sg = ctx.createRadialGradient(0, r*2.6, 0, 0, r*2.6, r*1.3);
    sg.addColorStop(0, 'rgba(29,27,46,0.30)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.scale(1, 0.24);
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(0, r*10.8, r*1.4, r*1.3, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ── Legendary aura glow ─────────────────────────────────────
  if (cfg.aura) {
    const pa = 0.16 + Math.sin(t * 2.2) * 0.08;
    const [ar,ag,ab] = parseHex(cfg.aura);
    const ag2 = ctx.createRadialGradient(0, -r*0.3, r*0.3, 0, -r*0.3, r*2.1);
    ag2.addColorStop(0, `rgba(${ar},${ag},${ab},${pa})`);
    ag2.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
    ctx.fillStyle = ag2;
    ctx.fillRect(-sz/2, -sz/2, sz, sz);
    // Orbiting star particles (tier 4)
    if (tier >= 4) {
      for (let i = 0; i < 3; i++) {
        const sa = t * 0.9 + i * TAU/3;
        const sx = Math.cos(sa) * r * 0.9, sy = Math.sin(sa * 0.55) * r * 0.42 - r*0.5;
        ctx.save();
        ctx.globalAlpha = 0.65 + Math.sin(t*2.8 + i) * 0.3;
        ctx.font = `${r*0.3}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✦', sx, sy + Math.sin(t * 2 + i * 1.1) * r * 0.06);
        ctx.restore();
      }
    }
  }

  // ── Body / Hoodie ───────────────────────────────────────────
  {
    const bW = r*1.32, bH = r*1.52, bY = r*0.5;
    const bg = ctx.createRadialGradient(-r*0.38, bY - bH*0.38, r*0.08, r*0.1, bY, r*1.3);
    bg.addColorStop(0, lightenHex(cfg.hoodie, 0.32));
    bg.addColorStop(0.5, cfg.hoodie);
    bg.addColorStop(1, darkenHex(cfg.hoodie, 0.30));
    rr(ctx, -bW/2, bY - bH/2, bW, bH, r*0.28);
    ctx.fillStyle = bg; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#1D1B2E'; ctx.stroke();

    // Center zip line
    ctx.lineWidth = 1.5; ctx.strokeStyle = darkenHex(cfg.hoodie, 0.22);
    ctx.beginPath(); ctx.moveTo(0, bY - bH*0.14); ctx.lineTo(0, bY + bH*0.32); ctx.stroke();

    // Collar (shirt showing)
    const cg = ctx.createLinearGradient(0, bY - bH*0.5, 0, bY - bH*0.18);
    cg.addColorStop(0, cfg.shirt); cg.addColorStop(1, darkenHex(cfg.shirt, 0.1));
    rr(ctx, -r*0.33, bY - bH*0.5, r*0.66, bH*0.3, r*0.1);
    ctx.fillStyle = cg; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#1D1B2E'; ctx.stroke();
  }

  // ── Arms + Typing hands ─────────────────────────────────────
  {
    const bW = r*1.32, bY = r*0.5;
    const tL =  Math.sin(t * 7.8) * 0.07;    // left hand oscillation
    const tR = -Math.sin(t * 7.8) * 0.07;    // right (opposite phase → typing feel)

    for (const [sign, tOff] of [[-1, tL], [1, tR]]) {
      const sx = sign * (bW/2 - r*0.06), sy = bY;
      const ex = sign * (bW/2 + r*0.1),  ey = bY + r*0.7 + tOff*r;
      const cx2 = sign * (bW/2 + r*0.26), cy2 = bY + r*0.28;

      // Arm shadow
      ctx.beginPath(); ctx.moveTo(sx+2, sy+2); ctx.quadraticCurveTo(cx2+2, cy2+2, ex+2, ey+2);
      ctx.strokeStyle = 'rgba(29,27,46,0.18)'; ctx.lineWidth = r*0.22; ctx.lineCap = 'round'; ctx.stroke();
      // Arm body
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx2, cy2, ex, ey);
      ctx.strokeStyle = cfg.hoodie; ctx.lineWidth = r*0.22; ctx.stroke();
      // Arm highlight
      ctx.beginPath(); ctx.moveTo(sx - sign*r*0.03, sy); ctx.quadraticCurveTo(cx2 - sign*r*0.04, cy2, ex - sign*r*0.02, ey);
      ctx.strokeStyle = lightenHex(cfg.hoodie, 0.2); ctx.lineWidth = r*0.09; ctx.stroke();
      // Hand (rounded fist)
      ctx.beginPath(); ctx.ellipse(ex, ey, r*0.15, r*0.13, sign * 0.3, 0, TAU);
      ctx.fillStyle = '#F0C898'; ctx.fill();
      ctx.strokeStyle = '#B07840'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  // ── Laptop (on lap) ─────────────────────────────────────────
  {
    const lapY = r*0.5 + r*0.76 + r*0.05;
    const lW = r*1.02, lH = r*0.64;

    // Keyboard base
    const kbg = ctx.createLinearGradient(0, lapY, 0, lapY + r*0.16);
    kbg.addColorStop(0, '#BABAC8'); kbg.addColorStop(1, '#888890');
    ctx.fillStyle = kbg;
    ctx.beginPath();
    ctx.moveTo(-lW*0.52, lapY);    ctx.lineTo(lW*0.52, lapY);
    ctx.lineTo(lW*0.48, lapY + r*0.16); ctx.lineTo(-lW*0.48, lapY + r*0.16);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#1D1B2E'; ctx.stroke();

    // Screen (trapezoidal perspective)
    const sG = ctx.createLinearGradient(0, lapY - lH, 0, lapY);
    sG.addColorStop(0, '#26263C'); sG.addColorStop(1, '#1A1A2C');
    ctx.fillStyle = sG;
    ctx.beginPath();
    ctx.moveTo(-lW*0.52, lapY);    ctx.lineTo(lW*0.52, lapY);
    ctx.lineTo(lW*0.44, lapY - lH); ctx.lineTo(-lW*0.44, lapY - lH);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = '#1D1B2E'; ctx.stroke();

    // Screen content
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-lW*0.52+r*0.04, lapY-r*0.02); ctx.lineTo(lW*0.52-r*0.04, lapY-r*0.02);
    ctx.lineTo(lW*0.44-r*0.04, lapY-lH+r*0.04); ctx.lineTo(-lW*0.44+r*0.04, lapY-lH+r*0.04);
    ctx.closePath(); ctx.clip();

    // BG glow (syncs with glasses)
    ctx.fillStyle = `rgba(46,196,182,${0.10 + Math.sin(t*1.9)*0.05})`;
    ctx.fillRect(-lW, lapY-lH, lW*2, lH);

    // Code lines
    const lineData = [
      { color: [46,196,182], w: 0.70 },
      { color: [123,92,255], w: 0.45 },
      { color: [255,212,71], w: 0.58 },
    ];
    for (let i = 0; i < 3; i++) {
      const ly  = lapY - lH + r*0.10 + i*r*0.18;
      const la  = 0.55 + Math.sin(t * 2.6 + i * 1.3) * 0.22;
      const lwd = lineData[i].w * lW * 0.82;
      const [lr,lg,lb] = lineData[i].color;
      ctx.fillStyle = `rgba(${lr},${lg},${lb},${la})`;
      ctx.fillRect(-lW*0.40, ly, lwd, r*0.08);
    }
    // Cursor blink
    if (Math.floor(t * 2.1) % 2 === 0) {
      const cl2 = lineData[2].w * lW * 0.82 - lW*0.40;
      ctx.fillStyle = '#FFD447';
      ctx.fillRect(-lW*0.40 + cl2, lapY - lH + r*0.10 + 2*r*0.18, r*0.045, r*0.09);
    }
    ctx.restore();

    // Screen top shine
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-lW*0.44, lapY-lH); ctx.lineTo(lW*0.44, lapY-lH);
    ctx.lineTo(lW*0.28, lapY-lH+r*0.14); ctx.lineTo(-lW*0.28, lapY-lH+r*0.14);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
    ctx.restore();
  }

  // ── Coffee cup (tier >= 1, right side) ──────────────────────
  if (tier >= 1) {
    const cx = r*1.02, cy = r*0.42;

    // Steam particles
    for (const s of steam) {
      const a = 0.22 * (1 - s.life);
      ctx.beginPath(); ctx.arc(cx + s.x * r*0.25, cy - r*0.26 - s.y * r*0.55, s.r, 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
    }

    // Cup
    const cpg = ctx.createLinearGradient(cx-r*0.2, cy, cx+r*0.2, cy);
    cpg.addColorStop(0, '#E8E8F0'); cpg.addColorStop(0.5, '#FFFFFF'); cpg.addColorStop(1, '#C8C8D8');
    ctx.fillStyle = cpg; ctx.strokeStyle = '#1D1B2E'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx-r*0.17, cy-r*0.24); ctx.lineTo(cx+r*0.17, cy-r*0.24);
    ctx.lineTo(cx+r*0.14, cy+r*0.14); ctx.lineTo(cx-r*0.14, cy+r*0.14);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Coffee inside
    ctx.fillStyle = '#6B3A2A';
    ctx.fillRect(cx-r*0.14, cy-r*0.20, r*0.28, r*0.10);

    // Handle arc
    ctx.beginPath(); ctx.arc(cx + r*0.24, cy - r*0.05, r*0.10, -1.15, 1.15);
    ctx.strokeStyle = '#1D1B2E'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.stroke();
  }

  // ── Neck ────────────────────────────────────────────────────
  const headY = -r*0.76;
  {
    const ng = ctx.createLinearGradient(-r*0.18, headY+r*0.5, r*0.18, headY+r*0.82);
    ng.addColorStop(0, '#F0C898'); ng.addColorStop(1, '#D8A870');
    rr(ctx, -r*0.19, headY+r*0.40, r*0.38, r*0.36, r*0.08);
    ctx.fillStyle = ng; ctx.fill();
  }

  // ── Head ────────────────────────────────────────────────────
  {
    const hg = ctx.createRadialGradient(-r*0.24, headY-r*0.28, r*0.04, r*0.05, headY, r*0.70);
    hg.addColorStop(0,    '#FFF8F0');
    hg.addColorStop(0.42, '#FFD8A8');
    hg.addColorStop(0.82, '#E8A870');
    hg.addColorStop(1,    '#C07840');
    ctx.beginPath(); ctx.ellipse(0, headY, r*0.58, r*0.63, 0, 0, TAU);
    ctx.fillStyle = hg; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#1D1B2E'; ctx.stroke();

    // Head rim shadow (bottom)
    const rsg = ctx.createRadialGradient(0, headY+r*0.42, 0, 0, headY+r*0.42, r*0.6);
    rsg.addColorStop(0, 'rgba(29,27,46,0.14)');
    rsg.addColorStop(1, 'rgba(29,27,46,0)');
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, headY, r*0.58, r*0.63, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = rsg; ctx.fill();
    ctx.restore();
  }

  // ── Hair ─────────────────────────────────────────────────────
  {
    const hg2 = ctx.createRadialGradient(-r*0.18, headY-r*0.55, 0, 0, headY-r*0.40, r*0.58);
    hg2.addColorStop(0, lightenHex(cfg.hair, 0.24));
    hg2.addColorStop(1, darkenHex(cfg.hair, 0.08));
    // Top mass
    ctx.fillStyle = hg2;
    ctx.beginPath(); ctx.ellipse(0, headY - r*0.44, r*0.52, r*0.29, 0, Math.PI, TAU);
    ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1D1B2E'; ctx.stroke();
    // Left side flick
    ctx.strokeStyle = cfg.hair; ctx.lineWidth = r*0.22; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r*0.54, headY-r*0.12);
    ctx.quadraticCurveTo(-r*0.68, headY-r*0.42, -r*0.46, headY-r*0.60);
    ctx.stroke();
    // Hair highlight
    ctx.strokeStyle = lightenHex(cfg.hair, 0.18); ctx.lineWidth = r*0.08;
    ctx.beginPath();
    ctx.moveTo(-r*0.52, headY-r*0.14);
    ctx.quadraticCurveTo(-r*0.62, headY-r*0.38, -r*0.44, headY-r*0.56);
    ctx.stroke();
  }

  // ── Glasses ──────────────────────────────────────────────────
  const gY = headY - r*0.1;
  {
    const gA = 0.14 + Math.sin(t * 2.1) * 0.08;   // pulsing screen reflection
    for (const gx of [-r*0.24, r*0.24]) {
      // Lens tint
      ctx.beginPath(); ctx.arc(gx, gY, r*0.20, 0, TAU);
      ctx.fillStyle = `rgba(46,196,182,${gA})`; ctx.fill();
      ctx.strokeStyle = '#1D1B2E'; ctx.lineWidth = 1.9; ctx.stroke();
      // Shimmer (scan line)
      ctx.save();
      ctx.beginPath(); ctx.arc(gx, gY, r*0.20, 0, TAU); ctx.clip();
      const shY = ((t * 0.4) % 1) * r*0.4 - r*0.22;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(gx - r*0.22, gY + shY, r*0.44, r*0.08);
      ctx.restore();
    }
    // Bridge
    ctx.strokeStyle = '#1D1B2E'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-r*0.04, gY); ctx.lineTo(r*0.04, gY); ctx.stroke();
    // Arms
    ctx.beginPath(); ctx.moveTo(-r*0.44, gY); ctx.lineTo(-r*0.57, gY + r*0.04); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( r*0.44, gY); ctx.lineTo( r*0.57, gY + r*0.04); ctx.stroke();
  }

  // ── Eyes ─────────────────────────────────────────────────────
  const eY = headY - r*0.12;
  for (const ex of [-r*0.24, r*0.24]) {
    ctx.save(); ctx.translate(ex, eY); ctx.scale(1, 1 - blinkAmt * 0.95);
    // White sclera
    ctx.beginPath(); ctx.arc(0, 0, r*0.14, 0, TAU);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.strokeStyle = '#1D1B2E'; ctx.lineWidth = 1.2; ctx.stroke();
    // Pupil (slight forward gaze)
    ctx.beginPath(); ctx.arc(r*0.04, r*0.02, r*0.078, 0, TAU);
    ctx.fillStyle = '#1D1B2E'; ctx.fill();
    // Shine
    ctx.beginPath(); ctx.arc(r*0.072, -r*0.022, r*0.030, 0, TAU);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.restore();
  }

  // ── Eyebrows (micro animate) ─────────────────────────────────
  {
    const br = Math.sin(t * 0.65) * 0.025 * r;
    ctx.strokeStyle = cfg.hair; ctx.lineWidth = 1.9; ctx.lineCap = 'round';
    for (const [bx, dir] of [[-r*0.24, 1], [r*0.24, -1]]) {
      ctx.beginPath();
      ctx.moveTo(bx - dir*r*0.16, headY - r*0.30 - br);
      ctx.quadraticCurveTo(bx, headY - r*(0.335) - br*1.1, bx + dir*r*0.16, headY - r*0.30 - br);
      ctx.stroke();
    }
  }

  // ── Nose (subtle) ────────────────────────────────────────────
  ctx.strokeStyle = '#B07848'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r*0.055, headY + r*0.055);
  ctx.quadraticCurveTo(-r*0.10, headY + r*0.14, -r*0.035, headY + r*0.16);
  ctx.stroke();

  // ── Mouth (small smile) ──────────────────────────────────────
  ctx.strokeStyle = '#8B5030'; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r*0.14, headY + r*0.28);
  ctx.quadraticCurveTo(0, headY + r*0.39, r*0.14, headY + r*0.28);
  ctx.stroke();

  // ── Tier badge (floating) ────────────────────────────────────
  if (cfg.badge && tier >= 2) {
    const bx = r*0.76, by = headY - r*0.68 + Math.sin(t*1.9)*r*0.06;
    ctx.save();
    ctx.globalAlpha = 0.7 + Math.sin(t*2.4)*0.28;
    ctx.font = `${r*0.38}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(cfg.badge, bx, by);
    ctx.restore();
  }

  // ── Head shine (top-left highlight) ─────────────────────────
  {
    const sg = ctx.createRadialGradient(-r*0.22, headY-r*0.36, 0, -r*0.22, headY-r*0.36, r*0.34);
    sg.addColorStop(0, 'rgba(255,255,255,0.30)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, headY, r*0.58, r*0.63, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = sg; ctx.fill();
    ctx.restore();
  }
}

// ── Component ─────────────────────────────────────────────────────────────
export function AnimatedPortrait({ tier = 0, size = 115 }) {
  const canvasRef = useRef(null);
  const frameRef  = useRef(null);
  const wrapRef   = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const gyroAvail = useRef(false);

  // Gyroscope (mobile)
  useEffect(() => {
    const handler = e => {
      if (e.gamma == null) return;
      gyroAvail.current = true;
      setTilt({ x: clamp(e.gamma / 22, -1, 1), y: clamp((e.beta - 30) / 22, -1, 1) });
    };
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const onTouch = () => {
        DeviceOrientationEvent.requestPermission()
          .then(s => { if (s === 'granted') window.addEventListener('deviceorientation', handler, { passive: true }); })
          .catch(() => {});
        document.removeEventListener('touchstart', onTouch);
      };
      document.addEventListener('touchstart', onTouch, { once: true });
    } else {
      window.addEventListener('deviceorientation', handler, { passive: true });
    }
    return () => window.removeEventListener('deviceorientation', handler);
  }, []);

  // Mouse tilt (desktop)
  const onMouseMove = useCallback(e => {
    if (gyroAvail.current) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTilt({
      x: clamp(((e.clientX - rect.left)  / rect.width  - 0.5) * 2, -1, 1),
      y: clamp(((e.clientY - rect.top)   / rect.height - 0.5) * 2, -1, 1),
    });
  }, []);
  const onMouseLeave = useCallback(() => { if (!gyroAvail.current) setTilt({ x:0, y:0 }); }, []);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = size * DPR;
    canvas.height = size * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    let t = 0;
    let blinkTimer = 2.5 + Math.random() * 2;
    let blinking   = false;
    let blinkAmt   = 0;
    const steam    = [];
    let last = performance.now();

    const loop = now => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t   += dt;

      // Blink timing
      blinkTimer -= dt;
      if (blinkTimer <= 0 && !blinking) {
        blinking   = true;
        blinkTimer = 3.5 + Math.random() * 3;
      }
      if (blinking) {
        blinkAmt += dt * 13;
        if (blinkAmt >= 1) {
          blinkAmt = 0;
          blinking = false;
        }
      }

      // Coffee steam (tier >= 1)
      if (tier >= 1) {
        if (Math.random() < dt * 2.8) {
          steam.push({ x: (Math.random() - 0.5) * 0.8, y: 0, r: 2 + Math.random() * 2.5, life: 0 });
        }
        for (const s of steam) { s.y += dt * 1.2; s.life = Math.min(1, s.life + dt * 1.8); }
        steam.splice(0, steam.length, ...steam.filter(s => s.y < 1.1));
      }

      // Breathing
      const breathY = Math.sin(t * 1.85) * 2.8;
      const breathS = 1 + Math.sin(t * 1.85) * 0.016;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size/2, size/2 + breathY);
      ctx.scale(breathS, breathS);
      drawChar(ctx, size, tier, t, blinkAmt, steam);
      ctx.restore();

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [tier, size]);

  const maxDeg       = 15;
  const tiltTransform = `perspective(320px) rotateY(${tilt.x * maxDeg}deg) rotateX(${-tilt.y * maxDeg}deg) scale(1.05)`;

  return (
    <div
      ref={wrapRef}
      class="tilt-wrap"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ display: 'inline-block' }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width:          size,
          height:         size,
          display:        'block',
          transform:      tiltTransform,
          transformOrigin:'center',
          transition:     'transform 0.07s ease-out',
          borderRadius:   14,
          imageRendering: 'auto',
        }}
      />
    </div>
  );
}
