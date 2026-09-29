/**
 * SpriteFactory.js
 * Generates canvas-drawn sprites and registers them as Phaser textures.
 * Ported from the prototype's canvas drawing code with "Sticker Office" art style:
 * thick ink borders, hard drop shadows, candy colors, googly eyes tracking player.
 */
import { C, FONT_DISPLAY } from './colors.js';

const TAU = Math.PI * 2;
const SS = 2; // supersample

// ── helpers ──────────────────────────────────────────────────────────────
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
function ink(g, fill, lw = 2.6) {
  if (fill) { g.fillStyle = fill; g.fill(); }
  g.lineWidth = lw; g.strokeStyle = C.INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
}
function line(g, p, lw = 2.4, col = C.INK) {
  g.beginPath(); g.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
  g.lineWidth = lw; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
}
function txt(g, s, x, y, size, col) {
  g.font = `800 ${size}px ${FONT_DISPLAY}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = col; g.fillText(s, x, y);
}
function eyeWhite(g, e) { circ(g, e.x, e.y, e.r); ink(g, '#FFFFFF', 1.8); }
function brows(g, E, ang = 1, lw = 2.6) {
  for (const e of E) {
    const s = e.x < 0 ? 1 : -1;
    line(g, [e.x - s * e.r * 1.15, e.y - e.r * (1.3 + 0.35 * ang), e.x + s * e.r * 0.95, e.y - e.r * (1.3 - 0.3 * ang)], lw);
  }
}
function blush(g, x, y, r) {
  g.globalAlpha = 0.55; circ(g, x, y, r); g.fillStyle = '#FF8FA8'; g.fill(); g.globalAlpha = 1;
}

// ── Enemy art ─────────────────────────────────────────────────────────────
export const ENEMY_ART = {
  email: {
    eyes: r => [{ x: -.4 * r, y: .05 * r, r: .29 * r }, { x: .4 * r, y: .05 * r, r: .29 * r }],
    draw(g, r) {
      const w = r * 2.2, h = r * 1.6;
      rr(g, -w / 2, -h / 2, w, h, r * .3); ink(g, '#FFFFFF', 2.6);
      line(g, [-w / 2 + r * .25, -h / 2 + r * .22, 0, h * .04, w / 2 - r * .25, -h / 2 + r * .22], 2);
      const E = this.eyes(r); E.forEach(e => eyeWhite(g, e)); brows(g, E, 1, 2.4);
      g.beginPath(); g.arc(0, r * .66, r * .2, Math.PI * 1.15, Math.PI * 1.85); g.lineWidth = 2; g.strokeStyle = C.INK; g.stroke();
      circ(g, w / 2 - r * .12, -h / 2 + r * .08, r * .36); ink(g, '#FF4D6D', 2);
      txt(g, '!', w / 2 - r * .12, -h / 2 + r * .12, r * .56, '#FFFFFF');
    }
  },
  notif: {
    eyes: r => [{ x: -.32 * r, y: -.12 * r, r: .3 * r }, { x: .32 * r, y: -.12 * r, r: .3 * r }],
    draw(g, r) {
      circ(g, 0, r * .8, r * .2); ink(g, '#FFB020', 2);
      circ(g, 0, -r * 1.02, r * .16); ink(g, '#FFB020', 2);
      g.beginPath();
      g.moveTo(-r * .98, r * .6); g.quadraticCurveTo(-r * .72, r * .35, -r * .74, -r * .15);
      g.quadraticCurveTo(-r * .7, -r * .92, 0, -r * .92);
      g.quadraticCurveTo(r * .7, -r * .92, r * .74, -r * .15);
      g.quadraticCurveTo(r * .72, r * .35, r * .98, r * .6); g.closePath(); ink(g, '#FFD447', 2.4);
      const E = this.eyes(r); E.forEach(e => eyeWhite(g, e));
      g.beginPath(); g.ellipse(0, r * .3, r * .15, r * .12, 0, 0, TAU); ink(g, C.INK, 1.4);
      circ(g, r * .74, -r * .72, r * .33); ink(g, '#FF4D6D', 1.8);
      txt(g, '3', r * .74, -r * .68, r * .46, '#FFFFFF');
    }
  },
  meeting: {
    lids: true,
    eyes: r => [{ x: -.36 * r, y: .3 * r, r: .27 * r }, { x: .36 * r, y: .3 * r, r: .27 * r }],
    draw(g, r) {
      const s = r * 1.8, y0 = -s / 2 + r * .05;
      rr(g, -s / 2, y0, s, s, r * .26); ink(g, '#FFFFFF', 2.8);
      g.save(); rr(g, -s / 2, y0, s, s, r * .26); g.clip();
      g.fillStyle = '#FF4D6D'; g.fillRect(-s / 2, y0, s, r * .56); g.restore();
      rr(g, -s / 2, y0, s, s, r * .26); ink(g, null, 2.8);
      line(g, [-s / 2, y0 + r * .56, s / 2, y0 + r * .56], 2.2);
      rr(g, -r * .52, y0 - r * .2, r * .17, r * .42, r * .08); ink(g, '#FFFFFF', 2);
      rr(g, r * .35, y0 - r * .2, r * .17, r * .42, r * .08); ink(g, '#FFFFFF', 2);
      txt(g, 'HỌP', 0, y0 + r * .31, r * .38, '#FFFFFF');
      const E = this.eyes(r); E.forEach(e => eyeWhite(g, e));
      line(g, [-r * .2, r * .74, r * .2, r * .74], 2.2);
    }
  },
  bug: {
    eyes: r => [{ x: -.22 * r, y: -.62 * r, r: .21 * r }, { x: .22 * r, y: -.62 * r, r: .21 * r }],
    draw(g, r) {
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) { const y = -.02 * r + i * .36 * r; line(g, [s * .6 * r, y, s * 1.02 * r, y - .14 * r + i * .1 * r, s * 1.2 * r, y + .14 * r], 2.2); }
        line(g, [s * .15 * r, -.98 * r, s * .36 * r, -1.26 * r], 2); circ(g, s * .4 * r, -1.32 * r, .11 * r); ink(g, '#7BD66B', 1.6);
      }
      g.beginPath(); g.ellipse(0, .25 * r, .82 * r, .78 * r, 0, 0, TAU); ink(g, '#7BD66B', 2.6);
      line(g, [0, -.2 * r, 0, 1.0 * r], 2);
      for (const [x, y, q] of [[-.42, .18, .13], [.42, .46, .11], [-.3, .64, .09], [.36, .05, .1]]) { circ(g, x * r, y * r, q * r); g.fillStyle = '#4FAF4A'; g.fill(); }
      circ(g, 0, -.58 * r, .5 * r); ink(g, '#5CC05A', 2.4);
      const E = this.eyes(r); E.forEach(e => eyeWhite(g, e)); brows(g, E, 1, 2);
    }
  },
  customer: {
    eyes: r => [{ x: -.34 * r, y: -.2 * r, r: .24 * r }, { x: .34 * r, y: -.2 * r, r: .24 * r }],
    draw(g, r) {
      g.beginPath(); g.moveTo(-.75 * r, .62 * r); g.lineTo(.75 * r, .62 * r); g.lineTo(.95 * r, 1.12 * r); g.lineTo(-.95 * r, 1.12 * r); g.closePath(); ink(g, '#FFFFFF', 2.2);
      g.beginPath(); g.moveTo(-.12 * r, .7 * r); g.lineTo(.12 * r, .7 * r); g.lineTo(.08 * r, 1.1 * r); g.lineTo(-.08 * r, 1.1 * r); g.closePath(); ink(g, '#3A8DFF', 1.6);
      circ(g, 0, -.05 * r, .92 * r); ink(g, '#FF8A3D', 2.6);
      const E = this.eyes(r); E.forEach(e => eyeWhite(g, e)); brows(g, E, 1.5, 3);
      g.beginPath(); g.ellipse(0, .38 * r, .3 * r, .22 * r, 0, 0, TAU); ink(g, C.INK, 1.5);
      g.beginPath(); g.ellipse(0, .49 * r, .16 * r, .08 * r, 0, 0, TAU); g.fillStyle = '#FF7AA0'; g.fill();
      const ax = .6 * r, ay = -.72 * r, a = .14 * r;
      g.strokeStyle = '#E8243F'; g.lineWidth = 2.2;
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        g.beginPath(); g.moveTo(ax + dx * a * .35, ay + dy * a * 1.3);
        g.quadraticCurveTo(ax + dx * a * .35, ay + dy * a * .35, ax + dx * a * 1.3, ay + dy * a * .35); g.stroke();
      }
    }
  },
  boss: {
    eyes: r => [{ x: -.27 * r, y: -.14 * r, r: .17 * r }, { x: .27 * r, y: -.14 * r, r: .17 * r }],
    draw(g, r) {
      line(g, [-.45 * r, .8 * r, -.72 * r, 1.12 * r], 5); line(g, [.45 * r, .8 * r, .72 * r, 1.12 * r], 5);
      for (const s of [-1, 1]) { circ(g, s * .62 * r, -.8 * r, .3 * r); ink(g, '#FFD447', 3.5); }
      line(g, [-.55 * r, -1.02 * r, .55 * r, -1.02 * r], 5); line(g, [0, -1.02 * r, 0, -.86 * r], 5);
      circ(g, 0, 0, r); ink(g, '#FF4D6D', 4.5);
      circ(g, 0, 0, r * .76); ink(g, '#FFFFFF', 3.5);
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU, big = i % 3 === 0;
        line(g, [Math.cos(a) * r * (big ? .58 : .63), Math.sin(a) * r * (big ? .58 : .63), Math.cos(a) * r * .7, Math.sin(a) * r * .7], big ? 3.5 : 2);
      }
      const E = this.eyes(r); E.forEach(e => eyeWhite(g, e)); brows(g, E, 1.6, 4.5);
      rr(g, -.34 * r, .2 * r, .68 * r, .22 * r, .07 * r); ink(g, C.INK, 2.5);
      g.fillStyle = '#FFFFFF';
      for (let i = 0; i < 5; i++) g.fillRect(-.3 * r + i * .13 * r, .22 * r, .09 * r, .08 * r);
      for (let i = 0; i < 4; i++) g.fillRect(-.24 * r + i * .13 * r, .32 * r, .09 * r, .08 * r);
      txt(g, '12', 0, -.5 * r, r * .16, C.INK);
    }
  },
};

// ── Player art ────────────────────────────────────────────────────────────
const PEYES = r => [{ x: -.3 * r, y: -.2 * r, r: .22 * r }, { x: .3 * r, y: -.2 * r, r: .22 * r }];

const PLAYER_ART = {
  developer: {
    shirt: '#2EC4B6',
    body(g, r) {
      line(g, [-.16 * r, .52 * r, -.2 * r, .88 * r], 1.6);
      line(g, [.16 * r, .52 * r, .2 * r, .88 * r], 1.6);
      rr(g, -.3 * r, .86 * r, .6 * r, .22 * r, .08 * r); ink(g, '#25A99C', 1.6);
    },
    hair(g, r) {
      g.beginPath(); g.moveTo(-.84 * r, -.2 * r);
      for (const [x, y] of [[-.9, -.55], [-.72, -.78], [-.64, -1.04], [-.36, -.92], [-.2, -1.2], [.05, -.97], [.28, -1.17], [.42, -.9], [.7, -1.0], [.74, -.72], [.92, -.52], [.84, -.2]])
        g.lineTo(x * r, y * r);
      g.quadraticCurveTo(.5 * r, -.55 * r, 0, -.62 * r); g.quadraticCurveTo(-.5 * r, -.55 * r, -.84 * r, -.2 * r); g.closePath(); ink(g, '#2B2B3A', 2.2);
      g.beginPath(); g.arc(0, -.28 * r, 1.0 * r, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = 5; g.strokeStyle = C.INK; g.stroke(); g.lineWidth = 2.6; g.strokeStyle = '#2EC4B6'; g.stroke();
      rr(g, -1.1 * r, -.44 * r, .32 * r, .52 * r, .13 * r); ink(g, '#2EC4B6', 2.2);
      rr(g, .78 * r, -.44 * r, .32 * r, .52 * r, .13 * r); ink(g, '#2EC4B6', 2.2);
    }
  },
  manager: {
    shirt: '#7B5CFF',
    body(g, r) {
      g.beginPath(); g.moveTo(-.3 * r, .42 * r); g.lineTo(0, .64 * r); g.lineTo(.3 * r, .42 * r); g.closePath(); ink(g, '#FFFFFF', 1.6);
      g.beginPath(); g.moveTo(0, .6 * r); g.lineTo(.11 * r, .74 * r); g.lineTo(0, 1.1 * r); g.lineTo(-.11 * r, .74 * r); g.closePath(); ink(g, '#FF4D6D', 1.6);
    },
    hair(g, r) {
      g.beginPath(); g.moveTo(-.86 * r, -.12 * r);
      g.quadraticCurveTo(-.96 * r, -1.12 * r, 0, -1.1 * r); g.quadraticCurveTo(.96 * r, -1.12 * r, .86 * r, -.12 * r);
      g.quadraticCurveTo(.78 * r, -.52 * r, .36 * r, -.62 * r); g.quadraticCurveTo(-.2 * r, -.72 * r, -.62 * r, -.48 * r); g.quadraticCurveTo(-.8 * r, -.38 * r, -.86 * r, -.12 * r); g.closePath(); ink(g, '#4A3226', 2.2);
      line(g, [.3 * r, -1.06 * r, .4 * r, -.66 * r], 1.6, '#2E1E16');
    },
    face(g, r) {
      for (const e of PEYES(r)) { rr(g, e.x - e.r * 1.45, e.y - e.r * 1.2, e.r * 2.9, e.r * 2.4, e.r * .6); ink(g, null, 2.2); }
      line(g, [-.3 * r + .22 * r * 1.45, -.2 * r, .3 * r - .22 * r * 1.45, -.2 * r], 2);
    }
  },
  designer: {
    shirt: '#FFD447',
    body(g, r) { for (const [x, y, col] of [[-.3, .7, '#FF4D6D'], [.25, .9, '#3A8DFF'], [.1, .6, '#2EC4B6']]) { circ(g, x * r, y * r, .1 * r); g.fillStyle = col; g.fill(); } },
    hair(g, r) {
      g.beginPath(); g.moveTo(-.95 * r, .2 * r); g.quadraticCurveTo(-1.02 * r, -1.02 * r, 0, -1.02 * r); g.quadraticCurveTo(1.02 * r, -1.02 * r, .95 * r, .2 * r);
      g.lineTo(.7 * r, .2 * r); g.quadraticCurveTo(.72 * r, -.5 * r, 0, -.55 * r); g.quadraticCurveTo(-.72 * r, -.5 * r, -.7 * r, .2 * r); g.closePath(); ink(g, '#FF8A3D', 2.2);
      g.beginPath(); g.ellipse(-.12 * r, -1.0 * r, .78 * r, .3 * r, -.2, 0, TAU); ink(g, '#FF7AB6', 2.4);
      line(g, [-.12 * r, -1.28 * r, -.05 * r, -1.42 * r], 2.6);
    }
  },
  sales: {
    shirt: '#2F4FA8',
    body(g, r) {
      g.beginPath(); g.moveTo(-.28 * r, .42 * r); g.lineTo(0, .8 * r); g.lineTo(.28 * r, .42 * r); g.closePath(); ink(g, '#FFFFFF', 1.6);
      g.beginPath(); g.moveTo(0, .52 * r); g.lineTo(.09 * r, .64 * r); g.lineTo(0, .8 * r); g.lineTo(-.09 * r, .64 * r); g.closePath(); ink(g, '#FFD447', 1.4);
    },
    hair(g, r) {
      g.beginPath(); g.moveTo(-.86 * r, -.25 * r); g.quadraticCurveTo(-.9 * r, -1.12 * r, .1 * r, -1.1 * r); g.quadraticCurveTo(.98 * r, -1.02 * r, .86 * r, -.25 * r);
      g.quadraticCurveTo(.6 * r, -.72 * r, -.1 * r, -.7 * r); g.quadraticCurveTo(-.6 * r, -.62 * r, -.86 * r, -.25 * r); g.closePath(); ink(g, '#1F1F2A', 2.2);
    }
  },
  chef: {
    shirt: '#FFFFFF',
    body(g, r) { for (const y of [.58, .78, .98]) { circ(g, 0, y * r, .06 * r); g.fillStyle = C.INK; g.fill(); } },
    hair(g, r) {
      rr(g, -.62 * r, -.98 * r, 1.24 * r, .34 * r, .1 * r); ink(g, '#FFFFFF', 2.2);
      for (const [x, y, q] of [[-.42, -1.2, .34], [.42, -1.2, .34], [0, -1.38, .4]]) { circ(g, x * r, y * r, q * r); ink(g, '#FFFFFF', 2.2); }
    },
    face(g, r) {
      g.beginPath(); g.moveTo(-.34 * r, .1 * r); g.quadraticCurveTo(-.15 * r, -.02 * r, 0, .08 * r); g.quadraticCurveTo(.15 * r, -.02 * r, .34 * r, .1 * r);
      g.quadraticCurveTo(.15 * r, .2 * r, 0, .14 * r); g.quadraticCurveTo(-.15 * r, .2 * r, -.34 * r, .1 * r); ink(g, '#4A3226', 1.4);
    }
  },
  driver: {
    shirt: '#FF8A3D',
    body(g, r) {
      g.fillStyle = '#FFD447';
      g.fillRect(-.6 * r, .7 * r, 1.2 * r, .12 * r);
      g.fillRect(-.6 * r, .92 * r, 1.2 * r, .12 * r);
    },
    hair(g, r) {
      g.beginPath(); g.moveTo(-.84 * r, -.45 * r); g.quadraticCurveTo(-.84 * r, -1.1 * r, 0, -1.1 * r); g.quadraticCurveTo(.84 * r, -1.1 * r, .84 * r, -.45 * r); g.closePath(); ink(g, '#FF8A3D', 2.4);
      rr(g, -.98 * r, -.58 * r, 1.96 * r, .22 * r, .1 * r); ink(g, '#E56F20', 2.2);
      circ(g, 0, -.85 * r, .1 * r); g.fillStyle = '#FFFFFF'; g.fill();
    }
  },
};

function drawPlayer(g, r, cls, rage) {
  const A = PLAYER_ART[cls] || PLAYER_ART.developer;
  const skin = rage ? '#FF9A8A' : '#FFD7B0';
  rr(g, -.62 * r, .4 * r, 1.24 * r, .8 * r, .3 * r); ink(g, A.shirt, 2.4);
  A.body && A.body(g, r);
  circ(g, -.74 * r, .74 * r, .17 * r); ink(g, skin, 2);
  circ(g, .74 * r, .74 * r, .17 * r); ink(g, skin, 2);
  circ(g, 0, -.2 * r, .86 * r); ink(g, skin, 2.6);
  A.hair(g, r);
  const E = PEYES(r); E.forEach(e => eyeWhite(g, e));
  if (rage) {
    brows(g, E, 1.6, 3);
    rr(g, -.28 * r, .2 * r, .56 * r, .2 * r, .06 * r); ink(g, '#FFFFFF', 1.8);
    line(g, [-.28 * r, .3 * r, .28 * r, .3 * r], 1.2);
  } else {
    brows(g, E, .5, 2.2);
    g.beginPath(); g.arc(.04 * r, .1 * r, .2 * r, .18 * Math.PI, .82 * Math.PI); g.lineWidth = 2.2; g.strokeStyle = C.INK; g.stroke();
  }
  blush(g, -.56 * r, .06 * r, .11 * r); blush(g, .56 * r, .06 * r, .11 * r);
  A.face && A.face(g, r);
}

// ── Pupils (drawn at runtime, not baked into sprite) ─────────────────────
export function drawPupils(ctx, eyeDefs, cx, cy, targetX, targetY, r) {
  const a = Math.atan2(targetY - cy, targetX - cx);
  ctx.fillStyle = C.INK;
  for (const e of eyeDefs) {
    ctx.beginPath();
    ctx.arc(cx + e.x + Math.cos(a) * e.r * 0.36, cy + e.y + Math.sin(a) * e.r * 0.36, e.r * 0.52, 0, TAU);
    ctx.fill();
  }
}

// ── Sprite maker ──────────────────────────────────────────────────────────
function makeCanvas(r, drawFn) {
  const size = Math.ceil(r * 3.8 + 14);
  const c = document.createElement('canvas');
  c.width = c.height = size * SS;
  const g = c.getContext('2d');
  g.scale(SS, SS);
  g.translate(size / 2, size / 2);
  drawFn(g, r);
  return { canvas: c, size };
}

/** Register Phaser textures from canvas-drawn sprites */
export function registerTextures(scene) {
  const sizes = { email: 13, notif: 11, meeting: 20, bug: 15, customer: 18, boss: 46 };

  // Enemies
  for (const [type, r] of Object.entries(sizes)) {
    if (scene.textures.exists('e_' + type)) continue;
    const { canvas, size } = makeCanvas(r, (g, r) => ENEMY_ART[type].draw(g, r));
    scene.textures.addCanvas('e_' + type, canvas);

    // White flash version
    const fc = document.createElement('canvas'); fc.width = fc.height = canvas.width;
    const fg = fc.getContext('2d');
    fg.drawImage(canvas, 0, 0);
    fg.globalCompositeOperation = 'source-atop'; fg.fillStyle = '#FFFFFF'; fg.fillRect(0, 0, fc.width, fc.height);
    scene.textures.addCanvas('e_' + type + '_w', fc);
  }

  // Players (both normal and rage)
  const classes = ['developer', 'manager', 'designer', 'sales', 'chef', 'driver'];
  const PR = 15;
  for (const cls of classes) {
    for (const rage of [false, true]) {
      const key = `p_${cls}_${rage ? 1 : 0}`;
      if (scene.textures.exists(key)) continue;
      const { canvas } = makeCanvas(PR, (g, r) => drawPlayer(g, r, cls, rage));
      scene.textures.addCanvas(key, canvas);
    }
  }

  // Gem (EXP)
  if (!scene.textures.exists('gem')) {
    const gc = document.createElement('canvas'); gc.width = gc.height = 24;
    const gg = gc.getContext('2d');
    gg.translate(12, 12);
    gg.beginPath(); gg.moveTo(0, -9); gg.lineTo(7, -3); gg.lineTo(7, 4); gg.lineTo(0, 10); gg.lineTo(-7, 4); gg.lineTo(-7, -3); gg.closePath();
    gg.fillStyle = '#FFD447'; gg.fill(); gg.strokeStyle = C.INK; gg.lineWidth = 2; gg.stroke();
    scene.textures.addCanvas('gem', gc);
  }

  // Projectiles
  if (!scene.textures.exists('staple')) {
    const sc = document.createElement('canvas'); sc.width = 14; sc.height = 6;
    const sg = sc.getContext('2d');
    sg.fillStyle = '#8C95AB'; sg.fillRect(1, 1, 12, 4); sg.strokeStyle = C.INK; sg.lineWidth = 1.5; sg.strokeRect(1, 1, 12, 4);
    scene.textures.addCanvas('staple', sc);
  }
  if (!scene.textures.exists('plane')) {
    const pc = document.createElement('canvas'); pc.width = 24; pc.height = 16;
    const pg = pc.getContext('2d');
    pg.translate(12, 8);
    pg.beginPath(); pg.moveTo(-10, 2); pg.lineTo(10, 0); pg.lineTo(-10, -2); pg.closePath();
    pg.fillStyle = '#FFFFFF'; pg.fill(); pg.strokeStyle = C.INK; pg.lineWidth = 1.5; pg.stroke();
    scene.textures.addCanvas('plane', pc);
  }
  if (!scene.textures.exists('spark')) {
    const kc = document.createElement('canvas'); kc.width = 8; kc.height = 8;
    const kg = kc.getContext('2d'); kg.translate(4, 4);
    kg.fillStyle = '#2EC4B6'; circ(kg, 0, 0, 3.5); kg.fill(); kg.strokeStyle = C.INK; kg.lineWidth = 1.2; kg.stroke();
    scene.textures.addCanvas('spark', kc);
  }

  // Particle (circle)
  if (!scene.textures.exists('dot')) {
    const dc = document.createElement('canvas'); dc.width = dc.height = 8;
    const dg = dc.getContext('2d'); dg.fillStyle = '#FFFFFF'; dg.beginPath(); dg.arc(4, 4, 3.5, 0, TAU); dg.fill();
    scene.textures.addCanvas('dot', dc);
  }
}

/** Generate portrait data URL for menu display */
export function portraitDataURL(cls, r = 30) {
  const size = Math.ceil(r * 3.4);
  const c = document.createElement('canvas'); c.width = c.height = size * SS;
  const g = c.getContext('2d');
  g.scale(SS, SS); g.translate(size / 2, size / 2 + r * .28);
  drawPlayer(g, r, cls, false);
  // Pupils looking forward
  const E = PEYES(r);
  g.fillStyle = C.INK;
  for (const e of E) { circ(g, e.x + Math.cos(.35) * e.r * .36, e.y + Math.sin(1) * e.r * .36, e.r * .52); g.fill(); }
  return c.toDataURL();
}

/** Generate enemy portrait data URL for book screen */
export function enemyPortraitDataURL(type, r = 26) {
  const size = Math.ceil(r * 3.0);
  const c = document.createElement('canvas'); c.width = c.height = size * SS;
  const g = c.getContext('2d');
  g.scale(SS, SS); g.translate(size / 2, size / 2 + r * .1);
  ENEMY_ART[type].draw(g, r);
  const E = ENEMY_ART[type].eyes(r);
  g.fillStyle = C.INK;
  for (const e of E) { circ(g, e.x, e.y + e.r * .36, e.r * .52); g.fill(); }
  return c.toDataURL();
}
