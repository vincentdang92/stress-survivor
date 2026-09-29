// LoadingScreen.jsx
// Shows animated loading bar while Phaser boots
// Art: dark (#1D1B2E) background, yellow loading bar, sticker-style
import { useState, useEffect } from 'preact/hooks';

const TIPS = [
  'Mở email là mất 15 phút...',
  'Cuộc họp này lẽ ra là một email.',
  'Works on my machine 🤷',
  'Đang debug production...',
  'Uống cà phê trước khi chiến!',
];

const DEV_FRAMES = ['💻', '🖥️', '⌨️', '🖱️'];

export function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [devFrame, setDevFrame] = useState(0);

  // Animate progress 0→100 over ~2 seconds (simulated)
  useEffect(() => {
    let p = 0;
    const id = setInterval(() => {
      p += Math.random() * 18 + 8;
      if (p >= 100) { p = 100; clearInterval(id); }
      setProgress(Math.min(100, p));
    }, 120);
    return () => clearInterval(id);
  }, []);

  // Cycle loading tips every 1.5 s
  useEffect(() => {
    const id = setInterval(() => {
      setTipIndex(i => (i + 1) % TIPS.length);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // Animate developer icon
  useEffect(() => {
    const id = setInterval(() => {
      setDevFrame(f => (f + 1) % DEV_FRAMES.length);
    }, 400);
    return () => clearInterval(id);
  }, []);

  const done = progress >= 100;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999,
      background: '#1D1B2E',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '24px',
    }}>
      {/* Animated dev icon */}
      <div style={{ fontSize: 48, lineHeight: 1, transition: 'opacity 0.2s' }}>
        {DEV_FRAMES[devFrame]}
      </div>

      {/* Logo */}
      <div style={{ textAlign: 'center', lineHeight: 1.1 }}>
        <div style={{
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: 72,
          color: '#FFD447',
          textShadow: '4px 4px 0 rgba(0,0,0,0.4)',
          letterSpacing: '-1px',
        }}>
          STRESS
        </div>
        <div style={{
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: 28,
          color: '#2EC4B6',
          letterSpacing: '6px',
          marginTop: 4,
        }}>
          SURVIVOR
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{
          width: 280,
          height: 28,
          border: '3px solid #FFD447',
          borderRadius: 6,
          background: 'transparent',
          overflow: 'hidden',
        }}>
          <div style={{
            background: '#FFD447',
            height: '100%',
            width: `${progress}%`,
            transition: 'width 0.2s ease',
          }} />
        </div>
        <div style={{
          marginTop: 8,
          textAlign: 'center',
          fontFamily: 'var(--mono)',
          fontSize: 14,
          color: done ? '#FFD447' : '#aaa',
          fontWeight: done ? 700 : 400,
          transition: 'color 0.3s',
        }}>
          {done ? 'Xong! 🎉' : `Đang tải... ${Math.round(progress)}%`}
        </div>
      </div>

      {/* Cycling tip */}
      <div class="loading-tip">
        💡 {TIPS[tipIndex]}
      </div>
    </div>
  );
}
