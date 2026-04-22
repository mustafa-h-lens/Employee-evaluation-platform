import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Eye, EyeOff, AlertCircle, Sun, Moon } from 'lucide-react';

type Theme = 'dark' | 'light';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('login-theme') as Theme) || 'dark';
  });
  const { login } = useAuth();

  useEffect(() => {
    localStorage.setItem('login-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className={`login-page ${isDark ? 'lp-dark' : 'lp-light'}`} dir="rtl">
      {/* Background decorations */}
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />
      <div className="login-bg-orb login-bg-orb-3" />

      {/* Theme toggle */}
      <button className="login-theme-toggle" onClick={toggleTheme} title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}>
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="login-container">
        {/* Logo */}
        <div className="login-logo-box">
          <img
            src={isDark ? '/Logo_White.png' : '/logo-color.png'}
            alt="Half Lens"
            className="login-logo"
          />
        </div>

        {/* Card */}
        <div className="login-card">
          <div className="login-card-header">
            <h1 className="login-title">منصة التقييم الوظيفي</h1>
            <p className="login-subtitle">نظام إدارة تقييم الأداء الوظيفي</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="login-error">
                <AlertCircle className="login-error-icon" />
                <span>{error}</span>
              </div>
            )}

            {/* Email */}
            <div className="login-field">
              <label className="login-label">البريد الإلكتروني</label>
              <input
                type="email"
                className="login-input"
                placeholder="example@h-lens.co"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="login-field">
              <label className="login-label">كلمة المرور</label>
              <div className="login-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-eye-btn"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="login-btn"
              disabled={loading}
            >
              {loading ? (
                <div className="login-spinner" />
              ) : (
                <>
                  <span>تسجيل الدخول</span>
                  <LogIn size={18} />
                </>
              )}
            </button>
          </form>

          <div className="login-hint">
            استخدم بيانات الدخول المقدمة من مدير النظام
          </div>
        </div>

        {/* Footer */}
        <p className="login-footer">&copy; 2026 HALF LENS PRODUCTION. جميع الحقوق محفوظة</p>
      </div>

      <style>{`
        /* ===== BASE ===== */
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          padding: 24px;
          transition: background 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ===== THEME TOGGLE ===== */
        .login-theme-toggle {
          position: fixed;
          top: 20px;
          left: 20px;
          z-index: 10;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ===== AMBIENT ORBS ===== */
        .login-bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
          transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .login-bg-orb-1 {
          width: 500px; height: 500px;
          top: -150px; right: -100px;
        }
        .login-bg-orb-2 {
          width: 400px; height: 400px;
          bottom: -120px; left: -80px;
        }
        .login-bg-orb-3 {
          width: 300px; height: 300px;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
        }

        .login-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        /* Logo */
        .login-logo-box {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .login-logo {
          height: 72px;
          width: auto;
          transition: filter 0.4s;
        }

        /* Card */
        .login-card {
          width: 100%;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-radius: 20px;
          padding: 32px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .login-card-header {
          text-align: center;
          margin-bottom: 28px;
        }
        .login-title {
          font-size: 22px;
          font-weight: 800;
          margin: 0 0 6px;
          transition: color 0.4s;
        }
        .login-subtitle {
          font-size: 14px;
          margin: 0;
          font-weight: 400;
          transition: color 0.4s;
        }

        /* Form */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .login-label {
          font-size: 13px;
          font-weight: 600;
          transition: color 0.4s;
        }
        .login-input-wrap {
          position: relative;
        }
        .login-input {
          width: 100%;
          height: 44px;
          padding: 0 14px;
          border-radius: 10px;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-sizing: border-box;
        }

        .login-eye-btn {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        /* Error */
        .login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.4s;
        }
        .login-error-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        /* Button */
        .login-btn {
          width: 100%;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 12px rgba(37, 99, 235, 0.35);
          margin-top: 4px;
        }
        .login-btn:hover:not(:disabled) {
          background: #3b82f6;
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(37, 99, 235, 0.45);
        }
        .login-btn:active:not(:disabled) {
          transform: scale(0.97);
        }
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        /* Spinner */
        .login-spinner {
          width: 20px;
          height: 20px;
          border: 2.5px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: login-spin 0.7s linear infinite;
        }
        @keyframes login-spin {
          to { transform: rotate(360deg); }
        }

        /* Hint */
        .login-hint {
          margin-top: 20px;
          text-align: center;
          font-size: 12px;
          padding: 12px;
          border-radius: 10px;
          transition: all 0.4s;
        }

        /* Footer */
        .login-footer {
          font-size: 12px;
          text-align: center;
          margin: 0;
          transition: color 0.4s;
        }

        /* ============================== */
        /* ===== DARK MODE TOKENS ======= */
        /* ============================== */
        .lp-dark {
          background: #050d1e;
        }
        .lp-dark .login-theme-toggle {
          background: rgba(255, 255, 255, 0.05);
          color: rgba(200, 215, 255, 0.6);
        }
        .lp-dark .login-theme-toggle:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fbbf24;
        }
        .lp-dark .login-bg-orb-1 { background: rgba(37, 99, 235, 0.12); }
        .lp-dark .login-bg-orb-2 { background: rgba(139, 92, 246, 0.08); }
        .lp-dark .login-bg-orb-3 { background: rgba(37, 99, 235, 0.06); }

        .lp-dark .login-logo {
          filter: drop-shadow(0 0 24px rgba(37, 99, 235, 0.25));
        }

        .lp-dark .login-card {
          background: rgba(7, 20, 45, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.07);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }
        .lp-dark .login-title { color: #f0f4ff; }
        .lp-dark .login-subtitle { color: rgba(200, 215, 255, 0.55); }
        .lp-dark .login-label { color: rgba(200, 215, 255, 0.65); }

        .lp-dark .login-input {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.09);
          color: #f0f4ff;
        }
        .lp-dark .login-input::placeholder { color: rgba(150, 175, 230, 0.35); }
        .lp-dark .login-input:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.14);
        }
        .lp-dark .login-input:focus {
          background: rgba(37, 99, 235, 0.05);
          border-color: rgba(37, 99, 235, 0.55);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .lp-dark .login-eye-btn { color: rgba(150, 175, 230, 0.4); }
        .lp-dark .login-eye-btn:hover { color: rgba(200, 215, 255, 0.7); }

        .lp-dark .login-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #f87171;
        }

        .lp-dark .login-hint {
          color: rgba(150, 175, 230, 0.35);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
        }
        .lp-dark .login-footer { color: rgba(150, 175, 230, 0.3); }

        /* =============================== */
        /* ===== LIGHT MODE TOKENS ======= */
        /* =============================== */
        .lp-light {
          background: #f4f6fb;
        }
        .lp-light .login-theme-toggle {
          background: rgba(0, 0, 0, 0.05);
          color: #475569;
        }
        .lp-light .login-theme-toggle:hover {
          background: rgba(0, 0, 0, 0.08);
          color: #1e40af;
        }
        .lp-light .login-bg-orb-1 { background: rgba(37, 99, 235, 0.08); }
        .lp-light .login-bg-orb-2 { background: rgba(139, 92, 246, 0.06); }
        .lp-light .login-bg-orb-3 { background: rgba(37, 99, 235, 0.04); }

        .lp-light .login-logo {
          filter: drop-shadow(0 0 20px rgba(37, 99, 235, 0.15));
        }

        .lp-light .login-card {
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 8px 32px rgba(0, 0, 0, 0.08);
        }
        .lp-light .login-title { color: #0f172a; }
        .lp-light .login-subtitle { color: #64748b; }
        .lp-light .login-label { color: #475569; }

        .lp-light .login-input {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #0f172a;
        }
        .lp-light .login-input::placeholder { color: #94a3b8; }
        .lp-light .login-input:hover {
          background: #fff;
          border-color: #cbd5e1;
        }
        .lp-light .login-input:focus {
          background: #fff;
          border-color: rgba(37, 99, 235, 0.5);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .lp-light .login-eye-btn { color: #94a3b8; }
        .lp-light .login-eye-btn:hover { color: #475569; }

        .lp-light .login-error {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #b91c1c;
        }

        .lp-light .login-btn {
          box-shadow: 0 2px 12px rgba(37, 99, 235, 0.25);
        }
        .lp-light .login-btn:hover:not(:disabled) {
          box-shadow: 0 4px 20px rgba(37, 99, 235, 0.35);
        }

        .lp-light .login-hint {
          color: #94a3b8;
          background: rgba(37, 99, 235, 0.04);
          border: 1px solid rgba(37, 99, 235, 0.08);
        }
        .lp-light .login-footer { color: #94a3b8; }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 480px) {
          .login-card {
            padding: 24px 20px;
            border-radius: 16px;
          }
          .login-logo {
            height: 56px;
          }
          .login-title {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
};
