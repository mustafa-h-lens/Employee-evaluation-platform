import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Eye, EyeOff, AlertCircle, MessageSquare } from 'lucide-react';

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
    <div className="lp">
      {/* LEFT — Form side */}
      <div className="lp-form-side" dir="rtl">
        <div className="lp-form-inner">
          <div className="lp-form-content">
            <h1 className="lp-heading">مرحباً بعودتك</h1>
            <p className="lp-sub">سجّل دخولك للوصول إلى لوحة التحكم</p>

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
                  <div className="lp-input-icon-box">
                    <MessageSquare size={14} />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="lp-field">
                <label className="lp-label">كلمة المرور</label>
                <div className="lp-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="lp-input lp-input-pass"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <div className="lp-input-icon-box">
                    <MessageSquare size={14} />
                  </div>
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
                    <ArrowLeft size={17} />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="lp-copy">&copy; Half Lens 2026. جميع الحقوق محفوظة.</p>
        </div>
      </div>

      {/* Glowing divider */}
      <div className="lp-divider" />

      {/* RIGHT — Brand side */}
      <div className="lp-brand-side" dir="rtl">
        <div className="lp-brand-top">
          {/* Logo */}
          <img src="/Logo_White.png" alt="Half Lens" className="lp-brand-logo" />

          {/* Badge + title + description right below logo */}
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
        /* ===== LAYOUT — forced LTR flex so panels don't flip ===== */
        .lp {
          display: flex;
          flex-direction: row;
          direction: ltr;
          min-height: 100vh;
          font-family: 'Cairo', sans-serif;
          background: #050d1e;
        }

        /* ===== FORM SIDE (LEFT panel) ===== */
        .lp-form-side {
          width: 30%;
          min-width: 380px;
          max-width: 440px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 44px;
          background: #060e21;
          position: relative;
          z-index: 2;
        }
        .lp-form-inner {
          width: 100%;
          max-width: 360px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 500px;
        }
        .lp-form-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .lp-heading {
          font-size: 30px;
          font-weight: 800;
          color: #f0f4ff;
          margin: 0 0 8px;
          text-align: right;
        }
        .lp-sub {
          font-size: 14px;
          color: rgba(160,185,230,0.45);
          margin: 0 0 40px;
          font-weight: 400;
          text-align: right;
        }

        /* Form */
        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .lp-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .lp-label {
          font-size: 13px;
          font-weight: 600;
          color: rgba(160,185,230,0.55);
          text-align: right;
        }
        .lp-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .lp-input {
          width: 100%;
          height: 48px;
          padding: 0 48px 0 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          color: #e8eef8;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
          box-sizing: border-box;
          text-align: right;
          direction: rtl;
        }
        .lp-input-pass {
          padding-left: 44px;
        }
        .lp-input::placeholder { color: rgba(140,165,220,0.3); }
        .lp-input:hover {
          border-color: rgba(255,255,255,0.13);
          background: rgba(255,255,255,0.05);
        }
        .lp-input:focus {
          border-color: rgba(37,99,235,0.55);
          background: rgba(37,99,235,0.04);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.08);
        }

        .lp-input-icon-box {
          position: absolute;
          right: 12px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: rgba(37,99,235,0.12);
          color: rgba(96,165,250,0.7);
          pointer-events: none;
        }

        .lp-eye {
          position: absolute;
          left: 14px;
          background: none;
          border: none;
          color: rgba(140,165,220,0.3);
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
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.18);
          border-radius: 10px;
          color: #f87171;
          font-size: 13px;
          font-weight: 500;
          direction: rtl;
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
          box-shadow:
            0 4px 16px rgba(37,99,235,0.3),
            0 8px 32px rgba(37,99,235,0.15);
          margin-top: 8px;
          position: relative;
          overflow: hidden;
        }
        .lp-btn::after {
          content: '';
          position: absolute;
          bottom: -6px;
          left: 15%;
          right: 15%;
          height: 16px;
          background: rgba(37,99,235,0.5);
          filter: blur(14px);
          border-radius: 50%;
          pointer-events: none;
        }
        .lp-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow:
            0 6px 24px rgba(37,99,235,0.4),
            0 12px 40px rgba(37,99,235,0.2);
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

        /* Copyright */
        .lp-copy {
          text-align: center;
          font-size: 12px;
          color: rgba(140,165,220,0.2);
          margin: 0;
          padding-top: 20px;
        }

        /* ===== DIVIDER ===== */
        .lp-divider {
          width: 1px;
          flex-shrink: 0;
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(37,99,235,0.12) 15%,
            rgba(37,99,235,0.25) 50%,
            rgba(37,99,235,0.12) 85%,
            transparent 100%
          );
          position: relative;
          z-index: 3;
        }

        /* ===== BRAND SIDE (RIGHT panel) ===== */
        .lp-brand-side {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: flex-end;
          padding: 48px 56px;
          background: linear-gradient(160deg, #0a1832 0%, #060f24 40%, #050c1c 100%);
          position: relative;
          overflow: hidden;
        }

        .lp-brand-top {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          text-align: right;
        }

        .lp-brand-logo {
          height: 140px;
          width: auto;
          filter: drop-shadow(0 0 30px rgba(37,99,235,0.1));
          margin-bottom: 48px;
        }

        .lp-brand-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 20px;
          border: 1px solid rgba(37,99,235,0.3);
          border-radius: 9999px;
          font-size: 13px;
          font-weight: 600;
          color: rgba(180,205,255,0.7);
          margin-bottom: 20px;
          background: rgba(37,99,235,0.06);
          direction: rtl;
        }
        .lp-badge-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #3b82f6;
          box-shadow: 0 0 8px rgba(59,130,246,0.6);
        }

        .lp-brand-title {
          font-size: 44px;
          font-weight: 900;
          line-height: 1.35;
          color: #f0f4ff;
          margin: 0 0 18px;
        }
        .lp-brand-gradient {
          background: linear-gradient(135deg, #60a5fa 0%, #818cf8 35%, #a78bfa 60%, #34d399 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .lp-brand-desc {
          font-size: 15px;
          line-height: 1.9;
          color: rgba(160,185,230,0.4);
          margin: 0;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 1024px) {
          .lp-brand-side, .lp-divider { display: none; }
          .lp-form-side {
            width: 100%;
            min-width: unset;
            max-width: unset;
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
