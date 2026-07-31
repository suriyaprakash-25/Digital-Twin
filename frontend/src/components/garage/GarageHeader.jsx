import React from 'react';
import { ShieldCheck, Star, MapPin, Phone, Mail, Clock, CalendarCheck, Navigation, Award, Wrench } from 'lucide-react';
import { getPhotoUrl } from '../../utils/imageUrl';

const GarageHeader = ({ garage, onBookClick, onLocationClick }) => {
  if (!garage) return null;

  const {
    name,
    verified,
    rating = 4.8,
    reviewCount = 0,
    currentStatus = 'AVAILABLE',
    address,
    city,
    phone,
    email,
    experienceYears = 8,
    partnerSince = 2024,
    description,
    photoUrl,
    certifications = [],
    garageLocation
  } = garage;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
      {/* Top Banner Gradient Overlay */}
      <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-teal-500 via-emerald-500 to-indigo-500" />

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pt-2">
        {/* Left Info Column */}
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Logo / Photo Avatar */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-teal-50 border-2 border-teal-100 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
            {photoUrl ? (
              <img src={getPhotoUrl(photoUrl)} alt={name} className="w-full h-full object-cover" />
            ) : (
              <Wrench className="w-10 h-10 text-teal-600" />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{name}</h1>
              {verified !== false && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Verified Partner
                </span>
              )}
            </div>

            {/* Ratings & Reviews Pill */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
              {reviewCount > 0 ? (
                <div className="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>{rating}</span>
                  <span className="text-slate-500 font-normal">({reviewCount} Reviews)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-teal-700 font-bold bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200/60">
                  <Star className="w-3.5 h-3.5 fill-teal-600 text-teal-600" />
                  <span>New Partner</span>
                </div>
              )}

              {/* Status Badge */}
              <div className={`px-3 py-1 rounded-full flex items-center gap-1.5 font-bold text-xs border
                ${currentStatus === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  currentStatus === 'BUSY' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-slate-50 text-slate-600 border-slate-200'}`}
              >
                {currentStatus === 'AVAILABLE' && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
                {currentStatus === 'BUSY' && <span className="h-2 w-2 rounded-full bg-amber-500"></span>}
                {currentStatus === 'CLOSED' && <span className="h-2 w-2 rounded-full bg-slate-400"></span>}
                {currentStatus === 'AVAILABLE' ? 'Open Now' : currentStatus === 'BUSY' ? 'Busy' : 'Closed'}
              </div>
            </div>

            {/* Quick Metadata */}
            <div className="mt-4 space-y-1.5 text-xs sm:text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{[address, city].filter(Boolean).join(', ')}</span>
              </div>
              {phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <a href={`tel:${phone}`} className="hover:text-teal-600 font-semibold">{phone}</a>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{email}</span>
                </div>
              )}
            </div>

            {/* Tags / Certifications */}
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 flex items-center gap-1">
                <Award className="w-3 h-3 text-slate-500" /> {experienceYears} Years Exp.
              </span>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 flex items-center gap-1">
                <CalendarCheck className="w-3 h-3 text-slate-500" /> Partner Since {partnerSince}
              </span>
              {certifications.slice(0, 3).map((cert, idx) => (
                <span key={idx} className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  {cert}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 sm:w-full lg:w-48">
          <button
            onClick={onBookClick}
            className="w-full py-3 px-5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2"
          >
            <CalendarCheck className="w-4 h-4" /> Book Service
          </button>
          
          {phone && (
            <a
              href={`tel:${phone}`}
              className="w-full py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm border border-slate-200 transition-all flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4 text-slate-600" /> Call Garage
            </a>
          )}

          {garageLocation?.latitude && garageLocation?.longitude && (
            <button
              onClick={onLocationClick}
              className="w-full py-3 px-5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-sm border border-emerald-200 transition-all flex items-center justify-center gap-2"
            >
              <Navigation className="w-4 h-4" /> Show Location
            </button>
          )}
        </div>
      </div>

      {/* Description Snippet */}
      {description && (
        <div className="mt-6 pt-5 border-t border-slate-100">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1">About Garage</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{description}</p>
        </div>
      )}
    </div>
  );
};

export default GarageHeader;
