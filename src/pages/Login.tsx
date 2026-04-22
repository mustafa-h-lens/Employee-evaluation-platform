import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Eye, EyeOff, AlertCircle, MessageSquare } from 'lucide-react';

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
    <div className="lp" dir="rtl">
      {/* LEFT — Form side */}
      <div className="lp-form-side">
        <div className="lp-form-inner">
          <h1 className="lp-heading">مرحباً بعودتك</h1>
          <p className="lp-sub">سجّل دخولك للوصول إلى نظام التقييم</p>

          <form onSubmit={handleSubmit} className="lp-form">
            {error && (
              <div className="lp-error">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {/* Email */}
            <div className="lp-field">
              <label className="lp-label">البريد الإلكتروني</label>
              <div className="lp-input-wrap">
                <input
                  type="email"
                  className="lp-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <MessageSquare size={16} className="lp-input-icon" />
              </div>
            </div>

            {/* Password */}
            <div className="lp-field">
              <label className="lp-label">كلمة المرور</label>
              <div className="lp-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="lp-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <MessageSquare size={16} className="lp-input-icon" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="lp-eye"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" className="lp-btn" disabled={loading}>
              {loading ? (
                <div className="lp-spinner" />
              ) : (
                <>
                  <span>تسجيل الدخول</span>
                  <LogIn size={17} />
                </>
              )}
            </button>
          </form>

          <p className="lp-copy">&copy; Half Lens 2026. جميع الحقوق محفوظة.</p>
        </div>
      </div>

      {/* RIGHT — Brand side */}
      <div className="lp-brand-side">
        {/* Subtle grid overlay */}
        <div className="lp-grid-bg" />

        <div className="lp-brand-content">
          <img src="/Logo_White.png" alt="Half Lens" className="lp-brand-logo" />

          <div className="lp-brand-badge">
            <span className="lp-badge-dot" />
            نظام تقييم الأداء الوظيفي
          </div>

          <h2 className="lp-brand-title">
            تقييم أداء موظفيك
            <br />
            <span className="lp-brand-gradient">باحترافية عالية</span>
          </h2>

          <p className="lp-brand-desc">
            نظام Half Lens لتقييم الأداء — تقييمات دورية، متابعة الأداء،
            <br />
            وتقارير شاملة في مكان واحد متكامل.
          </p>
        </div>
      </div>

      <style>{`
        /* ===== LAYOUT ===== */
        .lp {
          display: flex;
          min-height: 100vh;
          direction: rtl;
          font-family: 'Cairo', sans-serif;
        }

        /* ===== FORM SIDE ===== */
        .lp-form-side {
          width: 480px;
          min-width: 380px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
          background: #060e21;
          border-left: 1px solid rgba(255,255,255,0.06);
          position: relative;
          z-index: 2;
        }
        .lp-form-inner {
          width: 100%;
          max-width: 380px;
        }

        .lp-heading {
          font-size: 28px;
          font-weight: 800;
          color: #f0f4ff;
          margin: 0 0 8px;
        }
        .lp-sub {
          font-size: 14px;
          color: rgba(180,200,240,0.5);
          margin: 0 0 36px;
        }

        /* Form */
        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .lp-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .lp-label {
          font-size: 13px;
          font-weight: 600;
          color: rgba(180,200,240,0.6);
        }
        .lp-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .lp-input {
          width: 100%;
          height: 48px;
          padding: 0 44px 0 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          color: #f0f4ff;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
          box-sizing: border-box;
        }
        .lp-input::placeholder { color: rgba(150,175,230,0.3); }
        .lp-input:hover {
          border-color: rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.06);
        }
        .lp-input:focus {
          border-color: rgba(37,99,235,0.6);
          background: rgba(37,99,235,0.04);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }

        .lp-input-icon {
          position: absolute;
          right: 14px;
          color: rgba(120,150,220,0.35);
          pointer-events: none;
        }

        .lp-eye {
          position: absolute;
          left: 14px;
          background: none;
          border: none;
          color: rgba(150,175,230,0.35);
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }
        .lp-eye:hover { color: rgba(200,215,255,0.7); }

        /* Error */
        .lp-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          color: #f87171;
          font-size: 13px;
          font-weight: 500;
        }

        /* Button */
        .lp-btn {
          width: 100%;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
          color: #fff;
          border: none;
          border-radius: 14px;
          font-size: 16px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
          box-shadow: 0 4px 20px rgba(37,99,235,0.35);
          margin-top: 6px;
        }
        .lp-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 28px rgba(37,99,235,0.5);
        }
        .lp-btn:active:not(:disabled) { transform: scale(0.97); }
        .lp-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .lp-spinner {
          width: 20px; height: 20px;
          border: 2.5px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: lp-spin 0.7s linear infinite;
        }
        @keyframes lp-spin { to { transform: rotate(360deg); } }

        /* Footer */
        .lp-copy {
          margin-top: 40px;
          text-align: center;
          font-size: 12px;
          color: rgba(150,175,230,0.25);
        }

        /* ===== BRAND SIDE ===== */
        .lp-brand-side {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px;
          background: linear-gradient(160deg, #071428 0%, #050d1e 40%, #060c1a 100%);
          position: relative;
          overflow: hidden;
        }

        /* Subtle grid pattern */
        .lp-grid-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
        }

        .lp-brand-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          text-align: right;
          max-width: 560px;
        }

        .lp-brand-logo {
          height: 140px;
          width: auto;
          margin-bottom: 48px;
          filter: drop-shadow(0 0 40px rgba(37,99,235,0.15));
        }

        .lp-brand-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 18px;
          border: 1px solid rgba(37,99,235,0.3);
          border-radius: 9999px;
          font-size: 13px;
          font-weight: 600;
          color: rgba(200,215,255,0.7);
          margin-bottom: 24px;
          background: rgba(37,99,235,0.06);
        }
        .lp-badge-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #3b82f6;
          box-shadow: 0 0 8px rgba(59,130,246,0.6);
        }

        .lp-brand-title {
          font-size: 42px;
          font-weight: 900;
          line-height: 1.3;
          color: #f0f4ff;
          margin: 0 0 20px;
        }
        .lp-brand-gradient {
          background: linear-gradient(135deg, #60a5fa 0%, #818cf8 40%, #a78bfa 70%, #34d399 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .lp-brand-desc {
          font-size: 15px;
          line-height: 1.8;
          color: rgba(180,200,240,0.45);
          margin: 0;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 1024px) {
          .lp-brand-side { display: none; }
          .lp-form-side {
            width: 100%;
            min-width: unset;
            border-left: none;
          }
        }
        @media (max-width: 480px) {
          .lp-form-side { padding: 32px 24px; }
          .lp-heading { font-size: 24px; }
        }
      `}</style>
    </div>
  );
};
