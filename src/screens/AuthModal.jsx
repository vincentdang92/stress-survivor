/** AuthModal.jsx — Login / Signup modal (Sticker Office style) */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import {
  signInWithEmail, signUpWithEmail, upgradeAnonToEmail, signOut,
  onAuthChange, getCurrentUser, pullPlayerData,
} from '../supabase.js';

// ── Debug log collector (chỉ dùng khi debug=true) ─────────────────────────────
const debugLogs = [];
function dbg(...args) {
  const line = args.map(a => {
    try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); } catch { return String(a); }
  }).join(' ');
  console.log('[AuthDebug]', ...args);
  debugLogs.push(`${new Date().toISOString().slice(11,19)} ${line}`);
  if (debugLogs.length > 50) debugLogs.shift();
}

// ── AuthForm — component hoàn toàn độc lập, inputs dùng useRef ────────────────
function AuthForm({ isLinkMode, onClose, onAuthSuccess, debug }) {
  const emailRef    = useRef(null);
  const passwordRef = useRef(null);
  const modeRef     = useRef(isLinkMode ? 'link' : 'signup');
  const [modeUI, setModeUI]   = useState(modeRef.current);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState({ text: '', type: '' });
  const [rawLog, setRawLog]   = useState('');

  const showMsg = (text, type = 'ok') => setMsg({ text, type });

  const switchMode = useCallback((m) => {
    modeRef.current = m;
    setModeUI(m);
    setMsg({ text: '', type: '' });
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const email    = (emailRef.current?.value    || '').trim();
    const password = (passwordRef.current?.value || '');
    const mode     = modeRef.current;

    if (!email)              return showMsg('Vui lòng nhập email.', 'err');
    if (!password)           return showMsg('Vui lòng nhập mật khẩu.', 'err');
    if (password.length < 6) return showMsg('Mật khẩu tối thiểu 6 ký tự.', 'err');

    setLoading(true);
    setMsg({ text: '', type: '' });
    setRawLog('');

    try {
      dbg('Submit', { mode, email });

      if (mode === 'link') {
        const res = await upgradeAnonToEmail(email, password);
        dbg('upgradeAnonToEmail result:', res);
        setRawLog(JSON.stringify(res, null, 2));
        if (res.error && /session|missing/i.test(res.error)) {
          const res2 = await signUpWithEmail(email, password);
          dbg('signUpWithEmail fallback:', res2);
          setRawLog(JSON.stringify(res2, null, 2));
          if (res2.error)          showMsg('Lỗi: ' + res2.error, 'err');
          else if (res2.needConfirm) showMsg('📧 Kiểm tra email để xác nhận!', 'ok');
          else                     { showMsg('✅ Tài khoản tạo thành công!', 'ok'); setTimeout(onClose, 1500); }
        } else if (res.error) {
          showMsg('Lỗi: ' + res.error, 'err');
        } else {
          showMsg('✅ Đã liên kết! Data đồng bộ.', 'ok');
          setTimeout(onClose, 1500);
        }
      } else if (mode === 'login') {
        const res = await signInWithEmail(email, password);
        dbg('signInWithEmail result:', res);
        setRawLog(JSON.stringify(res, null, 2));
        if (res.error) showMsg('Sai email hoặc mật khẩu. (' + res.error + ')', 'err');
        else {
          await pullPlayerData();
          showMsg('✅ Đăng nhập thành công!', 'ok');
          onAuthSuccess?.(res.user);
          setTimeout(onClose, 1200);
        }
      } else { // signup
        const res = await signUpWithEmail(email, password);
        dbg('signUpWithEmail result:', res);
        setRawLog(JSON.stringify(res, null, 2));
        if (res.error === 'EMAIL_EXISTS') {
          // Email đã tồn tại — Supabase enumeration protection mask lỗi
          showMsg('📭 Email này đã được đăng ký. Hãy chuyển sang Đăng nhập!', 'err');
          setTimeout(() => switchMode('login'), 2000);
        } else if (res.error) {
          showMsg('Lỗi: ' + res.error, 'err');
        } else if (res.needConfirm) {
          showMsg('📧 Kiểm tra email để xác nhận tài khoản!', 'ok');
        } else {
          showMsg('✅ Tài khoản tạo thành công!', 'ok');
          setTimeout(onClose, 1500);
        }
      }
    } catch (err) {
      const errStr = err?.message || JSON.stringify(err) || 'Unknown';
      dbg('Exception:', errStr);
      setRawLog('Exception: ' + errStr);
      showMsg('Lỗi: ' + errStr, 'err');
    }

    setLoading(false);
  }, [onClose, onAuthSuccess]);

  return (
    <>
      {modeUI === 'link' ? (
        <div class="auth-anon-notice">
          <span>⚠️</span>
          <span>Đang chơi <b>ẩn danh</b>. Nhập email để lưu data và đồng bộ nhiều thiết bị.</span>
        </div>
      ) : (
        <div class="auth-tabs">
          <button type="button"
            class={`auth-tab${modeUI === 'login' ? ' active' : ''}`}
            onPointerDown={() => switchMode('login')}>Đăng nhập</button>
          <button type="button"
            class={`auth-tab${modeUI === 'signup' ? ' active' : ''}`}
            onPointerDown={() => switchMode('signup')}>Đăng ký</button>
        </div>
      )}

      <form onSubmit={handleSubmit} class="auth-form">
        <div class="auth-field">
          <label>Email</label>
          <input
            ref={emailRef}
            type="email"
            class="lb-input"
            placeholder="you@example.com"
            autocomplete="email"
            autocorrect="off"
            autocapitalize="none"
            spellcheck={false}
          />
        </div>
        <div class="auth-field">
          <label>Mật khẩu</label>
          <input
            ref={passwordRef}
            type="password"
            class="lb-input"
            placeholder="Tối thiểu 6 ký tự"
            autocomplete={modeUI === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {msg.text && <div class={`auth-msg ${msg.type}`}>{msg.text}</div>}

        {/* Debug panel — hiện khi debug=true hoặc có rawLog */}
        {(debug || rawLog) && (
          <details class="auth-debug" open={!!rawLog}>
            <summary>🐛 Debug Log</summary>
            <pre class="auth-debug-pre">{debugLogs.slice(-10).join('\n')}</pre>
            {rawLog && (
              <>
                <strong style={{ fontSize: 11 }}>Raw API response:</strong>
                <pre class="auth-debug-pre">{rawLog}</pre>
              </>
            )}
          </details>
        )}

        <button class="btn primary" type="submit" disabled={loading}
          style={{ width: '100%', marginTop: 4, fontSize: 15 }}>
          {loading       ? 'Đang xử lý...'
            : modeUI === 'link'   ? '🔗 Liên kết & Lưu data'
            : modeUI === 'login'  ? '🚀 Đăng nhập'
            :                       '✨ Tạo tài khoản'}
        </button>
      </form>

      <div class="auth-footer">
        {modeUI === 'link'
          ? 'Vàng và nâng cấp sẽ được giữ nguyên.'
          : modeUI === 'login'
            ? 'Chưa có tài khoản? → tab Đăng ký'
            : 'Đã có tài khoản? → tab Đăng nhập'}
      </div>
    </>
  );
}

// ── AuthModal ─────────────────────────────────────────────────────────────────
export function AuthModal({ onClose, onAuthSuccess }) {
  const [loggedInEmail, setLoggedInEmail] = useState(null);
  const [isLinkMode, setIsLinkMode]       = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [debug, setDebug]                 = useState(false);
  const tapCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser().then(u => {
      if (cancelled) return;
      const anon = u ? (u.is_anonymous ?? !u.email) : true;
      dbg('getCurrentUser:', { uid: u?.id, anon, email: u?.email });
      if (u && !anon)      setLoggedInEmail(u.email);
      else if (u && anon)  setIsLinkMode(true);
    });
    const unsub = onAuthChange((event, session) => {
      if (cancelled) return;
      if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) return;
      dbg('onAuthChange:', event);
      const u = session?.user || null;
      const anon = u ? (u.is_anonymous ?? !u.email) : true;
      if (u && !anon) setLoggedInEmail(u.email);
      else { setLoggedInEmail(null); setIsLinkMode(!!(u && anon)); }
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  // Tap tiêu đề 5 lần để bật debug mode
  const handleTitleTap = () => {
    tapCount.current += 1;
    if (tapCount.current >= 5) { setDebug(true); tapCount.current = 0; }
  };

  const handleSignOut = async () => {
    setLogoutLoading(true);
    await signOut();
    setLoggedInEmail(null);
    setIsLinkMode(false);
    setLogoutLoading(false);
    onAuthSuccess?.(null);
  };

  if (loggedInEmail) {
    return (
      <div class="auth-overlay">
        <div class="auth-modal">
          <div class="auth-header">
            <h3 onClick={handleTitleTap}>👤 Tài khoản</h3>
            <button class="auth-close" type="button" onClick={onClose}>✕</button>
          </div>
          <div class="auth-logged-in">
            <div class="auth-avatar">✉️</div>
            <div class="auth-email">{loggedInEmail}</div>
            <div class="auth-badge ok">✅ Đã đồng bộ</div>
            <p style={{ fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 1.5 }}>
              Data nhân vật được lưu và đồng bộ tự động.
            </p>
            {debug && (
              <details class="auth-debug" open>
                <summary>🐛 Debug Log</summary>
                <pre class="auth-debug-pre">{debugLogs.slice(-10).join('\n')}</pre>
              </details>
            )}
            <button class="btn" style={{ width: '100%' }} type="button"
              onClick={handleSignOut} disabled={logoutLoading}>
              {logoutLoading ? '...' : '🚪 Đăng xuất'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="auth-overlay">
      <div class="auth-modal">
        <div class="auth-header">
          <h3 onClick={handleTitleTap}>{isLinkMode ? '🔗 Lưu tài khoản' : '👤 Đăng nhập'}</h3>
          <button class="auth-close" type="button" onClick={onClose}>✕</button>
        </div>
        <AuthForm
          key="auth-form-singleton"
          isLinkMode={isLinkMode}
          onClose={onClose}
          onAuthSuccess={onAuthSuccess}
          debug={debug}
        />
      </div>
    </div>
  );
}

/** Compact auth badge */
export function AuthBadge({ onClick }) {
  const [email, setEmail] = useState(null);
  useEffect(() => {
    getCurrentUser().then(u => {
      if (u && !(u.is_anonymous ?? !u.email)) setEmail(u.email);
    });
    return onAuthChange((event, session) => {
      if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) return;
      const u = session?.user || null;
      const anon = u ? (u.is_anonymous ?? !u.email) : true;
      setEmail(u && !anon ? u.email : null);
    });
  }, []);
  return (
    <button class="auth-badge-btn" type="button" onClick={onClick}
      title={email || 'Đăng nhập để lưu data'}>
      {email ? `✅ ${email.split('@')[0]}` : '👤 Ẩn danh'}
    </button>
  );
}
