/** BookScreen.jsx — Character & enemy almanac */
import { useState, useEffect } from 'preact/hooks';
import { CLASSES, ENEMIES } from '../game/data/gameData.js';
import { portraitDataURL, enemyPortraitDataURL } from '../game/art/SpriteFactory.js';

export function BookScreen({ onClose }) {
  const [portraits, setPortraits] = useState({});
  const [enemyPts, setEnemyPts] = useState({});

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

  const ENEMY_LABELS = {
    email:    { name: 'Email', desc: 'Đuổi thẳng, ra theo nhóm', pill: 'THƯỜNG' },
    notif:    { name: 'Thông báo', desc: 'Nhanh, ra theo bầy lớn', pill: 'THƯỜNG' },
    meeting:  { name: 'Cuộc họp', desc: 'Chậm, trâu, ít bị đẩy lùi', pill: 'TRÂU MÁU' },
    bug:      { name: 'Bug', desc: 'Developer gây thêm sát thương lên loại này', pill: 'BUG' },
    customer: { name: 'Khách hàng', desc: 'Gồng rồi lao thẳng vào bạn', pill: 'CHARGE' },
    boss:     { name: 'Deadline', desc: 'Bắn vòng giấy tờ, phase 2 ở 50% máu', pill: 'BOSS' },
  };

  return (
    <div class="ov" style={{ zIndex: 200, alignItems: 'flex-start', paddingTop: 24 }}>
      <div class="book">
        <div class="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div class="eyebrow">Stress Survivor · Art</div>
            <h2>Sổ tay văn phòng</h2>
          </div>
          <button class="btn primary" onClick={onClose}>Đóng</button>
        </div>

        <h3>Dòng nhân vật</h3>
        <div class="book-grid">
          {Object.entries(CLASSES).map(([key, cls]) => (
            <div key={key} class="bcard">
              {portraits[key]
                ? <img src={portraits[key]} alt={cls.name} />
                : <span style={{ fontSize: 48 }}>👤</span>}
              <b>{cls.name}</b>
              <small>{cls.line}</small>
              {!cls.soon && cls.passive && <span class="pill">{cls.passive}</span>}
              {cls.soon && <span class="pill" style={{ background: 'var(--common)', color: '#fff' }}>SẮP RA</span>}
            </div>
          ))}
        </div>

        <h3>Phiền toái văn phòng</h3>
        <div class="book-grid">
          {Object.entries(ENEMY_LABELS).map(([type, info]) => (
            <div key={type} class={`bcard${type === 'boss' ? ' boss' : ''}`}>
              {enemyPts[type]
                ? <img src={enemyPts[type]} alt={info.name} />
                : <span style={{ fontSize: 48 }}>👾</span>}
              <b>{info.name}</b>
              <small>{info.desc}</small>
              <span class={`pill${type === 'boss' ? '' : ''}`}>{info.pill}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
