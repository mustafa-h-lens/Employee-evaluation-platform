import { ArrowLeft, CheckCircle2, BarChart3, Users, Shield } from 'lucide-react';

export const Landing = ({ onLogin }: { onLogin: () => void }) => {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');

        .ld-page {
          min-height: 100vh;
          font-family: 'Cairo', 'Segoe UI', sans-serif;
          background: #030b1a;
          direction: rtl;
          color: #f0f4ff;
          position: relative;
          overflow: hidden;
        }
        .ld-grid {
          position: absolute; inset: 0; pointer-events: none; opacity: .6;
          background-image:
            linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px);
          background-size: 56px 56px;
        }
        .ld-orb1, .ld-orb2 {
          position: absolute; border-radius: 50%; pointer-events: none; filter: blur(50px);
        }
        .ld-orb1 {
          top: 10%; right: -80px;
          width: 420px; height: 420px;
          background: radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 65%);
        }
        .ld-orb2 {
          bottom: -60px; left: -40px;
          width: 320px; height: 320px;
          background: radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 65%);
        }

        .ld-nav {
          position: relative; z-index: 2;
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 48px;
        }
        .ld-nav-logo { height: 48px; object-fit: contain; cursor: pointer; transition: opacity .2s; }
        .ld-nav-logo:hover { opacity: .85; }
        .ld-login-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 9px 18px; border-radius: 10px; border: none;
          background: linear-gradient(135deg, #1d4ed8, #2563eb);
          color: #fff; font-family: inherit; font-size: .85rem; font-weight: 700;
          cursor: pointer; box-shadow: 0 4px 20px rgba(37,99,235,0.35);
          transition: box-shadow .2s, transform .15s;
        }
        .ld-login-btn:hover { box-shadow: 0 6px 28px rgba(37,99,235,0.55); transform: translateY(-1px); }

        .ld-hero {
          position: relative; z-index: 1;
          max-width: 1040px; margin: 0 auto;
          padding: 60px 32px 48px;
          text-align: center;
        }
        .ld-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 16px; border-radius: 9999px; margin-bottom: 24px;
          background: rgba(29,78,216,0.18); border: 1px solid rgba(59,130,246,0.3);
        }
        .ld-badge-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #60a5fa;
          animation: ld-pulse 2s infinite;
        }
        @keyframes ld-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:.4; transform:scale(.8); }
        }
        .ld-badge-txt {
          font-size: .75rem; font-weight: 700; color: #93c5fd;
          letter-spacing: .1em; text-transform: uppercase;
        }
        .ld-h1 {
          font-size: clamp(2rem, 5vw, 3.4rem);
          font-weight: 900; color: #fff;
          line-height: 1.18; margin-bottom: 18px;
        }
        .ld-grad {
          background: linear-gradient(90deg, #60a5fa, #34d399, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .ld-sub {
          font-size: clamp(.9rem, 2vw, 1.05rem);
          color: rgba(255,255,255,0.55);
          line-height: 1.8; max-width: 640px; margin: 0 auto 32px;
        }
        .ld-cta {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 14px 32px; border-radius: 12px; border: none;
          background: linear-gradient(135deg, #1d4ed8, #2563eb);
          color: #fff; font-family: inherit; font-size: 1rem; font-weight: 700;
          cursor: pointer; box-shadow: 0 6px 32px rgba(37,99,235,0.5);
          transition: box-shadow .2s, transform .15s;
        }
        .ld-cta:hover { box-shadow: 0 8px 40px rgba(37,99,235,0.7); transform: translateY(-1px); }

        .ld-features {
          position: relative; z-index: 1;
          max-width: 1040px; margin: 0 auto;
          padding: 20px 32px 80px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }
        .ld-feat {
          padding: 22px 22px;
          border-radius: 16px;
          background: rgba(8,18,38,0.55);
          border: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(8px);
          transition: transform .2s, border-color .2s, background .2s;
        }
        .ld-feat:hover {
          transform: translateY(-3px);
          border-color: rgba(59,130,246,0.25);
          background: rgba(8,18,38,0.75);
        }
        .ld-feat-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(37,99,235,0.12);
          border: 1px solid rgba(59,130,246,0.2);
          color: #60a5fa;
          margin-bottom: 14px;
        }
        .ld-feat-title { font-size: 1rem; font-weight: 800; color: #f0f4ff; margin-bottom: 6px; }
        .ld-feat-desc { font-size: .82rem; color: rgba(255,255,255,0.5); line-height: 1.7; }

        .ld-footer {
          position: relative; z-index: 1;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 20px 32px; text-align: center;
          font-size: .78rem; color: rgba(255,255,255,0.3);
        }

        @media (max-width: 720px) {
          .ld-nav { padding: 14px 20px; }
          .ld-nav-logo { height: 40px; }
          .ld-login-btn { padding: 8px 14px; font-size: .78rem; }
          .ld-hero { padding: 36px 18px 28px; }
          .ld-badge { padding: 5px 12px; margin-bottom: 18px; }
          .ld-badge-txt { font-size: .68rem; }
          .ld-sub { margin-bottom: 24px; }
          .ld-cta { padding: 12px 24px; font-size: .92rem; }
          .ld-features {
            padding: 10px 18px 48px;
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .ld-feat { padding: 18px 18px; }
          .ld-footer { padding: 18px 20px; font-size: .72rem; }
        }
      `}</style>

      <div className="ld-page">
        <div className="ld-grid" />
        <div className="ld-orb1" />
        <div className="ld-orb2" />

        <nav className="ld-nav">
          <img
            src="/logo-white.png"
            alt="Half Lens"
            className="ld-nav-logo"
            onClick={onLogin}
          />
          <button className="ld-login-btn" onClick={onLogin}>
            <span>تسجيل الدخول</span>
            <ArrowLeft size={16} />
          </button>
        </nav>

        <section className="ld-hero">
          <div className="ld-badge">
            <div className="ld-badge-dot" />
            <span className="ld-badge-txt">نظام تقييم الأداء الوظيفي</span>
          </div>
          <h1 className="ld-h1">
            تقييم أداء موظفيك<br />
            <span className="ld-grad">باحترافية عالية</span>
          </h1>
          <p className="ld-sub">
            نظام Half Lens لتقييم الأداء — تقييمات دورية، متابعة الأداء، وتقارير شاملة في مكان واحد متكامل يساعدك على اتخاذ قرارات مبنية على بيانات واضحة.
          </p>
          <button className="ld-cta" onClick={onLogin}>
            <span>ابدأ الآن</span>
            <ArrowLeft size={18} />
          </button>
        </section>

        <section className="ld-features">
          <div className="ld-feat">
            <div className="ld-feat-icon"><BarChart3 size={22} /></div>
            <div className="ld-feat-title">تقارير ذكية</div>
            <div className="ld-feat-desc">تقارير تفصيلية وملخصات لحظية عن أداء الموظفين والإدارات</div>
          </div>
          <div className="ld-feat">
            <div className="ld-feat-icon"><Users size={22} /></div>
            <div className="ld-feat-title">إدارة متكاملة</div>
            <div className="ld-feat-desc">هرمية كاملة للمدراء والمشرفين والموظفين بصلاحيات واضحة</div>
          </div>
          <div className="ld-feat">
            <div className="ld-feat-icon"><Shield size={22} /></div>
            <div className="ld-feat-title">أمان عالٍ</div>
            <div className="ld-feat-desc">حماية كاملة للبيانات مع سجل تدقيق شامل لكل إجراء داخل النظام</div>
          </div>
        </section>

        <div className="ld-footer">
          © {new Date().getFullYear()} Half Lens. جميع الحقوق محفوظة.
        </div>
      </div>
    </>
  );
};
