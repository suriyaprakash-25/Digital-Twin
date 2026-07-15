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
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              DrivePortz Privacy Policy
            </h2>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Effective Date: {effectiveDate}
            </p>
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
            <h3 className="text-lg font-bold text-slate-900 mb-3">1. Information We Collect</h3>
            <p className="text-slate-600 leading-relaxed">
              We may collect your name, email address, phone number, vehicle details, location (when permitted), and any information you provide while using our services.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">2. How We Use Your Information</h3>
            <p className="text-slate-600 leading-relaxed">
              We use your information to provide services, process bookings, improve our platform, communicate with you, and enhance customer support.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">3. Information Sharing</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              We may share relevant information with trusted service partners only to fulfill your requested services.
            </p>
            <p className="text-slate-600 leading-relaxed font-semibold">
              We do not sell your personal information.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">4. Data Security</h3>
            <p className="text-slate-600 leading-relaxed">
              We use reasonable technical and organizational measures to protect your information from unauthorized access, disclosure, or misuse.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">5. Cookies</h3>
            <p className="text-slate-600 leading-relaxed">
              Our website may use cookies and similar technologies to improve functionality and analyze website usage.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">6. Your Rights</h3>
            <p className="text-slate-600 leading-relaxed">
              You may request access to, correction of, or deletion of your personal information, subject to applicable law.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">7. Third-Party Links</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              Our website may contain links to third-party websites.
            </p>
            <p className="text-slate-600 leading-relaxed">
              We are not responsible for their privacy practices or content.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">8. Policy Updates</h3>
            <p className="text-slate-600 leading-relaxed mb-3">
              We may update this Privacy Policy periodically.
            </p>
            <p className="text-slate-600 leading-relaxed">
              The latest version will always be available on the DrivePortz website.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-3">9. Contact Us</h3>
            <p className="text-slate-600 leading-relaxed">
              If you have questions about this Privacy Policy or your personal data, please contact DrivePortz using the contact information provided on the official website.
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
                  I have read and understood the Privacy Policy.
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
