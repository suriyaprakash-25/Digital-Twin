import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap } from 'lucide-react';
import SEO from '../components/SEO';
import TermsConditionsModal from '../components/TermsConditionsModal';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import AboutUsModal from '../components/AboutUsModal';
import PartnerTermsModal from '../components/PartnerTermsModal';

const FleetsPage = () => {
  const [scrolled, setScrolled] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPartnerTerms, setShowPartnerTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const scrollTo = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const css = `
    *{box-sizing:border-box;}
    .float{animation:floatY 7s ease-in-out infinite}
    @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
    .glow-cta{animation:glowPulse 3s ease-in-out infinite;transition:transform .18s ease}
    .glow-cta:hover{transform:translateY(-3px) scale(1.03)!important}
    @keyframes glowPulse{0%,100%{box-shadow:0 4px 24px rgba(13,148,136,.35),0 2px 8px rgba(13,148,136,.15)}50%{box-shadow:0 8px 40px rgba(13,148,136,.55),0 4px 16px rgba(13,148,136,.25)}}
    .nav-a{color:#475569;font-size:.88rem;font-weight:500;text-decoration:none;position:relative;transition:color .2s}
    .nav-a::after{content:'';position:absolute;width:0;height:2px;bottom:-5px;left:0;background:linear-gradient(90deg,#0d9488,#14b8a6);transition:width .3s ease}
    .nav-a:hover{color:#0d9488}.nav-a:hover::after{width:100%}
  `;

  return (
    <>
      <style>{css}</style>
      <SEO 
        title="Driveportz for Fleets" 
        description="Manage your entire fleet's health and value with Driveportz. Real-time dashboards, expense trends, and Vehicle IQ scores." 
      />
      <div style={{ color: '#191c1e', overflowX: 'hidden', lineHeight: 1 }}>

        {/* NAVBAR */}
        <nav style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
          paddingTop: '6px', paddingBottom: '0px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: scrolled ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,.8)',
          boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,.06)' : 'none',
          transition: 'all .35s ease',
        }} className="px-4 sm:px-10">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo-removebg-preview.png" alt="Logo" style={{ height: 86, marginBottom: '-20px' }} />
          </Link>
          <div className="hidden md:flex gap-6 lg:gap-9 items-center">
            <Link to="/" className="nav-a">For Owners</Link>
            <Link to="/garage-partners" className="nav-a">For Garages</Link>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Log in</Link>
            <Link to="/signup" style={{
              background: 'linear-gradient(135deg,#0d9488,#0f766e)',
              color: '#fff', fontWeight: 700, fontSize: '.82rem',
              padding: '.4rem 1rem', borderRadius: 8, textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }} className="glow-cta sm:px-4 sm:py-2 sm:text-sm">
              Get Started for Fleets <ArrowRight size={12} className="shrink-0" />
            </Link>
          </div>
        </nav>

        {/* HERO / FLEET ANALYTICS */}
        <section className="pt-32 pb-16 md:pt-40 md:pb-28 px-4 md:px-8 bg-white min-h-[80vh] flex flex-col justify-center">
          <div className="max-w-[1160px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
            
            <div className="order-1 lg:order-1">
              <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#16a34a', letterSpacing: '.12em', textTransform: 'uppercase' }}>FLEET ANALYTICS</span>
              <h1 style={{ fontSize: 'clamp(2.5rem,5vw,4.2rem)', fontWeight: 900, marginTop: '1rem', letterSpacing: '-0.04em', marginBottom: '1.5rem', color: '#0f172a', lineHeight: 1.1 }}>
                Manage Your Entire Fleet's Health and Value.
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-slate-500 leading-relaxed mb-8">
                Real-time dashboards with expense trends, service category breakdowns, per-vehicle mileage distributions and fleet-wide Vehicle IQ scores — all rendered in beautiful, interactive charts.
              </p>
              <div className="flex flex-col gap-3 mb-10">
                {[
                  'Monthly expense trend charts with year-over-year view',
                  'Service category donut chart (Periodic / Repair / Major)',
                  'Per-vehicle mileage and usage distribution',
                  'Fleet-wide Vehicle IQ Score aggregation',
                  'Total services logged and cost summaries',
                ].map(item => (
                  <div key={item} className="flex items-start gap-3">
                    <Zap size={18} color="#16a34a" className="shrink-0 mt-0.5" />
                    <span className="text-sm md:text-base text-slate-700 leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
              
              <Link to="/signup" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#0d9488', border: '1px solid #0d9488',
                color: '#fff', fontWeight: 700, fontSize: '1.1rem',
                padding: '1rem 3rem', borderRadius: 12, textDecoration: 'none',
                transition: 'all .2s', boxShadow: '0 4px 20px rgba(13,148,136,.3)',
              }}
                className="w-full sm:w-auto justify-center"
                onMouseEnter={e => { e.currentTarget.style.background = '#0f766e'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(13,148,136,.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#0d9488'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(13,148,136,.3)'; }}>
                Get Started for Fleets <ArrowRight size={17} />
              </Link>
            </div>

            {/* Analytics visual */}
            <div className="float bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 shadow-xl order-2 lg:order-2 max-w-md mx-auto lg:max-w-none w-full">
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
                    <div key={i} style={{ flex: 1, background: 'linear-gradient(to top,#0d9488,#5eead4)', borderRadius: '4px 4px 0 0', height: h + '%', opacity: i === 11 ? 1 : 0.5 + i * 0.04 }} />
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

          </div>
        </section>

        <footer className="border-t border-slate-200 py-12 px-4 md:px-10 bg-white text-slate-600">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center mb-1">
                <img src="/logo-removebg-preview.png" alt="DrivePortz Logo" style={{ height: 86, marginBottom: '-15px' }} />
              </div>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                The next-generation mobility digital twin platform.
              </p>
            </div>
            
            <div>
              <h4 className="text-slate-900 font-bold mb-6 tracking-wide text-sm">PLATFORM</h4>
              <ul className="space-y-4">
                <li><Link to="/" className="text-sm text-slate-600 hover:text-teal-600 transition-colors">For Individual Owners</Link></li>
                <li><Link to="/garage-partners" className="text-sm text-slate-600 hover:text-teal-600 transition-colors">For Garages</Link></li>
                <li><Link to="/login" className="text-sm text-slate-600 hover:text-teal-600 transition-colors">Log In</Link></li>
                <li><Link to="/signup" className="text-sm text-slate-600 hover:text-teal-600 transition-colors">Sign Up</Link></li>
              </ul>
            </div>
            
            <div>
              <div className="space-y-4 mb-10">
                <button onClick={(e) => { e.preventDefault(); setShowPartnerTerms(true); }} className="text-sm text-slate-600 hover:text-teal-600 transition-colors block text-left font-medium">Partner Terms and Conditions</button>
                <button onClick={(e) => { e.preventDefault(); setShowTerms(true); }} className="text-sm text-slate-600 hover:text-teal-600 transition-colors block text-left font-medium">Terms and Conditions</button>
                <button onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }} className="text-sm text-slate-600 hover:text-teal-600 transition-colors block text-left font-medium">Privacy Policy</button>
                <button onClick={(e) => { e.preventDefault(); setShowAbout(true); }} className="text-sm text-slate-600 hover:text-teal-600 transition-colors block text-left font-medium">About Us</button>
              </div>
            </div>
          </div>
          
          <div className="max-w-7xl mx-auto border-t border-slate-200 mt-10 pt-6 text-center md:text-left">
            <div style={{ fontSize: '.8rem', color: '#94a3b8' }}>© 2026 DrivePortz. All rights reserved.</div>
          </div>
        </footer>
        
        <TermsConditionsModal isOpen={showTerms} onClose={() => setShowTerms(false)} onAccept={() => {}} readOnly={true} />
        <PartnerTermsModal isOpen={showPartnerTerms} onClose={() => setShowPartnerTerms(false)} />
        <PrivacyPolicyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} onAccept={() => {}} readOnly={true} />
        <AboutUsModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
      </div>
    </>
  );
};

export default FleetsPage;
