// UpgradeScreen.jsx
// Outside-battle character upgrade screen — persistent via localStorage.
// Exports: getUpgrades, saveUpgrades, addGold, getUpgradeStats, UpgradeScreen
import { useState, useCallback } from 'preact/hooks';
import { pushPlayerData } from '../supabase.js';

// ─── Data helpers ────────────────────────────────────────────────────────────

const DEFAULTS = { gold: 0, hp: 0, atk: 0, spd: 0, crit: 0, stressResist: 0 };

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
    hpBonus:      u.hp            * 20,   // flat HP bonus
    atkMul:       1 + u.atk       * 0.08, // damage multiplier
    spdMul:       1 + u.spd       * 0.05, // speed multiplier
    critBonus:    u.crit          * 0.04, // crit chance bonus
    stressResist: u.stressResist  * 0.08, // reduce stress gain
  };
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

      {/* Footer */}
      <div class="upgrade-footer">
        Vàng kiếm được: 5 vàng / địch hạ
      </div>
    </div>
  );
}
