/** BookScreen.jsx — Character almanac with detail panel */
import { useState, useEffect } from 'preact/hooks';
import { CLASSES, ENEMIES, CARDS } from '../game/data/gameData.js';
import { portraitDataURL, enemyPortraitDataURL } from '../game/art/SpriteFactory.js';
import { TiltPortrait } from '../components/TiltPortrait.jsx';
import { getUpgradeTier } from './UpgradeScreen.jsx';

function loadOwned() {
  try { const p = JSON.parse(localStorage.getItem('ss_profile_v1')); return p?.owned || ['developer']; } catch { return ['developer']; }
}

const ENEMY_LABELS = {
  email:    { name: 'Email',          desc: 'Đuổi thẳng, ra theo nhóm',                    pill: 'THƯỜNG' },
  notif:    { name: 'Thông báo',      desc: 'Nhanh, ra theo bầy lớn',                       pill: 'THƯỜNG' },
  meeting:  { name: 'Cuộc họp',      desc: 'Chậm, trâu, ít bị đẩy lùi',                   pill: 'TRÂU MÁU' },
  bug:      { name: 'Bug',            desc: 'Developer gây +30% sát thương lên loại này',   pill: 'BUG' },
  customer: { name: 'Khách hàng',    desc: 'Gồng rồi lao thẳng vào bạn',                   pill: 'CHARGE' },
  boss:     { name: 'Deadline',       desc: 'Bắn vòng giấy tờ, phase 2 ở 50% máu',         pill: 'BOSS' },
};

const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

function CharacterDetail({ cls, clsKey, portrait }) {
  // Locked / soon character → teaser only
  if (cls.soon) {
    return (
      <div class="book-detail">
        <div class="book-detail-head" style={{ filter: 'grayscale(1)', opacity: .6 }}>
          <span style={{ fontSize: 56 }}>🔒</span>
          <div>
            <h3 style={{ margin: '0 0 4px', font: '800 22px var(--display)' }}>{cls.name}</h3>
            <div style={{ font: '400 13px/1.5 var(--body)', color: '#666' }}>{cls.line}</div>
          </div>
        </div>
        <div class="book-detail-section" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🚧</div>
          <div style={{ font: '700 14px var(--display)', marginBottom: 6 }}>Đang phát triển</div>
          {cls.lore && (
            <div style={{ font: '400 12px/1.6 var(--body)', color: '#888', fontStyle: 'italic' }}>
              {cls.lore}
            </div>
          )}
          {cls.passive && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--paper)', border: 'var(--bd)', borderRadius: 8 }}>
              <div style={{ font: '700 11px var(--display)', color: 'var(--grape)', marginBottom: 3 }}>Passive: {cls.passive}</div>
              <div style={{ font: '400 11px var(--body)', color: '#666' }}>{cls.pdesc}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const weapons = (cls.weapons || []).map(id => CARD_BY_ID[id]).filter(Boolean);
  const passives = (cls.passives || []).map(id => CARD_BY_ID[id]).filter(Boolean);
  const tier = clsKey === 'developer' ? getUpgradeTier() : 0;
  const TIER_NAMES  = ['Rookie', 'Experienced', 'Veteran', 'Elite', 'Legendary'];
  const TIER_COLORS = ['#888', '#2EC4B6', '#7B5CFF', '#FF8A3D', '#FFD447'];

  return (
    <div class="book-detail">
      <div class="book-detail-head">
        {clsKey === 'developer' && portrait
          ? <TiltPortrait src={portraitDataURL('developer', 48, tier)} size={80} maxDeg={18} />
          : portrait
            ? <img src={portrait} alt={cls.name} class="book-detail-portrait" />
            : <span style={{ fontSize: 56 }}>👤</span>}
        <div>
          <h3 style={{ margin: '0 0 4px', font: '800 22px var(--display)' }}>{cls.name}</h3>
          <div style={{ font: '400 13px/1.5 var(--body)', color: '#666' }}>{cls.line}</div>
          {clsKey === 'developer' && (
            <span style={{
              display: 'inline-block', marginTop: 6,
              font: '700 11px var(--mono)',
              color: TIER_COLORS[tier],
              background: 'var(--paper2)',
              border: `1.5px solid ${TIER_COLORS[tier]}`,
              borderRadius: 6, padding: '2px 8px',
            }}>
              {['⚪','🟢','🔵','🟠','⭐'][tier]} {TIER_NAMES[tier]}
            </span>
          )}
          {cls.lore && <div style={{ font: '400 12px/1.5 var(--body)', color: '#888', marginTop: 6, fontStyle: 'italic' }}>{cls.lore}</div>}
        </div>
      </div>

      <div class="book-detail-section">
        <div class="eyebrow">Kỹ năng thụ động</div>
        <div class="book-ability">
          <span class="book-ability-name">{cls.passive}</span>
          <span class="book-ability-desc">{cls.pdesc}</span>
        </div>
      </div>

      <div class="book-detail-section">
        <div class="eyebrow">Kỹ năng tap</div>
        <div class="book-ability-desc">{cls.tap}</div>
      </div>

      {weapons.length > 0 && (
        <div class="book-detail-section">
          <div class="eyebrow">Vũ khí ({weapons.length})</div>
          <div class="book-card-list">
            {weapons.map(c => (
              <div key={c.id} class={`book-mini-card r-${c.rarity}`}>
                <span class="book-mini-icon">{c.icon}</span>
                <div>
                  <div style={{ font: '700 12px var(--display)', marginBottom: 2 }}>{c.name}</div>
                  <div style={{ font: '400 11px var(--body)', color: '#666' }}>{c.desc(1)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {passives.length > 0 && (
        <div class="book-detail-section">
          <div class="eyebrow">Vật phẩm ({passives.length})</div>
          <div class="book-card-list">
            {passives.map(c => (
              <div key={c.id} class={`book-mini-card r-${c.rarity}`}>
                <span class="book-mini-icon">{c.icon}</span>
                <div>
                  <div style={{ font: '700 12px var(--display)', marginBottom: 2 }}>{c.name}</div>
                  <div style={{ font: '400 11px var(--body)', color: '#666' }}>{c.desc(1)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function BookScreen({ onClose }) {
  const [portraits, setPortraits] = useState({});
  const [enemyPts, setEnemyPts] = useState({});
  const [tab, setTab] = useState('char'); // 'char' | 'enemy'
  const [selChar, setSelChar] = useState('developer');
  const owned = loadOwned();

  useEffect(() => {
    const pt = {};
    for (const cls of Object.keys(CLASSES)) {
      try { pt[cls] = portraitDataURL(cls, 42); } catch { }
    }
    setPortraits(pt);
    const ep = {};
    for (const type of Object.keys(ENEMIES)) {
      try { ep[type] = enemyPortraitDataURL(type, 36); } catch { }
    }
    setEnemyPts(ep);
  }, []);

  const selCls = CLASSES[selChar];

  return (
    <div class="ov" style={{ zIndex: 200, alignItems: 'flex-start', paddingTop: 0, overflowY: 'auto' }}>
      <div class="book">
        {/* Header */}
        <div class="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div class="eyebrow">Stress Survivor · Almanac</div>
            <h2>Sổ tay văn phòng</h2>
          </div>
          <button class="btn primary" onClick={onClose}>Đóng</button>
        </div>

        {/* Tabs */}
        <div class="book-tabs">
          <button class={`book-tab${tab === 'char' ? ' active' : ''}`} onClick={() => setTab('char')}>👤 Nhân vật</button>
          <button class={`book-tab${tab === 'enemy' ? ' active' : ''}`} onClick={() => setTab('enemy')}>👾 Kẻ thù</button>
        </div>

        {tab === 'char' && (
          <div class="book-char-layout">
            {/* Character list */}
            <div class="book-char-list">
              {Object.entries(CLASSES).map(([key, cls]) => {
                const isOwned = !cls.soon && (owned.includes(key) || key === 'developer');
                const isSelected = key === selChar;
                return (
                  <div
                    key={key}
                    class={`book-char-item${isSelected ? ' selected' : ''}${!isOwned ? ' locked' : ''}`}
                    onClick={() => setSelChar(key)}
                  >
                    {portraits[key]
                      ? <img src={portraits[key]} alt={cls.name} style={{ width: 40, height: 40 }} />
                      : <span style={{ fontSize: 28 }}>👤</span>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '700 13px var(--display)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.name}</div>
                      <div style={{ font: '400 11px var(--body)', color: '#888' }}>
                        {cls.soon ? '🔒 Sắp ra' : isOwned ? '✅ Mở khóa' : '🔒 Chưa mở'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Character detail */}
            <div class="book-char-detail">
              {selCls && <CharacterDetail cls={selCls} clsKey={selChar} portrait={portraits[selChar]} />}
            </div>
          </div>
        )}

        {tab === 'enemy' && (
          <>
            <h3>Phiền toái văn phòng</h3>
            <div class="book-grid">
              {Object.entries(ENEMY_LABELS).map(([type, info]) => (
                <div key={type} class={`bcard${type === 'boss' ? ' boss' : ''}`}>
                  {enemyPts[type]
                    ? <img src={enemyPts[type]} alt={info.name} />
                    : <span style={{ fontSize: 48 }}>👾</span>}
                  <b>{info.name}</b>
                  <small>{info.desc}</small>
                  <span class="pill">{info.pill}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
