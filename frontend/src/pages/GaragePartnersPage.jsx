import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Users, Award } from 'lucide-react';
import SEO from '../components/SEO';
import TermsConditionsModal from '../components/TermsConditionsModal';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import AboutUsModal from '../components/AboutUsModal';
import PartnerTermsModal from '../components/PartnerTermsModal';

const GaragePartnersPage = () => {
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

  const css = `
    *{box-sizing:border-box;}
    .glow-cta{animation:glowPulse 3s ease-in-out infinite;transition:transform .18s ease}
    .glow-cta:hover{transform:translateY(-3px) scale(1.03)!important}
    @keyframes glowPulse{0%,100%{box-shadow:0 4px 24px rgba(13,148,136,.35),0 2px 8px rgba(13,148,136,.15)}50%{box-shadow:0 8px 40px rgba(13,148,136,.55),0 4px 16px rgba(13,148,136,.25)}}
    .card{transition:transform .3s ease,box-shadow .3s ease,border-color .3s ease;background:#fff;border:1px solid #e2e8f0;border-radius:20px}
    .card:hover{transform:translateY(-10px)!important;box-shadow:0 24px 60px rgba(13,148,136,.13)!important;border-color:rgba(13,148,136,.35)!important}
    .nav-a{color:#475569;font-size:.88rem;font-weight:500;text-decoration:none;position:relative;transition:color .2s}
    .nav-a::after{content:'';position:absolute;width:0;height:2px;bottom:-5px;left:0;background:linear-gradient(90deg,#0d9488,#14b8a6);transition:width .3s ease}
    .nav-a:hover{color:#0d9488}.nav-a:hover::after{width:100%}
  `;

  return (
    <>
      <style>{css}</style>
      <SEO 
        title="Driveportz Garage Partners" 
        description="Grow your workshop online with Driveportz. Manage bookings, verify service claims, and build lasting trust." 
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
            <Link to="/fleets" className="nav-a">For Fleets</Link>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Log in</Link>
            <Link to="/signup" style={{
              background: 'linear-gradient(135deg,#0d9488,#0f766e)',
              color: '#fff', fontWeight: 700, fontSize: '.82rem',
              padding: '.4rem 1rem', borderRadius: 8, textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }} className="glow-cta sm:px-4 sm:py-2 sm:text-sm">
              Register Garage <ArrowRight size={12} className="shrink-0" />
            </Link>
          </div>
        </nav>

        {/* HERO / FOR GARAGES */}
        <section className="pt-32 pb-16 md:pt-40 md:pb-28 px-4 md:px-8 bg-teal-50/50 min-h-[80vh] flex flex-col justify-center">
          <div className="max-w-[1100px] mx-auto text-center">
            <span style={{ fontSize: '.75rem', fontWeight: 800, color: '#14b8a6', letterSpacing: '.12em', textTransform: 'uppercase' }}>FOR GARAGE PARTNERS</span>
            <h1 style={{ fontSize: 'clamp(2.5rem,5vw,4.5rem)', fontWeight: 900, marginTop: '1rem', letterSpacing: '-0.04em', marginBottom: '1.5rem', color: '#0f172a' }}>
              Grow Your Workshop Online
            </h1>
            <p className="text-base sm:text-lg text-slate-500 max-w-[640px] mx-auto mb-12 leading-relaxed">
              Join our platform as a verified partner. Manage bookings, verify service claims, and build lasting trust with thousands of vehicle owners.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {[
                { icon: <Globe size={28} color="#5eead4" />, title: 'Online Presence', desc: 'Create a verified garage profile with services, pricing, and availability. Get discovered by thousands of vehicle owners in your area.' },
                { icon: <Users size={28} color="#14b8a6" />, title: 'Booking Management', desc: 'Accept and track service bookings in real time with a full status timeline — from request through completion.' },
                { icon: <Award size={28} color="#a78bfa" />, title: 'Trust Certification', desc: 'Earn verification badges by cross-validating service records. Higher trust ratings attract premium customers and repeat business.' },
              ].map(item => (
                <div key={item.title} className="card" style={{ padding: '2.5rem' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f0fdfa', border: '1px solid #99f6e4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    {item.icon}
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '.8rem', color: '#0f172a' }}>{item.title}</h3>
                  <p style={{ fontSize: '1rem', color: '#64748b', lineHeight: 1.72 }}>{item.desc}</p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '3.5rem' }}>
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
                Register Your Garage <ArrowRight size={17} />
              </Link>
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
                <li><Link to="/fleets" className="text-sm text-slate-600 hover:text-teal-600 transition-colors">For Fleets</Link></li>
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

export default GaragePartnersPage;
