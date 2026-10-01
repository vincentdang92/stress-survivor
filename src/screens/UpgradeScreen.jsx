// UpgradeScreen.jsx
// Outside-battle character upgrade screen — persistent via localStorage.
// Exports: getUpgrades, saveUpgrades, addGold, getUpgradeStats, UpgradeScreen
import { useState, useCallback } from 'preact/hooks';
import { pushPlayerData } from '../supabase.js';

// ─── Data helpers ────────────────────────────────────────────────────────────

const DEFAULTS = { gold: 0, hp: 0, atk: 0, spd: 0, crit: 0, stressResist: 0,
  dev_mouse: 0, dev_ide: 0, dev_compile: 0 };

export function getUpgrades() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('ss_upgrades_v1') || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveUpgrades(u) {
  localStorage.setItem('ss_upgrades_v1', JSON.stringify(u));
}

export function addGold(amount) {
  const u = getUpgrades();
  u.gold += amount;
  saveUpgrades(u);
  return u.gold;
}

/** Returns stat multipliers derived from purchased upgrade levels. */
export function getUpgradeStats() {
  const u = getUpgrades();
  return {
    hpBonus:      u.hp            * 20,
    atkMul:       1 + u.atk       * 0.08,
    spdMul:       1 + u.spd       * 0.05,
    critBonus:    u.crit          * 0.04,
    stressResist: u.stressResist  * 0.08,
  };
}

/**
 * Returns upgrade tier 0-4 based on total upgrade points spent.
 * Used to pick character portrait variant and in-game sprite.
 *   0 Rookie:      0-4 pts   (fresh start)
 *   1 Experienced: 5-9 pts   (+glasses +coffee)
 *   2 Veteran:     10-19 pts (+hoodie +headphone)
 *   3 Elite:       20-29 pts (+RGB keyboard +energy drink)
 *   4 Legendary:   30+ pts   (+aura +crown)
 */
export function getUpgradeTier() {
  const u = getUpgrades();
  const total = (u.hp || 0) + (u.atk || 0) + (u.spd || 0) + (u.crit || 0)
              + (u.stressResist || 0) + (u.dev_mouse || 0) + (u.dev_ide || 0) + (u.dev_compile || 0);
  if (total >= 30) return 4;
  if (total >= 20) return 3;
  if (total >= 10) return 2;
  if (total >= 5)  return 1;
  return 0;
}

// ─── Stat definitions ────────────────────────────────────────────────────────

const MAX_LVL = 5;

const STATS = [
  {
    key: 'hp',
    icon: '❤️',
    name: 'Max HP',
    costs: [50, 100, 200, 350, 500],
    bonusText: lvl => lvl > 0 ? `Max HP: ${100 + lvl * 20} (+${lvl * 20})` : 'Max HP: 100 → 120 → 140...',
  },
  {
    key: 'atk',
    icon: '⚔️',
    name: 'Sát thương',
    costs: [60, 120, 250, 400, 600],
    bonusText: lvl => lvl > 0 ? `+${lvl * 8}% ATK` : '+8% / cấp',
  },
  {
    key: 'spd',
    icon: '👟',
    name: 'Tốc độ',
    costs: [40, 80, 150, 280, 450],
    bonusText: lvl => lvl > 0 ? `+${lvl * 5}% SPD` : '+5% / cấp',
  },
  {
    key: 'crit',
    icon: '🎯',
    name: 'Chí mạng',
    costs: [70, 140, 280, 500, 750],
    bonusText: lvl => lvl > 0 ? `+${lvl * 4}% CRIT` : '+4% / cấp',
  },
  {
    key: 'stressResist',
    icon: '🧘',
    name: 'Kháng Stress',
    costs: [80, 160, 320, 550, 800],
    bonusText: lvl => lvl > 0 ? `-${lvl * 8}% stress` : '-8% stress / cấp',
  },
];

const DEV_STATS = [
  {
    key: 'dev_mouse',
    icon: '🖱️',
    name: 'Chuột Thêm Quỹ Đạo',
    costs: [80, 160, 300, 500, 750],
    bonusText: lvl => lvl > 0 ? `+${lvl} chuột bay quanh người` : '+1 chuột / cấp (max +5)',
  },
  {
    key: 'dev_ide',
    icon: '💻',
    name: 'IDE Turbo',
    costs: [70, 140, 260, 420, 620],
    bonusText: lvl => lvl > 0 ? `CD vũ khí Dev -${lvl * 8}%` : '-8% CD Hotfix, Terminal, Deploy / cấp',
  },
  {
    key: 'dev_compile',
    icon: '⚡',
    name: 'Tăng Tốc Compile',
    costs: [60, 120, 220, 380, 580],
    bonusText: lvl => lvl > 0 ? `Tap COMPILE cần ${Math.max(8, 20 - lvl * 3)} thay vì 20` : 'Giảm số tap cần để COMPILE (-3 tap / cấp)',
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function LevelDots({ current }) {
  return (
    <div class="upgrade-levels">
      {Array.from({ length: MAX_LVL }, (_, i) => (
        <div key={i} class={`upgrade-dot${i < current ? ' filled' : ''}`} />
      ))}
    </div>
  );
}

function UpgradeCard({ stat, level, gold, onBuy }) {
  const maxed   = level >= MAX_LVL;
  const cost    = maxed ? null : stat.costs[level];
  const canAfford = !maxed && gold >= cost;

  return (
    <div class="upgrade-card">
      <div class="upgrade-card-head">
        <span class="upgrade-card-icon">{stat.icon}</span>
        <span class="upgrade-card-name">{stat.name}</span>
      </div>

      <LevelDots current={level} />

      <div class="upgrade-bonus">{stat.bonusText(level)}</div>

      {maxed ? (
        <div class="upgrade-maxed">✨ Tối đa</div>
      ) : (
        <button
          class="btn upgrade-btn"
          disabled={!canAfford}
          onClick={() => canAfford && onBuy(stat.key, cost)}
        >
          Nâng (+{cost} vàng)
        </button>
      )}
    </div>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

/**
 * UpgradeScreen
 * @param {{ onClose: () => void }} props
 */
export function UpgradeScreen({ onClose }) {
  const [upgrades, setUpgrades] = useState(() => getUpgrades());

  const handleBuy = useCallback(async (key, cost) => {
    let next;
    setUpgrades(prev => {
      if (prev[key] >= MAX_LVL || prev.gold < cost) return prev;
      next = { ...prev, gold: prev.gold - cost, [key]: prev[key] + 1 };
      saveUpgrades(next);
      return next;
    });
    // Sync lên Supabase (fire & forget)
    if (next) pushPlayerData().catch(() => {});
  }, []);

  return (
    <div class="ov" style={{ zIndex: 200, alignItems: 'flex-start', paddingTop: 0, overflowY: 'auto' }}>
      <div class="upgrade-screen">
        {/* Header */}
        <div class="upgrade-header">
          <button class="btn" onClick={onClose}>← Quay lại</button>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18 }}>
            ⬆ Nâng cấp Developer
          </span>
          <span class="upgrade-gold">💰 {upgrades.gold} vàng</span>
        </div>

        {/* Character portrait */}
        <div class="upgrade-portrait">
          <div class="big-icon">💻</div>
          <h3>Dev Cứng Đầu</h3>
          <p>Chiến binh văn phòng bất khuất — sống sót qua mọi deadline.</p>
        </div>

        {/* Stat cards */}
        <div class="upgrade-grid">
          {STATS.map(stat => (
            <UpgradeCard
              key={stat.key}
              stat={stat}
              level={upgrades[stat.key]}
              gold={upgrades.gold}
              onBuy={handleBuy}
            />
          ))}
        </div>

        {/* Developer-specific section */}
        <div style={{ marginTop: 16 }}>
          <div class="eyebrow" style={{ marginBottom: 8 }}>⚙️ Nâng cấp Developer</div>
          <div class="upgrade-grid">
            {DEV_STATS.map(stat => (
              <UpgradeCard
                key={stat.key}
                stat={stat}
                level={upgrades[stat.key] || 0}
                gold={upgrades.gold}
                onBuy={handleBuy}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div class="upgrade-footer">
          💰 Vàng kiếm được: <b>5 vàng / địch hạ · 20 vàng / boss</b>
        </div>
      </div>
    </div>
  );
}

