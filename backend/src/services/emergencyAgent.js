const axios = require('axios');

/**
 * Emergency Agent
 * Provides immediate roadside assistance by finding nearby services using Google Places API.
 */
class EmergencyAgent {
  
  async handleRequest(userId, message, location = null) {
    const text = message.toLowerCase();
    
    // In chat, emergency is usually triggered with location via the Emergency Panel.
    // If we don't have location, we might ask for it, but for PRD-2 we assume the 
    // Emergency Panel POSTs to the emergency API with lat/lng.
    
    return {
      text: "Please use the Emergency Panel to share your location so I can find nearby help.",
      type: "text"
    };
  }

  // --- API Methods ---
  
  async findNearbyServices(lat, lng, category, radius = 5000) {
    let query = '';
    switch (category) {
      case 'Flat Tyre': query = 'puncture shop'; break;
      case 'Vehicle Breakdown': query = 'towing service'; break;
      case 'Dead Battery': query = 'car battery replacement'; break;
      case 'Fuel Finished': query = 'petrol station'; break;
      case 'Accident': query = 'hospital'; break;
      default: query = 'car mechanic';
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      // Return mock data if no API key is provided
      console.warn("⚠️ GOOGLE_MAPS_API_KEY not found. Returning mock emergency data.");
      return [
        {
          id: 'mock_1',
          name: `Mock ${query} 1`,
          rating: 4.5,
          vicinity: '123 Fake Street',
          distance: '1.2 km',
          open_now: true,
          phone: '+1 555-0101'
        },
        {
          id: 'mock_2',
          name: `Mock ${query} 2`,
          rating: 4.0,
          vicinity: '456 Mock Ave',
          distance: '3.4 km',
          open_now: false,
          phone: '+1 555-0102'
        }
      ];
    }

    try {
      const response = await axios.get(`https://maps.googleapis.com/maps/api/place/textsearch/json`, {
        params: {
          query: query,
          location: `${lat},${lng}`,
          radius: radius,
          key: apiKey
        }
      });

      return response.data.results.slice(0, 5).map(place => ({
        id: place.place_id,
        name: place.name,
        rating: place.rating,
        vicinity: place.formatted_address,
        open_now: place.opening_hours ? place.opening_hours.open_now : null,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
      }));
    } catch (error) {
      console.error("Error fetching places from Google API:", error);
      throw new Error("Failed to fetch nearby services");
    }
  }
}

module.exports = new EmergencyAgent();
