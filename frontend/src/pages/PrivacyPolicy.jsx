import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Database, FileText, Brain, CreditCard } from 'lucide-react';

const Section = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
    <div className="space-y-3 text-sm sm:text-base leading-7 text-slate-600">{children}</div>
  </section>
);

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-teal-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to DrivePortz
        </Link>

        <article className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 sm:p-10 space-y-8">
          <header className="border-b border-slate-100 pb-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-teal-600" />
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900">Privacy & Data Handling Notice</h1>
            </div>
            <p className="mt-3 text-slate-500 font-medium">Pilot version: 2026-09-v1 • Effective 18 September 2026</p>
          </header>

          <Section title="1. What DrivePortz collects">
            <p>DrivePortz processes account information, contact details, vehicle records, booking and service history, garage information, payment and invoice metadata, support/feedback records, and information you submit to AI-assisted features.</p>
            <p>When you choose to upload documents, DrivePortz may process vehicle-related files such as insurance policies, licence documents, service bills, garage images and dispute evidence.</p>
          </Section>

          <Section title="2. Why this data is used">
            <p>We use this information to authenticate users, manage vehicles and garages, enable bookings and service records, create invoices and payment records, provide notifications, support disputes and audit trails, and operate the Vehicle Doctor/CoPilot features.</p>
          </Section>

          <Section title="3. Vehicle and document upload consent">
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
              <p className="font-semibold text-slate-800">Only upload documents you are authorised to provide.</p>
              <p className="mt-2">By uploading a vehicle or identity-related document, you consent to DrivePortz storing and processing that file for the feature you requested. Avoid uploading unrelated personal information. You can contact DrivePortz to request account/data support where applicable.</p>
            </div>
          </Section>

          <Section title="4. Service providers">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-4"><Database className="h-5 w-5 text-teal-600 mb-2" /><b>Infrastructure & storage</b><p>MongoDB-backed application data and Cloudinary-backed uploaded files.</p></div>
              <div className="rounded-xl border border-slate-200 p-4"><CreditCard className="h-5 w-5 text-teal-600 mb-2" /><b>Payments</b><p>Payment processing may use Razorpay. DrivePortz should not store full card credentials.</p></div>
              <div className="rounded-xl border border-slate-200 p-4"><Brain className="h-5 w-5 text-teal-600 mb-2" /><b>AI services</b><p>Vehicle Doctor/CoPilot requests may be processed through configured AI providers such as Groq or Gemini.</p></div>
              <div className="rounded-xl border border-slate-200 p-4"><FileText className="h-5 w-5 text-teal-600 mb-2" /><b>Login & messaging</b><p>Google authentication, Firebase notifications and configured email delivery services may process the minimum information required for those functions.</p></div>
            </div>
          </Section>

          <Section title="5. Security and access">
            <p>DrivePortz applies authentication, role-based access controls, audit logging, payment signature verification, restricted production origins and persistent storage controls. No internet service can guarantee absolute security, so pilot users should use strong unique passwords and report suspicious activity promptly.</p>
          </Section>

          <Section title="6. Retention and deletion">
            <p>Records may be retained while needed to provide the service, maintain transaction/service history, investigate disputes, meet operational or legal obligations, and protect platform integrity. Test/pilot data should be removed using the controlled cleanup process after the pilot where appropriate.</p>
          </Section>

          <Section title="7. AI outputs">
            <p>AI-generated vehicle guidance is informational support. It may be incomplete or inaccurate and must not replace inspection by a qualified mechanic, emergency responder, insurer or other professional when safety or significant cost is involved.</p>
          </Section>

          <Section title="8. Changes and contact">
            <p>If this notice changes materially, DrivePortz should publish an updated version/date and request renewed consent where required. Pilot users can use the platform support channels for privacy or data-handling questions.</p>
          </Section>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3">
            <Link to="/terms" className="font-bold text-teal-700 hover:text-teal-800">Read Terms of Service</Link>
            <Link to="/signup" className="font-bold text-slate-700 hover:text-slate-900">Create account</Link>
          </div>
        </article>
      </div>
    </main>
  );
}
