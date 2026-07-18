import React from 'react';
import { X } from 'lucide-react';

const PrivacyPolicyModal = ({ isOpen, onClose, onAccept, readOnly = false }) => {
  if (!isOpen) return null;

  // Format today's date
  const effectiveDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

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
                DrivePortz Privacy Policy & Terms
              </h2>
              <p className="text-sm font-medium text-slate-500 mt-1">
                Effective Date: {effectiveDate}
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
          <p className="text-slate-600 leading-relaxed">
            Welcome to DrivePortz. These Terms & Conditions ("Terms") govern your access to and use of the DrivePortz website, mobile application, and all related services (collectively, the "Platform"). By accessing, browsing, registering, or using the Platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms. If you do not agree with any part of these Terms, you should discontinue using the Platform immediately.
          </p>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">1. About DrivePortz</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              DrivePortz is a technology platform designed to connect vehicle owners with independent automotive service providers, including but not limited to vehicle maintenance, repairs, detailing, roadside assistance, inspections, towing, and other mobility-related services.
            </p>
            <p className="text-slate-600 leading-relaxed">
              DrivePortz facilitates service discovery, booking, communication, and payments where applicable. Unless expressly stated otherwise, DrivePortz does not directly provide automotive services and is not the employer, agent, or representative of third-party service providers.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">2. Eligibility</h3>
            <p className="text-slate-600 leading-relaxed mb-3">To use the Platform, you must:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Be at least 18 years of age; or</li>
              <li>Use the Platform under the supervision and consent of a parent or legal guardian.</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3 mb-3">
              By using DrivePortz, you represent and warrant that all information you provide is accurate, complete, and up to date.
            </p>
            <p className="text-slate-600 leading-relaxed">
              DrivePortz reserves the right to refuse access or terminate accounts that violate these Terms or applicable laws.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">3. User Accounts</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              Certain features of the Platform may require you to create an account.
            </p>
            <p className="text-slate-600 leading-relaxed mb-3">You are responsible for:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Maintaining the confidentiality of your login credentials.</li>
              <li>Ensuring that all information associated with your account remains accurate.</li>
              <li>All activities that occur under your account.</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3 mb-3">
              You must immediately notify DrivePortz if you suspect unauthorized access to your account.
            </p>
            <p className="text-slate-600 leading-relaxed">
              DrivePortz is not liable for losses resulting from unauthorized use caused by your failure to safeguard your account credentials.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">4. User Responsibilities</h3>
            <p className="text-slate-600 leading-relaxed mb-3">When using DrivePortz, you agree to:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Provide truthful and accurate information.</li>
              <li>Respect service providers and other users.</li>
              <li>Use the Platform only for lawful purposes.</li>
              <li>Not interfere with or disrupt the Platform's operation.</li>
              <li>Not upload viruses, malware, or harmful software.</li>
              <li>Not attempt to gain unauthorized access to our systems.</li>
              <li>Not misuse promotional offers or payment systems.</li>
              <li>Not impersonate another individual or entity.</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3">
              Any violation of these obligations may result in suspension or permanent termination of your account.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">5. Booking and Service Availability</h3>
            <p className="text-slate-600 leading-relaxed mb-3">All bookings made through DrivePortz are subject to:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Availability of service providers.</li>
              <li>Geographic service coverage.</li>
              <li>Operational conditions.</li>
              <li>Vehicle compatibility.</li>
              <li>Confirmation by the selected service provider.</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3 mb-3">
              DrivePortz does not guarantee that a requested service will always be available or completed within a specific timeframe.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Estimated arrival times and service durations are provided for convenience only and may vary.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">6. Pricing and Payments</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              Service prices displayed on the Platform may include applicable taxes and fees unless stated otherwise.
            </p>
            <p className="text-slate-600 leading-relaxed mb-3">
              Payments must be made using the payment methods approved by DrivePortz.
            </p>
            <p className="text-slate-600 leading-relaxed mb-3">DrivePortz reserves the right to:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Modify prices without prior notice.</li>
              <li>Correct pricing errors.</li>
              <li>Cancel bookings affected by obvious pricing mistakes.</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3">
              If payment cannot be processed successfully, DrivePortz may suspend or cancel the related booking.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">7. Cancellations and Refunds</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              Cancellation and refund policies vary depending on the service booked.
            </p>
            <p className="text-slate-600 leading-relaxed mb-3">Refund eligibility may depend on factors including:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Cancellation timing.</li>
              <li>Service provider policies.</li>
              <li>Whether the service has already commenced.</li>
              <li>Promotional discounts or special offers used during booking.</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3">
              Approved refunds will be processed through the original payment method within the timeframe determined by the payment provider.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">8. Third-Party Service Providers</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              DrivePortz acts solely as an intermediary platform connecting users with independent service providers.
            </p>
            <p className="text-slate-600 leading-relaxed mb-3">Each provider is independently responsible for:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Service quality.</li>
              <li>Workmanship.</li>
              <li>Pricing accuracy.</li>
              <li>Compliance with applicable laws.</li>
              <li>Required licenses and permits.</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3">
              While DrivePortz strives to work with reliable partners, we do not guarantee the performance, safety, or suitability of any third-party provider.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">9. Intellectual Property</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              All content available on the Platform, including but not limited to the DrivePortz name, logo, trademarks, graphics, icons, images, software, website design, text, and databases, is owned by or licensed to DrivePortz and protected under applicable intellectual property laws.
            </p>
            <p className="text-slate-600 leading-relaxed">
              No content may be copied, reproduced, modified, distributed, or commercially exploited without prior written permission.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">10. Privacy</h3>
            <p className="text-slate-600 leading-relaxed">
              Your use of DrivePortz is also governed by our Privacy Policy, which explains how we collect, use, store, and protect your personal information. By using the Platform, you consent to the collection and processing of your information in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">11. Limitation of Liability</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              To the maximum extent permitted by applicable law, DrivePortz shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Services performed by independent service providers.</li>
              <li>Delays or cancellations.</li>
              <li>Vehicle damage.</li>
              <li>Loss of profits.</li>
              <li>Loss of data.</li>
              <li>Business interruption.</li>
              <li>Personal injury, except where liability cannot legally be excluded.</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3">
              Our total liability, where applicable, shall not exceed the amount paid by the user for the specific booking giving rise to the claim.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">12. Indemnification</h3>
            <p className="text-slate-600 leading-relaxed">
              You agree to indemnify and hold harmless DrivePortz, its directors, employees, affiliates, partners, and representatives from any claims, damages, liabilities, losses, costs, or legal expenses arising out of your misuse of the Platform, breach of these Terms, violation of applicable laws, or infringement of any third-party rights.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">13. Suspension and Termination</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              DrivePortz reserves the right to suspend or permanently terminate your account without prior notice if you:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Violate these Terms.</li>
              <li>Engage in fraudulent or unlawful activities.</li>
              <li>Misuse the Platform.</li>
              <li>Harm other users or service providers.</li>
              <li>Attempt unauthorized access to our systems.</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3">
              Termination does not affect any legal rights or obligations that accrued before termination.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">14. Force Majeure</h3>
            <p className="text-slate-600 leading-relaxed">
              DrivePortz shall not be liable for any delay or failure in performing its obligations due to events beyond its reasonable control, including natural disasters, pandemics, government actions, internet outages, labor disputes, or other unforeseen circumstances.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">15. Changes to These Terms</h3>
            <p className="text-slate-600 leading-relaxed">
              We may revise these Terms from time to time to reflect changes in our services, legal requirements, or business practices. Updated Terms will be published on the Platform with a revised Effective Date. Your continued use of DrivePortz after any updates constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">16. Governing Law and Jurisdiction</h3>
            <p className="text-slate-600 leading-relaxed">
              These Terms shall be governed by and interpreted in accordance with the laws of India. Any dispute arising out of or relating to these Terms shall be subject to the exclusive jurisdiction of the competent courts in India.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">17. Contact Information</h3>
            <p className="text-slate-600 leading-relaxed">
              If you have any questions, concerns, or requests regarding these Terms & Conditions, you may contact DrivePortz through the contact details provided on our official website or mobile application. We will make reasonable efforts to respond to your inquiries in a timely manner.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">18. Entire Agreement</h3>
            <p className="text-slate-600 leading-relaxed">
              These Terms & Conditions, together with our Privacy Policy and any additional policies or guidelines published on the Platform, constitute the entire agreement between you and DrivePortz regarding your use of the Platform and supersede any prior agreements or understandings relating to the same subject matter.
            </p>
          </section>

        </div>

        {/* Sticky Footer */}
        <div className="flex-shrink-0 px-6 py-5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 z-10">
          {readOnly ? (
            <div className="flex w-full justify-end">
              <button 
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors w-full sm:w-auto shadow-sm"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input 
                  type="checkbox" 
                  id="modal-privacy-checkbox"
                  className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  onChange={(e) => {
                    if (e.target.checked) {
                      onAccept();
                    }
                  }}
                />
                <label htmlFor="modal-privacy-checkbox" className="text-sm font-semibold text-slate-700 cursor-pointer">
                  I have read and understood the Privacy Policy & Terms.
                </label>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                <button 
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    document.getElementById('modal-privacy-checkbox').checked = true;
                    onAccept();
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-sm transition-colors w-full sm:w-auto"
                >
                  Accept
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default PrivacyPolicyModal;
