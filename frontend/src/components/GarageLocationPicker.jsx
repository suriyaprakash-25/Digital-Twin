import { useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { MapPin, Navigation, Save, ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// Fix default marker icon broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Inner component: listens to map clicks and places a marker
function LocationSelector({ position, onSelect }) {
  useMapEvents({
    click(e) {
      onSelect({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return position ? <Marker position={[position.latitude, position.longitude]} /> : null;
}

const GarageLocationPicker = ({ token, initialLocation, readOnly = false, onSaved }) => {
  const [location, setLocation] = useState(
    initialLocation?.latitude && initialLocation?.longitude
      ? { latitude: initialLocation.latitude, longitude: initialLocation.longitude }
      : null
  );
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [saved, setSaved] = useState(Boolean(initialLocation?.latitude));
  const mapRef = useRef(null);

  // Default center: India
  const defaultCenter = [20.5937, 78.9629];
  const mapCenter = location
    ? [location.latitude, location.longitude]
    : defaultCenter;

  function flash(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  }

  const handleDetect = () => {
    if (!navigator.geolocation) {
      flash('error', 'Geolocation is not supported by your browser.');
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setLocation(coords);
        setSaved(false);
        if (mapRef.current) {
          mapRef.current.setView([coords.latitude, coords.longitude], 16);
        }
        setDetecting(false);
      },
      () => {
        flash('error', 'Could not detect location. Please allow location access.');
        setDetecting(false);
      }
    );
  };

  const handleSave = async () => {
    if (!location) {
      flash('error', 'Please select a location on the map first.');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        'http://localhost:5000/api/garages/location',
        { latitude: location.latitude, longitude: location.longitude },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSaved(true);
      flash('success', 'Location saved successfully!');
      if (onSaved) onSaved({ latitude: location.latitude, longitude: location.longitude });
    } catch (e) {
      flash('error', e.response?.data?.msg || 'Failed to save location.');
    } finally {
      setSaving(false);
    }
  };

  const googleMapsUrl = location
    ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
    : null;

  return (
    <div className="space-y-4">
      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm" style={{ height: 300 }}>
        <MapContainer
          center={mapCenter}
          zoom={location ? 15 : 5}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!readOnly && (
            <LocationSelector
              position={location}
              onSelect={(coords) => { setLocation(coords); setSaved(false); }}
            />
          )}
          {readOnly && location && (
            <Marker position={[location.latitude, location.longitude]} />
          )}
        </MapContainer>
      </div>

      {/* Hint */}
      {!readOnly && (
        <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          Click anywhere on the map to place your garage pin, or use &ldquo;Detect My Location&rdquo;.
        </p>
      )}

      {/* Coordinates display */}
      {location && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono">
          <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <span className="text-slate-700">
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </span>
          {saved && (
            <span className="ml-auto inline-flex items-center gap-1 text-emerald-600 text-xs font-sans font-bold">
              <CheckCircle className="h-3.5 w-3.5" /> Saved
            </span>
          )}
        </div>
      )}

      {/* Alert */}
      {message.text && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${
          message.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.type === 'success'
            ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Action buttons */}
      {!readOnly && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDetect}
            disabled={detecting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-60"
          >
            {detecting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Navigation className="h-4 w-4 text-blue-500" />}
            Detect My Location
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !location || saved}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save Location'}
          </button>

          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-all"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Google Maps
            </a>
          )}
        </div>
      )}

      {/* Read-only directions button */}
      {readOnly && googleMapsUrl && (
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-sm"
        >
          <Navigation className="h-4 w-4" />
          Get Directions
        </a>
      )}
    </div>
  );
};

export default GarageLocationPicker;
