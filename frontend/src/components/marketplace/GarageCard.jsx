import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Navigation, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { getPhotoUrl } from '../../utils/imageUrl';
import { slotsLeft } from './useMarketplaceData';

const StatusPill = ({ status }) => (
  <div className={`px-2 py-0.5 rounded-full flex items-center gap-1.5 text-xs font-bold border ml-1
    ${status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
      status === 'BUSY' ? 'bg-amber-50 text-amber-700 border-amber-200' :
      'bg-slate-50 text-slate-600 border-slate-200'}`}
  >
    {status === 'AVAILABLE' && <span className="relative flex h-2 w-2" aria-hidden="true"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
    {status === 'BUSY' && <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true"></span>}
    {status === 'CLOSED' && <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true"></span>}
    {status === 'AVAILABLE' ? 'Open Now' : status === 'BUSY' ? 'Busy' : 'Closed'}
  </div>
);

const SlotsPill = ({ garage }) => {
  const left = slotsLeft(garage);
  return (
    <div className={`px-2 py-0.5 rounded-full text-xs font-bold border ml-1
      ${left <= 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : left <= 5 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}
    >
      {left <= 0 ? '🚫 Full (0 slots left)' : `Slots: ${left} / ${garage.maxCapacity} remaining`}
    </div>
  );
};

const unavailableClasses = 'bg-slate-350 cursor-not-allowed text-slate-500';

/**
 * One garage in the marketplace list. Clicking the card (outside buttons/links) opens
 * the garage details page; the garage name is also a keyboard-accessible link.
 */
const GarageCard = ({ garage: g, canBook, pendingServiceKey, onRequestService, onReportIssue }) => {
  const navigate = useNavigate();
  const isClosed = g.currentStatus === 'CLOSED';
  const isFull = slotsLeft(g) <= 0;
  const unavailable = isClosed || isFull;
  const bookingBusy = Boolean(pendingServiceKey);

  return (
    <div
      onClick={(e) => {
        if (e.target.closest('button') || e.target.closest('a')) return;
        navigate(`/garages/${g.id}`);
      }}
      className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm cursor-pointer hover:border-teal-400 hover:shadow-md transition-all group"
    >
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
            {g.photoUrl || (Array.isArray(g.galleryPhotos) && g.galleryPhotos.length > 0) ? (
              <img
                src={getPhotoUrl(g.photoUrl || g.galleryPhotos[0])}
                alt={g.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <span className="font-black text-teal-700 text-lg" aria-hidden="true">{g.name?.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div>
            <div className="text-lg font-extrabold text-slate-900 group-hover:text-teal-700 transition-colors flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold">
                <Link to={`/garages/${g.id}`} className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded">
                  {g.name}
                </Link>
              </h2>
              {g.verified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-bold">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Verified
                </span>
              )}
              <StatusPill status={g.currentStatus} />
              <SlotsPill garage={g} />
              <div className="ml-1">
                {g.reviewCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                    ★ {g.rating} ({g.reviewCount} reviews)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 inline-flex items-center gap-1">
                    ★ New Partner
                  </span>
                )}
              </div>
            </div>
            <div className="text-sm text-slate-600 mt-1">{[g.address, g.city].filter(Boolean).join(', ')}</div>
            {g.phone ? <div className="text-sm text-slate-600 mt-1">Phone: {g.phone}</div> : null}
            {g.description ? <div className="text-sm text-slate-600 mt-2">{g.description}</div> : null}
          </div>
        </div>

        <div>
          {g.garageLocation?.latitude && g.garageLocation?.longitude ? (
            <a
              href={`https://www.google.com/maps?q=${g.garageLocation.latitude},${g.garageLocation.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-sm font-bold hover:bg-teal-100 transition-all"
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Show Location
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> No location set
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-indigo-200 rounded-2xl p-4 bg-indigo-50/50 flex flex-col justify-center transition-colors hover:border-indigo-300">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-indigo-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-indigo-600" aria-hidden="true" /> Custom Vehicle Issue
              </div>
              <div className="text-xs text-indigo-700 mt-1">Not sure what's wrong? Describe the problem directly to the garage.</div>
            </div>
            <button
              type="button"
              onClick={() => onReportIssue(g.id)}
              disabled={!canBook || unavailable}
              aria-label={`Report a custom vehicle issue to ${g.name}`}
              className={`shrink-0 text-white text-sm font-bold py-2 px-4 rounded-xl shadow-sm transition-colors ${
                unavailable ? unavailableClasses : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              Request
            </button>
          </div>
        </div>

        {(g.services || []).length === 0 ? (
          <div className="text-slate-500 text-sm">No services listed.</div>
        ) : (
          g.services.map((s) => {
            const key = `${g.id}:${s.id}`;
            const isPending = pendingServiceKey === key;
            return (
              <div key={s.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">{s.title}</div>
                    {s.description ? <div className="text-sm text-slate-600 mt-1">{s.description}</div> : null}
                    <div className="text-xs text-slate-500 mt-2 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        {s.price !== null && s.price !== undefined ? (
                          <span className="font-metric text-metric-md text-teal-700">₹{s.price}</span>
                        ) : (
                          <span className="text-slate-500 font-semibold">Price: —</span>
                        )}
                        {s.durationMins ? <span className="text-slate-400 font-medium">• {s.durationMins} mins</span> : ''}
                      </div>
                      {g.currentStatus === 'BUSY' && <span className="text-amber-600 font-semibold text-[10px]">Garage is busy, expect delays</span>}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRequestService({ garageId: g.id, serviceId: s.id, serviceTitle: s.title, garageName: g.name })}
                    disabled={!canBook || unavailable || bookingBusy}
                    aria-busy={isPending}
                    aria-label={unavailable ? undefined : `Request ${s.title} at ${g.name}`}
                    title={isClosed ? 'Garage is currently closed' : isFull ? 'Garage is at full capacity' : ''}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all ${
                      unavailable ? unavailableClasses : 'bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {isClosed ? 'Closed' : isFull ? 'Full' : isPending ? 'Requesting…' : 'Request'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default GarageCard;
