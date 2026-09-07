import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Camera, UploadCloud } from 'lucide-react';

/**
 * MediaManager Component
 * Handles displaying, uploading, and deleting media for Vehicles or Services.
 *
 * @param {string} entityId - The ID of the Vehicle or Service
 * @param {string} entityType - "VEHICLE" or "SERVICE"
 * @param {string} category - "PROFILE", "DAMAGE", "INSPECTION", "PROGRESS", "COMPLETED"
 * @param {boolean} readOnly - If true, hides upload and delete controls
 * @param {string} label - Display label for this media section
 */
export default function MediaManager({ entityId, entityType, category, readOnly = false, label = "Photos" }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (entityId) {
      fetchMedia();
    }
  }, [entityId, entityType, category]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${baseUrl}/api/media/${entityType}/${entityId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter by category locally, or we could pass category as query param.
      // For now, filtering locally is fine since total photos per entity is small.
      const filtered = res.data.filter(m => m.category === category);
      setMedia(filtered);
    } catch (err) {
      console.error('Error fetching media:', err);
      setError('Failed to load media.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityId', entityId);
    formData.append('entityType', entityType);
    formData.append('category', category);

    try {
      const res = await axios.post(`${baseUrl}/api/media/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setMedia(prev => [...prev, res.data.media]);
    } catch (err) {
      console.error('Error uploading media:', err);
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = null;
    }
  };

  const handleDelete = async (mediaId) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;

    try {
      await axios.delete(`${baseUrl}/api/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMedia(prev => prev.filter(m => m._id !== mediaId));
    } catch (err) {
      console.error('Error deleting media:', err);
      setError('Failed to delete media. You might not have permission.');
    }
  };

  return (
    <div className="mt-4 mb-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-2">{label}</h3>
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {media.map((m) => (
          <div key={m._id} className="relative group rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
            <img
              src={`${baseUrl}${m.url}`}
              alt={`${category} photo`}
              className="w-full h-32 object-cover"
            />
            {!readOnly && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete(m._id);
                }}
                className="absolute top-2 right-2 bg-white bg-opacity-75 text-red-600 hover:text-red-800 hover:bg-opacity-100 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete Photo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        ))}
        {loading && <div className="h-32 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400">Loading...</div>}
        {media.length === 0 && !loading && readOnly && (
          <div className="col-span-full text-slate-500 italic text-sm">No photos available.</div>
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <label className={`flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl cursor-pointer bg-white hover:bg-slate-50 transition-colors text-slate-700 shadow-sm ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <UploadCloud className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-bold">{uploading ? 'Uploading...' : 'Upload File'}</span>
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>

          <label className={`flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl cursor-pointer bg-white hover:bg-slate-50 transition-colors text-slate-700 shadow-sm ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <Camera className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-bold">{uploading ? 'Uploading...' : 'Take Photo'}</span>
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              capture="environment"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
      )}
    </div>
  );
}
