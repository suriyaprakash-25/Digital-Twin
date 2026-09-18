import { Link } from 'react-router-dom';
import { ArrowLeft, FileCheck2, AlertTriangle } from 'lucide-react';

const Section = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
    <div className="space-y-3 text-sm sm:text-base leading-7 text-slate-600">{children}</div>
  </section>
);

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-teal-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to DrivePortz
        </Link>

        <article className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 sm:p-10 space-y-8">
          <header className="border-b border-slate-100 pb-6">
            <div className="flex items-center gap-3">
              <FileCheck2 className="h-8 w-8 text-teal-600" />
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900">DrivePortz Terms of Service</h1>
            </div>
            <p className="mt-3 text-slate-500 font-medium">Pilot version: 2026-09-v1 • Effective 18 September 2026</p>
          </header>

          <Section title="1. Pilot platform">
            <p>DrivePortz is currently being prepared for a controlled pilot. Features, integrations and workflows may be updated as reliability and user feedback are validated. Pilot participants should report unexpected behaviour instead of relying on unverified platform results for safety-critical decisions.</p>
          </Section>

          <Section title="2. Accounts and responsibilities">
            <p>You must provide accurate information, protect your login credentials, use only accounts you are authorised to use, and comply with the role assigned to you. Public registration does not grant administrative privileges.</p>
          </Section>

          <Section title="3. Garage marketplace and services">
            <p>DrivePortz facilitates digital workflows between vehicle owners and garage/service partners. Garage partners remain responsible for the accuracy, quality, legality and safety of the automotive services they perform and the records they submit.</p>
          </Section>

          <Section title="4. Bookings, invoices and payments">
            <p>Bookings depend on garage availability and confirmation. Where enabled, customer payments are processed using the configured payment gateway. Invoice and transaction records shown in DrivePortz should be reviewed when a dispute, refund or mismatch occurs.</p>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p>During the controlled pilot, automatic garage settlement jobs remain disabled. Garage payouts are handled through the approved manual pilot process until the live payout workflow has passed production validation.</p>
            </div>
          </Section>

          <Section title="5. Vehicle Doctor and CoPilot">
            <p>AI-assisted features provide informational guidance based on available data and user input. They are not a substitute for physical inspection or professional mechanical, emergency, insurance or legal advice. Do not delay urgent safety action because of an AI response.</p>
          </Section>

          <Section title="6. Uploaded content">
            <p>You must have permission to upload vehicle records, insurance documents, licence files, images, bills and dispute evidence. Do not upload unlawful content, malware or unrelated sensitive information.</p>
          </Section>

          <Section title="7. Prohibited use">
            <p>You may not attempt to bypass authentication or role controls, manipulate payments, impersonate another person or garage, submit fraudulent records, abuse platform resources, scrape restricted data, interfere with service availability, or use DrivePortz for unlawful activity.</p>
          </Section>

          <Section title="8. Suspension and pilot access">
            <p>DrivePortz may restrict or suspend pilot accounts where required to investigate security, fraud, data integrity, operational or policy concerns. Pilot features may also be disabled temporarily while incidents are investigated.</p>
          </Section>

          <Section title="9. Platform availability">
            <p>While DrivePortz is designed with production controls, no service is guaranteed to be uninterrupted or error-free. Planned or emergency maintenance, provider outages and network failures may temporarily affect availability.</p>
          </Section>

          <Section title="10. Privacy">
            <p>Use of DrivePortz is also governed by the Privacy & Data Handling Notice, including the handling of vehicle records, uploaded documents, payment metadata and AI feature inputs.</p>
          </Section>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3">
            <Link to="/privacy" className="font-bold text-teal-700 hover:text-teal-800">Read Privacy & Data Handling Notice</Link>
            <Link to="/signup" className="font-bold text-slate-700 hover:text-slate-900">Create account</Link>
          </div>
        </article>
      </div>
    </main>
  );
}
