import React from 'react';
import { HelpCircle, ChevronDown, CheckCircle2, User, Wrench, Building } from 'lucide-react';

const FAQItem = ({ question, answer }) => (
  <div className="border border-slate-200 rounded-xl mb-4 overflow-hidden bg-white hover:border-teal-300 transition-colors">
    <details className="group">
      <summary className="flex items-center justify-between font-bold text-slate-800 cursor-pointer list-none p-5">
        <span>{question}</span>
        <span className="transition group-open:rotate-180">
          <ChevronDown className="h-5 w-5 text-slate-400" />
        </span>
      </summary>
      <div className="text-slate-600 px-5 pb-5 leading-relaxed">
        {answer}
      </div>
    </details>
  </div>
);

const PartnerHelpFAQ = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-teal-100 rounded-2xl mb-4">
          <HelpCircle className="h-8 w-8 text-teal-700" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-4">Help & Frequently Asked Questions</h1>
        <p className="text-slate-600 text-lg max-w-2xl mx-auto">
          Find answers to common questions about managing your garage, processing bookings, and maximizing your visibility on Driveportz.
        </p>
      </div>

      <div className="space-y-8">
        {/* Getting Started Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Building className="h-5 w-5 text-teal-600" />
            <h2 className="text-xl font-bold text-slate-800">Getting Started</h2>
          </div>
          <FAQItem
            question="How do I complete my garage profile?"
            answer="Navigate to Garage Dashboard → Profile, and provide your services, pricing, operating hours, and location. A complete profile improves discoverability and builds trust with vehicle owners."
          />
          <FAQItem
            question="Why does my garage display as &quot;Closed&quot; despite being open?"
            answer="This may occur if your operating hours were not saved correctly. Please review and re-confirm your hours under Profile → Availability. If the issue persists, contact our support team — this is a known issue we are actively resolving."
          />
          <FAQItem
            question="How do I set my service pricing?"
            answer="Under Profile → Services, add each service along with its price and estimated duration. These details can be updated at any time."
          />
        </section>

        {/* Bookings Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="h-5 w-5 text-teal-600" />
            <h2 className="text-xl font-bold text-slate-800">Bookings</h2>
          </div>
          <FAQItem
            question="How do I accept or decline a booking request?"
            answer="New booking requests appear on your dashboard with options to Accept or Decline. We recommend responding promptly, as response time is visible to vehicle owners when selecting a garage."
          />
          <FAQItem
            question="What is the process for cancelling a confirmed booking?"
            answer="Select the booking, choose Cancel, and provide a reason. The vehicle owner will be notified immediately. Please note that frequent cancellations may affect your visibility in search results."
          />
          <FAQItem
            question="How does the booking status system work?"
            answer="Bookings progress through four stages: Requested → Confirmed → In Progress → Completed. We recommend updating the status promptly to keep vehicle owners informed."
          />
        </section>

        {/* Trust & Verification Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-teal-600" />
            <h2 className="text-xl font-bold text-slate-800">Trust & Verification</h2>
          </div>
          <FAQItem
            question="What does the &quot;Verified&quot; badge signify?"
            answer="The Verified badge confirms to vehicle owners that your garage has been reviewed and validated as an active, legitimate business — building confidence prior to booking."
          />
          <FAQItem
            question="How can my garage become Verified?"
            answer="Complete your profile in full, provide a valid phone number and location, and maintain accurate service records. Our team periodically reviews new garage submissions for verification."
          />
          <FAQItem
            question="How is the Vehicle IQ Score bonus for my garage calculated?"
            answer="Verified garages contribute a trust bonus of +5 points per verified service record, up to a maximum of +15, to a vehicle's IQ Score — rewarding accurate and consistent record-keeping."
          />
        </section>

        {/* Account Management Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-teal-600" />
            <h2 className="text-xl font-bold text-slate-800">Account Management</h2>
          </div>
          <FAQItem
            question="How do I update my garage details or contact information?"
            answer="Navigate to Profile → Edit, update the relevant fields, and select Save."
          />
          <FAQItem
            question="Can I temporarily deactivate my listing?"
            answer="Yes. Under Profile → Availability, toggle &quot;Temporarily Closed.&quot; Your listing and data will remain saved but will not appear in active search results while deactivated."
          />
        </section>
      </div>
    </div>
  );
};

export default PartnerHelpFAQ;
