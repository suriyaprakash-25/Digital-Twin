import React from 'react';
import { X, Heart, Eye, Target, Sparkles, ShieldAlert, Award } from 'lucide-react';

const AboutUsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-[700px] bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[80vh] border border-slate-200/50">
        
        {/* Sticky Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <img 
              src="/logo-removebg-preview.png" 
              alt="DrivePortz Logo" 
              style={{ height: '44px', objectFit: 'contain' }} 
            />
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                About DrivePortz
              </h2>
              <p className="text-sm font-medium text-slate-500 mt-1">
                Driving the Future of Automotive Services
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 scroll-smooth">
          
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-600" />
              Our Story
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Every vehicle owner has faced the same challenge at least once—finding a trustworthy garage when their vehicle needs servicing or repair. At the same time, thousands of skilled local garages struggle to reach new customers despite delivering quality work. This gap between customers and service providers inspired the creation of DrivePortz.
            </p>
            <p className="text-slate-600 leading-relaxed">
              DrivePortz was founded with a simple vision: to make vehicle services easier, more transparent, and accessible for everyone. We believe technology can simplify the way people discover, book, and experience automotive services while helping local businesses grow.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Our journey began with a commitment to understand real-world problems by speaking directly with garage owners, mechanics, and vehicle owners. Instead of building technology first, we chose to listen, learn, and create a platform based on genuine industry needs.
            </p>
            <p className="text-slate-600 leading-relaxed font-semibold text-slate-800">
              Today, DrivePortz is building a connected automotive ecosystem where customers can confidently find trusted service providers, and garages can expand their reach through digital innovation.
            </p>
          </section>

          <hr className="border-slate-100" />

          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Our Mission & Vision</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 bg-teal-50/50 border border-teal-100 rounded-2xl space-y-2">
                <h4 className="font-bold text-teal-900 flex items-center gap-1.5 text-sm">
                  <Target className="h-4.5 w-4.5 text-teal-650" />
                  Our Mission
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  To simplify vehicle ownership by connecting customers with verified automotive service providers through an easy-to-use digital platform that delivers convenience, transparency, and trust.
                </p>
              </div>
              
              <div className="p-5 bg-purple-50/50 border border-purple-100 rounded-2xl space-y-2">
                <h4 className="font-bold text-purple-900 flex items-center gap-1.5 text-sm">
                  <Eye className="h-4.5 w-4.5 text-purple-650" />
                  Our Vision
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  To become India's most trusted automotive services platform, empowering millions of vehicle owners and thousands of local automotive businesses through technology.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900">What We Do</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              DrivePortz connects vehicle owners with trusted automotive service providers through one digital platform. Our goal is to make vehicle maintenance simple, reliable, and stress-free.
            </p>
            <p className="text-slate-600 leading-relaxed mb-2">Our platform is designed to support services such as:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>Vehicle servicing</li>
              <li>Repairs and maintenance</li>
              <li>Roadside assistance</li>
              <li>Car and bike washing</li>
              <li>Vehicle inspection</li>
              <li>Emergency support</li>
              <li>Future mobility solutions</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Our Core Values</h3>
            <div className="space-y-3">
              {[
                { title: 'Customer First', desc: 'Every decision begins with creating a better experience for our customers.' },
                { title: 'Trust & Transparency', desc: 'We believe long-term relationships are built through honesty and reliability.' },
                { title: 'Innovation', desc: 'We continuously improve our platform using technology and customer feedback.' },
                { title: 'Partnership', desc: 'Our success depends on helping local garages and automotive businesses grow alongside us.' },
                { title: 'Quality', desc: 'We are committed to maintaining high standards across every interaction and every service.' }
              ].map(val => (
                <div key={val.title} className="flex gap-3 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="w-6 h-6 rounded-full bg-teal-50 flex items-center justify-center text-teal-650 shrink-0 mt-0.5 font-bold text-xs">✓</div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{val.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{val.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-100" />

          <section className="space-y-3 bg-slate-50 border border-slate-100 p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Award className="h-5 w-5 text-teal-650" />
              Building the Future Together
            </h3>
            <p className="text-slate-650 text-sm leading-relaxed">
              The automotive industry is changing rapidly, and DrivePortz aims to be part of that transformation. We envision a future where finding a trusted garage is as simple as booking a cab or ordering food online.
            </p>
            <p className="text-slate-650 text-sm leading-relaxed">
              Our roadmap includes expanding our network of verified service partners, introducing smarter booking experiences, improving customer convenience, and bringing digital tools to local automotive businesses across India.
            </p>
            <p className="text-slate-650 text-sm leading-relaxed">
              We understand that building trust takes time. That's why our focus is not simply on growing fast, but on growing responsibly by delivering real value to both customers and partners.
            </p>
            <p className="text-slate-650 text-sm leading-relaxed">
              Whether you are a vehicle owner looking for dependable service or a garage seeking new opportunities, DrivePortz is committed to supporting your journey.
            </p>
            <div className="pt-2 border-t border-slate-200 mt-4 text-center">
              <div className="font-bold text-slate-900 text-base">DrivePortz</div>
              <div className="text-xs text-teal-605 font-semibold mt-1">Driven by Trust. Powered by Technology. Built for Every Journey.</div>
            </div>
          </section>

        </div>

        {/* Sticky Footer */}
        <div className="flex-shrink-0 px-6 py-5 border-t border-slate-100 bg-slate-50 flex justify-end z-10">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors w-full sm:w-auto shadow-sm"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default AboutUsModal;
