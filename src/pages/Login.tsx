import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

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

  return (
    <div className="login-page" dir="rtl">
      {/* Background decorations */}
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />
      <div className="login-bg-orb login-bg-orb-3" />

      <div className="login-container">
        {/* Logo */}
        <div className="login-logo-box">
          <img src="/logo-color.png" alt="Half Lens" className="login-logo" />
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
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #050d1e;
          position: relative;
          overflow: hidden;
          padding: 24px;
        }

        /* Ambient glow orbs */
        .login-bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
        }
        .login-bg-orb-1 {
          width: 500px; height: 500px;
          background: rgba(37, 99, 235, 0.12);
          top: -150px; right: -100px;
        }
        .login-bg-orb-2 {
          width: 400px; height: 400px;
          background: rgba(139, 92, 246, 0.08);
          bottom: -120px; left: -80px;
        }
        .login-bg-orb-3 {
          width: 300px; height: 300px;
          background: rgba(37, 99, 235, 0.06);
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
          filter: drop-shadow(0 0 24px rgba(37, 99, 235, 0.25));
        }

        /* Card */
        .login-card {
          width: 100%;
          background: rgba(7, 20, 45, 0.75);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 20px;
          padding: 32px;
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .login-card-header {
          text-align: center;
          margin-bottom: 28px;
        }
        .login-title {
          font-size: 22px;
          font-weight: 800;
          color: #f0f4ff;
          margin: 0 0 6px;
        }
        .login-subtitle {
          font-size: 14px;
          color: rgba(200, 215, 255, 0.55);
          margin: 0;
          font-weight: 400;
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
          color: rgba(200, 215, 255, 0.65);
        }
        .login-input-wrap {
          position: relative;
        }
        .login-input {
          width: 100%;
          height: 44px;
          padding: 0 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 10px;
          color: #f0f4ff;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-sizing: border-box;
        }
        .login-input::placeholder {
          color: rgba(150, 175, 230, 0.35);
        }
        .login-input:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.14);
        }
        .login-input:focus {
          background: rgba(37, 99, 235, 0.05);
          border-color: rgba(37, 99, 235, 0.55);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .login-eye-btn {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: rgba(150, 175, 230, 0.4);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }
        .login-eye-btn:hover {
          color: rgba(200, 215, 255, 0.7);
        }

        /* Error */
        .login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 10px;
          color: #f87171;
          font-size: 13px;
          font-weight: 500;
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
          color: rgba(150, 175, 230, 0.35);
          padding: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 10px;
        }

        /* Footer */
        .login-footer {
          font-size: 12px;
          color: rgba(150, 175, 230, 0.3);
          text-align: center;
          margin: 0;
        }

        /* Responsive */
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
