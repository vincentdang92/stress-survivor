/** AuthModal.jsx — Login / Signup modal rendered via Portal (isolated from App re-renders) */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import {
  signInWithEmail, signUpWithEmail, upgradeAnonToEmail, signOut,
  onAuthChange, getCurrentUser, pullPlayerData,
} from '../supabase.js';

// ── Sync read Supabase session from localStorage (no async, no re-render on mount) ──
function readSessionSync() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const data = JSON.parse(localStorage.getItem(key) || 'null');
        const u = data?.user;
        if (u?.id) return u;
      }
    }
  } catch {}
  return null;
}

// ── Debug log ─────────────────────────────────────────────────────────────────
const debugLogs = [];
function dbg(...args) {
  const line = args.map(a => {
    try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); } catch { return String(a); }
  }).join(' ');
  console.log('[Auth]', ...args);
  debugLogs.push(`${new Date().toISOString().slice(11, 19)} ${line}`);
  if (debugLogs.length > 30) debugLogs.shift();
}

// ── AuthForm — completely static, inputs never touched by Preact after mount ──
function AuthForm({ initialLinkMode, onCloseRef, onAuthSuccessRef, debug }) {
  const emailRef    = useRef(null);
  const passwordRef = useRef(null);
  const modeRef     = useRef(initialLinkMode ? 'link' : 'signup');
  const [modeUI, setModeUI]   = useState(modeRef.current);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState({ text: '', type: '' });
  const [rawLog, setRawLog]   = useState('');

  const showMsg = useCallback((text, type = 'ok') => setMsg({ text, type }), []);

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
    const onClose       = onCloseRef.current;
    const onAuthSuccess = onAuthSuccessRef.current;

    if (!email)              return showMsg('Vui lòng nhập email.', 'err');
    if (!password)           return showMsg('Vui lòng nhập mật khẩu.', 'err');
    if (password.length < 6) return showMsg('Mật khẩu tối thiểu 6 ký tự.', 'err');

    setLoading(true); setMsg({ text: '', type: '' }); setRawLog('');

    try {
      dbg('Submit', { mode, email });

      if (mode === 'link') {
        const res = await upgradeAnonToEmail(email, password);
        dbg('upgradeAnonToEmail:', res);
        setRawLog(JSON.stringify(res, null, 2));
        if (res.error === 'EMAIL_EXISTS') {
          showMsg('📭 Email này đã có tài khoản. Hãy chuyển sang Đăng nhập.', 'err');
        } else if (res.error) {
          showMsg('Lỗi: ' + res.error, 'err');
        } else {
          showMsg('✅ Đã liên kết! Data đồng bộ.', 'ok');
          setTimeout(onClose, 1500);
        }

      } else if (mode === 'login') {
        const res = await signInWithEmail(email, password);
        dbg('signIn:', res);
        setRawLog(JSON.stringify(res, null, 2));
        if (res.error === 'EMAIL_NOT_CONFIRMED') {
          showMsg('📧 Email chưa được xác nhận. Vui lòng kiểm tra hộp thư và click link xác nhận.', 'err');
        } else if (res.error === 'WRONG_PASSWORD') {
          showMsg('❌ Sai email hoặc mật khẩu.', 'err');
        } else if (res.error) {
          showMsg('Lỗi: ' + res.error, 'err');
        } else {
          await pullPlayerData();
          showMsg('✅ Đăng nhập thành công!', 'ok');
          onAuthSuccess?.(res.user);
          setTimeout(onClose, 1200);
        }

      } else { // signup
        const res = await signUpWithEmail(email, password);
        dbg('signUp:', res);
        setRawLog(JSON.stringify(res, null, 2));
        if (res.error === 'EMAIL_EXISTS') {
          // {} error từ Supabase = email có thể đã tồn tại (hoặc enumeration protection)
          // Không auto-switch — cho user tự quyết
          showMsg('📭 Email này có thể đã được đăng ký. Thử tab Đăng nhập, hoặc dùng email khác.', 'err');
        } else if (res.error) {
          showMsg('Lỗi: ' + res.error, 'err');
        } else if (res.needConfirm) {
          showMsg('📧 Kiểm tra email để xác nhận tài khoản! Sau khi xác nhận, quay lại đây và Đăng nhập.', 'ok');
        } else {
          // Đăng ký + đăng nhập luôn (email confirmation tắt)
          showMsg('✅ Tài khoản tạo thành công!', 'ok');
          onAuthSuccess?.(res.user);
          setTimeout(onClose, 1500);
        }
      }
    } catch (err) {
      const msg = err?.message || String(err);
      dbg('Exception:', msg);
      setRawLog('Exception: ' + msg);
      showMsg('Lỗi: ' + msg, 'err');
    }

    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← NO deps: uses refs for all mutable values

  return (
    <>
      {modeUI === 'link' ? (
        <div class="auth-anon-notice">
          <span>⚠️</span>
          <span>Đang chơi <b>ẩn danh</b>. Nhập email để lưu data và đồng bộ nhiều thiết bị.</span>
        </div>
      ) : (
        <div class="auth-tabs">
          <button type="button" class={`auth-tab${modeUI === 'login' ? ' active' : ''}`}
            onPointerDown={() => switchMode('login')}>Đăng nhập</button>
          <button type="button" class={`auth-tab${modeUI === 'signup' ? ' active' : ''}`}
            onPointerDown={() => switchMode('signup')}>Đăng ký</button>
        </div>
      )}

      <form onSubmit={handleSubmit} class="auth-form">
        <div class="auth-field">
          <label>Email</label>
          <input ref={emailRef}
            type="text"
            inputmode="email"
            class="lb-input"
            placeholder="you@example.com"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="none"
            spellcheck={false} />
        </div>
        <div class="auth-field">
          <label>Mật khẩu</label>
          <input ref={passwordRef}
            type="password"
            inputmode="text"
            class="lb-input"
            placeholder="Tối thiểu 6 ký tự"
            autocomplete="off" />
        </div>

        {msg.text && <div class={`auth-msg ${msg.type}`}>{msg.text}</div>}

        {(debug || rawLog) && (
          <details class="auth-debug" open={!!rawLog}>
            <summary>🐛 Debug ({debugLogs.length} logs)</summary>
            <pre class="auth-debug-pre">{debugLogs.slice(-8).join('\n')}</pre>
            {rawLog && <><strong style={{ fontSize: 11 }}>Raw API:</strong>
              <pre class="auth-debug-pre">{rawLog}</pre></>}
          </details>
        )}

        <button class="btn primary" type="submit" disabled={loading}
          style={{ width: '100%', marginTop: 4, fontSize: 15 }}>
          {loading      ? 'Đang xử lý...'
            : modeUI === 'link'  ? '🔗 Liên kết & Lưu data'
            : modeUI === 'login' ? '🚀 Đăng nhập'
            :                      '✨ Tạo tài khoản'}
        </button>
      </form>

      <div class="auth-footer">
        {modeUI === 'link'   ? 'Vàng và nâng cấp sẽ được giữ nguyên.'
          : modeUI === 'login' ? 'Chưa có tài khoản? → tab Đăng ký'
          :                      'Đã có tài khoản? → tab Đăng nhập'}
      </div>
    </>
  );
}


// ── AuthModal — rendered via Portal into document.body (isolated from App re-renders) ──
export function AuthModal({ onClose, onAuthSuccess }) {
  // Sync read from localStorage → no async state update → no re-render after mount
  const initUser = readSessionSync();
  const initAnon = initUser ? (initUser.is_anonymous ?? !initUser.email) : true;

  const [loggedInEmail, setLoggedInEmail] = useState(
    initUser && !initAnon ? initUser.email : null
  );
  const [isLinkMode] = useState(initUser && initAnon);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [debug, setDebug] = useState(false);
  const tapCount = useRef(0);

  // Stable refs for callbacks — AuthForm reads from these, never re-renders when App changes
  const onCloseRef       = useRef(onClose);
  const onAuthSuccessRef = useRef(onAuthSuccess);
  useEffect(() => { onCloseRef.current = onClose; onAuthSuccessRef.current = onAuthSuccess; });

  // CRITICAL: thêm class auth-open vào body khi modal mở
  // → override body { touch-action: none; user-select: none } để mobile keyboard hoạt động
  useEffect(() => {
    document.body.classList.add('auth-open');
    return () => document.body.classList.remove('auth-open');
  }, []);

  // Listen only for actual auth changes (not initial session load)
  useEffect(() => {
    let cancelled = false;
    return onAuthChange((event, session) => {
      if (cancelled) return;
      if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) return;
      dbg('onAuthChange', event);
      const u = session?.user || null;
      const anon = u ? (u.is_anonymous ?? !u.email) : true;
      setLoggedInEmail(u && !anon ? u.email : null);
    });
  }, []);

  const handleTitleTap = () => {
    tapCount.current += 1;
    if (tapCount.current >= 5) { setDebug(v => !v); tapCount.current = 0; }
  };

  const handleSignOut = async () => {
    setLogoutLoading(true);
    await signOut();
    setLoggedInEmail(null);
    setLogoutLoading(false);
    onAuthSuccessRef.current?.(null);
  };

  const content = loggedInEmail ? (
    <div class="auth-overlay">
      <div class="auth-modal">
        <div class="auth-header">
          <h3 onClick={handleTitleTap}>👤 Tài khoản</h3>
          <button class="auth-close" type="button" onClick={onCloseRef.current}>✕</button>
        </div>
        <div class="auth-logged-in">
          <div class="auth-avatar">✉️</div>
          <div class="auth-email">{loggedInEmail}</div>
          <div class="auth-badge ok">✅ Đã đồng bộ</div>
          <p style={{ fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 1.5 }}>
            Data nhân vật được lưu và đồng bộ tự động trên mọi thiết bị.
          </p>
          <button class="btn" style={{ width: '100%' }} type="button"
            onClick={handleSignOut} disabled={logoutLoading}>
            {logoutLoading ? '...' : '🚪 Đăng xuất'}
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div class="auth-overlay">
      <div class="auth-modal">
        <div class="auth-header">
          <h3 onClick={handleTitleTap}>{isLinkMode ? '🔗 Lưu tài khoản' : '👤 Đăng nhập'}</h3>
          <button class="auth-close" type="button" onClick={onCloseRef.current}>✕</button>
        </div>
        <AuthForm
          key="auth-form-singleton"
          initialLinkMode={isLinkMode}
          onCloseRef={onCloseRef}
          onAuthSuccessRef={onAuthSuccessRef}
          debug={debug}
        />
      </div>
    </div>
  );

  // Portal: render vào document.body, hoàn toàn tách khỏi Preact tree của App
  return createPortal(content, document.body);
}

/** Compact auth badge */
export function AuthBadge({ onClick }) {
  const initUser = readSessionSync();
  const initAnon = initUser ? (initUser.is_anonymous ?? !initUser.email) : true;
  const [email, setEmail] = useState(initUser && !initAnon ? initUser.email : null);

  useEffect(() => {
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
