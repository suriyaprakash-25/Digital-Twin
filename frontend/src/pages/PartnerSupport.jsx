import React from 'react';
import { Phone, MessageCircle, FileText, AlertTriangle } from 'lucide-react';

const PartnerSupport = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white shadow rounded-lg p-6 sm:p-10 border border-slate-200">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-4">Partner Support</h1>
        <p className="text-slate-600 mb-8 text-lg">
          We are committed to providing timely, reliable support to every garage partner on the Driveportz platform.
          Please use the channel most appropriate to your query below.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div className="bg-teal-50 rounded-xl p-6 border border-teal-100 flex flex-col items-start">
            <div className="p-3 bg-teal-100 text-teal-700 rounded-lg mb-4">
              <MessageCircle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">WhatsApp Support (Recommended)</h2>
            <p className="text-slate-700 font-semibold mb-1">6381509292</p>
            <p className="text-sm text-slate-500">Available 9:00 AM – 8:00 PM, seven days a week.</p>
          </div>

          <div className="bg-blue-50 rounded-xl p-6 border border-blue-100 flex flex-col items-start">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-lg mb-4">
              <Phone className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Phone Support</h2>
            <p className="text-slate-700 font-semibold mb-1">6381509292</p>
            <p className="text-sm text-slate-500">Available 9:00 AM – 8:00 PM, Monday to Saturday.</p>
          </div>
        </div>

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-6 w-6 text-slate-400" />
            <h2 className="text-2xl font-bold text-slate-900">Submit a Support Request</h2>
          </div>
          <p className="text-slate-600 mb-6">
            For non-urgent matters, please submit a request with the following details:
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-teal-600">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Field
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">Garage Name</td>
                  <td className="px-6 py-4 text-sm text-slate-500">The registered name of your garage</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">Issue Category</td>
                  <td className="px-6 py-4 text-sm text-slate-500">Booking / Payment / Listing / Technical / Other</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">Description</td>
                  <td className="px-6 py-4 text-sm text-slate-500">A brief summary of the issue</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">Attachment (optional)</td>
                  <td className="px-6 py-4 text-sm text-slate-500">Screenshot or supporting document</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm italic text-slate-500">
            We aim to respond to all inquiries within 24 hours. Urgent booking-related matters are prioritized accordingly.
          </p>
        </div>

        <div className="bg-red-50 rounded-xl p-6 border border-red-200">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h2 className="text-xl font-bold text-red-900">Urgent Escalation</h2>
          </div>
          <p className="text-red-700">
            For same-day booking disputes or payment concerns requiring immediate attention, please contact <span className="font-bold">6381509292</span> directly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PartnerSupport;
