/** LevelUpOverlay.jsx — card selection screen */
import { useState, useEffect, useCallback } from 'preact/hooks';
import { bus } from '../bus.js';
import { SYN } from '../game/data/gameData.js';

function CardChoice({ card, index, onPick }) {
  const lv = card.currentLv || 0;
  const newLv = Math.min(lv + 1, 5);
  const rarClass = 'r-' + card.rarity;

  return (
    <button class={`card ${rarClass}`} onClick={() => onPick(card.id)} tabIndex={0}>
      <div class="ctop">
        <span class="cicon">{card.icon}</span>
        <div>
          <span class={`rar`}>{card.rarity}</span>
          <span class="ckey">{index + 1}</span>
        </div>
      </div>
      <div class="cname">{card.name}</div>
      <div class="clv">
        {lv === 0 ? 'Mới · Lv 1' : `Lv ${lv} → `}
        {lv > 0 && <b>Lv {newLv}</b>}
        {newLv === 5 && ' · TỐI ĐA'}
      </div>
      <p class="cdesc">{card.desc(newLv)}</p>
      <div class="tags">
        {card.tags.map(t => <span key={t} class="tag">{t}</span>)}
      </div>
      {(card.unlocks || []).map(sy => (
        <div key={sy.id} class="syn-hint">⚡ Kích hoạt {sy.name}</div>
      ))}
    </button>
  );
}

export function LevelUpOverlay() {
  const [offer, setOffer] = useState(null);
  const [lvl, setLvl] = useState(1);

  useEffect(() => {
    const off = bus.on('LEVEL_UP', ({ lvl, cards }) => {
      setLvl(lvl); setOffer(cards);
    });
    return off;
  }, []);

  const pick = useCallback(id => {
    bus.emit('CARD_PICKED', { id });
    setOffer(null);
  }, []);

  useEffect(() => {
    if (!offer) return;
    const handler = e => {
      if (e.key === '1') pick(offer[0]?.id);
      if (e.key === '2') pick(offer[1]?.id);
      if (e.key === '3') pick(offer[2]?.id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [offer, pick]);

  if (!offer) return null;
  return (
    <div class="ov ov-lvl">
      <div class="lvbox">
        <div class="eyebrow">Lên cấp {lvl}</div>
        <h2>Chọn <span>1 thẻ</span></h2>
        <div class="choices">
          {offer.map((card, i) => (
            <CardChoice key={`${card.id}_${i}`} card={card} index={i} onPick={pick} />
          ))}
        </div>
        <p class="hint">Phím 1 · 2 · 3 để chọn nhanh. Thẻ trùng sẽ lên cấp (tối đa Lv 5).</p>
      </div>
    </div>
  );
}
