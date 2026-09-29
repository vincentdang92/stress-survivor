/** AuthModal.jsx — Login / Signup / Upgrade modal (Sticker Office style) */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import {
  signInWithEmail, signUpWithEmail, upgradeAnonToEmail, signOut,
  onAuthChange, getCurrentUser, pullPlayerData,
} from '../supabase.js';

// ── AuthForm — hoàn toàn KHÔNG nhận props thay đổi, tự quản lý state ──────────
// Dùng uncontrolled inputs + useRef → không bao giờ re-render vì parent
function AuthForm({ initialLinkMode, onClose, onAuthSuccess }) {
  const emailRef    = useRef(null);
  const passwordRef = useRef(null);
  const modeRef     = useRef(initialLinkMode ? 'link' : 'login'); // ref thay vì state
  const [modeLabel, setModeLabel] = useState(initialLinkMode ? 'link' : 'login');
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState('');
  const [msgType, setMsgType]     = useState('');

  const showMsg = (text, type = 'ok') => { setMsg(text); setMsgType(type); };

  const switchMode = useCallback((m) => {
    modeRef.current = m;
    setModeLabel(m);
    setMsg('');
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const email    = emailRef.current?.value?.trim()  || '';
    const password = passwordRef.current?.value       || '';
    const mode     = modeRef.current;

    if (!email || !password) return showMsg('Nhập đủ email và mật khẩu.', 'err');
    if (password.length < 6)  return showMsg('Mật khẩu ít nhất 6 ký tự.', 'err');

    setLoading(true); setMsg('');

    if (mode === 'link') {
      const { error } = await upgradeAnonToEmail(email, password);
      if (error && (error.toLowerCase().includes('session') || error.toLowerCase().includes('missing'))) {
        const { error: e2, needConfirm } = await signUpWithEmail(email, password);
        if (e2) showMsg('Lỗi: ' + e2, 'err');
        else if (needConfirm) showMsg('📧 Kiểm tra email để xác nhận!', 'ok');
        else { showMsg('✅ Tài khoản tạo thành công!', 'ok'); setTimeout(onClose, 1500); }
      } else if (error) {
        showMsg('Lỗi: ' + error, 'err');
      } else {
        showMsg('✅ Tài khoản đã liên kết! Data đồng bộ.', 'ok');
        setTimeout(onClose, 1500);
      }
    } else if (mode === 'login') {
      const { user, error } = await signInWithEmail(email, password);
      if (error) showMsg('Sai email hoặc mật khẩu.', 'err');
      else {
        await pullPlayerData();
        showMsg('✅ Đăng nhập thành công!', 'ok');
        onAuthSuccess?.(user);
        setTimeout(onClose, 1200);
      }
    } else {
      const { error, needConfirm } = await signUpWithEmail(email, password);
      if (error) showMsg('Lỗi: ' + error, 'err');
      else if (needConfirm) showMsg('📧 Kiểm tra email để xác nhận!', 'ok');
      else { showMsg('✅ Tài khoản tạo thành công!', 'ok'); setTimeout(onClose, 1500); }
    }

    setLoading(false);
  }, [onClose, onAuthSuccess]);

  return (
    <>
      {modeLabel === 'link' ? (
        <div class="auth-anon-notice">
          <span>⚠️</span>
          <span>Bạn đang chơi <b>ẩn danh</b>. Nhập email để lưu data và đồng bộ nhiều thiết bị.</span>
        </div>
      ) : (
        <div class="auth-tabs">
          <button type="button" class={`auth-tab${modeLabel === 'login' ? ' active' : ''}`}
            onClick={() => switchMode('login')}>Đăng nhập</button>
          <button type="button" class={`auth-tab${modeLabel === 'signup' ? ' active' : ''}`}
            onClick={() => switchMode('signup')}>Đăng ký</button>
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
            style={{ fontSize: 16 }}
            autocomplete="email"
            autocorrect="off"
            autocapitalize="off"
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
            style={{ fontSize: 16 }}
            autocomplete={modeLabel === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {msg && <div class={`auth-msg ${msgType}`}>{msg}</div>}

        <button class="btn primary" type="submit" disabled={loading}
          style={{ width: '100%', marginTop: 4, fontSize: 15 }}>
          {loading ? 'Đang xử lý...'
            : modeLabel === 'link'   ? '🔗 Liên kết & Lưu data'
            : modeLabel === 'login'  ? '🚀 Đăng nhập'
            :                          '✨ Tạo tài khoản'}
        </button>
      </form>

      <div class="auth-footer">
        {modeLabel === 'link'
          ? 'Vàng và nâng cấp sẽ được giữ nguyên.'
          : modeLabel === 'login'
            ? 'Chưa có tài khoản? → Chuyển tab Đăng ký'
            : 'Đã có tài khoản? → Chuyển tab Đăng nhập'}
      </div>
    </>
  );
}

// ── AuthModal chính — load auth state một lần, không cập nhật khi đang gõ ─────
export function AuthModal({ onClose, onAuthSuccess }) {
  // Load auth state 1 lần khi mount, không update liên tục
  const [authState, setAuthState] = useState(null); // null = loading
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    getCurrentUser().then(u => {
      setAuthState({
        user: u,
        isAnon: u ? (u.is_anonymous ?? !u.email) : true,
        hasSession: !!u,
      });
    });

    // Chỉ update khi có SIGNED_IN / SIGNED_OUT / USER_UPDATED — bỏ qua TOKEN_REFRESHED
    return onAuthChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
      const u = session?.user || null;
      setAuthState({
        user: u,
        isAnon: u ? (u.is_anonymous ?? !u.email) : true,
        hasSession: !!u,
      });
    });
  }, []);

  const handleSignOut = async () => {
    setLogoutLoading(true);
    await signOut();
    setLogoutLoading(false);
    onAuthSuccess?.(null);
  };

  // Loading auth state
  if (!authState) return (
    <div class="auth-overlay">
      <div class="auth-modal" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ fontSize: 14, color: '#666' }}>Đang kiểm tra tài khoản...</div>
      </div>
    </div>
  );

  const { user, isAnon, hasSession } = authState;

  // Đã đăng nhập bằng email
  if (user && !isAnon) {
    return (
      <div class="auth-overlay">
        <div class="auth-modal">
          <div class="auth-header">
            <h3>👤 Tài khoản</h3>
            <button class="auth-close" onClick={onClose}>✕</button>
          </div>
          <div class="auth-logged-in">
            <div class="auth-avatar">✉️</div>
            <div class="auth-email">{user.email}</div>
            <div class="auth-badge ok">✅ Đã đồng bộ</div>
            <p style={{ fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 1.5 }}>
              Data nhân vật được lưu và đồng bộ tự động trên mọi thiết bị.
            </p>
            <button class="btn" style={{ width: '100%' }} onClick={handleSignOut}
              disabled={logoutLoading}>
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
          <h3>{isAnon && hasSession ? '🔗 Lưu tài khoản' : '👤 Đăng nhập'}</h3>
          <button class="auth-close" onClick={onClose}>✕</button>
        </div>
        {/*
          Key = chuỗi cố định → Preact KHÔNG bao giờ unmount/remount AuthForm
          initialLinkMode chỉ đọc 1 lần khi mount → không gây re-render
        */}
        <AuthForm
          key="auth-form-stable"
          initialLinkMode={isAnon && hasSession}
          onClose={onClose}
          onAuthSuccess={onAuthSuccess}
        />
      </div>
    </div>
  );
}

/** Compact auth badge dùng trong MenuScreen */
export function AuthBadge({ onClick }) {
  const [info, setInfo] = useState({ isAnon: true, email: null });

  useEffect(() => {
    getCurrentUser().then(u => {
      setInfo({ isAnon: u ? (u.is_anonymous ?? !u.email) : true, email: u?.email });
    });
    return onAuthChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      const u = session?.user || null;
      setInfo({ isAnon: u ? (u.is_anonymous ?? !u.email) : true, email: u?.email });
    });
  }, []);

  return (
    <button class="auth-badge-btn" onClick={onClick}
      title={info.isAnon ? 'Đăng nhập để lưu data' : info.email}>
      {info.isAnon ? '👤 Ẩn danh' : `✅ ${info.email?.split('@')[0]}`}
    </button>
  );
}
