import React from 'react';
import { X } from 'lucide-react';

const PartnerTermsModal = ({ isOpen, onClose }) => {
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
                DrivePortz Partner Terms & Conditions
              </h2>
              <p className="text-sm font-medium text-slate-500 mt-1">
                Effective Date: July 19, 2026
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
          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">1. Introduction</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              These Partner Terms & Conditions govern the relationship between DrivePortz ("Platform") and the automotive service provider ("Partner"). By registering as a Partner, you agree to comply with these terms.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">2. Partner Eligibility</h3>
            <p className="text-slate-600 leading-relaxed mb-3">To become a Partner, you must:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Be legally authorized to operate your business.</li>
              <li>Hold all required business licenses, registrations, and permits.</li>
              <li>Provide accurate and up-to-date business information.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">3. Service Standards</h3>
            <p className="text-slate-600 leading-relaxed mb-3">Partners agree to:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Deliver services professionally and honestly.</li>
              <li>Use qualified technicians and appropriate equipment.</li>
              <li>Complete services within the agreed time whenever reasonably possible.</li>
              <li>Treat customers respectfully and fairly.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">4. Pricing</h3>
            <p className="text-slate-600 leading-relaxed mb-3">Partners must:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Clearly disclose service prices.</li>
              <li>Avoid unauthorized or hidden charges.</li>
              <li>Honor confirmed bookings unless exceptional circumstances arise.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">5. Customer Satisfaction</h3>
            <p className="text-slate-600 leading-relaxed mb-3">Partners are responsible for:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Providing quality workmanship.</li>
              <li>Addressing customer concerns promptly.</li>
              <li>Cooperating with DrivePortz during complaint investigations.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">6. Bookings</h3>
            <p className="text-slate-600 leading-relaxed mb-3">Partners should:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Accept or decline booking requests promptly.</li>
              <li>Notify customers and DrivePortz immediately if a scheduled service cannot be completed.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">7. Payments</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              Payment terms, commissions, and settlement schedules will be communicated separately by DrivePortz and may change with prior notice.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">8. Prohibited Activities</h3>
            <p className="text-slate-600 leading-relaxed mb-3">Partners must not:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Submit false business information.</li>
              <li>Mislead customers.</li>
              <li>Perform fraudulent activities.</li>
              <li>Use the DrivePortz brand without written permission.</li>
              <li>Violate any applicable law.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">9. Suspension or Termination</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              DrivePortz may suspend or terminate a Partner account for fraud, repeated poor service, customer safety concerns, violation of these Terms, or other misconduct.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">10. Liability</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              Partners are solely responsible for the services they provide, including the quality, safety, warranties, and compliance with applicable laws.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">11. Confidentiality</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              Partners must keep confidential any customer information and business information obtained through DrivePortz and use it only for providing the requested services.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">12. Changes to These Terms</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              DrivePortz may update these Partner Terms & Conditions from time to time. Continued participation after updates indicates acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">13. Governing Law</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              These Terms are governed by the laws of India.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">14. Contact</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              For questions regarding these Partner Terms & Conditions, please contact DrivePortz through the official contact details published on the DrivePortz website.
            </p>
          </section>
        </div>

        {/* Sticky Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/80 backdrop-blur-md rounded-b-2xl md:rounded-b-3xl">
          <button
            onClick={onClose}
            className="w-full bg-slate-200 text-slate-800 font-bold py-3 px-4 rounded-xl hover:bg-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartnerTermsModal;
