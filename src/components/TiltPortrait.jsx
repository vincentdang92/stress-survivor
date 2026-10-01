/**
 * TiltPortrait.jsx
 * CSS 3D perspective tilt — gyroscope on mobile, mouse on desktop.
 * Drop-in wrapper: <TiltPortrait src={url} size={80} />
 */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function TiltPortrait({ src, size = 80, maxDeg = 14, className = '', style = {} }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const wrapRef = useRef(null);
  const gyroAvail = useRef(false);

  // ── Gyroscope (mobile) ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (e.gamma == null) return;
      gyroAvail.current = true;
      setTilt({
        x: clamp(e.gamma / 22, -1, 1),         // left-right
        y: clamp((e.beta - 30) / 22, -1, 1),   // forward-back
      });
    };

    // iOS 13+ needs explicit permission — request on first touch
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      const onTouch = () => {
        DeviceOrientationEvent.requestPermission()
          .then(state => { if (state === 'granted') window.addEventListener('deviceorientation', handler, { passive: true }); })
          .catch(() => {});
        document.removeEventListener('touchstart', onTouch);
      };
      document.addEventListener('touchstart', onTouch, { once: true });
    } else {
      window.addEventListener('deviceorientation', handler, { passive: true });
    }
    return () => window.removeEventListener('deviceorientation', handler);
  }, []);

  // ── Mouse (desktop, only if gyro inactive) ────────────────────────────
  const onMouseMove = useCallback(e => {
    if (gyroAvail.current) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTilt({
      x: clamp(((e.clientX - rect.left) / rect.width  - 0.5) * 2, -1, 1),
      y: clamp(((e.clientY - rect.top)  / rect.height - 0.5) * 2, -1, 1),
    });
  }, []);

  const onMouseLeave = useCallback(() => {
    if (!gyroAvail.current) setTilt({ x: 0, y: 0 });
  }, []);

  const transform = `perspective(300px) rotateY(${tilt.x * maxDeg}deg) rotateX(${-tilt.y * maxDeg}deg) scale(1.05)`;

  return (
    <div
      ref={wrapRef}
      class="tilt-wrap"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ display: 'inline-block', ...style }}
    >
      {src && (
        <img
          src={src}
          width={size}
          height={size}
          class={`tilt-img ${className}`}
          style={{ transform, width: size, height: size, display: 'block' }}
          draggable={false}
        />
      )}
    </div>
  );
}
