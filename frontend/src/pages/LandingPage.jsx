import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield, TrendingUp, Bell, Store, BarChart3,
  ChevronRight, CheckCircle, ArrowRight, Car,
  Zap, Globe, Users, Award, HeartPulse,
} from 'lucide-react';

/* ── Animated counter hook ────────────────────────────── */
function useCounter(end, duration = 2000, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = null;
    const raf = (ts) => {
      if (!start) start = ts;
      const pct = Math.min((ts - start) / duration, 1);
      setCount(Math.floor(pct * end));
      if (pct < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [end, duration, active]);
  return count;
}

/* ── Intersection observer hook ──────────────────────── */
function useVisible(threshold = 0.25) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

/* ══════════════════════════════════════════════════════
   LANDING PAGE
═══════════════════════════════════════════════════════ */
const LandingPage = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [statsRef, statsVisible] = useVisible(0.3);
  const [featRef, featVisible] = useVisible(0.1);
  const [howRef, howVisible] = useVisible(0.2);

  const c1 = useCounter(50000, 2200, statsVisible);
  const c2 = useCounter(2500, 2200, statsVisible);
  const c3 = useCounter(98, 1800, statsVisible);
  const c4 = useCounter(240, 2200, statsVisible);

  /* auth redirect */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const role = String(user.role || '').toUpperCase();
    navigate(role === 'GARAGE' ? '/garage-dashboard' : '/user-dashboard', { replace: true });
  }, [navigate]);

  /* navbar scroll */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  /* ── inline keyframes ─────────────────────────────── */
  const css = `
    *{box-sizing:border-box;margin:0;padding:0;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:translateY(0)}}
    @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
    @keyframes floatY2{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
    @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
    @keyframes glowPulse{0%,100%{box-shadow:0 4px 24px rgba(37,99,235,.35),0 2px 8px rgba(37,99,235,.15)}50%{box-shadow:0 8px 40px rgba(37,99,235,.55),0 4px 16px rgba(37,99,235,.25)}}
    @keyframes dotPulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.5)}}
    @keyframes scanline{0%{top:-4px}100%{top:100%}}
    .fu{opacity:0;animation:fadeUp .75s ease forwards}
    .fu1{animation-delay:.1s}.fu2{animation-delay:.25s}.fu3{animation-delay:.4s}.fu4{animation-delay:.55s}.fu5{animation-delay:.7s}
    .float{animation:floatY 7s ease-in-out infinite}
    .float2{animation:floatY2 9s 1s ease-in-out infinite}
    .shimmer-text{background:linear-gradient(90deg,#2563eb,#0284c7,#7c3aed,#2563eb);background-size:250% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 4.5s linear infinite}
    .glow-cta{animation:glowPulse 3s ease-in-out infinite;transition:transform .18s ease}
    .glow-cta:hover{transform:translateY(-3px) scale(1.03)!important}
    .card{transition:transform .3s ease,box-shadow .3s ease,border-color .3s ease;background:#fff;border:1px solid #e2e8f0;border-radius:20px}
    .card:hover{transform:translateY(-10px)!important;box-shadow:0 24px 60px rgba(37,99,235,.13)!important;border-color:rgba(37,99,235,.35)!important}
    .nav-a{color:#475569;font-size:.88rem;font-weight:500;text-decoration:none;position:relative;transition:color .2s}
    .nav-a::after{content:'';position:absolute;width:0;height:2px;bottom:-5px;left:0;background:linear-gradient(90deg,#2563eb,#0284c7);transition:width .3s ease}
    .nav-a:hover{color:#2563eb}.nav-a:hover::after{width:100%}
    .scan{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(37,99,235,.4),transparent);animation:scanline 2.5s linear infinite;pointer-events:none}
    ::-webkit-scrollbar{width:6px;background:#f1f5f9}
    ::-webkit-scrollbar-thumb{background:rgba(37,99,235,.3);border-radius:6px}
  `;

  return (
    <div style={{ background: '#f8fafc', color: '#0f172a', fontFamily: "'Inter',system-ui,sans-serif", overflowX: 'hidden', lineHeight: 1 }}>
      <style>{css}</style>

      {/* ════════════════════════════════
           NAVBAR
      ════════════════════════════════ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
        padding: '0 2.5rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(226,232,240,.8)',
        boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,.06)' : 'none',
        transition: 'all .35s ease',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg,#2563eb,#06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 22px rgba(37,99,235,.55)',
          }}>
            <Car size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: '1.3rem', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a' }}>
            Dri<span style={{ color: '#2563eb' }}>vix</span>
          </span>
        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: '2.25rem', alignItems: 'center' }}>
          {[['#features', 'Features'], ['#how-it-works', 'How It Works'], ['#for-garages', 'For Garages'], ['#analytics', 'Analytics']].map(([href, label]) => (
            <a key={href} href={href} className="nav-a">{label}</a>
          ))}
        </div>

        {/* Auth CTAs */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link to="/login" style={{
            color: '#374151', fontWeight: 500, fontSize: '.88rem',
            padding: '.48rem 1.2rem', borderRadius: 8, textDecoration: 'none',
            border: '1px solid #e2e8f0', transition: 'all .2s', background: '#fff',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
            Log in
          </Link>
          <Link to="/signup" className="glow-cta" style={{
            background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
            color: '#fff', fontWeight: 700, fontSize: '.88rem',
            padding: '.48rem 1.3rem', borderRadius: 8, textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            Get Started <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* ════════════════════════════════
           HERO
      ════════════════════════════════ */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden', paddingTop: 64, background: 'linear-gradient(160deg,#eff6ff 0%,#f8fafc 50%,#f0f9ff 100%)' }}>
        {/* grid bg */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(37,99,235,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,.05) 1px,transparent 1px)',
          backgroundSize: '64px 64px', pointerEvents: 'none',
        }} />
        {/* orb 1 */}
        <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,99,235,.1) 0%,transparent 68%)', top: -160, left: -160, pointerEvents: 'none' }} />
        {/* orb 2 */}
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(2,132,199,.08) 0%,transparent 68%)', bottom: -80, right: -80, pointerEvents: 'none' }} />
        {/* orb 3 */}
        <div style={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle,rgba(124,58,237,.07) 0%,transparent 68%)', top: '45%', left: '58%', pointerEvents: 'none' }} />

        {/* ── Automotive background illustration ── */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '58%', pointerEvents: 'none', overflow: 'hidden' }}>
          <svg viewBox="0 0 1440 300" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg"
            style={{ position: 'absolute', bottom: 0, width: '100%' }}>
            <defs>
              <linearGradient id="bodyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.07" />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.04" />
              </linearGradient>
              <linearGradient id="glassFill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* ── MAIN CAR BODY — modern sedan ── */}
            {/*
              Path traces clockwise starting from front bumper bottom:
              Front bumper → hood → A-pillar / windshield → roof →
              C-pillar → trunk → rear bumper → bottom (with wheel arch cutouts) → Z
            */}
            <path d="
              M 237,268
              C 236,257 239,242 253,230
              C 260,224 273,217 296,212
              C 344,207 398,204 462,200
              C 492,196 515,195 536,191
              C 562,178 583,150 600,124
              C 611,112 624,106 638,104
              L 856,104
              C 872,106 889,117 906,136
              C 922,154 936,174 946,188
              C 962,196 998,201 1040,204
              C 1082,206 1132,210 1170,216
              C 1182,221 1191,238 1193,258
              L 1194,268
              L 1086,268
              Q 1040,170 994,268
              L 460,268
              Q 415,170 369,268
              Z"
              fill="url(#bodyFill)"
              stroke="rgba(37,99,235,0.32)"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />

            {/* ── GREENHOUSE — windshield + side windows + C-pillar glass ── */}
            <path d="
              M 540,190
              C 562,178 584,150 602,126
              C 612,114 624,107 638,104
              L 856,104
              C 870,106 888,118 906,137
              L 912,162
              L 640,158
              Z"
              fill="url(#glassFill)"
              stroke="rgba(37,99,235,0.24)"
              strokeWidth="1.2"
            />

            {/* ── B-PILLAR (centre door post) ── */}
            <line x1="748" y1="104" x2="748" y2="160"
              stroke="rgba(37,99,235,0.38)" strokeWidth="3" />

            {/* ── DOOR GAP ── */}
            <path d="M 748,160 L 752,268"
              stroke="rgba(37,99,235,0.22)" strokeWidth="1.5" />

            {/* ── BELT LINE / character line ── */}
            <path d="M 558,191 C 598,172 638,160 700,157 C 760,155 820,157 878,161 C 908,164 936,169 955,177"
              fill="none" stroke="rgba(37,99,235,0.16)" strokeWidth="1.2" />

            {/* ── HOOD SURFACE CREASE ── */}
            <path d="M 296,211 C 344,207 398,204 462,200 C 492,196 515,195 536,191"
              fill="none" stroke="rgba(37,99,235,0.18)" strokeWidth="1" />

            {/* ── FRONT LED HEADLIGHT ── */}
            <path d="M 253,228 C 253,220 259,214 268,213 L 294,211 C 290,220 285,229 281,235 L 255,236 Z"
              fill="rgba(37,99,235,0.22)" stroke="rgba(37,99,235,0.44)" strokeWidth="1.2" />
            <line x1="258" y1="214" x2="290" y2="212"
              stroke="rgba(219,234,254,0.7)" strokeWidth="1.2" />

            {/* ── REAR TAIL LIGHT ── */}
            <path d="M 1178,217 C 1183,222 1190,238 1193,257 L 1194,268 L 1170,268 L 1169,214 Z"
              fill="rgba(220,38,38,0.18)" stroke="rgba(220,38,38,0.38)" strokeWidth="1.2" />

            {/* ── SIDE MIRROR ── */}
            <path d="M 534,175 L 530,163 L 516,160 L 514,172 Z"
              fill="rgba(37,99,235,0.16)" stroke="rgba(37,99,235,0.38)" strokeWidth="1.2" />

            {/* ── FRONT WHEEL: tyre → outer rim → inner rim → hub → 6 spokes ── */}
            <circle cx="415" cy="228" r="52"
              fill="rgba(15,23,42,0.05)" stroke="rgba(37,99,235,0.32)" strokeWidth="2" />
            <circle cx="415" cy="228" r="36"
              fill="rgba(37,99,235,0.05)" stroke="rgba(37,99,235,0.24)" strokeWidth="1.4" />
            <circle cx="415" cy="228" r="12"
              fill="rgba(37,99,235,0.15)" stroke="rgba(37,99,235,0.36)" strokeWidth="1.2" />
            {[0, 60, 120, 180, 240, 300].map(a => (
              <line key={a}
                x1={415 + 12 * Math.cos(a * Math.PI / 180)} y1={228 + 12 * Math.sin(a * Math.PI / 180)}
                x2={415 + 34 * Math.cos(a * Math.PI / 180)} y2={228 + 34 * Math.sin(a * Math.PI / 180)}
                stroke="rgba(37,99,235,0.28)" strokeWidth="2" />
            ))}

            {/* ── REAR WHEEL ── */}
            <circle cx="1040" cy="228" r="52"
              fill="rgba(15,23,42,0.05)" stroke="rgba(37,99,235,0.32)" strokeWidth="2" />
            <circle cx="1040" cy="228" r="36"
              fill="rgba(37,99,235,0.05)" stroke="rgba(37,99,235,0.24)" strokeWidth="1.4" />
            <circle cx="1040" cy="228" r="12"
              fill="rgba(37,99,235,0.15)" stroke="rgba(37,99,235,0.36)" strokeWidth="1.2" />
            {[0, 60, 120, 180, 240, 300].map(a => (
              <line key={a}
                x1={1040 + 12 * Math.cos(a * Math.PI / 180)} y1={228 + 12 * Math.sin(a * Math.PI / 180)}
                x2={1040 + 34 * Math.cos(a * Math.PI / 180)} y2={228 + 34 * Math.sin(a * Math.PI / 180)}
                stroke="rgba(37,99,235,0.28)" strokeWidth="2" />
            ))}

            {/* ── GROUND LINE + SHADOW ── */}
            <line x1="0" y1="278" x2="1440" y2="278"
              stroke="rgba(37,99,235,0.2)" strokeWidth="1.5" />
            <ellipse cx="720" cy="282" rx="520" ry="10" fill="rgba(37,99,235,0.04)" />

            {/* ── MOTION LINES ── */}
            <line x1="10" y1="262" x2="218" y2="262" stroke="rgba(37,99,235,0.2)" strokeWidth="1.8" strokeDasharray="26,10" />
            <line x1="10" y1="252" x2="158" y2="252" stroke="rgba(37,99,235,0.13)" strokeWidth="1.2" strokeDasharray="20,12" />
            <line x1="10" y1="244" x2="192" y2="244" stroke="rgba(37,99,235,0.09)" strokeWidth="1" strokeDasharray="16,14" />
            <line x1="1222" y1="262" x2="1430" y2="262" stroke="rgba(37,99,235,0.2)" strokeWidth="1.8" strokeDasharray="26,10" />
            <line x1="1282" y1="252" x2="1430" y2="252" stroke="rgba(37,99,235,0.13)" strokeWidth="1.2" strokeDasharray="20,12" />
          </svg>
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '5rem 2rem 4rem', width: '100%' }}>
          {/* Badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.6rem' }}>
            <div className="fu fu1" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(37,99,235,.08)', border: '1px solid rgba(37,99,235,.25)',
              borderRadius: 100, padding: '.38rem 1rem',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee', display: 'inline-block', animation: 'dotPulse 2s ease-in-out infinite' }} />
              <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#2563eb', letterSpacing: '.08em', textTransform: 'uppercase' }}>The Future of Vehicle Intelligence</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="fu fu2" style={{ fontSize: 'clamp(2.8rem,6.5vw,5.2rem)', fontWeight: 900, lineHeight: 1.04, letterSpacing: '-0.045em', textAlign: 'center', marginBottom: '1.4rem', color: '#0f172a' }}>
            Your Vehicle's{' '}
            <span className="shimmer-text">Digital Brain</span>
          </h1>

          {/* Sub */}
          <p className="fu fu3" style={{ fontSize: 'clamp(.95rem,1.8vw,1.2rem)', color: '#64748b', maxWidth: 620, margin: '0 auto 2.8rem', lineHeight: 1.75, textAlign: 'center' }}>
            Track every service, monitor health, detect odometer fraud, and unlock true resale value — all in one intelligent platform built for the modern driver.
          </p>

          {/* CTAs */}
          <div className="fu fu4" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '4.5rem' }}>
            <Link to="/signup" className="glow-cta" style={{
              background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
              color: '#fff', fontWeight: 700, fontSize: '1rem',
              padding: '.9rem 2.5rem', borderRadius: 12, textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              Start for Free <ArrowRight size={17} />
            </Link>
            <a href="#features" style={{
              background: '#fff', color: '#374151',
              fontWeight: 600, fontSize: '1rem',
              padding: '.9rem 2.5rem', borderRadius: 12, textDecoration: 'none',
              border: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all .2s',
              boxShadow: '0 1px 4px rgba(0,0,0,.06)',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
              Explore Features
            </a>
          </div>

          {/* ── Dashboard mockup ── */}
          <div className="fu fu5 float" style={{ maxWidth: 880, margin: '0 auto', position: 'relative' }}>
            {/* Main card */}
            <div style={{
              background: '#fff', backdropFilter: 'blur(24px)',
              border: '1px solid #e2e8f0', borderRadius: 24,
              padding: '2rem', boxShadow: '0 20px 60px rgba(37,99,235,.1),0 4px 20px rgba(0,0,0,.06)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div className="scan" />
              {/* header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg,#2563eb,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(37,99,235,.5)' }}>
                    <Car size={22} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>Toyota Fortuner</div>
                    <div style={{ color: '#94a3b8', fontSize: '.78rem', marginTop: 2 }}>KA 05 MX 2847 &nbsp;•&nbsp; 2022 &nbsp;•&nbsp; 44,820 km</div>
                  </div>
                </div>
                <div style={{ background: 'rgba(74,222,128,.15)', border: '1px solid rgba(74,222,128,.35)', color: '#4ade80', fontWeight: 700, fontSize: '.82rem', padding: '.32rem .9rem', borderRadius: 50 }}>
                  ● Excellent Condition
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '.9rem', marginBottom: '1.4rem' }}>
                {[
                  { label: 'Health Score', val: '92', unit: '/100', color: '#16a34a' },
                  { label: 'Trust Score', val: '87', unit: '/100', color: '#2563eb' },
                  { label: 'Est. Value', val: '₹18.4L', unit: '', color: '#d97706' },
                  { label: 'Next Service', val: '2,100', unit: 'km', color: '#7c3aed' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.55rem', fontWeight: 900, color: s.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {s.val}<span style={{ fontSize: '.72rem', color: '#94a3b8' }}>{s.unit}</span>
                    </div>
                    <div style={{ fontSize: '.7rem', color: '#64748b', marginTop: 6, fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ flex: 1, height: 7, background: '#e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ width: '72%', height: '100%', background: 'linear-gradient(90deg,#2563eb,#0284c7)', borderRadius: 10 }} />
                </div>
                <span style={{ fontSize: '.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>72% service cycle complete</span>
              </div>
            </div>

            {/* Floating badge — left */}
            <div className="float2" style={{
              position: 'absolute', left: '-3%', top: '18%',
              background: '#fff', backdropFilter: 'blur(16px)',
              border: '1px solid #fde68a', borderRadius: 14,
              padding: '.8rem 1.1rem', minWidth: 178,
              boxShadow: '0 8px 30px rgba(217,119,6,.12)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Bell size={13} color="#d97706" />
                <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#d97706' }}>Insurance Expiring</span>
              </div>
              <div style={{ fontSize: '.68rem', color: '#94a3b8' }}>12 days remaining — Renew now</div>
            </div>

            {/* Floating badge — right */}
            <div className="float2" style={{
              position: 'absolute', right: '-3%', top: '22%',
              background: '#fff', backdropFilter: 'blur(16px)',
              border: '1px solid #bbf7d0', borderRadius: 14,
              padding: '.8rem 1.1rem',
              animationDelay: '.8s',
              boxShadow: '0 8px 30px rgba(22,163,74,.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Shield size={13} color="#16a34a" />
                <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#16a34a' }}>Service Verified</span>
              </div>
              <div style={{ fontSize: '.68rem', color: '#94a3b8' }}>No tamper flags detected</div>
            </div>

            {/* Floating badge — bottom right */}
            <div className="float2" style={{
              position: 'absolute', right: '8%', bottom: '-6%',
              background: '#fff', backdropFilter: 'blur(16px)',
              border: '1px solid #bfdbfe', borderRadius: 14,
              padding: '.8rem 1.1rem', animationDelay: '1.5s',
              boxShadow: '0 8px 30px rgba(37,99,235,.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <TrendingUp size={13} color="#2563eb" />
                <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#2563eb' }}>Resale Valuation Ready</span>
              </div>
              <div style={{ fontSize: '.68rem', color: '#94a3b8' }}>₹17.2L – ₹19.6L estimated range</div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
           STATS BAR
      ════════════════════════════════ */}
      <div ref={statsRef} style={{ borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '3.5rem 2rem', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '2rem', textAlign: 'center' }}>
          {[
            { val: c1.toLocaleString() + '+', label: 'Vehicles Tracked', icon: <Car size={20} color="#2563eb" />, color: '#2563eb' },
            { val: c2.toLocaleString() + '+', label: 'Verified Garages', icon: <Store size={20} color="#0284c7" />, color: '#0284c7' },
            { val: c3 + '%', label: 'Health Accuracy', icon: <Award size={20} color="#7c3aed" />, color: '#7c3aed' },
            { val: '₹' + c4 + 'Cr+', label: 'Fraud Prevented', icon: <Shield size={20} color="#d97706" />, color: '#d97706' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ width: 50, height: 50, borderRadius: 13, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', border: `1px solid ${s.color}22` }}>
                {s.icon}
              </div>
              <div style={{ fontSize: '2.1rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#0f172a' }}>{s.val}</div>
              <div style={{ fontSize: '.82rem', color: '#64748b', marginTop: 6, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════
           FEATURES
      ════════════════════════════════ */}
      <section id="features" ref={featRef} style={{ padding: '7rem 2rem', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Section heading */}
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#3b82f6', letterSpacing: '.12em', textTransform: 'uppercase' }}>PLATFORM FEATURES</span>
            <h2 style={{ fontSize: 'clamp(1.9rem,4vw,3.1rem)', fontWeight: 900, marginTop: '.7rem', letterSpacing: '-0.04em', lineHeight: 1.08, color: '#0f172a' }}>
              Everything Your Vehicle Needs
            </h2>
            <p style={{ fontSize: '1.05rem', color: '#64748b', maxWidth: 540, margin: '1rem auto 0', lineHeight: 1.75 }}>
              A complete intelligence layer for your vehicle's entire lifetime — from first drive to final sale.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(316px,1fr))', gap: '1.4rem' }}>
            {[
              {
                icon: <Shield size={26} color="#2563eb" />,
                bg: '#eff6ff', border: '#bfdbfe',
                tag: 'ANTI-FRAUD', tagColor: '#2563eb',
                title: 'Fraud-Proof Service History',
                desc: 'Dual-layer verification cross-checks odometer readings from owners and garages. Tamper flags trigger automatically on discrepancies exceeding 50 km.',
              },
              {
                icon: <HeartPulse size={26} color="#dc2626" />,
                bg: '#fff1f2', border: '#fecdd3',
                tag: 'AI-POWERED', tagColor: '#dc2626',
                title: 'Live Vehicle Health Score',
                desc: 'Multi-factor engine evaluates legal validity, maintenance frequency, verified records and behavioral patterns to produce a precise 0–100 health score.',
              },
              {
                icon: <TrendingUp size={26} color="#d97706" />,
                bg: '#fffbeb', border: '#fde68a',
                tag: 'VALUATION ENGINE', tagColor: '#d97706',
                title: 'Intelligent Resale Valuation',
                desc: 'Algorithmic depreciation model plus a trust score adjusted for ownership transfers, verified history and accident records to compute a precise price range.',
              },
              {
                icon: <Bell size={26} color="#7c3aed" />,
                bg: '#f5f3ff', border: '#ddd6fe',
                tag: 'PROACTIVE ALERTS', tagColor: '#7c3aed',
                title: 'Smart Legal Reminders',
                desc: 'Never miss an expiry. Priority-based alerts for Insurance, PUC, RC, Fitness Certificate and Road Tax — dispatched weeks before they lapse.',
              },
              {
                icon: <Store size={26} color="#0284c7" />,
                bg: '#f0f9ff', border: '#bae6fd',
                tag: 'MARKETPLACE', tagColor: '#0284c7',
                title: 'Verified Garage Marketplace',
                desc: 'Discover certified service centres, compare pricing, and book appointments. Every service claim is cross-verified on our platform for authenticity.',
              },
              {
                icon: <BarChart3 size={26} color="#16a34a" />,
                bg: '#f0fdf4', border: '#bbf7d0',
                tag: 'DATA INTELLIGENCE', tagColor: '#16a34a',
                title: 'Fleet Analytics Dashboard',
                desc: 'Real-time expense trends, category breakdowns, mileage distributions and health scores across your entire fleet — all in one visual dashboard.',
              },
            ].map((f, i) => (
              <div key={f.title} className="card" style={{
                background: f.bg, border: `1px solid ${f.border}`, borderRadius: 20,
                padding: '2rem', cursor: 'default',
                opacity: featVisible ? 1 : 0,
                transform: featVisible ? 'none' : 'translateY(32px)',
                transition: `opacity .6s ${i * .1}s ease, transform .6s ${i * .1}s ease`,
              }}>
                <div style={{ width: 54, height: 54, borderRadius: 15, background: '#fff', boxShadow: `0 2px 12px ${f.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.2rem' }}>
                  {f.icon}
                </div>
                <div style={{ fontSize: '.68rem', fontWeight: 800, color: f.tagColor, letterSpacing: '.1em', marginBottom: '.6rem' }}>{f.tag}</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '.7rem', lineHeight: 1.3, color: '#0f172a' }}>{f.title}</h3>
                <p style={{ fontSize: '.88rem', color: '#64748b', lineHeight: 1.72 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
           HOW IT WORKS
      ════════════════════════════════ */}
      <section id="how-it-works" ref={howRef} style={{ padding: '7rem 2rem', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#06b6d4', letterSpacing: '.12em', textTransform: 'uppercase' }}>HOW IT WORKS</span>
            <h2 style={{ fontSize: 'clamp(1.9rem,4vw,3.1rem)', fontWeight: 900, marginTop: '.7rem', letterSpacing: '-0.04em', color: '#0f172a' }}>
              Up and Running in 3 Steps
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '2rem', position: 'relative' }}>
            {/* connector */}
            <div style={{ position: 'absolute', top: 56, left: '22%', right: '22%', height: 2, background: 'linear-gradient(90deg,rgba(37,99,235,.5),rgba(6,182,212,.5),rgba(167,139,250,.5))', zIndex: 0 }} />

            {[
              { n: '01', c: '#3b82f6', t: 'Register Your Vehicle', d: "Add your vehicle's complete digital profile — ownership history, legal documents, chassis & engine numbers, and current odometer reading." },
              { n: '02', c: '#06b6d4', t: 'Log Every Service', d: 'Record each visit with parts replaced, costs, and mechanic notes. Our system cross-verifies garage-reported odometer against your records in real time.' },
              { n: '03', c: '#a78bfa', t: 'Get Full Intelligence', d: "Receive health scores, resale valuations, fraud alerts, and expiry reminders. Your vehicle's complete lifecycle, intelligently managed for you." },
            ].map((s, i) => (
              <div key={s.n} style={{
                textAlign: 'center', position: 'relative', zIndex: 1,
                opacity: howVisible ? 1 : 0,
                transform: howVisible ? 'none' : 'translateY(28px)',
                transition: `opacity .65s ${i * .18}s ease, transform .65s ${i * .18}s ease`,
              }}>
                <div style={{
                  width: 76, height: 76, borderRadius: '50%',
                  background: `linear-gradient(135deg,${s.c}28,${s.c}0d)`,
                  border: `2px solid ${s.c}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 1.6rem',
                  boxShadow: `0 0 32px ${s.c}28`,
                }}>
                  <span style={{ fontSize: '1.55rem', fontWeight: 900, color: s.c }}>{s.n}</span>
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '.75rem', color: '#0f172a' }}>{s.t}</h3>
                <p style={{ fontSize: '.88rem', color: '#64748b', lineHeight: 1.75, maxWidth: 270, margin: '0 auto' }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
           SPOTLIGHT: Health Score
      ════════════════════════════════ */}
      <section style={{ padding: '7rem 2rem', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#dc2626', letterSpacing: '.12em', textTransform: 'uppercase' }}>HEALTH INTELLIGENCE</span>
            <h2 style={{ fontSize: 'clamp(1.75rem,3.5vw,2.75rem)', fontWeight: 900, marginTop: '.7rem', marginBottom: '1.2rem', letterSpacing: '-0.04em', lineHeight: 1.1, color: '#0f172a' }}>
              Know Your Vehicle's True Condition
            </h2>
            <p style={{ fontSize: '.97rem', color: '#64748b', lineHeight: 1.8, marginBottom: '2rem' }}>
              Our multi-factor health engine analyses legal document validity, maintenance frequency, verified service records, accident history, and behavioural patterns to compute a precise score — not just a rough estimate.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.72rem' }}>
              {[
                'Expired document detection with automatic score penalties',
                'Service gap analysis — flags gaps beyond 6 months',
                'Tamper-flag penalties for fraud attempts',
                'Verified garage bonus: +5 per record (max +15)',
                'Recent accident & rapid repair frequency analysis',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <CheckCircle size={15} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: '.88rem', color: '#374151', lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Health visual */}
          <div className="float" style={{
            background: '#fff',
            border: '1px solid #e2e8f0', borderRadius: 24, padding: '2.5rem',
            boxShadow: '0 20px 60px rgba(37,99,235,.08),0 4px 20px rgba(0,0,0,.05)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '.72rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.6rem' }}>VEHICLE HEALTH SCORE</div>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <svg viewBox="0 0 200 120" width={200} height={120}>
                  <path d="M 18 105 A 82 82 0 0 1 182 105" fill="none" stroke="#e2e8f0" strokeWidth={13} strokeLinecap="round" />
                  <path d="M 18 105 A 82 82 0 0 1 182 105" fill="none" stroke="url(#hGrad)" strokeWidth={13} strokeLinecap="round" strokeDasharray="257" strokeDashoffset="54" />
                  <defs>
                    <linearGradient id="hGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f43f5e" />
                      <stop offset="45%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#4ade80" />
                    </linearGradient>
                  </defs>
                </svg>
                <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.6rem', fontWeight: 900, color: '#16a34a', letterSpacing: '-0.05em', lineHeight: 1 }}>92</div>
                  <div style={{ fontSize: '.65rem', color: '#94a3b8', marginTop: 2 }}>out of 100</div>
                </div>
              </div>
              <div style={{ marginTop: '.5rem', display: 'inline-block', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: '.82rem', fontWeight: 700, padding: '.3rem 1rem', borderRadius: 50 }}>Excellent Condition</div>
            </div>
            {[
              { label: 'Legal Documents', pct: 95, c: '#16a34a' },
            { label: 'Service Consistency', pct: 88, c: '#2563eb' },
            { label: 'Verification Score', pct: 90, c: '#7c3aed' },
            { label: 'Safety Record', pct: 97, c: '#0284c7' },
            ].map(m => (
              <div key={m.label} style={{ marginBottom: '.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', marginBottom: '.35rem' }}>
                  <span style={{ color: '#64748b' }}>{m.label}</span>
                  <span style={{ fontWeight: 700, color: m.c }}>{m.pct}%</span>
                </div>
                <div style={{ height: 6, background: '#e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ width: m.pct + '%', height: '100%', background: `linear-gradient(90deg,${m.c}88,${m.c})`, borderRadius: 10 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
           SPOTLIGHT: Fraud Detection
      ════════════════════════════════ */}
      <section style={{ padding: '7rem 2rem', background: '#fff' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center' }}>
          {/* Fraud visual */}
          <div className="float2" style={{
            background: '#fff',
            border: '1px solid #e2e8f0', borderRadius: 24, padding: '2rem',
            boxShadow: '0 20px 60px rgba(37,99,235,.08),0 4px 20px rgba(0,0,0,.05)', position: 'relative', overflow: 'hidden',
          }}>
            <div className="scan" />
            <div style={{ fontSize: '.7rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '1.1rem' }}>TAMPER DETECTION REPORT</div>

            {/* Verified */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 13, padding: '1rem 1.1rem', marginBottom: '.7rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '.88rem', color: '#0f172a' }}>Annual Service</div>
                  <div style={{ fontSize: '.72rem', color: '#94a3b8', marginTop: 3 }}>Jan 15, 2025 &nbsp;•&nbsp; 42,500 km</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontSize: '.78rem', fontWeight: 700 }}>
                  <Shield size={13} /> VERIFIED
                </div>
              </div>
            </div>

            {/* Normal */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 13, padding: '1rem 1.1rem', marginBottom: '.7rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '.88rem', color: '#0f172a' }}>Brake Replacement</div>
                  <div style={{ fontSize: '.72rem', color: '#94a3b8', marginTop: 3 }}>Mar 3, 2025 &nbsp;•&nbsp; 45,200 km</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2563eb', fontSize: '.78rem', fontWeight: 700 }}>
                  <CheckCircle size={13} /> OK
                </div>
              </div>
            </div>

            {/* Flagged */}
            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 13, padding: '1rem 1.1rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, background: '#dc2626', borderBottomLeftRadius: 8, padding: '2px 10px', fontSize: '.62rem', fontWeight: 800, letterSpacing: '.06em', color: '#fff' }}>⚠ FLAGGED</div>
              <div style={{ fontWeight: 600, fontSize: '.88rem', marginBottom: 4, color: '#0f172a' }}>Suspicious Entry Detected</div>
              <div style={{ fontSize: '.72rem', color: '#dc2626' }}>Odometer mismatch: 320 km discrepancy reported</div>
              <div style={{ fontSize: '.72rem', color: '#94a3b8', marginTop: 4 }}>Oct 18, 2025 — Garage vs. Owner reading mismatch</div>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#d97706', letterSpacing: '.12em', textTransform: 'uppercase' }}>FRAUD DETECTION</span>
            <h2 style={{ fontSize: 'clamp(1.75rem,3.5vw,2.75rem)', fontWeight: 900, marginTop: '.7rem', marginBottom: '1.2rem', letterSpacing: '-0.04em', lineHeight: 1.1, color: '#0f172a' }}>
              Zero Tolerance for Odometer Fraud
            </h2>
            <p style={{ fontSize: '.97rem', color: '#64748b', lineHeight: 1.8, marginBottom: '2rem' }}>
              Our dual-verification system compares odometer readings from vehicle owners and garages. Any discrepancy beyond 50 km triggers an automatic tamper flag, updates the vehicle's risk score, and is permanently recorded in the resale report.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.72rem' }}>
              {[
                'Cross-validates owner vs. garage odometer readings',
                'Automatic tamper flag on &gt;50 km discrepancy',
                'Abnormal jump detection for entries &gt;40,000 km',
                'Fraud history permanently visible in resale reports',
                'Garage trust ratings downgraded on each flag',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <CheckCircle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: '.88rem', color: '#374151', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: item }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
           RESALE VALUATION
      ════════════════════════════════ */}
      <section style={{ padding: '7rem 2rem', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#d97706', letterSpacing: '.12em', textTransform: 'uppercase' }}>RESALE INTELLIGENCE</span>
            <h2 style={{ fontSize: 'clamp(1.75rem,3.5vw,2.75rem)', fontWeight: 900, marginTop: '.7rem', marginBottom: '1.2rem', letterSpacing: '-0.04em', lineHeight: 1.1, color: '#0f172a' }}>
              Transparent Resale Valuation
            </h2>
            <p style={{ fontSize: '.97rem', color: '#64748b', lineHeight: 1.8, marginBottom: '2rem' }}>
              Get an algorithmically computed resale price range backed by a verifiable trust score. Buyers see exactly what factors affect the valuation — creating complete transparency in the used vehicle market.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.72rem' }}>
              {[
                'Depreciation model: 15% year-1, 10%/year thereafter',
                'Trust score factors: ownership count, service quality, accidents',
                '+5% adjustment for excellent health condition',
                '–10% penalty for documented accident history',
                'Risk level classification: Low / Medium / High',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <CheckCircle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: '.88rem', color: '#374151', lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Resale Visual */}
          <div className="float" style={{
            background: '#fff',
            border: '1px solid #e2e8f0', borderRadius: 24, padding: '2.5rem',
            boxShadow: '0 20px 60px rgba(37,99,235,.08),0 4px 20px rgba(0,0,0,.05)',
          }}>
            <div style={{ fontSize: '.7rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '1.4rem' }}>RESALE REPORT</div>
            {/* Trust score ring */}
            <div style={{ textAlign: 'center', marginBottom: '1.8rem' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <svg viewBox="0 0 100 100" width={110} height={110}>
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth={9} />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="url(#tGrad)" strokeWidth={9} strokeLinecap="round"
                    strokeDasharray="264" strokeDashoffset={264 - 264 * 0.84} transform="rotate(-90 50 50)" />
                  <defs>
                    <linearGradient id="tGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#2563eb', letterSpacing: '-0.04em', lineHeight: 1 }}>84</div>
                  <div style={{ fontSize: '.6rem', color: '#94a3b8', marginTop: 2 }}>TRUST</div>
                </div>
              </div>
              <div style={{ marginTop: '.5rem' }}>
                <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: '.78rem', fontWeight: 700, padding: '.25rem .8rem', borderRadius: 50 }}>LOW RISK</span>
              </div>
            </div>

            {/* Price range */}
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '1.2rem', marginBottom: '1.1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '.72rem', color: '#92400e', fontWeight: 600, marginBottom: '.45rem' }}>ESTIMATED RESALE RANGE</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#d97706', letterSpacing: '-0.03em' }}>₹17.2L – ₹19.6L</div>
              <div style={{ fontSize: '.72rem', color: '#94a3b8', marginTop: 4 }}>Mean: ₹18.4L &nbsp;•&nbsp; Based on current market</div>
            </div>

            {/* Trust factors */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {[
                { text: '1 previous owner', ok: true },
                { text: '6 verified service records', ok: true },
                { text: 'No accident history', ok: true },
                { text: 'No tamper flags', ok: true },
              ].map(f => (
                <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: f.ok ? '#dcfce7' : '#fee2e2', border: `1px solid ${f.ok ? '#bbf7d0' : '#fecdd3'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '.55rem', color: f.ok ? '#16a34a' : '#dc2626' }}>{f.ok ? '✓' : '✗'}</span>
                  </div>
                  <span style={{ fontSize: '.8rem', color: '#374151' }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
           FOR GARAGES
      ════════════════════════════════ */}
      <section id="for-garages" style={{ padding: '7rem 2rem', background: '#eff6ff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#0284c7', letterSpacing: '.12em', textTransform: 'uppercase' }}>FOR GARAGE PARTNERS</span>
          <h2 style={{ fontSize: 'clamp(1.9rem,4vw,3.1rem)', fontWeight: 900, marginTop: '.7rem', letterSpacing: '-0.04em', marginBottom: '1rem', color: '#0f172a' }}>
            Grow Your Workshop Online
          </h2>
          <p style={{ fontSize: '1.05rem', color: '#64748b', maxWidth: 540, margin: '0 auto 3.5rem', lineHeight: 1.75 }}>
            Join Drivix as a verified partner. Manage bookings, verify service claims, and build lasting trust with thousands of vehicle owners.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1.4rem' }}>
            {[
              { icon: <Globe size={28} color="#06b6d4" />, title: 'Online Presence', desc: 'Create a verified garage profile with services, pricing, and availability. Get discovered by thousands of vehicle owners in your area.' },
              { icon: <Users size={28} color="#3b82f6" />, title: 'Booking Management', desc: 'Accept and track service bookings in real time with a full status timeline — from request through completion.' },
              { icon: <Award size={28} color="#a78bfa" />, title: 'Trust Certification', desc: 'Earn verification badges by cross-validating service records. Higher trust ratings attract premium customers and repeat business.' },
            ].map(item => (
              <div key={item.title} className="card" style={{ padding: '2rem', textAlign: 'left' }}>
                <div style={{ width: 56, height: 56, borderRadius: 15, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  {item.icon}
                </div>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 700, marginBottom: '.7rem', color: '#0f172a' }}>{item.title}</h3>
                <p style={{ fontSize: '.88rem', color: '#64748b', lineHeight: 1.72 }}>{item.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '2.8rem' }}>
            <Link to="/signup" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#2563eb', border: '1px solid #2563eb',
              color: '#fff', fontWeight: 700, fontSize: '.97rem',
              padding: '.85rem 2.4rem', borderRadius: 12, textDecoration: 'none',
              transition: 'all .2s', boxShadow: '0 4px 20px rgba(37,99,235,.3)',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1d4ed8'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(37,99,235,.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(37,99,235,.3)'; }}>
              Register Your Garage <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
           ANALYTICS SECTION
      ════════════════════════════════ */}
      <section id="analytics" style={{ padding: '7rem 2rem', background: '#fff' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center' }}>
          {/* Analytics visual */}
          <div className="float" style={{
            background: '#fff',
            border: '1px solid #e2e8f0', borderRadius: 24, padding: '2rem',
            boxShadow: '0 20px 60px rgba(37,99,235,.08),0 4px 20px rgba(0,0,0,.05)',
          }}>
            <div style={{ fontSize: '.7rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '1.2rem' }}>FLEET ANALYTICS</div>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '.7rem', marginBottom: '1.4rem' }}>
              {[{ l: 'Total Fleet KM', v: '1,24,820' }, { l: 'Services Logged', v: '38' }, { l: 'Avg Health', v: '89/100' }].map(k => (
                <div key={k.l} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '.85rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#0f172a' }}>{k.v}</div>
                  <div style={{ fontSize: '.65rem', color: '#94a3b8', marginTop: 4 }}>{k.l}</div>
                </div>
              ))}
            </div>
            {/* Bar chart mock */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '.72rem', color: '#94a3b8', marginBottom: '.6rem' }}>Monthly Expense Trend (₹)</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                {[35, 55, 42, 68, 80, 62, 90, 74, 58, 88, 76, 95].map((h, i) => (
                  <div key={i} style={{ flex: 1, background: `linear-gradient(to top,#2563eb,#06b6d4)`, borderRadius: '4px 4px 0 0', height: h + '%', opacity: i === 11 ? 1 : 0.5 + i * 0.04 }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map(m => (
                  <span key={m} style={{ flex: 1, textAlign: 'center', fontSize: '.58rem', color: '#cbd5e1' }}>{m}</span>
                ))}
              </div>
            </div>
            {/* Category donut placeholder */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginTop: '.5rem' }}>
              {[
                { c: '#2563eb', l: 'Periodic Maintenance', pct: '42%' },
                { c: '#0284c7', l: 'Repairs', pct: '28%' },
                { c: '#7c3aed', l: 'Major Service', pct: '18%' },
                { c: '#d97706', l: 'Breakdown', pct: '12%' },
              ].map(cat => (
                <div key={cat.l} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.c, flexShrink: 0 }} />
                  <span style={{ fontSize: '.68rem', color: '#64748b' }}>{cat.l}</span>
                  <span style={{ fontSize: '.68rem', color: cat.c, fontWeight: 700, marginLeft: 'auto' }}>{cat.pct}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#16a34a', letterSpacing: '.12em', textTransform: 'uppercase' }}>FLEET ANALYTICS</span>
            <h2 style={{ fontSize: 'clamp(1.75rem,3.5vw,2.75rem)', fontWeight: 900, marginTop: '.7rem', marginBottom: '1.2rem', letterSpacing: '-0.04em', lineHeight: 1.1, color: '#0f172a' }}>
              Your Fleet at a Glance — Always
            </h2>
            <p style={{ fontSize: '.97rem', color: '#64748b', lineHeight: 1.8, marginBottom: '2rem' }}>
              Real-time dashboards with expense trends, service category breakdowns, per-vehicle mileage distributions and fleet-wide health scores — all rendered in beautiful, interactive charts.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.72rem' }}>
              {[
                'Monthly expense trend charts with year-over-year view',
                'Service category donut chart (Periodic / Repair / Major)',
                'Per-vehicle mileage and usage distribution',
                'Fleet-wide health score aggregation',
                'Total services logged and cost summaries',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <Zap size={14} color="#16a34a" style={{ flexShrink: 0, marginTop: 3 }} />
                  <span style={{ fontSize: '.88rem', color: '#374151', lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
           FINAL CTA
      ════════════════════════════════ */}
      <section style={{ padding: '7rem 2rem', background: 'linear-gradient(160deg,#eff6ff 0%,#f8fafc 60%,#f0f9ff 100%)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{
            background: '#fff',
            border: '1px solid #bfdbfe', borderRadius: 28,
            padding: 'clamp(2.5rem,6vw,5rem)', textAlign: 'center',
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 20px 80px rgba(37,99,235,.1)',
          }}>
            <div style={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,99,235,.07) 0%,transparent 70%)', top: -170, right: -100, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(124,58,237,.06) 0%,transparent 70%)', bottom: -110, left: -60, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 100, padding: '.32rem .9rem', marginBottom: '1.4rem' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb', display: 'inline-block', animation: 'dotPulse 2s ease-in-out infinite' }} />
                <span style={{ fontSize: '.7rem', fontWeight: 700, color: '#2563eb', letterSpacing: '.08em' }}>FREE TO GET STARTED</span>
              </div>
              <h2 style={{ fontSize: 'clamp(2rem,5vw,3.6rem)', fontWeight: 900, letterSpacing: '-0.045em', lineHeight: 1.08, marginBottom: '1rem', color: '#0f172a' }}>
                Start Protecting Your{' '}
                <span className="shimmer-text">Vehicle Today</span>
              </h2>
              <p style={{ fontSize: '1.05rem', color: '#64748b', maxWidth: 480, margin: '0 auto 2.5rem', lineHeight: 1.75 }}>
                Join thousands of vehicle owners who trust Drivix to track, protect, and maximise the value of their vehicles.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/signup" className="glow-cta" style={{
                  background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                  color: '#fff', fontWeight: 700, fontSize: '1rem',
                  padding: '.95rem 2.6rem', borderRadius: 12, textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  Create Free Account <ArrowRight size={17} />
                </Link>
                <Link to="/login" style={{
                  background: '#fff', color: '#374151',
                  fontWeight: 600, fontSize: '1rem',
                  padding: '.95rem 2.6rem', borderRadius: 12, textDecoration: 'none',
                  border: '1px solid #e2e8f0',
                  transition: 'background .2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
           FOOTER
      ════════════════════════════════ */}
      <footer style={{ borderTop: '1px solid #e2e8f0', padding: '2.5rem 2.5rem', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Car size={14} color="#fff" />
            </div>
            <span style={{ fontWeight: 900, fontSize: '1rem', letterSpacing: '-0.03em', color: '#0f172a' }}>Dri<span style={{ color: '#2563eb' }}>vix</span></span>
            <span style={{ fontSize: '.78rem', color: '#94a3b8', marginLeft: 4 }}>Mobility Digital Twin Platform</span>
          </div>
          <div style={{ fontSize: '.8rem', color: '#94a3b8' }}>© 2026 Drivix. All rights reserved.</div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {[['Log in', '/login'], ['Sign up', '/signup']].map(([label, to]) => (
              <Link key={to} to={to} style={{ fontSize: '.82rem', color: '#94a3b8', textDecoration: 'none', transition: 'color .2s' }}
                onMouseEnter={e => e.target.style.color = '#2563eb'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
