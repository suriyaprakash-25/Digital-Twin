import React from 'react';
import { Clock, MapPin, Phone, Mail, Navigation, CreditCard, Car, Truck, Wrench, ShieldAlert } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const BusinessInfo = ({ garage }) => {
  if (!garage) return null;

  const {
    businessHours = {},
    currentStatus = 'AVAILABLE',
    currentTime = '',
    phone,
    email,
    address,
    city,
    garageLocation,
    facilities = {},
    paymentMethods = ['Cash', 'UPI', 'Credit/Debit Card']
  } = garage;

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayHours = businessHours[todayName] || { isOpen: true, openTime: '09:00', closeTime: '19:00' };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Business Hours & Today's Status */}
      <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" /> Business Hours &amp; Live Status
          </h3>
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
            currentStatus === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            {currentStatus === 'AVAILABLE' ? 'Open Now' : 'Closed'}
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-600 flex justify-between items-center">
          <span>Today ({todayName}): <span className="text-slate-900 font-extrabold">{todayHours.isOpen ? `${todayHours.openTime} – ${todayHours.closeTime}` : 'Closed'}</span></span>
          {currentTime && <span className="text-[11px] text-slate-400 font-normal">{currentTime}</span>}
        </div>

        {/* Weekly Schedule Table */}
        <div className="divide-y divide-slate-100 text-xs">
          {DAYS.map((day) => {
            const h = businessHours[day] || { isOpen: true, openTime: '09:00', closeTime: '19:00' };
            const isToday = day === todayName;

            return (
              <div key={day} className={`py-2.5 px-3 flex justify-between items-center rounded-xl transition-colors ${isToday ? 'bg-teal-50/70 font-bold text-teal-900' : 'text-slate-600'}`}>
                <span className="flex items-center gap-1.5">
                  {isToday && <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />}
                  {day}
                </span>
                <span>
                  {h.isOpen ? `${h.openTime} – ${h.closeTime}` : <span className="text-rose-600 font-bold">Closed</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Facilities, Payments & Maps */}
      <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
          <Car className="w-5 h-5 text-teal-600" /> Facilities &amp; Payment Methods
        </h3>

        {/* Facilities Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-2xl border flex items-center gap-2.5 text-xs font-bold ${facilities.parkingAvailable !== false ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <Car className="w-4 h-4 text-emerald-600" /> Parking Available
          </div>
          <div className={`p-3 rounded-2xl border flex items-center gap-2.5 text-xs font-bold ${facilities.pickupDrop !== false ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <Truck className="w-4 h-4 text-emerald-600" /> Pickup &amp; Drop
          </div>
          <div className={`p-3 rounded-2xl border flex items-center gap-2.5 text-xs font-bold ${facilities.homeService !== false ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <Wrench className="w-4 h-4 text-emerald-600" /> Home Service
          </div>
          <div className={`p-3 rounded-2xl border flex items-center gap-2.5 text-xs font-bold ${facilities.emergencyService !== false ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            <ShieldAlert className="w-4 h-4 text-emerald-600" /> Emergency Breakdown
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block">Accepted Payment Methods</span>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map((pm, idx) => (
              <span key={idx} className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-500" /> {pm}
              </span>
            ))}
          </div>
        </div>

        {/* Map Preview Button */}
        {garageLocation?.latitude && garageLocation?.longitude && (
          <div className="pt-3 border-t border-slate-100">
            <a
              href={`https://www.google.com/maps?q=${garageLocation.latitude},${garageLocation.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full p-3.5 rounded-2xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Navigation className="w-4 h-4 text-teal-600" /> Open Location in Google Maps
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessInfo;
