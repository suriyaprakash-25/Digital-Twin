import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import SEO from '../components/SEO';
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

  /* ── Parallax hero card ───────────────────────────── */
  const heroCardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const tiltRaf = useRef(null);

  const handleHeroMouseMove = (e) => {
    if (tiltRaf.current) cancelAnimationFrame(tiltRaf.current);
    tiltRaf.current = requestAnimationFrame(() => {
      const rect = heroCardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);   // -1 … 1
      const dy = (e.clientY - cy) / (rect.height / 2);  // -1 … 1
      setTilt({ x: dy * -6, y: dx * 6 });               // max 6° tilt
    });
  };

  const handleHeroMouseLeave = () => {
    if (tiltRaf.current) cancelAnimationFrame(tiltRaf.current);
    setTilt({ x: 0, y: 0 });
  };

  /* ── Smooth scroll without hash in URL ─────────────── */
  const scrollTo = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
    *{box-sizing:border-box;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:translateY(0)}}
    @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
    @keyframes floatY2{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
    @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
    @keyframes glowPulse{0%,100%{box-shadow:0 4px 24px rgba(13,148,136,.35),0 2px 8px rgba(13,148,136,.15)}50%{box-shadow:0 8px 40px rgba(13,148,136,.55),0 4px 16px rgba(13,148,136,.25)}}
    @keyframes dotPulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.5)}}
    @keyframes scanline{0%{top:-4px}100%{top:100%}}
    .fu{opacity:0;animation:fadeUp .75s ease forwards}
    .fu1{animation-delay:.1s}.fu2{animation-delay:.25s}.fu3{animation-delay:.4s}.fu4{animation-delay:.55s}.fu5{animation-delay:.7s}
    .float{animation:floatY 7s ease-in-out infinite}
    .float2{animation:floatY2 9s 1s ease-in-out infinite}
    .shimmer-text{background:linear-gradient(90deg,#0d9488,#14b8a6,#0f766e,#0d9488);background-size:250% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 4.5s linear infinite}
    .glow-cta{animation:glowPulse 3s ease-in-out infinite;transition:transform .18s ease}
    .glow-cta:hover{transform:translateY(-3px) scale(1.03)!important}
    .card{transition:transform .3s ease,box-shadow .3s ease,border-color .3s ease;background:#fff;border:1px solid #e2e8f0;border-radius:20px}
    .card:hover{transform:translateY(-10px)!important;box-shadow:0 24px 60px rgba(13,148,136,.13)!important;border-color:rgba(13,148,136,.35)!important}
    .nav-a{color:#475569;font-size:.88rem;font-weight:500;text-decoration:none;position:relative;transition:color .2s}
    .nav-a::after{content:'';position:absolute;width:0;height:2px;bottom:-5px;left:0;background:linear-gradient(90deg,#0d9488,#14b8a6);transition:width .3s ease}
    .nav-a:hover{color:#0d9488}.nav-a:hover::after{width:100%}
    .scan{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(13,148,136,.4),transparent);animation:scanline 2.5s linear infinite;pointer-events:none}
    ::-webkit-scrollbar{width:6px;background:#f1f5f9}
    ::-webkit-scrollbar-thumb{background:rgba(13,148,136,.3);border-radius:6px}
  `;

  return (
    <>
      <style>{css}</style>
      <SEO 
        title="Smart Vehicle Driveportz & Service Tracker" 
        description="Create a living driveportz of your vehicle. Track maintenance, get predictive alerts, and book top-rated garages with AI assistance." 
      />
      <div style={{ color: '#191c1e', overflowX: 'hidden', lineHeight: 1 }}>

      {/* ════════════════════════════════
           NAVBAR
      ════════════════════════════════ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
        paddingTop: '6px', paddingBottom: '0px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(226,232,240,.8)',
        boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,.06)' : 'none',
        transition: 'all .35s ease',
      }} className="px-4 sm:px-10">
        {/* Logo */}
        <div 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <img
            src="/logo-removebg-preview.png"
            alt="Logo"
            style={{ height: 86, marginBottom: '-20px' }}
          />
        </div>

        {/* Nav links */}
        <div className="hidden md:flex gap-6 lg:gap-9 items-center">
          {[['features', 'Features'], ['how-it-works', 'How It Works'], ['for-garages', 'For Garages'], ['analytics', 'Analytics']].map(([id, label]) => (
            <button key={id} onClick={scrollTo(id)} className="nav-a" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{label}</button>
          ))}
        </div>

        {/* Auth CTAs */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link to="/login" style={{
            color: '#374151', fontWeight: 505, fontSize: '.82rem',
            padding: '.4rem 1rem', borderRadius: 8, textDecoration: 'none',
            border: '1px solid #e2e8f0', transition: 'all .2s', background: '#fff',
          }}
            className="sm:px-4 sm:py-2 sm:text-sm"
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
            Log in
          </Link>
          <Link to="/signup" style={{
            background: 'linear-gradient(135deg,#0d9488,#0f766e)',
            color: '#fff', fontWeight: 700, fontSize: '.82rem',
            padding: '.4rem 1rem', borderRadius: 8, textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
            className="glow-cta sm:px-4 sm:py-2 sm:text-sm">
            Get Started <ArrowRight size={12} className="shrink-0" />
          </Link>
        </div>
      </nav>

      {/* ════════════════════════════════
           HERO
      ════════════════════════════════ */}
      <main className="pt-20 md:pt-24 pb-12 px-4 md:px-8 max-w-container-max mx-auto">
        {/* Hero Section Canvas – Parallax wrapper */}
        <div
          className="w-full"
          style={{ perspective: '1200px' }}
          onMouseMove={handleHeroMouseMove}
          onMouseLeave={handleHeroMouseLeave}
        >
        <div
          ref={heroCardRef}
          className="canvas-card rounded-2xl overflow-hidden w-full flex flex-col md:flex-row min-h-0 md:min-h-[680px]"
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.01)`,
            transition: 'transform 0.12s ease-out, box-shadow 0.12s ease-out',
            boxShadow: `
              ${tilt.y * 2}px ${tilt.x * -2}px 40px rgba(15,23,42,0.10),
              0 30px 60px -15px rgba(15,23,42,0.08)
            `,
            willChange: 'transform',
          }}
        >
          {/* Left Side: Content */}
          <div className="w-full md:w-1/2 p-6 pb-2 sm:p-12 sm:pb-4 md:p-16 lg:p-24 flex flex-col justify-center">
            <div className="max-w-xl">
              <span className="text-primary font-label-md text-xs sm:text-sm uppercase tracking-widest mb-4 block">Precision Engineering</span>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-slate-900 mb-6 font-display">Your Vehicle's Digital Brain</h1>
              <p className="text-sm sm:text-base md:text-lg text-on-surface-variant mb-8 leading-relaxed font-body-lg">
                The definitive operating system for automotive management. Experience surgical efficiency in vehicle diagnostics, garage workflow, and real-time telemetry analytics.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/signup"
                  className="bg-primary-container text-on-primary-fixed flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-label-md text-label-md hover:opacity-90 transition-all active:scale-95"
                >
                  Start for Free
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </Link>
                <button
                  onClick={scrollTo('features')}
                  className="border border-on-secondary-fixed text-on-secondary-fixed flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-all text-center"
                >
                  Explore Features
                </button>
              </div>
            </div>
          </div>
          {/* Right Side: Illustration */}
          <div className="w-full md:w-1/2 bg-surface-container-low flex items-center justify-center p-6 pt-2 md:p-10 border-t md:border-l md:border-t-0 border-outline-variant">
            <div className="relative w-full aspect-[1.79]">
              <img alt="Garage Scene" className="w-full h-full object-contain pointer-events-none" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCKk4bG_vORRaC8TqJQ2YDu4CTj1TluAhujbKRLmbilwg4F2zUHl63eYWwHkv4znCgknFRNEvdYVTWZKSlT4VNsROIXA3T89oudaVPZV19d5ugjnnr8VIfvSuN-7Siy3GXSlGtwoeYEfvWqGIHz_w9YytM2h3s_SnpHnkrI6gQDnzr7Wss7oLVQvSx7P6Uj15fzhXQVZ58ulN90baB2k1nMhV1Oh77E5j_02-2wIxGDhSKfnSev4tDwT-psdmWMGJ2qzsbSphImQxs"/>
              {/* Decorative Floating Data Nodes (Vector Style) */}
              <div className="absolute top-4 right-4 sm:top-8 sm:right-8 py-2 px-3 canvas-card rounded-lg flex items-center gap-2 animate-bounce">
                <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                <div>
                  <p className="text-[9px] uppercase font-bold text-outline leading-tight">Real-time Data</p>
                  <p className="font-bold text-[12px] text-on-surface leading-tight">98.2% Accurate</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </main>

      {/* ════════════════════════════════
           STATS BAR
      ════════════════════════════════ */}
      <div ref={statsRef} className="border-y border-slate-200 py-10 md:py-14 px-4 md:px-8 bg-white">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-6 text-center">
          {[
            { val: c1.toLocaleString() + '+', label: 'Vehicles Tracked', icon: <Car size={20} color="#0d9488" />, color: '#0d9488' },
            { val: c2.toLocaleString() + '+', label: 'Verified Garages', icon: <Store size={20} color="#14b8a6" />, color: '#14b8a6' },
            { val: c3 + '%', label: 'Health Accuracy', icon: <Award size={20} color="#0f766e" />, color: '#0f766e' },
            { val: '₹' + c4 + 'Cr+', label: 'Fraud Prevented', icon: <Shield size={20} color="#d97706" />, color: '#d97706' },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center">
              <div style={{ width: 50, height: 50, borderRadius: 13, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, border: `1px solid ${s.color}22` }}>
                {s.icon}
              </div>
              <div className="text-3xl md:text-[2.1rem] font-black tracking-tight text-slate-900 leading-none">{s.val}</div>
              <div style={{ fontSize: '.82rem', color: '#64748b', marginTop: 6, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════
           FEATURES
      ════════════════════════════════ */}
      <section id="features" ref={featRef} className="py-16 md:py-28 px-4 md:px-8 bg-slate-50">
        <div className="max-w-[1200px] mx-auto">
          {/* Section heading */}
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#14b8a6', letterSpacing: '.12em', textTransform: 'uppercase' }}>PLATFORM FEATURES</span>
            <h2 style={{ fontSize: 'clamp(1.9rem,4vw,3.1rem)', fontWeight: 900, marginTop: '.7rem', letterSpacing: '-0.04em', lineHeight: 1.08, color: '#0f172a' }}>
              Everything Your Vehicle Needs
            </h2>
            <p className="text-sm sm:text-base text-slate-500 max-w-[540px] mx-auto mt-4 leading-relaxed">
              A complete intelligence layer for your vehicle's entire lifetime — from first drive to final sale.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Shield size={26} color="#0d9488" />,
                bg: '#f0fdfa', border: '#99f6e4',
                tag: 'ANTI-FRAUD', tagColor: '#0d9488',
                title: 'Fraud-Proof Service History',
                desc: 'Dual-layer verification cross-checks odometer readings from owners and garages. Tamper flags trigger automatically on discrepancies exceeding 50 km.',
              },
              {
                icon: <HeartPulse size={26} color="#0d9488" />,
                bg: '#f0fdfa', border: '#99f6e4',
                tag: 'AI-POWERED', tagColor: '#0d9488',
                title: 'Live Vehicle IQ Score',
                desc: 'Multi-factor engine evaluates legal validity, maintenance frequency, verified records and behavioral patterns to produce a precise 0–100 Vehicle IQ score.',
              },
              {
                icon: <TrendingUp size={26} color="#0d9488" />,
                bg: '#f0fdfa', border: '#99f6e4',
                tag: 'VALUATION ENGINE', tagColor: '#0d9488',
                title: 'Intelligent Resale Valuation',
                desc: 'Algorithmic depreciation model plus a trust score adjusted for ownership transfers, verified history and accident records to compute a precise price range.',
              },
              {
                icon: <Bell size={26} color="#0f766e" />,
                bg: '#f0fdfa', border: '#99f6e4',
                tag: 'PROACTIVE ALERTS', tagColor: '#0f766e',
                title: 'Smart Legal Reminders',
                desc: 'Never miss an expiry. Priority-based alerts for Insurance, PUC, RC, Fitness Certificate and Road Tax — dispatched weeks before they lapse.',
              },
              {
                icon: <Store size={26} color="#14b8a6" />,
                bg: '#f0fdfa', border: '#99f6e4',
                tag: 'MARKETPLACE', tagColor: '#14b8a6',
                title: 'Verified Garage Marketplace',
                desc: 'Discover certified service centres, compare pricing, and book appointments. Every service claim is cross-verified on our platform for authenticity.',
              },
              {
                icon: <BarChart3 size={26} color="#0d9488" />,
                bg: '#f0fdfa', border: '#99f6e4',
                tag: 'DATA INTELLIGENCE', tagColor: '#0d9488',
                title: 'Fleet Analytics Dashboard',
                desc: 'Real-time expense trends, category breakdowns, mileage distributions and Vehicle IQ scores across your entire fleet — all in one visual dashboard.',
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
      <section id="how-it-works" ref={howRef} className="py-16 md:py-28 px-4 md:px-8 bg-white">
        <div className="max-w-[1100px] mx-auto">
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#0d9488', letterSpacing: '.12em', textTransform: 'uppercase' }}>HOW IT WORKS</span>
            <h2 style={{ fontSize: 'clamp(1.9rem,4vw,3.1rem)', fontWeight: 900, marginTop: '.7rem', letterSpacing: '-0.04em', color: '#0f172a' }}>
              Up and Running in 3 Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 relative">
            {/* connector */}
            <div className="hidden md:block absolute top-14 left-[22%] right-[22%] h-0.5 bg-gradient-to-r from-teal-500/50 via-cyan-500/50 to-violet-500/50 z-0" />

            {[
              { n: '01', c: '#14b8a6', t: 'Register Your Vehicle', d: "Add your vehicle's complete digital profile — ownership history, legal documents, chassis & engine numbers, and current odometer reading." },
              { n: '02', c: '#5eead4', t: 'Log Every Service', d: 'Record each visit with parts replaced, costs, and mechanic notes. Our system cross-verifies garage-reported odometer against your records in real time.' },
              { n: '03', c: '#a78bfa', t: 'Get Full Intelligence', d: "Receive Vehicle IQ scores, resale valuations, fraud alerts, and expiry reminders. Your vehicle's complete lifecycle, intelligently managed for you." },
            ].map((s, i) => (
              <div key={s.n} style={{
                textAlign: 'center', position: 'relative', zIndex: 1,
                opacity: howVisible ? 1 : 0,
                transform: howVisible ? 'none' : 'translateY(28px)',
                transition: `opacity .65s ${i * .18}s ease, transform .65s ${i * .18}s ease`,
              }} className="max-w-sm mx-auto md:max-w-none">
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
           SPOTLIGHT: Vehicle IQ Score
      ════════════════════════════════ */}
      <section className="py-16 md:py-28 px-4 md:px-8 bg-slate-50">
        <div className="max-w-[1160px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
          <div>
            <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#dc2626', letterSpacing: '.12em', textTransform: 'uppercase' }}>VEHICLE IQ INTELLIGENCE</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 mt-3 mb-5 tracking-tight leading-tight">
              Know Your Vehicle's True Condition
            </h2>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed mb-8">
              Our multi-factor Vehicle IQ engine analyses legal document validity, maintenance frequency, verified service records, accident history, and behavioural patterns to compute a precise score — not just a rough estimate.
            </p>
            <div className="flex flex-col gap-3">
              {[
                'Expired document detection with automatic score penalties',
                'Service gap analysis — flags gaps beyond 6 months',
                'Tamper-flag penalties for fraud attempts',
                'Verified garage bonus: +5 per record (max +15)',
                'Recent accident & rapid repair frequency analysis',
              ].map(item => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle size={15} color="#16a34a" className="shrink-0 mt-1" />
                  <span className="text-sm text-slate-700 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Health visual */}
          <div className="float bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xl max-w-md mx-auto lg:max-w-none w-full">
            <div className="text-center mb-8">
              <div style={{ fontSize: '.72rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.6rem' }}>VEHICLE IQ SCORE</div>
              <div className="relative inline-block">
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
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center">
                  <div className="text-4xl sm:text-5xl font-black text-emerald-600 tracking-tight leading-none">92</div>
                  <div style={{ fontSize: '.65rem', color: '#94a3b8', marginTop: 2 }}>out of 100</div>
                </div>
              </div>
              <div className="mt-4 inline-block bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs sm:text-sm font-bold px-4 py-1.5 rounded-full">Excellent Condition</div>
            </div>
            {[
              { label: 'Legal Documents', pct: 95, c: '#16a34a' },
              { label: 'Service Consistency', pct: 88, c: '#0d9488' },
              { label: 'Verification Score', pct: 90, c: '#0f766e' },
              { label: 'Safety Record', pct: 97, c: '#14b8a6' },
            ].map(m => (
              <div key={m.label} className="mb-4">
                <div className="flex justify-between text-xs sm:text-sm mb-1">
                  <span className="text-slate-500">{m.label}</span>
                  <span className="font-bold" style={{ color: m.c }}>{m.pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div style={{ width: m.pct + '%', height: '100%', background: `linear-gradient(90deg,${m.c}88,${m.c})` }} className="rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
           SPOTLIGHT: Fraud Detection
      ════════════════════════════════ */}
      <section className="py-16 md:py-28 px-4 md:px-8 bg-white">
        <div className="max-w-[1160px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
          {/* Fraud visual */}
          <div className="float2 bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 shadow-xl relative overflow-hidden order-2 lg:order-1 max-w-md mx-auto lg:max-w-none w-full">
            <div className="scan" />
            <div style={{ fontSize: '.7rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '1.1rem' }}>TAMPER DETECTION REPORT</div>

            {/* Verified */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 13, padding: '1rem 1.1rem', marginBottom: '.7rem' }}>
              <div className="flex justify-between items-center gap-3">
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-slate-800">Annual Service</div>
                  <div style={{ fontSize: '.72rem', color: '#94a3b8', marginTop: 3 }}>Jan 15, 2025 &nbsp;•&nbsp; 42,500 km</div>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold shrink-0">
                  <Shield size={13} /> VERIFIED
                </div>
              </div>
            </div>

            {/* Normal */}
            <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 13, padding: '1rem 1.1rem', marginBottom: '.7rem' }}>
              <div className="flex justify-between items-center gap-3">
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-slate-800">Brake Replacement</div>
                  <div style={{ fontSize: '.72rem', color: '#94a3b8', marginTop: 3 }}>Mar 3, 2025 &nbsp;•&nbsp; 45,200 km</div>
                </div>
                <div className="flex items-center gap-1.5 text-teal-600 text-xs font-bold shrink-0">
                  <CheckCircle size={13} /> OK
                </div>
              </div>
            </div>

            {/* Flagged */}
            <div className="bg-red-50/50 border border-red-200 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-red-600 rounded-bl-lg px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">⚠ FLAGGED</div>
              <div className="font-bold text-xs sm:text-sm text-slate-900 mb-1">Suspicious Entry Detected</div>
              <div style={{ fontSize: '.72rem' }} className="text-red-600 font-medium">Odometer mismatch: 320 km discrepancy reported</div>
              <div style={{ fontSize: '.72rem', color: '#94a3b8', marginTop: 4 }}>Oct 18, 2025 — Garage vs. Owner reading mismatch</div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#d97706', letterSpacing: '.12em', textTransform: 'uppercase' }}>FRAUD DETECTION</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 mt-3 mb-5 tracking-tight leading-tight">
              Zero Tolerance for Odometer Fraud
            </h2>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed mb-8">
              Our dual-verification system compares odometer readings from vehicle owners and garages. Any discrepancy beyond 50 km triggers an automatic tamper flag, updates the vehicle's risk score, and is permanently recorded in the resale report.
            </p>
            <div className="flex flex-col gap-3">
              {[
                'Cross-validates owner vs. garage odometer readings',
                'Automatic tamper flag on &gt;50 km discrepancy',
                'Abnormal jump detection for entries &gt;40,000 km',
                'Fraud history permanently visible in resale reports',
                'Garage trust ratings downgraded on each flag',
              ].map(item => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle size={15} color="#d97706" className="shrink-0 mt-1" />
                  <span className="text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: item }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
           RESALE VALUATION
      ════════════════════════════════ */}
      <section className="py-16 md:py-28 px-4 md:px-8 bg-slate-50">
        <div className="max-w-[1160px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
          <div>
            <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#d97706', letterSpacing: '.12em', textTransform: 'uppercase' }}>RESALE INTELLIGENCE</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 mt-3 mb-5 tracking-tight leading-tight">
              Transparent Resale Valuation
            </h2>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed mb-8">
              Get an algorithmically computed resale price range backed by a verifiable trust score. Buyers see exactly what factors affect the valuation — creating complete transparency in the used vehicle market.
            </p>
            <div className="flex flex-col gap-3">
              {[
                'Depreciation model: 15% year-1, 10%/year thereafter',
                'Trust score factors: ownership count, service quality, accidents',
                '+5% adjustment for excellent Vehicle IQ score',
                '–10% penalty for documented accident history',
                'Risk level classification: Low / Medium / High',
              ].map(item => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle size={15} color="#d97706" className="shrink-0 mt-1" />
                  <span className="text-sm text-slate-700 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Resale Visual */}
          <div className="float bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xl max-w-md mx-auto lg:max-w-none w-full">
            <div style={{ fontSize: '.7rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '1.4rem' }}>RESALE REPORT</div>
            {/* Trust score ring */}
            <div className="text-center mb-8">
              <div className="relative inline-block">
                <svg viewBox="0 0 100 100" width={110} height={110}>
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth={9} />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="url(#tGrad)" strokeWidth={9} strokeLinecap="round"
                    strokeDasharray="264" strokeDashoffset={264 - 264 * 0.84} transform="rotate(-90 50 50)" />
                  <defs>
                    <linearGradient id="tGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#0d9488" />
                      <stop offset="100%" stopColor="#5eead4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-2xl sm:text-3xl font-black text-teal-600 tracking-tight leading-none">84</div>
                  <div style={{ fontSize: '.6rem', color: '#94a3b8', marginTop: 2 }}>TRUST</div>
                </div>
              </div>
              <div className="mt-4">
                <span className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-bold px-3 py-1 rounded-full">LOW RISK</span>
              </div>
            </div>

            {/* Price range */}
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '1.2rem', marginBottom: '1.1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '.72rem', color: '#92400e', fontWeight: 600, marginBottom: '.45rem' }}>ESTIMATED RESALE RANGE</div>
              <div className="text-xl sm:text-2xl font-black text-amber-600 tracking-tight leading-none">₹17.2L – ₹19.6L</div>
              <div style={{ fontSize: '.72rem', color: '#94a3b8', marginTop: 4 }}>Mean: ₹18.4L &nbsp;•&nbsp; Based on current market</div>
            </div>

            {/* Trust factors */}
            <div className="flex flex-col gap-2.5">
              {[
                { text: '1 previous owner', ok: true },
                { text: '6 verified service records', ok: true },
                { text: 'No accident history', ok: true },
                { text: 'No tamper flags', ok: true },
              ].map(f => (
                <div key={f.text} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${f.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-red-50 border-red-200 text-red-650'}`}>
                    <span style={{ fontSize: '.6rem' }} className="font-bold">{f.ok ? '✓' : '✗'}</span>
                  </div>
                  <span className="text-sm text-slate-700">{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
           FOR GARAGES
      ════════════════════════════════ */}
      <section id="for-garages" className="py-16 md:py-28 px-4 md:px-8 bg-teal-50/50">
        <div className="max-w-[1100px] mx-auto text-center">
          <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#14b8a6', letterSpacing: '.12em', textTransform: 'uppercase' }}>FOR GARAGE PARTNERS</span>
          <h2 style={{ fontSize: 'clamp(1.9rem,4vw,3.1rem)', fontWeight: 900, marginTop: '.7rem', letterSpacing: '-0.04em', marginBottom: '1rem', color: '#0f172a' }}>
            Grow Your Workshop Online
          </h2>
          <p className="text-sm sm:text-base text-slate-500 max-w-[540px] mx-auto mb-12 leading-relaxed">
            Join our platform as a verified partner. Manage bookings, verify service claims, and build lasting trust with thousands of vehicle owners.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: <Globe size={28} color="#5eead4" />, title: 'Online Presence', desc: 'Create a verified garage profile with services, pricing, and availability. Get discovered by thousands of vehicle owners in your area.' },
              { icon: <Users size={28} color="#14b8a6" />, title: 'Booking Management', desc: 'Accept and track service bookings in real time with a full status timeline — from request through completion.' },
              { icon: <Award size={28} color="#a78bfa" />, title: 'Trust Certification', desc: 'Earn verification badges by cross-validating service records. Higher trust ratings attract premium customers and repeat business.' },
            ].map(item => (
              <div key={item.title} className="card" style={{ padding: '2rem', textAlign: 'left' }}>
                <div style={{ width: 56, height: 56, borderRadius: 15, background: '#f0fdfa', border: '1px solid #99f6e4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
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
              background: '#0d9488', border: '1px solid #0d9488',
              color: '#fff', fontWeight: 700, fontSize: '.97rem',
              padding: '.85rem 2.4rem', borderRadius: 12, textDecoration: 'none',
              transition: 'all .2s', boxShadow: '0 4px 20px rgba(13,148,136,.3)',
            }}
              className="w-full sm:w-auto justify-center"
              onMouseEnter={e => { e.currentTarget.style.background = '#0f766e'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(13,148,136,.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0d9488'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(13,148,136,.3)'; }}>
              Register Your Garage <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
           ANALYTICS SECTION
      ════════════════════════════════ */}
      <section id="analytics" className="py-16 md:py-28 px-4 md:px-8 bg-white">
        <div className="max-w-[1160px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
          {/* Analytics visual */}
          <div className="float bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 shadow-xl order-2 lg:order-1 max-w-md mx-auto lg:max-w-none w-full">
            <div style={{ fontSize: '.7rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '1.2rem' }}>FLEET ANALYTICS</div>
            {/* KPI cards */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[{ l: 'Total Fleet KM', v: '1,24,820' }, { l: 'Services Logged', v: '38' }, { l: 'Avg Vehicle IQ', v: '89/100' }].map(k => (
                <div key={k.l} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }} className="p-2 sm:p-3 text-center">
                  <div className="text-xs sm:text-sm md:text-base font-extrabold text-slate-900 tracking-tight leading-none">{k.v}</div>
                  <div className="text-[8px] sm:text-[9px] text-slate-400 mt-1 uppercase font-bold tracking-wider leading-tight">{k.l}</div>
                </div>
              ))}
            </div>
            {/* Bar chart mock */}
            <div className="mb-4 w-full overflow-hidden">
              <div style={{ fontSize: '.72rem', color: '#94a3b8', marginBottom: '.6rem' }}>Monthly Expense Trend (₹)</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                {[35, 55, 42, 68, 80, 62, 90, 74, 58, 88, 76, 95].map((h, i) => (
                  <div key={i} style={{ flex: 1, background: `linear-gradient(to top,#0d9488,#5eead4)`, borderRadius: '4px 4px 0 0', height: h + '%', opacity: i === 11 ? 1 : 0.5 + i * 0.04 }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map(m => (
                  <span key={m} style={{ flex: 1, textAlign: 'center', fontSize: '.58rem', color: '#cbd5e1' }}>{m}</span>
                ))}
              </div>
            </div>
            {/* Category donut placeholder */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {[
                { c: '#0d9488', l: 'Periodic Maintenance', pct: '42%' },
                { c: '#14b8a6', l: 'Repairs', pct: '28%' },
                { c: '#0f766e', l: 'Major Service', pct: '18%' },
                { c: '#d97706', l: 'Breakdown', pct: '12%' },
              ].map(cat => (
                <div key={cat.l} className="flex items-center gap-1.5 min-w-0">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.c, flexShrink: 0 }} />
                  <span style={{ fontSize: '.68rem', color: '#64748b' }} className="truncate">{cat.l}</span>
                  <span style={{ fontSize: '.68rem', color: cat.c, fontWeight: 700, marginLeft: 'auto' }} className="shrink-0">{cat.pct}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#16a34a', letterSpacing: '.12em', textTransform: 'uppercase' }}>FLEET ANALYTICS</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 mt-3 mb-5 tracking-tight leading-tight">
              Your Fleet at a Glance — Always
            </h2>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed mb-8">
              Real-time dashboards with expense trends, service category breakdowns, per-vehicle mileage distributions and fleet-wide Vehicle IQ scores — all rendered in beautiful, interactive charts.
            </p>
            <div className="flex flex-col gap-3">
              {[
                'Monthly expense trend charts with year-over-year view',
                'Service category donut chart (Periodic / Repair / Major)',
                'Per-vehicle mileage and usage distribution',
                'Fleet-wide Vehicle IQ Score aggregation',
                'Total services logged and cost summaries',
              ].map(item => (
                <div key={item} className="flex items-start gap-3">
                  <Zap size={14} color="#16a34a" className="shrink-0 mt-1" />
                  <span className="text-sm text-slate-700 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
           FINAL CTA
      ════════════════════════════════ */}
      <section className="py-16 md:py-28 px-4 md:px-8 bg-gradient-to-br from-teal-50/30 via-slate-50 to-teal-50/30">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white border border-teal-200 rounded-[2rem] sm:rounded-[2.5rem] py-12 px-6 sm:p-16 md:p-24 text-center relative overflow-hidden shadow-xl w-full">
            <div style={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,148,136,.07) 0%,transparent 70%)', top: -170, right: -100, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(124,58,237,.06) 0%,transparent 70%)', bottom: -110, left: -60, pointerEvents: 'none' }} />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1 mb-6">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d9488', display: 'inline-block', animation: 'dotPulse 2s ease-in-out infinite' }} />
                <span style={{ fontSize: '.7rem', fontWeight: 700, color: '#0d9488', letterSpacing: '.08em' }}>FREE TO GET STARTED</span>
              </div>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight mb-4 text-slate-900">
                Start Protecting Your <span className="shimmer-text">Vehicle Today</span>
              </h2>
              <p className="text-sm sm:text-base text-slate-500 max-w-md mx-auto mb-10 leading-relaxed font-body-lg">
                Join thousands of vehicle owners who trust our platform to track, protect, and maximise the value of their vehicles.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link to="/signup" className="glow-cta w-full sm:w-auto justify-center" style={{
                  background: 'linear-gradient(135deg,#0d9488,#0f766e)',
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
                  className="w-full sm:w-auto justify-center flex"
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
      <footer className="border-t border-slate-200 py-10 px-4 md:px-10 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
          <div style={{ fontSize: '.8rem', color: '#94a3b8' }}>© 2026 Driveportz. All rights reserved.</div>
          <div className="flex gap-6 justify-center">
            {[['Log in', '/login'], ['Sign up', '/signup']].map(([label, to]) => (
              <Link key={to} to={to} style={{ fontSize: '.82rem', color: '#94a3b8', textDecoration: 'none', transition: 'color .2s' }}
                onMouseEnter={e => e.target.style.color = '#0d9488'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  </>
);
};

export default LandingPage;
