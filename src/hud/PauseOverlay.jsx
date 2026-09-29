/** PauseOverlay.jsx */
import { useState, useEffect, useCallback } from 'preact/hooks';
import { bus } from '../bus.js';
import { getMuted, setMuted } from '../game/audio/SFX.js';

export function PauseOverlay() {
  const [visible, setVisible] = useState(false);
  const [muted, setMutedState] = useState(getMuted());
  const [autoTap, setAutoTap] = useState(false);

  useEffect(() => {
    const offs = [
      bus.on('PAUSED', () => setVisible(true)),
      bus.on('BATTLE_COMPLETED', () => setVisible(false)),
      bus.on('BATTLE_STARTED', () => setVisible(false)),
    ];
    const keyHandler = e => {
      if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && visible) resume();
    };
    window.addEventListener('keydown', keyHandler);
    return () => { offs.forEach(o => o()); window.removeEventListener('keydown', keyHandler); };
  }, [visible]);

  const resume    = useCallback(() => { setVisible(false); bus.emit('RESUME'); }, []);
  const restart   = useCallback(() => { setVisible(false); bus.emit('RESTART'); }, []);
  const goHome    = useCallback(() => { setVisible(false); bus.emit('QUIT_TO_MENU'); }, []);
  const toggleMute = useCallback(() => { const v = !getMuted(); setMuted(v); setMutedState(v); }, []);
  const toggleAuto = useCallback(() => setAutoTap(v => !v), []);

  if (!visible) return null;
  return (
    <div class="ov" style={{ zIndex: 200 }}>
      <div class="pz">
        <h2>Tạm dừng</h2>
        <button class="btn primary" onClick={resume}>▶ Tiếp tục</button>
        <button class="btn" onClick={restart}>🔄 Chơi lại từ 08:00</button>
        <button class="btn" onClick={toggleMute}>🔊 Âm thanh: {muted ? 'Tắt' : 'Bật'}</button>
        <button class="btn" onClick={toggleAuto}>👆 Giữ ngón = tự tap: {autoTap ? 'Bật' : 'Tắt'}</button>
        <hr style={{ borderColor: '#ffffff30', margin: '10px 0' }} />
        <button class="btn btn-danger" onClick={goHome}>🏠 Màn hình chính</button>
      </div>
    </div>
  );
}
