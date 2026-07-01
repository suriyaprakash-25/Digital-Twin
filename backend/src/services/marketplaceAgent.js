const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

/**
 * Marketplace Agent
 * Handles discovering garages and marketplace services.
 */
class MarketplaceAgent {
  
  async handleRequest(userId, message) {
    const text = message.toLowerCase();
    
    // We can do simple heuristic routing here as well
    let query = { isActive: true }; // Assuming active garages

    if (text.includes('verified')) {
      query.isVerified = true;
    }

    const db = getDb();
    const garages = await db.collection('garages').find(query).limit(5).toArray();

    if (garages.length === 0) {
      return {
        text: "I couldn't find any garages matching your criteria right now.",
        type: "text"
      };
    }

    return {
      text: `I found ${garages.length} garage${garages.length > 1 ? 's' : ''} that might help you.`,
      type: "garage_list",
      payload: garages
    };
  }

  // --- API Methods ---
  
  async getGarages(query = {}) {
    const db = getDb();
    return await db.collection('garages').find(query).toArray();
  }

  async getGarageById(garageId) {
    const db = getDb();
    return await db.collection('garages').findOne({ _id: new ObjectId(garageId) });
  }
}

module.exports = new MarketplaceAgent();
