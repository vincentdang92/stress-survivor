/** AuthModal.jsx — Login / Signup modal (Sticker Office style) */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import {
  signInWithEmail, signUpWithEmail, upgradeAnonToEmail, signOut,
  onAuthChange, getCurrentUser, pullPlayerData,
} from '../supabase.js';

// ── AuthForm — component hoàn toàn độc lập, không nhận props thay đổi ─────────
// Dùng uncontrolled inputs (useRef) → không bao giờ re-render vì parent
function AuthForm({ isLinkMode, onClose, onAuthSuccess }) {
  const emailRef    = useRef(null);
  const passwordRef = useRef(null);
  const modeRef     = useRef(isLinkMode ? 'link' : 'signup'); // lưu trong ref, không phải state
  const [modeUI, setModeUI]   = useState(modeRef.current);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState({ text: '', type: '' });

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

    if (!email)           return showMsg('Vui lòng nhập email.', 'err');
    if (!password)        return showMsg('Vui lòng nhập mật khẩu.', 'err');
    if (password.length < 6) return showMsg('Mật khẩu tối thiểu 6 ký tự.', 'err');

    setLoading(true);
    setMsg({ text: '', type: '' });

    try {
      if (mode === 'link') {
        const { error } = await upgradeAnonToEmail(email, password);
        if (error && /session|missing/i.test(error)) {
          const { error: e2, needConfirm } = await signUpWithEmail(email, password);
          if (e2)         showMsg('Lỗi: ' + e2, 'err');
          else if (needConfirm) showMsg('📧 Kiểm tra email để xác nhận tài khoản!', 'ok');
          else          { showMsg('✅ Tài khoản tạo thành công!', 'ok'); setTimeout(onClose, 1500); }
        } else if (error) {
          showMsg('Lỗi: ' + error, 'err');
        } else {
          showMsg('✅ Đã liên kết! Data đồng bộ.', 'ok');
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
      } else { // signup
        const { error, needConfirm } = await signUpWithEmail(email, password);
        if (error)          showMsg('Lỗi: ' + error, 'err');
        else if (needConfirm) showMsg('📧 Kiểm tra email để xác nhận tài khoản!', 'ok');
        else                { showMsg('✅ Tài khoản tạo thành công!', 'ok'); setTimeout(onClose, 1500); }
      }
    } catch (err) {
      showMsg('Lỗi: ' + (err?.message || 'Không xác định'), 'err');
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

// ── AuthModal — KHÔNG dùng loading state để tránh unmount/remount form ─────────
export function AuthModal({ onClose, onAuthSuccess }) {
  // Khởi tạo ngay với giá trị mặc định — KHÔNG dùng null để tránh render loading spinner
  const [loggedInEmail, setLoggedInEmail] = useState(null);
  const [isLinkMode, setIsLinkMode]       = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Đọc auth state một lần sau khi mount, cập nhật UI phù hợp
  useEffect(() => {
    let cancelled = false;
    getCurrentUser().then(u => {
      if (cancelled) return;
      const anon = u ? (u.is_anonymous ?? !u.email) : true;
      if (u && !anon) {
        setLoggedInEmail(u.email);       // đã login bằng email
      } else if (u && anon) {
        setIsLinkMode(true);             // anon session → link mode
      }
      // Nếu không có user → giữ nguyên default (login/signup tabs)
    });

    // Chỉ lắng nghe SIGNED_IN / SIGNED_OUT / USER_UPDATED
    const unsub = onAuthChange((event, session) => {
      if (cancelled) return;
      if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) return;
      const u = session?.user || null;
      const anon = u ? (u.is_anonymous ?? !u.email) : true;
      if (u && !anon) setLoggedInEmail(u.email);
      else { setLoggedInEmail(null); setIsLinkMode(!!(u && anon)); }
    });

    return () => { cancelled = true; unsub(); };
  }, []);

  const handleSignOut = async () => {
    setLogoutLoading(true);
    await signOut();
    setLoggedInEmail(null);
    setIsLinkMode(false);
    setLogoutLoading(false);
    onAuthSuccess?.(null);
  };

  // Đã đăng nhập bằng email
  if (loggedInEmail) {
    return (
      <div class="auth-overlay">
        <div class="auth-modal">
          <div class="auth-header">
            <h3>👤 Tài khoản</h3>
            <button class="auth-close" type="button" onClick={onClose}>✕</button>
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
    );
  }

  // Form đăng nhập / đăng ký — luôn render ngay, KHÔNG có loading state
  return (
    <div class="auth-overlay">
      <div class="auth-modal">
        <div class="auth-header">
          <h3>{isLinkMode ? '🔗 Lưu tài khoản' : '👤 Đăng nhập'}</h3>
          <button class="auth-close" type="button" onClick={onClose}>✕</button>
        </div>
        {/*
          AuthForm được render NGAY từ đầu — không có transition loading→form.
          key cố định → Preact giữ nguyên DOM instance dù parent re-render.
          Tất cả input dùng useRef → giá trị không bao giờ bị reset.
        */}
        <AuthForm
          key="auth-form-singleton"
          isLinkMode={isLinkMode}
          onClose={onClose}
          onAuthSuccess={onAuthSuccess}
        />
      </div>
    </div>
  );
}

/** Compact auth badge dùng trong MenuScreen */
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
      title={email ? email : 'Đăng nhập để lưu data'}>
      {email ? `✅ ${email.split('@')[0]}` : '👤 Ẩn danh'}
    </button>
  );
}
