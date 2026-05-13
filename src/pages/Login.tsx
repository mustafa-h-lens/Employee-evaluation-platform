import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavReveal } from '../contexts/ThemeContext';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const { runWithNavReveal } = useNavReveal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Validate credentials FIRST (no overlay yet) so we can show inline
      // errors. Only on success do we play the brand reveal as the auth
      // state propagates and the dashboard mounts.
      await login(email, password);
      // login() resolved without throwing — credentials accepted. Now
      // play the reveal and let the dashboard render underneath.
      runWithNavReveal(() => Promise.resolve());
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');

        .hl-login {
          min-height: 100vh;
          display: flex;
          font-family: 'Cairo', 'Segoe UI', sans-serif;
          background: #030b1a;
          direction: rtl;
          color: #f0f4ff;
        }

        /* ── Decorative panel (RIGHT in RTL) ── */
        .hl-left {
          flex: 1;
          position: relative;
          overflow: hidden;
          display: none;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px 52px 44px;
          background: linear-gradient(145deg, #020c20 0%, #071a40 55%, #082060 100%);
        }
        @media (min-width: 1024px) { .hl-left { display: flex; } }

        .hl-grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px);
          background-size: 56px 56px;
        }
        .hl-orb1 {
          position: absolute; top: 12%; right: 8%;
          width: 420px; height: 420px; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 65%);
        }
        .hl-orb2 {
          position: absolute; bottom: 8%; left: 4%;
          width: 280px; height: 280px; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 65%);
        }
        .hl-left-z { position: relative; z-index: 1; }

        .hl-logo {
          padding: 20px 0; display: flex; justify-content: flex-start;
          cursor: pointer; text-decoration: none;
          transition: opacity 0.2s, transform 0.2s;
        }
        .hl-logo:hover { opacity: 0.85; transform: translateY(-1px); }
        .hl-logo img { height: 192px; width: auto; object-fit: contain; pointer-events: none; }

        .hl-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 5px 14px; border-radius: 9999px; margin-bottom: 20px;
          background: rgba(29,78,216,0.18); border: 1px solid rgba(59,130,246,0.3);
        }
        .hl-badge-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #60a5fa;
          animation: hl-pulse 2s infinite;
        }
        @keyframes hl-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.4; transform:scale(0.8); }
        }
        .hl-badge-txt {
          font-size: 0.72rem; font-weight: 700; color: #93c5fd;
          letter-spacing: 0.1em; text-transform: uppercase;
        }
        .hl-h1 {
          font-size: 2.6rem; font-weight: 900; color: #fff;
          line-height: 1.18; margin-bottom: 16px;
        }
        .hl-grad {
          background: linear-gradient(90deg, #60a5fa, #34d399, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hl-sub {
          font-size: 0.95rem; color: rgba(255,255,255,0.5);
          line-height: 1.7; max-width: 380px;
        }

        /* ── Form panel (LEFT in RTL) ── */
        .hl-right {
          width: 100%;
          display: flex; align-items: center; justify-content: center;
          padding: 32px 20px;
          background: #030b1a;
          border-right: 1px solid rgba(255,255,255,0.06);
        }
        @media (min-width: 640px) { .hl-right { padding: 48px 32px; } }
        @media (min-width: 1024px) { .hl-right { width: 440px; flex-shrink: 0; } }

        .hl-form-wrap { width: 100%; max-width: 380px; }

        .hl-mobile-logo {
          display: flex; justify-content: center; margin-bottom: 32px; padding: 12px 0;
          cursor: pointer; text-decoration: none;
          transition: opacity 0.2s;
        }
        .hl-mobile-logo:hover { opacity: 0.8; }
        .hl-mobile-logo img { height: 112px; object-fit: contain; pointer-events: none; }
        @media (min-width: 640px) {
          .hl-mobile-logo { margin-bottom: 48px; padding: 20px 0; justify-content: flex-end; }
          .hl-mobile-logo img { height: 144px; }
        }
        @media (min-width: 1024px) { .hl-mobile-logo { display: none; } }

        .hl-title { font-size: 1.8rem; font-weight: 800; color: #f0f4ff; margin-bottom: 6px; text-align: right; }
        .hl-desc  { font-size: 0.875rem; color: #4a6480; margin-bottom: 32px; text-align: right; }

        .hl-field { margin-bottom: 18px; }
        .hl-label {
          display: block; font-size: 0.8rem; font-weight: 600;
          color: #7a9ab8; margin-bottom: 8px;
        }
        .hl-input {
          width: 100%; padding: 12px 16px; border-radius: 10px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          color: #f0f4ff; font-size: 0.9rem; font-family: inherit;
          outline: none; transition: all 0.15s; direction: ltr; text-align: left;
          box-sizing: border-box;
        }
        .hl-input::placeholder { color: #2a3f55; }
        .hl-input:focus {
          border-color: rgba(59,130,246,0.55);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
          background: rgba(37,99,235,0.05);
        }
        /* Browser autofill paints its own light background and dark text
           — pin both back to the dark-mode palette so saved-credential
           fields don't read as white blocks. */
        .hl-input:-webkit-autofill,
        .hl-input:-webkit-autofill:hover,
        .hl-input:-webkit-autofill:focus,
        .hl-input:-webkit-autofill:active {
          -webkit-text-fill-color: #f0f4ff;
          -webkit-box-shadow: 0 0 0 1000px #0b1426 inset;
          caret-color: #f0f4ff;
          transition: background-color 9999s ease-out 0s;
          border-color: rgba(255,255,255,0.08);
        }
        .hl-input:-webkit-autofill:focus {
          border-color: rgba(59,130,246,0.55);
          -webkit-box-shadow: 0 0 0 1000px #0b1426 inset, 0 0 0 3px rgba(37,99,235,0.12);
        }

        .hl-pw-wrap { position: relative; }
        .hl-pw-wrap .hl-input { padding-left: 44px; }
        .hl-eye {
          position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #3d5470; display: flex; align-items: center;
          transition: color 0.15s; padding: 0;
        }
        .hl-eye:hover { color: #7a9ab8; }

        .hl-error {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-radius: 10px; margin-bottom: 18px;
          background: rgba(244,63,94,0.08); border: 1px solid rgba(244,63,94,0.2);
          color: #fda4af; font-size: 0.82rem;
        }
        .hl-error-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #f43f5e; flex-shrink: 0;
        }

        .hl-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 13px; border-radius: 12px; border: none;
          background: linear-gradient(135deg, #1d4ed8, #2563eb);
          color: #fff; font-size: 0.95rem; font-weight: 700; font-family: inherit;
          cursor: pointer; box-shadow: 0 4px 24px rgba(37,99,235,0.4);
          transition: box-shadow 0.2s, transform 0.15s; margin-top: 6px;
        }
        .hl-btn:hover:not(:disabled) {
          box-shadow: 0 6px 32px rgba(37,99,235,0.6);
          transform: translateY(-1px);
        }
        .hl-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .hl-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: hl-spin 0.7s linear infinite;
        }
        @keyframes hl-spin { to { transform: rotate(360deg); } }

        .hl-footer {
          margin-top: 28px; padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          text-align: center; font-size: 0.78rem; color: #2a3f55;
        }
      `}</style>

      <div className="hl-login">
        {/* Decorative panel — right side in RTL */}
        <div className="hl-left">
          <div className="hl-grid" />
          <div className="hl-orb1" />
          <div className="hl-orb2" />

          <a href="/" className="hl-left-z hl-logo" aria-label="Half Lens — الرئيسية">
            <img src="/logo-white.png" alt="Half Lens" />
          </a>

          <div className="hl-left-z">
            <div className="hl-badge">
              <div className="hl-badge-dot" />
              <span className="hl-badge-txt">نظام تقييم الأداء الوظيفي</span>
            </div>
            <div className="hl-h1">
              تقييم أداء موظفيك<br />
              <span className="hl-grad">باحترافية عالية</span>
            </div>
            <div className="hl-sub">
              نظام Half Lens لتقييم الأداء — تقييمات دورية، متابعة الأداء، وتقارير شاملة في مكان واحد متكامل.
            </div>
          </div>

          <div />
        </div>

        {/* Form panel — left side in RTL */}
        <div className="hl-right">
          <div className="hl-form-wrap">
            <div className="hl-title">مرحباً بعودتك</div>
            <div className="hl-desc">سجّل دخولك للوصول إلى لوحة التحكم</div>

            <a href="/" className="hl-mobile-logo" aria-label="Half Lens — الرئيسية">
              <img src="/logo-white.png" alt="Half Lens" />
            </a>

            <form onSubmit={handleSubmit}>
              <div className="hl-field">
                <label className="hl-label">البريد الإلكتروني</label>
                <input
                  className="hl-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="hl-field">
                <label className="hl-label">كلمة المرور</label>
                <div className="hl-pw-wrap">
                  <input
                    className="hl-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="hl-eye"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="hl-error">
                  <div className="hl-error-dot" />
                  {error}
                </div>
              )}

              <button type="submit" className="hl-btn" disabled={loading}>
                {loading ? (
                  <>
                    <div className="hl-spinner" />
                    <span>جارٍ تسجيل الدخول...</span>
                  </>
                ) : (
                  <>
                    <span>تسجيل الدخول</span>
                    <ArrowLeft size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="hl-footer">
              © {new Date().getFullYear()} Half Lens. جميع الحقوق محفوظة.
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
