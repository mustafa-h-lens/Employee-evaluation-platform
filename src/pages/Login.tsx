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
          background: #f4f6fb;
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
          background: rgba(37, 99, 235, 0.08);
          top: -150px; right: -100px;
        }
        .login-bg-orb-2 {
          width: 400px; height: 400px;
          background: rgba(139, 92, 246, 0.06);
          bottom: -120px; left: -80px;
        }
        .login-bg-orb-3 {
          width: 300px; height: 300px;
          background: rgba(37, 99, 235, 0.04);
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
          filter: drop-shadow(0 0 20px rgba(37, 99, 235, 0.15));
        }

        /* Card */
        .login-card {
          width: 100%;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(0, 0, 0, 0.06);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 8px 32px rgba(0, 0, 0, 0.08);
        }

        .login-card-header {
          text-align: center;
          margin-bottom: 28px;
        }
        .login-title {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 6px;
        }
        .login-subtitle {
          font-size: 14px;
          color: #64748b;
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
          color: #475569;
        }
        .login-input-wrap {
          position: relative;
        }
        .login-input {
          width: 100%;
          height: 44px;
          padding: 0 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          color: #0f172a;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-sizing: border-box;
        }
        .login-input::placeholder {
          color: #94a3b8;
        }
        .login-input:hover {
          background: #fff;
          border-color: #cbd5e1;
        }
        .login-input:focus {
          background: #fff;
          border-color: rgba(37, 99, 235, 0.5);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .login-eye-btn {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }
        .login-eye-btn:hover {
          color: #475569;
        }

        /* Error */
        .login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 10px;
          color: #b91c1c;
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
          box-shadow: 0 2px 12px rgba(37, 99, 235, 0.25);
          margin-top: 4px;
        }
        .login-btn:hover:not(:disabled) {
          background: #3b82f6;
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(37, 99, 235, 0.35);
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
          color: #94a3b8;
          padding: 12px;
          background: rgba(37, 99, 235, 0.04);
          border: 1px solid rgba(37, 99, 235, 0.08);
          border-radius: 10px;
        }

        /* Footer */
        .login-footer {
          font-size: 12px;
          color: #94a3b8;
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
