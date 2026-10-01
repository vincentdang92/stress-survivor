/**
 * BattleScene.js — Main Phaser gameplay scene
 * Handles: player, enemies, projectiles, weapons, stress/rage, combo, waves, boss
 */
import Phaser from 'phaser';
import { bus } from '../../bus.js';
import { createRNG } from '../rng.js';
import { registerTextures, ENEMY_ART, drawPupils } from '../art/SpriteFactory.js';
import { SFX, initAudio } from '../audio/SFX.js';
import {
  ENEMIES, WAVES, CARD, CARDS, SYNERGIES, SYN, CLASSES,
  nextXp, RARITY_WEIGHT, PUNS, scaledHp
} from '../data/gameData.js';
import { C } from '../art/colors.js';
import { getUpgradeTier } from '../../screens/UpgradeScreen.jsx';

const TAU = Math.PI * 2;
const WORLD = 1200; // world half-extent (2400×2400 world)
const MAX_ENEMIES = 170;

export class BattleScene extends Phaser.Scene {
  constructor() { super('BattleScene'); }

  init(data) {
    this.cls = data.cls || 'developer';
    this.seed = data.seed || (Math.random() * 0xFFFFFFFF) >>> 0;
    this.trial = data.trial || false;
  }

  create() {
    this.rng = createRNG(this.seed);
    // Camera target — mutated each frame, camera follows it
    this._camTarget = { x: WORLD, y: WORLD };
    this._setupWorld();
    this._setupPlayer();
    this._setupPools();

    // Create graphics objects EARLY so they exist before first render
    this._gfx = this.add.graphics();
    this._gfx.setDepth(10);

    // Debug text — shows errors if render fails
    this._dbgText = this.add.text(20, 20, '', {
      fontSize: '14px', fill: '#ff0000',
      backgroundColor: '#000000', padding: { x: 4, y: 2 }
    });
    this._dbgText.setScrollFactor(0); // stays on screen, not world
    this._dbgText.setDepth(999);

    this._setupInput();
    this._setupBus();
    this._initBattle();
    this._setupCamera();
    try { registerTextures(this); } catch (e) { console.warn('[SpriteFactory]', e); }

    // ── Sprite pools (use registered textures) ──────────────────────────
    const SS = 2; // supersampling factor (must match SpriteFactory)
    const PR = 15; // player radius
    // Canvas px = Math.ceil(r*3.8+14)*SS — same formula as makeCanvas
    const playerCanvasPx = Math.ceil(PR * 3.8 + 14) * SS; // = 142
    // Scale so character appears as ~r*3 px (comfortable visibility)
    const playerDisplayPx = PR * 3.45; // +15% from r*3
    const playerSpriteScale = playerDisplayPx / playerCanvasPx; // ≈ 0.317

    // Player sprite — developer uses tier-specific texture
    const devTier = this.cls === 'developer' ? getUpgradeTier() : 0;
    this._devTier = devTier; // cache for rage swap
    const initSpriteKey = this.cls === 'developer'
      ? `p_developer_${devTier}_0`
      : `p_${this.cls}_0`;
    this._playerSprite = this.add.image(this.player.x, this.player.y, initSpriteKey);
    this._playerSprite.setScale(playerSpriteScale).setDepth(15);


    // Enemy sprite pool (MAX_ENEMIES)
    this._ePool = [];
    const ENEMY_R = { email: 13, notif: 11, meeting: 20, bug: 15, customer: 18, boss: 46 };
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const img = this.add.image(-9999, -9999, 'e_bug');
      img.setDepth(12).setVisible(false);
      this._ePool.push(img);
    }

    // Gem sprite pool
    this._gemPool = [];
    for (let i = 0; i < 60; i++) {
      const g2 = this.add.image(-9999, -9999, 'gem');
      g2.setDepth(8).setVisible(false).setScale(0.8);
      this._gemPool.push(g2);
    }

    // Bullet pools (player bullets)
    this._bPool = [];
    for (let i = 0; i < 120; i++) {
      const b = this.add.image(-9999, -9999, 'spark');
      b.setDepth(11).setVisible(false);
      this._bPool.push(b);
    }

    // HP pack pool
    this._hpPool = [];
    for (let i = 0; i < 10; i++) {
      const h = this.add.graphics();
      h.setDepth(8).setVisible(false);
      h.fillStyle(0xFF4D6D, 1);
      h.fillCircle(0, 0, 8);
      h.lineStyle(2, 0x1D1B2E, 1);
      h.strokeCircle(0, 0, 8);
      h.fillStyle(0xFFFFFF, 1);
      h.fillRect(-4, -1.5, 8, 3);
      h.fillRect(-1.5, -4, 3, 8);
      this._hpPool.push(h);
    }
  }


  // ── World setup ───────────────────────────────────────────────────────
  _setupWorld() {
    this.floorGfx = this.add.graphics();
    this._drawFloor();

    // Desks scattered around world
    this.desks = [];
    const positions = [
      [-400, -300], [200, -350], [-100, 100], [350, 200], [-350, 200],
      [0, -100], [150, -150], [-200, 0], [300, -100], [-300, 300],
    ];
    for (const [x, y] of positions) {
      this.desks.push({ x: x + WORLD / 2, y: y + WORLD / 2, seed: (this.rng.next() * 0xFFFFFF) | 0 });
    }
  }

  _drawFloor() {
    const g = this.floorGfx;
    g.clear();
    // Background
    g.fillStyle(0xE7EDF5); g.fillRect(0, 0, WORLD * 2, WORLD * 2);
    // Grid lines
    g.lineStyle(1, 0xD3D9E6, 0.5);
    for (let x = 0; x < WORLD * 2; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, WORLD * 2); g.strokePath(); }
    for (let y = 0; y < WORLD * 2; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(WORLD * 2, y); g.strokePath(); }
    // Carpet patches
    const carpetColors = [0xFFD447, 0x2EC4B6, 0xE8E4F2];
    const cr = this.rng;
    for (let i = 0; i < 8; i++) {
      const cx = cr.range(100, WORLD * 2 - 100), cy = cr.range(100, WORLD * 2 - 100);
      const cw = cr.range(120, 220), ch = cr.range(80, 160);
      g.fillStyle(carpetColors[i % 3], 0.18);
      g.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 14);
    }
  }

  // ── Player setup ──────────────────────────────────────────────────────
  _setupPlayer() {
    const C = CLASSES[this.cls];
    this.player = {
      x: WORLD, y: WORLD, // Center of world
      r: 15, hp: 100, maxHp: 100, stress: 0,
      lvl: 1, xp: 0, nextXp: nextXp(1),
      dashCd: 0, dashT: 0, dvx: 0, dvy: 0,
      rage: 0, hitFlash: 0, invincible: 0,
      moving: false, bob: 0,
      fx: 1, fy: 0, // facing direction
      // class-specific
      stamps: new Map(), // manager: enemy id → stamp count
      devTaps: 0,        // developer compile counter
      manageTapCd: 0,
    };
    this.cards = { [C.start]: 1 };
    this.weaponTimers = { [C.start]: 0.4 };
    this.orbitAngle = 0;
    this.taps = 0;
    this.tapTimes = [];
    this.rageTaps = 0;
    this.kills = 0;
    this.combo = 0; this.comboTimer = 0; this.maxCombo = 0;
    this.dmgDealt = 0;
    this.synActive = new Set();
    this._recompute();
  }

  _recompute() {
    // Load meta-upgrade bonuses from localStorage
    let upgBonuses = { hpBonus: 0, atkMul: 1, spdMul: 1, critBonus: 0, stressResist: 0, devIde: 0, devMouse: 0, devCompile: 0 };
    try {
      const u = JSON.parse(localStorage.getItem('ss_upgrades_v1') || '{}');
      upgBonuses = {
        hpBonus:      (u.hp  || 0) * 20,
        atkMul:       1 + (u.atk || 0) * 0.08,
        spdMul:       1 + (u.spd || 0) * 0.05,
        critBonus:    (u.crit || 0) * 0.04,
        stressResist: (u.stressResist || 0) * 0.08,
        devIde:       (u.dev_ide || 0) * 0.08,
        devMouse:     u.dev_mouse || 0,
        devCompile:   u.dev_compile || 0,
      };
    } catch { }

    const st = {
      dmgMul: upgBonuses.atkMul, atkSpd: 1,
      crit: 0.05 + upgBonuses.critBonus,
      moveMul: upgBonuses.spdMul, pickup: 70,
      dr: 0, stressGain: Math.max(0.3, 1 - upgBonuses.stressResist),
      regen: 0, extraProj: 0,
      burnAll: 0, burnMul: 1,
      bugMul: this.cls === 'developer' ? 1.3 : 1,
      maxHp: 100 + upgBonuses.hpBonus,
      devIdeMul: 1 - upgBonuses.devIde,
      devMouseExtra: upgBonuses.devMouse,
      devCompileBonus: upgBonuses.devCompile * 3,
    };
    for (const [id, lv] of Object.entries(this.cards)) {
      const c = CARD[id]; if (c.stat) c.stat(st, lv);
    }
    // Synergies
    const tags = this._tagCounts();
    const newSyn = new Set();
    for (const sy of SYNERGIES) {
      if (Object.entries(sy.need).every(([k, n]) => (tags[k] || 0) >= n)) {
        newSyn.add(sy.id); sy.apply(st);
        if (!this.synActive.has(sy.id)) {
          this._showBanner('SYNERGY · ' + SYN[sy.id].name, SYN[sy.id].desc, 'syn');
          SFX.level();
        }
      }
    }
    this.synActive = newSyn;
    st.dr = Math.min(0.6, st.dr);
    st.stressGain = Math.max(0.3, st.stressGain);
    st.maxHp = Math.max(40, st.maxHp);
    const oldMax = this.player.maxHp;
    this.player.maxHp = st.maxHp;
    if (st.maxHp > oldMax) this.player.hp += st.maxHp - oldMax;
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    this.stats = st;
    bus.emit('LOADOUT_UPDATE', { cards: this.cards, synActive: this.synActive, synergies: SYNERGIES, SYN });
  }


  _tagCounts(extraId) {
    const t = {};
    const ids = Object.keys(this.cards);
    if (extraId && !this.cards[extraId]) ids.push(extraId);
    for (const id of ids) for (const tag of CARD[id].tags) t[tag] = (t[tag] || 0) + 1;
    return t;
  }

  // ── Pools ─────────────────────────────────────────────────────────────
  _setupPools() {
    this.enemies = [];
    this.bullets = [];
    this.ebullets = []; // enemy bullets
    this.gems = [];
    this.particles = [];
    this.zones = [];    // burn zones
    this.decals = [];   // bug death decals
    this.damageTexts = [];
    this.orbitBullets = []; // mouse orbit
  }

  // ── Input ─────────────────────────────────────────────────────────────
  _setupInput() {
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      up2: Phaser.Input.Keyboard.KeyCodes.UP,
      down2: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left2: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right2: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      dash: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      rage: Phaser.Input.Keyboard.KeyCodes.SPACE,
      pause: Phaser.Input.Keyboard.KeyCodes.P,
      k1: Phaser.Input.Keyboard.KeyCodes.ONE,
      k2: Phaser.Input.Keyboard.KeyCodes.TWO,
      k3: Phaser.Input.Keyboard.KeyCodes.THREE,
    });

    // Mouse click = tap
    this.input.on('pointerdown', ptr => {
      initAudio();
      if (this.paused || this.state !== 'battle') return;
      const wx = ptr.x + this.cameras.main.scrollX;
      const wy = ptr.y + this.cameras.main.scrollY;
      this._handleTap(wx, wy, ptr.x, ptr.y);
    });

    // Touch joystick
    this.joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
    const COARSE = this.input.pointer1.motionFactor != null || window.matchMedia('(pointer: coarse)').matches;
    if (COARSE) {
      this.input.on('pointerdown', ptr => {
        if (ptr.x < this.scale.width / 2 && !this.joy.active) {
          this.joy.active = true; this.joy.id = ptr.id; this.joy.ox = ptr.x; this.joy.oy = ptr.y;
        }
      });
      this.input.on('pointermove', ptr => {
        if (ptr.id === this.joy.id) { this.joy.dx = ptr.x - this.joy.ox; this.joy.dy = ptr.y - this.joy.oy; }
      });
      this.input.on('pointerup', ptr => { if (ptr.id === this.joy.id) { this.joy.active = false; this.joy.dx = 0; this.joy.dy = 0; } });
    }

    // Keyboard events
    this.input.keyboard.on('keydown-P', () => { if (this.state === 'battle') this._pause(); });
    this.input.keyboard.on('keydown-SHIFT', () => { if (this.state === 'battle') bus.emit('DASH_PRESSED'); });
    this.input.keyboard.on('keydown-SPACE', () => { if (this.state === 'battle') bus.emit('RAGE_PRESSED'); });
    this.input.keyboard.on('keydown-J', () => {
      if (this.state === 'battle') {
        const cx = this.player.x, cy = this.player.y;
        this._handleTap(cx, cy, this.scale.width / 2, this.scale.height / 2);
      }
    });
  }

  // ── Bus listeners ─────────────────────────────────────────────────────
  _setupBus() {
    this._busOff = [
      bus.on('CARD_PICKED', ({ id }) => this._pickCard(id)),
      bus.on('PAUSE', () => this._pause()),
      bus.on('RESUME', () => this._resume()),
      bus.on('RAGE_PRESSED', () => this._tryRage()),
      bus.on('DASH_PRESSED', () => this._tryDash()),
      bus.on('QUIT_TO_MENU', () => {
        // Clean stop from inside the scene — most reliable approach
        this.paused = true;
        this.scene.stop('BattleScene');
      }),
    ];
  }


  // ── Battle init ───────────────────────────────────────────────────────
  _initBattle() {
    this.state = 'battle';
    this.elapsed = 0;
    this.waveIdx = -1;
    this.spawnAcc = 0;
    this.boss = null;
    this.bossSpawned = false;
    this.paused = false;
    this.pendingLevelUp = 0;
    this.offer = [];
    this.won = false;
    this.lost = false;
    this.hudTimer = 0;
    this.rageReadyShown = false;
    this.mash = null;

    // Trial mode: 30 seconds then end
    if (this.trial) this.trialTimeLeft = 30;

    bus.emit('BATTLE_STARTED', { cls: this.cls, trial: this.trial });
    this._showBanner('Ca làm bắt đầu!', '08:00 · Hộp thư đầy', 'wave');
  }

  _setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD * 2, WORLD * 2);
    // Position camera immediately on player start position
    cam.scrollX = this.player.x - cam.width / 2;
    cam.scrollY = this.player.y - cam.height / 2;
  }


  // ── Update loop ───────────────────────────────────────────────────────
  update(time, rawDt) {
    if (this.paused || this.state !== 'battle') return;
    const dt = Math.min(rawDt / 1000, 0.05); // cap at 50ms
    this.elapsed += dt;
    if (this.trial) { this.trialTimeLeft -= dt; if (this.trialTimeLeft <= 0) { this._endBattle(false, true); return; } }

    this._updatePlayer(dt);
    // Process pending terminal bursts
    if (this._pendingTerminal?.length) {
      this._pendingTerminal = this._pendingTerminal.filter(t => {
        t.delay -= dt;
        if (t.delay > 0) return true;
        // Burst!
        const dmg = t.dmg;
        for (let i = 0; i < t.count; i++) {
          const ang = (i / t.count) * Math.PI * 2;
          this.bullets.push({ x: t.x, y: t.y, vx: Math.cos(ang)*380, vy: Math.sin(ang)*380, dmg, tex: 'staple', life: 1.0, pierce: 2, burn: this.stats.burnAll });
        }
        this.particles.push({ type: 'ring', x: t.x, y: t.y, r: 0, maxR: 100, life: 0.3, max: 0.3, color: 0x2EC4B6 });
        SFX.boom();
        return false;
      });
    }
    this._updateWeapons(dt);
    this._updateOrbit(dt);
    this._updateBullets(dt);
    this._updateEnemies(dt);
    this._updateEBullets(dt);
    this._updateGems(dt);
    this._updateZones(dt);
    this._updateParticles(dt);
    this._updateDamageTexts(dt);
    this._updateCombo(dt);
    this._updateStress(dt);
    this._updateWaves(dt);
    this._checkBoss(dt);
    this._checkRegen(dt);
    this._updateHUD(dt);
    this._checkLevelUp();
    try { this._render(); } catch (e) { console.error('[render]', e); }
    this._cameraFollow();
  }

  // ── Player update ─────────────────────────────────────────────────────
  _updatePlayer(dt) {
    const p = this.player;
    const st = this.stats;
    const spd = 160 * st.moveMul * (p.rage > 0 ? 1.2 : 1);

    // Movement
    let mx = 0, my = 0;
    if (this.keys.left.isDown || this.keys.left2.isDown) mx -= 1;
    if (this.keys.right.isDown || this.keys.right2.isDown) mx += 1;
    if (this.keys.up.isDown || this.keys.up2.isDown) my -= 1;
    if (this.keys.down.isDown || this.keys.down2.isDown) my += 1;

    if (this.joy.active) { mx = this.joy.dx; my = this.joy.dy; }

    if (mx !== 0 || my !== 0) {
      const len = Math.sqrt(mx * mx + my * my) || 1;
      mx /= len; my /= len;
      p.moving = true;
      if (p.dashT <= 0) { p.x += mx * spd * dt; p.y += my * spd * dt; }
      if (Math.abs(mx) > 0.1 || Math.abs(my) > 0.1) { p.fx = mx; p.fy = my; }
      p.bob += dt * 8;
    } else {
      p.moving = false;
    }

    // Dash
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dvx * dt; p.y += p.dvy * dt;
      p.invincible = Math.max(p.invincible, p.dashT);
      if (p.dashT <= 0) p.dashT = 0;
    }

    // Rage countdown
    if (p.rage > 0) { p.rage -= dt; if (p.rage < 0) p.rage = 0; }

    // Hit flash
    if (p.hitFlash > 0) p.hitFlash -= dt;
    if (p.invincible > 0) p.invincible -= dt;

    // Bound to world
    p.x = Phaser.Math.Clamp(p.x, 30, WORLD * 2 - 30);
    p.y = Phaser.Math.Clamp(p.y, 30, WORLD * 2 - 30);

    // Manage stamp cooldown
    if (p.manageTapCd > 0) p.manageTapCd -= dt;
  }

  // ── Weapons ───────────────────────────────────────────────────────────
  _updateWeapons(dt) {
    const p = this.player;
    const st = this.stats;
    const spdMul = st.atkSpd * (p.rage > 0 ? 1.6 : 1);

    for (const id of Object.keys(this.cards)) {
      const c = CARD[id];
      if (c.type !== 'weapon') continue;
      const lv = this.cards[id];

      if (id === 'mouse') continue; // orbit, handled separately

      if (this.weaponTimers[id] == null) this.weaponTimers[id] = 0;
      this.weaponTimers[id] -= dt * spdMul;

      if (this.weaponTimers[id] > 0) continue;

      let cd = typeof c.cd === 'function' ? c.cd(lv) : (c.cd || 1);
      if (['terminal', 'hotfix', 'deploy', 'mouse'].includes(id)) {
        cd *= (this.stats.devIdeMul || 1);
      }
      this.weaponTimers[id] = cd;

      const extraProj = st.extraProj;

      switch (id) {
        case 'stapler': this._fireStapler(lv, extraProj); break;
        case 'plane':   this._firePlane(lv, extraProj); break;
        case 'coffee':  this._fireCoffee(lv, extraProj); break;
        case 'keyboard': this._fireKeyboard(lv); break;
        case 'hotfix':  this._fireHotfix(lv, extraProj); break;
        case 'terminal': this._fireTerminal(lv, extraProj); break;
        case 'deploy':   this._fireDeploy(lv, extraProj); break;
      }
    }
  }

  _fireStapler(lv, extra) {
    const p = this.player;
    const target = this._nearest(p.x, p.y);
    if (!target) return;
    const count = (lv >= 5 ? 3 : lv >= 3 ? 2 : 1) + extra;
    const dx = target.x - p.x, dy = target.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const dmg = Math.round(9 * (1 + 0.25 * (lv - 1)));
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.15;
      const angle = Math.atan2(dy, dx) + spread;
      this.bullets.push({ x: p.x, y: p.y, vx: Math.cos(angle) * 480, vy: Math.sin(angle) * 480, dmg, tex: 'staple', life: 1.2, pierce: 1, burn: this.stats.burnAll });
    }
    SFX.shoot();
  }

  _firePlane(lv, extra) {
    const p = this.player;
    const angle = Math.atan2(p.fy, p.fx) || 0;
    const count = 1 + extra;
    const dmg = Math.round(18 * (1 + 0.25 * (lv - 1)));
    const pierce = 2 + lv;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.2;
      const a = angle + spread;
      this.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 350, vy: Math.sin(a) * 350, dmg, tex: 'plane', life: 2.0, pierce, burn: this.stats.burnAll, rot: a });
    }
    SFX.shoot();
  }

  _fireCoffee(lv, extra) {
    const p = this.player;
    const target = this._nearest(p.x, p.y) || { x: p.x, y: p.y - 200 };
    const count = (lv >= 4 ? 2 : 1) + (extra > 0 ? 1 : 0);
    const dmg = Math.round(28 * (1 + 0.25 * (lv - 1)));
    const radius = 70 + 10 * lv;
    for (let i = 0; i < count; i++) {
      const ang = Math.atan2(target.y - p.y, target.x - p.x) + (i - (count - 1) / 2) * 0.3;
      const tx = p.x + Math.cos(ang) * 200, ty = p.y + Math.sin(ang) * 200;
      this.bullets.push({
        x: p.x, y: p.y, tx, ty, vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300,
        dmg, tex: 'dot', life: 0.7, pierce: 99, aoe: radius, isCoffee: true,
        burn: this.stats.burnAll, burnZone: true, burnMul: this.stats.burnMul
      });
    }
    SFX.boom();
  }

  _fireKeyboard(lv) {
    const p = this.player;
    const radius = 100 + 15 * lv;
    const dmg = Math.round(22 * (1 + 0.25 * (lv - 1)));
    // AOE wave: hits all enemies in radius, pushes them, deletes their bullets
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < radius + e.r) {
        const ang = Math.atan2(e.y - p.y, e.x - p.x);
        this._hurtEnemy(e, dmg, { kx: Math.cos(ang) * 280, ky: Math.sin(ang) * 280 });
      }
    }
    // Delete nearby enemy bullets
    for (const b of this.ebullets) {
      if (!b.dead && Math.hypot(b.x - p.x, b.y - p.y) < radius + 40) b.dead = true;
    }
    // Visual wave ring
    this.particles.push({ type: 'ring', x: p.x, y: p.y, r: 0, maxR: radius, life: 0.4, max: 0.4, color: 0xFFD447 });
    this.cameras.main.shake(200, 0.008);
    SFX.boom();
  }

  _fireHotfix(lv, extra) {
    const p = this.player;
    const maxBounce = 3 + lv;
    const dmg = Math.round(24 * (1 + 0.25 * (lv - 1)));
    let target = this._nearest(p.x, p.y);
    if (!target) return;
    const hit = new Set([target]);
    let cx = p.x, cy = p.y;
    for (let i = 0; i < maxBounce; i++) {
      this.bullets.push({
        x: cx, y: cy, vx: 0, vy: 0,
        dmg, tex: 'spark', life: 0.05, pierce: 1,
        zap: true, zapTo: target, burn: this.stats.burnAll,
        bugX: 2
      });
      this.particles.push({ type: 'zap', x1: cx, y1: cy, x2: target.x, y2: target.y, life: 0.12, max: 0.12 });
      cx = target.x; cy = target.y;
      const next = this._nearest(cx, cy, 250, hit);
      if (!next) break;
      hit.add(next); target = next;
    }
    SFX.zap();
  }

  _fireTerminal(lv, extra) {
    const p = this.player;
    const dmg = Math.round(14 * (1 + 0.25 * (lv - 1)));
    const count = 4 + lv + extra;
    // Delayed burst: push a pending terminal burst
    if (!this._pendingTerminal) this._pendingTerminal = [];
    this._pendingTerminal.push({ x: p.x, y: p.y, delay: 0.6, dmg, count });
    // Visual indicator
    this.particles.push({ type: 'ring', x: p.x, y: p.y, r: 0, maxR: 60, life: 0.6, max: 0.6, color: 0x2EC4B6 });
    SFX.shoot();
  }

  _fireDeploy(lv, extra) {
    const p = this.player;
    const dmg = Math.round(45 * (1 + 0.25 * (lv - 1)));
    const radius = 90 + 15 * lv;
    const count = (lv >= 3 ? 2 : 1) + (extra > 0 ? 1 : 0);
    // Find cluster center (average position of up to 5 nearest enemies)
    const nearby = this.enemies
      .filter(e => !e.dead)
      .sort((a, b) => Math.hypot(a.x-p.x,a.y-p.y) - Math.hypot(b.x-p.x,b.y-p.y))
      .slice(0, 5);
    if (nearby.length === 0) return;
    const cx = nearby.reduce((s,e)=>s+e.x,0)/nearby.length;
    const cy = nearby.reduce((s,e)=>s+e.y,0)/nearby.length;
    for (let i = 0; i < count; i++) {
      const ang = Math.atan2(cy - p.y, cx - p.x) + (i - (count-1)/2) * 0.25;
      this.bullets.push({
        x: p.x, y: p.y,
        vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420,
        dmg, tex: 'dot', life: 1.4, pierce: 99,
        aoe: radius, isCoffee: true,
        burn: this.stats.burnAll + 12, burnZone: true, burnMul: this.stats.burnMul
      });
    }
    this.cameras.main.shake(220, 0.01);
    SFX.boom();
  }

  // ── Orbit (mouse weapon) ──────────────────────────────────────────────
  _updateOrbit(dt) {
    const lv = this.cards['mouse'];
    if (!lv) return;
    const p = this.player;
    const count = (lv >= 5 ? 4 : lv >= 3 ? 3 : 2) + (this.stats.devMouseExtra || 0);
    const dmg = Math.round(11 * (1 + 0.25 * (lv - 1)));
    const orbitR = 60 + count * 5;
    this.orbitAngle += dt * (2 + 0.3 * lv) * (p.rage > 0 ? 1.6 : 1);

    // Orbit bullets track positions
    while (this.orbitBullets.length < count) this.orbitBullets.push({ hitTimer: 0 });
    while (this.orbitBullets.length > count) this.orbitBullets.pop();

    for (let i = 0; i < count; i++) {
      const a = this.orbitAngle + (i / count) * TAU;
      const ob = this.orbitBullets[i];
      ob.px = ob.x; ob.py = ob.y;
      ob.x = p.x + Math.cos(a) * orbitR;
      ob.y = p.y + Math.sin(a) * orbitR;
      if (ob.hitTimer > 0) { ob.hitTimer -= dt; continue; }

      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - ob.x, e.y - ob.y) < e.r + 8) {
          this._hurtEnemy(e, dmg, { burn: this.stats.burnAll });
          ob.hitTimer = 0.3;
          break;
        }
      }
    }
  }

  // ── Bullets ───────────────────────────────────────────────────────────
  _updateBullets(dt) {
    for (const b of this.bullets) {
      if (b.dead) continue;
      if (b.zap) { b.life -= dt; if (b.life <= 0) b.dead = true; continue; }
      if (b.isCoffee) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0) {
          // Explode
          this._coffeeExplosion(b);
          b.dead = true; continue;
        }
      } else {
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0 || b.x < 0 || b.x > WORLD * 2 || b.y < 0 || b.y > WORLD * 2) { b.dead = true; continue; }
      }

      // Hit enemies
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 5) {
          const kdir = Math.atan2(b.vy, b.vx);
          const bspd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          this._hurtEnemy(e, b.dmg, {
            kx: Math.cos(kdir) * bspd * 0.15, ky: Math.sin(kdir) * bspd * 0.15,
            burn: b.burn || 0, bugX: b.bugX || 1
          });
          b.pierce = (b.pierce || 1) - 1;
          if (b.pierce <= 0) { b.dead = true; break; }
        }
      }
    }
    this.bullets = this.bullets.filter(b => !b.dead);
  }

  _coffeeExplosion(b) {
    const { x, y, aoe, dmg, burn, burnZone, burnMul } = b;
    this.particles.push({ type: 'ring', x, y, r: 0, maxR: aoe, life: 0.3, max: 0.3, color: 0xFF8A3D });
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - x, e.y - y) < aoe + e.r) this._hurtEnemy(e, dmg, { burn });
    }
    if (burnZone) {
      this.zones.push({ x, y, r: aoe * 0.6, life: 3, max: 3, dmgPerSec: 7 * (burnMul || 1), tickTimer: 0 });
    }
    SFX.boom();
  }

  // ── Enemy bullets ─────────────────────────────────────────────────────
  _updateEBullets(dt) {
    const p = this.player;
    for (const b of this.ebullets) {
      if (b.dead) continue;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -100 || b.x > WORLD * 2 + 100 || b.y < -100 || b.y > WORLD * 2 + 100) { b.dead = true; continue; }
      if (p.invincible > 0 || p.dashT > 0) continue;
      if (Math.hypot(p.x - b.x, p.y - b.y) < p.r + 5) { this._hurtPlayer(b.dmg); b.dead = true; }
    }
    this.ebullets = this.ebullets.filter(b => !b.dead);
  }

  // ── Enemies ───────────────────────────────────────────────────────────
  _updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;

      // Knockback
      if (e.kvx || e.kvy) {
        e.x += e.kvx * dt; e.y += e.kvy * dt;
        const decay = Math.pow(0.08, dt); e.kvx *= decay; e.kvy *= decay;
        if (Math.abs(e.kvx) < 1 && Math.abs(e.kvy) < 1) { e.kvx = 0; e.kvy = 0; }
      }

      // AI movement
      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      let spd = e.T.spd;

      if (e.T.charge) {
        // Customer: charge mechanic
        e.chargeTimer = (e.chargeTimer || 0) - dt;
        if (e.chargeTimer <= 0 && !e.charging) {
          e.winding = (e.winding || 0) + dt;
          if (e.winding > 0.6) { e.charging = true; e.winding = 0; e.chargeTimer = 2.5 + this.rng.range(0, 1); }
          spd *= 0.4; // slow while winding
        } else if (e.charging) {
          spd *= 4.4;
          if (dist < e.r + p.r + 5) { e.charging = false; e.chargeTimer = 2 + this.rng.range(0, 1.5); }
        }
      }

      e.x += (dx / dist) * spd * dt;
      e.y += (dy / dist) * spd * dt;

      // Boss behavior
      if (e.T.boss) this._updateBoss(e, dt, dx, dy, dist);

      // Burn zones
      for (const z of this.zones) {
        if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) {
          z.tickTimer -= dt;
          if (z.tickTimer <= 0) { z.tickTimer = 0.5; this._hurtEnemy(e, z.dmgPerSec * 0.5); }
        }
      }

      // Collide with player
      if (p.invincible <= 0 && p.dashT <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) {
        this._hurtPlayer(e.T.dmg * dt * 2);
      }

      // Flash decay
      if (e.flash > 0) e.flash -= dt;

      // Clamp to world
      e.x = Phaser.Math.Clamp(e.x, 30, WORLD * 2 - 30);
      e.y = Phaser.Math.Clamp(e.y, 30, WORLD * 2 - 30);
    }

    // Remove dead enemies
    this.enemies = this.enemies.filter(e => !e.dead);
  }

  _updateBoss(boss, dt, dx, dy, dist) {
    boss.shotTimer = (boss.shotTimer || 0) - dt;
    if (boss.shotTimer <= 0) {
      if (boss.phase === 2) {
        // Phase 2: 16-bullet ring + 3 aimed at player
        this._bossShoot(boss, 16, false);
        for (let i = 0; i < 3; i++) {
          const angle = Math.atan2(dy, dx) + (i - 1) * 0.25;
          this.ebullets.push({ x: boss.x, y: boss.y, vx: Math.cos(angle) * 280, vy: Math.sin(angle) * 280, dmg: boss.T.dmg, life: 4 });
        }
        // Spawn email minions
        if (this.enemies.length < MAX_ENEMIES - 5) {
          for (let i = 0; i < 3; i++) this._spawnEnemy('email');
        }
        boss.shotTimer = 1.8;
      } else {
        this._bossShoot(boss, 10, false);
        boss.shotTimer = 2.3;
      }
      SFX.bossShot();
    }
  }

  _bossShoot(boss, count, aimed) {
    const p = this.player;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU + (this.elapsed * 0.5);
      this.ebullets.push({ x: boss.x, y: boss.y, vx: Math.cos(angle) * 220, vy: Math.sin(angle) * 220, dmg: boss.T.dmg * 0.6, life: 5 });
    }
  }

  // ── Gems ──────────────────────────────────────────────────────────────
  _updateGems(dt) {
    const p = this.player;
    const pickupR = this.stats.pickup;
    for (const gem of this.gems) {
      if (gem.collected) continue;
      const d = Math.hypot(gem.x - p.x, gem.y - p.y);
      if (d < pickupR) gem.homing = true;
      if (gem.homing) {
        const ang = Math.atan2(p.y - gem.y, p.x - gem.x);
        gem.x += Math.cos(ang) * 300 * dt; gem.y += Math.sin(ang) * 300 * dt;
        if (Math.hypot(gem.x - p.x, gem.y - p.y) < p.r + 8) {
          gem.collected = true; this._giveXp(gem.xp);
        }
      }
    }
    this.gems = this.gems.filter(g => !g.collected);
  }

  // ── Zones ─────────────────────────────────────────────────────────────
  _updateZones(dt) {
    for (const z of this.zones) z.life -= dt;
    this.zones = this.zones.filter(z => z.life > 0);
  }

  // ── Particles ─────────────────────────────────────────────────────────
  _updateParticles(dt) {
    for (const pt of this.particles) {
      pt.life -= dt;
      if (pt.type === 'burst') { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 180 * dt; }
      if (pt.type === 'ring') { pt.r += (pt.maxR / pt.max) * dt * 2; }
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  // ── Damage texts ──────────────────────────────────────────────────────
  _updateDamageTexts(dt) {
    for (const t of this.damageTexts) { t.y -= 70 * dt; t.life -= dt; t.alpha = Math.min(1, t.life * 3); }
    this.damageTexts = this.damageTexts.filter(t => t.life > 0);
  }

  // ── Combo ─────────────────────────────────────────────────────────────
  _updateCombo(dt) {
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
  }

  // ── Stress ───────────────────────────────────────────────────────────
  _updateStress(dt) {
    const p = this.player;
    const st = this.stats;
    // Passive stress gain
    p.stress += 0.45 * dt * st.stressGain;
    // Combo bonus
    if (this.combo > 0 && this.combo % 10 === 0) p.stress += 6 * st.stressGain;
    p.stress = Phaser.Math.Clamp(p.stress, 0, 100);

    // Rage drain
    if (p.rage > 0) { p.stress -= (100 / 7) * dt; p.stress = Math.max(0, p.stress); }

    if (p.stress >= 100 && !this.rageReadyShown) {
      this.rageReadyShown = true;
      bus.emit('RAGE_READY', {});
    }
  }

  _updateWaves(dt) {
    const t = this.elapsed;
    let currentWave = WAVES[0];
    let newWaveIdx = 0;
    for (let i = WAVES.length - 1; i >= 0; i--) {
      if (t >= WAVES[i].t) { currentWave = WAVES[i]; newWaveIdx = i; break; }
    }
    if (newWaveIdx !== this.waveIdx) {
      this.waveIdx = newWaveIdx;
      if (currentWave.boss && !this.bossSpawned) {
        this._spawnBoss();
      } else {
        this._showBanner(currentWave.name, currentWave.sub, 'wave');
      }
    }
    // Spawn enemies
    if (!this.bossSpawned || this.boss) {
      const rate = currentWave.rate * 1.5;
      this.spawnAcc += dt;
      if (this.spawnAcc >= 1 / rate && this.enemies.length < MAX_ENEMIES) {
        this.spawnAcc = 0;
        this._spawnFromWave(currentWave);
      }
    }
  }

  _spawnFromWave(wave) {
    const types = Object.keys(wave.mix);
    const weights = Object.values(wave.mix);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.rng.next() * total;
    let type = types[0];
    for (let i = 0; i < types.length; i++) { r -= weights[i]; if (r <= 0) { type = types[i]; break; } }
    this._spawnEnemy(type);
  }

  _spawnEnemy(type) {
    const T = ENEMIES[type];
    const p = this.player;
    const angle = this.rng.next() * TAU;
    const dist = 350 + this.rng.next() * 150;
    const x = Phaser.Math.Clamp(p.x + Math.cos(angle) * dist, T.r + 10, WORLD * 2 - T.r - 10);
    const y = Phaser.Math.Clamp(p.y + Math.sin(angle) * dist, T.r + 10, WORLD * 2 - T.r - 10);
    const hp = scaledHp(T.hp, this.elapsed);
    this.enemies.push({
      type, T, x, y, r: T.r, hp, maxHp: hp, dead: false,
      kvx: 0, kvy: 0, flash: 0, burnStacks: [],
      stamps: 0, chargeTimer: 2, charging: false, winding: 0,
      shotTimer: 1, phase: 1,
    });
  }

  _spawnBoss() {
    this.bossSpawned = true;
    const p = this.player;
    const T = ENEMIES['boss'];
    this.boss = {
      type: 'boss', T, x: p.x + 400, y: p.y,
      r: T.r, hp: T.hp, maxHp: T.hp, dead: false,
      kvx: 0, kvy: 0, flash: 0, burnStacks: [], stamps: 0,
      chargeTimer: 0, charging: false, winding: 0,
      shotTimer: 1, phase: 1,
    };
    this.enemies.push(this.boss);
    this._showBanner('⏰ DEADLINE!', '10:00 · Boss xuất hiện', 'wave');
    bus.emit('BOSS_PHASE_CHANGED', { phase: 1, hp: T.hp, maxHp: T.hp });
    this.cameras.main.shake(500, 0.015);
  }

  _checkBoss(dt) {
    if (!this.boss) return;
    const boss = this.boss;
    if (boss.dead) {
      this.boss = null;
      this._endBattle(true);
      return;
    }
    // Phase 2 at 50% HP
    if (boss.hp <= boss.maxHp * 0.5 && boss.phase === 1) {
      boss.phase = 2;
      this._showBanner('OVERTIME!', 'Phase 2 · Boss nổi điên', 'rage');
      bus.emit('BOSS_PHASE_CHANGED', { phase: 2, hp: boss.hp, maxHp: boss.maxHp });
      this.cameras.main.shake(600, 0.02);
      SFX.boom();
      // Start mash
      this._startMash();
    }
    bus.emit('BOSS_HP', { hp: boss.hp, maxHp: boss.maxHp, phase: boss.phase });
  }

  _startMash() {
    this.mash = { count: 0, timer: 3, done: false };
    bus.emit('MASH_START', {});
  }

  // ── Regen ─────────────────────────────────────────────────────────────
  _checkRegen(dt) {
    const regen = this.stats.regen;
    if (regen > 0) { this.player.hp = Math.min(this.player.hp + regen * dt, this.player.maxHp); }
  }

  // ── HUD ticker ────────────────────────────────────────────────────────
  _updateHUD(dt) {
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1; // 10/s max
      const p = this.player;
      const t = this.elapsed;
      const gameMin = Math.floor(t / 60);
      const gameSec = Math.floor(t % 60);
      const gameHr = 8 + Math.floor(t / 60);
      const clockStr = `${String(gameHr).padStart(2, '0')}:${String(gameSec).padStart(2, '0')}`;
      bus.emit('HUD_TICK', {
        hp: p.hp, maxHp: p.maxHp, stress: p.stress,
        lvl: p.lvl, xp: p.xp, nextXp: p.nextXp,
        kills: this.kills, taps: this.taps,
        combo: this.combo, rageActive: p.rage > 0, rageCd: p.dashCd,
        dashCd: p.dashCd, clock: clockStr,
        wave: WAVES[this.waveIdx]?.name || '',
        rageReady: p.stress >= 100,
      });
    }
  }

  // ── Combat ────────────────────────────────────────────────────────────
  _hurtEnemy(e, baseDmg, opts = {}) {
    if (e.dead) return;
    const st = this.stats;
    let d = baseDmg * st.dmgMul * (this.player.rage > 0 ? 1.5 : 1);
    if (e.T.bug) d *= st.bugMul * (opts.bugX || 1);
    if (this.cls === 'manager' && e.stamps > 0) d *= 1.15;
    const crit = this.rng.next() < st.crit;
    if (crit) d *= 2;
    d = Math.max(1, Math.round(d));
    e.hp -= d; e.flash = 0.09; this.dmgDealt += d;

    if (opts.kx !== undefined) { e.kvx += opts.kx * e.T.kb; e.kvy += opts.ky * e.T.kb; }
    if (opts.burn > 0 || st.burnAll > 0) {
      const bd = (opts.burn || 0) + st.burnAll;
      e.burnStacks.push({ dmg: bd * st.burnMul, t: 3 });
    }

    // Damage text
    const col = crit ? '#FFD447' : e.T.bug ? '#7BD66B' : '#FFFFFF';
    this.damageTexts.push({ x: e.x + (this.rng.next() - 0.5) * 12, y: e.y - e.r - 10, txt: d, color: col, life: 0.7, alpha: 1 });

    SFX.hit();
    if (e.hp <= 0) this._killEnemy(e);
  }

  _killEnemy(e) {
    e.dead = true; this.kills++;
    // Earn gold: 5 per normal kill, 20 for boss
    const goldEarned = e.T.boss ? 20 : 5;
    try {
      const u = JSON.parse(localStorage.getItem('ss_upgrades_v1') || '{}');
      u.gold = (u.gold || 0) + goldEarned;
      localStorage.setItem('ss_upgrades_v1', JSON.stringify(u));
    } catch { }
    // Gold pop animation — float up from kill position
    this.damageTexts.push({
      x: e.x + (this.rng.next() - 0.5) * 20,
      y: e.y - e.r - 5,
      txt: `+${goldEarned} 🪙`,
      color: '#FFD447',
      life: 1.3, alpha: 1, pun: true,  // pun=true → bigger font in renderer
    });
    // Combo
    const now = this.elapsed;
    if (now - this.comboTimer < 2.5) { this.combo++; if (this.combo > this.maxCombo) this.maxCombo = this.combo; SFX.combo(); }
    else this.combo = 1;
    this.comboTimer = now;
    // Stress bonus per combo×10
    if (this.combo % 10 === 0) this.player.stress = Math.min(100, this.player.stress + 6 * this.stats.stressGain);

    // Drop gems
    for (let i = 0; i < e.T.xp; i++) {
      this.gems.push({ x: e.x + this.rng.range(-12, 12), y: e.y + this.rng.range(-12, 12), xp: 1, homing: false, collected: false });
    }
    // Drop health (from meeting/customer)
    if ((e.type === 'meeting' || e.type === 'customer') && this.rng.bool(0.25)) {
      this.gems.push({ x: e.x, y: e.y, xp: 0, hp: 25, homing: false, collected: false, isHp: true });
    }

    // Boss defeat
    if (e.T.boss) { this.boss = null; this._endBattle(true); return; }

    // Death fx (particles)
    this._deathFx(e);
    SFX.kill();
  }

  _deathFx(e) {
    const colors = { email: [0xFFFFFF, 0xFF4D6D], notif: [0xFFD447], meeting: [0xFFFFFF, 0xFF4D6D], bug: [0x7BD66B], customer: [0xFF8A3D, 0xFFFFFF] };
    const cols = colors[e.type] || [0xFFFFFF];
    for (const col of cols) {
      for (let i = 0; i < (e.type === 'boss' ? 50 : 8); i++) {
        const a = this.rng.next() * TAU, v = this.rng.range(60, 280);
        this.particles.push({ type: 'burst', x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: this.rng.range(0.3, 0.7), max: 0.7, color: col, size: this.rng.range(3, 6) });
      }
    }
    // Bug decal
    if (e.type === 'bug') this.decals.push({ x: e.x, y: e.y, r: e.r * 1.1, life: 6, color: 0x9BDD8C });
    // Pun text
    const punList = PUNS[e.type];
    if (punList && this.rng.bool(0.25)) {
      this.damageTexts.push({ x: e.x, y: e.y - e.r - 18, txt: this.rng.pick(punList), color: '#FFD447', life: 1.0, alpha: 1, pun: true });
    }
  }

  _hurtPlayer(dmg) {
    const p = this.player;
    if (p.invincible > 0 || p.dashT > 0) return;
    const st = this.stats;
    const actual = Math.max(1, Math.round(dmg * (1 - st.dr)));
    p.hp -= actual;
    p.stress = Math.min(100, p.stress + actual * 1.4 * st.stressGain);
    p.hitFlash = 0.15; p.invincible = 0.3;
    this.cameras.main.shake(120, 0.006);
    SFX.hurt();
    if (p.hp <= 0) { p.hp = 0; this._endBattle(false); }
  }

  // ── Tap handling ──────────────────────────────────────────────────────
  _handleTap(wx, wy, sx, sy) {
    initAudio();
    this.taps++;
    this.tapTimes.push(this.elapsed);
    // Trim old taps (keep last 2s)
    while (this.tapTimes.length > 0 && this.elapsed - this.tapTimes[0] > 2) this.tapTimes.shift();

    // Mash during boss phase change
    if (this.mash && !this.mash.done) {
      this.mash.count++;
      bus.emit('MASH_UPDATE', { count: this.mash.count });
      this.boss && (this.boss.hp -= 30 + this.mash.count * 2);
    }

    // Rage mash
    if (this.player.rage > 0) {
      this.rageTaps++;
      // Shockwave at player
      const p = this.player;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 60) this._hurtEnemy(e, 15);
      }
      SFX.tap(); return;
    }

    // Class-specific tap
    switch (this.cls) {
      case 'developer': this._devTap(wx, wy); break;
      case 'manager':   this._managerTap(wx, wy); break;
      default:          this._genericTap(wx, wy); break;
    }
    SFX.tap();
  }

  _devTap(wx, wy) {
    const dmg = 12 + this.stats.dmgMul * 3;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - wx, e.y - wy) < e.r + 30) { this._hurtEnemy(e, dmg); break; }
    }
    this.devTaps = (this.devTaps || 0) + 1;
    const compileThreshold = Math.max(8, 20 - (this.stats.devCompileBonus || 0));
    if (this.devTaps >= compileThreshold) {
      this.devTaps = 0;
      // Compile: 16 bullets outward
      const p = this.player;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        this.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, dmg: 20, tex: 'spark', life: 1.0, pierce: 3, burn: this.stats.burnAll });
      }
      this._showBanner('COMPILE!', 'Developer skill', 'rage');
      SFX.boom();
    }
  }

  _managerTap(wx, wy) {
    if (this.player.manageTapCd > 0) return;
    this.player.manageTapCd = 0.15;
    // Stamp closest enemy to tap point
    let best = null, bd = 60;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - wx, e.y - wy);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      best.stamps = (best.stamps || 0) + 1;
      this.damageTexts.push({ x: best.x, y: best.y - 20, txt: best.stamps >= 3 ? 'TỪ CHỐI!' : 'DUYỆT', color: best.stamps >= 3 ? '#FF4D6D' : '#7B5CFF', life: 0.8, alpha: 1 });
      if (best.stamps >= 3) {
        // Explode: AOE and chain stamps
        best.stamps = 0;
        this._hurtEnemy(best, 60);
        for (const e2 of this.enemies) {
          if (e2 === best || e2.dead) continue;
          if (Math.hypot(e2.x - best.x, e2.y - best.y) < 120) {
            e2.stamps = (e2.stamps || 0) + 1;
            this._hurtEnemy(e2, 30);
          }
        }
        this.particles.push({ type: 'ring', x: best.x, y: best.y, r: 0, maxR: 120, life: 0.3, max: 0.3, color: 0xFF4D6D });
        SFX.boom();
      }
    }
  }

  _genericTap(wx, wy) {
    const dmg = 8 + this.stats.dmgMul * 2;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - wx, e.y - wy) < e.r + 25) { this._hurtEnemy(e, dmg); break; }
    }
  }

  // ── Rage / Dash ───────────────────────────────────────────────────────
  _tryRage() {
    const p = this.player;
    if (p.stress < 100) return;
    // Shockwave
    const radius = 280;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < radius + e.r) {
        const ang = Math.atan2(e.y - p.y, e.x - p.x);
        this._hurtEnemy(e, 40, { kx: Math.cos(ang) * 200, ky: Math.sin(ang) * 200 });
      }
    }
    // Clear nearby bullets
    for (const b of this.ebullets) { if (Math.hypot(b.x - p.x, b.y - p.y) < radius + 40) b.dead = true; }
    this.particles.push({ type: 'ring', x: p.x, y: p.y, r: 0, maxR: radius, life: 0.5, max: 0.5, color: 0xFF4D6D });

    p.stress = 0; p.rage = 7;
    this.rageTaps = 0;
    this.rageReadyShown = false;
    this._showBanner('RAGE!', '7 giây', 'rage');
    this.cameras.main.shake(300, 0.012);
    SFX.rage();
  }

  _tryDash() {
    const p = this.player;
    if (p.dashCd > 0) return;
    p.dashCd = 1.1; p.dashT = 0.17;
    const len = Math.sqrt(p.fx * p.fx + p.fy * p.fy) || 1;
    p.dvx = (p.fx / len) * 520; p.dvy = (p.fy / len) * 520;
    p.invincible = 0.17;
    SFX.dash();
  }

  // ── XP / Level ────────────────────────────────────────────────────────
  _giveXp(xp) {
    const p = this.player;
    if (xp > 0) { p.xp += xp; while (p.xp >= p.nextXp) { p.xp -= p.nextXp; p.lvl++; p.nextXp = nextXp(p.lvl); this.pendingLevelUp++; } }
  }

  _checkLevelUp() {
    if (this.pendingLevelUp > 0 && this.offer.length === 0) {
      this.pendingLevelUp--;
      this.paused = true;
      const offer = this._buildOffer();
      this.offer = offer;
      bus.emit('LEVEL_UP', { lvl: this.player.lvl, cards: offer });
      SFX.level();
    }
  }

  _buildOffer() {
    // Pick 3 cards weighted by rarity and biased by class
    const cls = CLASSES[this.cls];
    const bias = cls?.bias;
    const pool = [...CARDS];
    const pick = [];
    const tries = 40;
    for (let attempt = 0; attempt < tries && pick.length < 3; attempt++) {
      // Weighted rarity
      const rarityRoll = this.rng.next() * (6 + 3.2 + 1.6);
      const rarity = rarityRoll < 6 ? 'common' : rarityRoll < 9.2 ? 'rare' : 'epic';
      const candidates = pool.filter(c => c.rarity === rarity && !pick.includes(c));
      if (candidates.length === 0) continue;
      // Bias: prefer cards with class tag
      const biased = candidates.filter(c => bias && c.tags.includes(bias));
      const chosen = this.rng.pick(biased.length > 0 && this.rng.bool(0.55) ? biased : candidates);
      // Compute synergy hints
      const currentLv = this.cards[chosen.id] || 0;
      const tags = this._tagCounts(chosen.id);
      const unlocks = SYNERGIES.filter(sy =>
        !this.synActive.has(sy.id) &&
        Object.entries(sy.need).every(([k, n]) => (tags[k] || 0) >= n) &&
        !SYNERGIES.find(s => s.id === sy.id && this.synActive.has(s.id))
      );
      pick.push({ ...chosen, currentLv, unlocks });
    }
    // Fill with random if short
    while (pick.length < 3) pick.push({ ...this.rng.pick(CARDS), currentLv: 0, unlocks: [] });
    return pick;
  }

  _pickCard(id) {
    const lv = (this.cards[id] || 0) + 1;
    this.cards[id] = Math.min(lv, 5);
    if (!this.weaponTimers[id] && CARD[id].type === 'weapon') this.weaponTimers[id] = 0;
    this._recompute();
    this.offer = [];
    this.paused = false;
    SFX.pick();
  }

  // ── End battle ────────────────────────────────────────────────────────
  _endBattle(won, trial = false) {
    this.state = 'ended';
    this.paused = true;
    if (won) SFX.win(); else SFX.lose();
    bus.emit('BATTLE_COMPLETED', {
      won, trial,
      stats: {
        kills: this.kills, combo: this.maxCombo,
        taps: this.taps, dmg: this.dmgDealt,
        time: this.elapsed, lvl: this.player.lvl,
      },
      cards: this.cards, synActive: [...this.synActive],
    });
  }

  // ── Pause ─────────────────────────────────────────────────────────────
  _pause() { this.paused = true; bus.emit('PAUSED', {}); }
  _resume() { this.paused = false; }

  // ── Nearest enemy ─────────────────────────────────────────────────────
  _nearest(x, y, maxD = 1e9, skip) {
    let best = null, bestD = maxD * maxD;
    for (const e of this.enemies) {
      if (e.dead || (skip && skip.has(e))) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // ── Banner ────────────────────────────────────────────────────────────
  _showBanner(title, sub, kind) {
    bus.emit('BANNER', { title, sub, kind });
  }

  // ── Camera follow ─────────────────────────────────────────────────────
  _cameraFollow() {
    const cam = this.cameras.main;
    const tx = this.player.x - cam.width / 2;
    const ty = this.player.y - cam.height / 2;
    // Lerp toward player
    cam.scrollX += (tx - cam.scrollX) * 0.1;
    cam.scrollY += (ty - cam.scrollY) * 0.1;
    // Clamp to world bounds
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, WORLD * 2 - cam.width);
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, WORLD * 2 - cam.height);
  }

  // ── Render ────────────────────────────────────────────────────────────
  _render() {
    const cam = this.cameras.main;
    const g = this._gfx;
    g.clear();

    // Hide debug text in production (keep for now as position indicator)
    if (this._dbgText) this._dbgText.setVisible(false);

    // ── Decals (blood/impact splats on floor) ──────────────────────
    for (const d of this.decals) {
      if (d.life <= 0) continue;
      g.fillStyle(d.color, 0.5 * (d.life / 6)); g.fillCircle(d.x, d.y, d.r);
    }
    this.decals = this.decals.filter(d => (d.life -= 0.016) > 0);

    // ── Burn zones ────────────────────────────────────────────────
    for (const z of this.zones) {
      const a = (z.life / z.max) * 0.35;
      g.fillStyle(0xFF8A3D, a); g.fillCircle(z.x, z.y, z.r);
      g.lineStyle(2.5, 0xFF4D6D, a * 1.5); g.strokeCircle(z.x, z.y, z.r);
    }

    // ── Particles ─────────────────────────────────────────────────
    for (const pt of this.particles) {
      const a = Math.min(1, pt.life / (pt.max || 0.5));
      if (pt.type === 'burst') {
        g.fillStyle(pt.color, a); g.fillCircle(pt.x, pt.y, pt.size || 4);
      } else if (pt.type === 'ring') {
        g.lineStyle(4, pt.color, a); g.strokeCircle(pt.x, pt.y, pt.r);
      } else if (pt.type === 'zap') {
        g.lineStyle(2, 0x2EC4B6, a);
        g.beginPath(); g.moveTo(pt.x1, pt.y1); g.lineTo(pt.x2, pt.y2); g.strokePath();
      }
    }

    // ── HP packs ──────────────────────────────────────────────────
    let hpIdx = 0;
    for (const gem of this.gems) {
      if (!gem.isHp) continue;
      if (hpIdx < this._hpPool.length) {
        const h = this._hpPool[hpIdx++];
        h.setPosition(gem.x, gem.y).setVisible(true);
      }
    }
    for (let i = hpIdx; i < this._hpPool.length; i++) this._hpPool[i].setVisible(false);

    // ── EXP Gems (sprite pool) ─────────────────────────────────────
    let gemIdx = 0;
    for (const gem of this.gems) {
      if (gem.isHp || gemIdx >= this._gemPool.length) continue;
      const gs = this._gemPool[gemIdx++];
      gs.setPosition(gem.x, gem.y).setVisible(true);
    }
    for (let i = gemIdx; i < this._gemPool.length; i++) this._gemPool[i].setVisible(false);

    // ── Player bullets ────────────────────────────────────────────
    let bIdx = 0;
    for (const b of this.bullets) {
      if (b.dead || bIdx >= this._bPool.length) continue;
      const bs = this._bPool[bIdx++];
      bs.setTexture(b.tex || 'spark');
      bs.setPosition(b.x, b.y).setVisible(true);
      // Rotate toward velocity
      if (b.vx !== undefined) bs.setRotation(Math.atan2(b.vy, b.vx));
    }
    for (let i = bIdx; i < this._bPool.length; i++) this._bPool[i].setVisible(false);

    // ── Enemy bullets ─────────────────────────────────────────────
    for (const b of this.ebullets) {
      if (b.dead) continue;
      g.fillStyle(0xFF4D6D, 0.9);
      g.fillCircle(b.x, b.y, 5);
      g.lineStyle(2, 0x1D1B2E, 1);
      g.strokeCircle(b.x, b.y, 5);
    }

    // ── Orbit bullets ────────────────────────────────────────────
    for (const ob of this.orbitBullets) {
      if (!ob.x) continue;
      g.fillStyle(0x8C95AB, 1); g.fillCircle(ob.x, ob.y, 7);
      g.lineStyle(2.5, 0x1D1B2E, 1); g.strokeCircle(ob.x, ob.y, 7);
    }

    // ── Enemies (sprite pool) ─────────────────────────────────────
    let eIdx = 0;
    for (const e of this.enemies) {
      if (e.dead || eIdx >= this._ePool.length) continue;
      const es = this._ePool[eIdx++];
      const texKey = e.flash > 0 ? `e_${e.type}_w` : `e_${e.type}`;
      const tex = this.textures.exists(texKey) ? texKey : (this.textures.exists(`e_${e.type}`) ? `e_${e.type}` : 'e_bug');
      es.setTexture(tex);
      es.setPosition(e.x, e.y);
      // Correct scale: canvasPx = Math.ceil(r*3.8+14)*2, display = r*3
      const canvasPx = Math.ceil(e.r * 3.8 + 14) * 2;
      es.setScale((e.r * 3.45) / canvasPx).setVisible(true);

      // Charge ring indicator (drawn on _gfx)
      if (e.charging) {
        g.lineStyle(3, 0xFF4D6D, 0.8);
        g.strokeCircle(e.x, e.y, e.r + 6);
      }
      // Winding telegraph
      if (e.type === 'customer' && e.winding > 0.3) {
        g.lineStyle(4, 0xFF4D6D, Math.min(1, e.winding * 2));
        g.strokeCircle(e.x, e.y, e.r + 8 + e.winding * 10);
      }
      // Stamp dots (manager ability)
      if (e.stamps > 0) {
        for (let i = 0; i < e.stamps; i++) {
          g.fillStyle(0x7B5CFF, 1);
          g.fillCircle(e.x - e.r + i * 10 + 5, e.y - e.r - 10, 5);
          g.lineStyle(1.5, 0x1D1B2E, 1);
          g.strokeCircle(e.x - e.r + i * 10 + 5, e.y - e.r - 10, 5);
        }
      }
    }
    for (let i = eIdx; i < this._ePool.length; i++) this._ePool[i].setVisible(false);

    // ── Player sprite ─────────────────────────────────────────────
    if (this._playerSprite) {
      const p = this.player;
      const rage = p.rage > 0;
      const rageKey = this.cls === 'developer'
        ? `p_developer_${this._devTier ?? 0}_${rage ? 1 : 0}`
        : `p_${this.cls}_${rage ? 1 : 0}`;
      if (this.textures.exists(rageKey)) this._playerSprite.setTexture(rageKey);
      this._playerSprite.setPosition(p.x, p.y);
      this._playerSprite.setAlpha(p.hitFlash > 0 ? 0.4 : 1);
      // Flip toward facing direction
      this._playerSprite.setFlipX(p.fx < 0);

      // Dash trail
      if (p.dashT > 0) {
        g.fillStyle(0xFFFFFF, p.dashT * 0.5);
        g.fillCircle(p.x, p.y, 22);
      }
      // Invincible shimmer ring
      if (p.invincible > 0 && p.dashT <= 0) {
        g.lineStyle(2.5, 0xFFD447, (Math.sin(Date.now() * 0.015) * 0.4 + 0.6));
        g.strokeCircle(p.x, p.y, 22);
      }
    }
  }


  // ── Shutdown ──────────────────────────────────────────────────────────
  shutdown() {
    for (const off of (this._busOff || [])) off();
    this._busOff = [];
  }
}
