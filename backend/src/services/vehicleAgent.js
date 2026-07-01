const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

/**
 * Vehicle Agent
 * Handles all vehicle-related queries securely for the authenticated user.
 */
class VehicleAgent {
  
  async handleRequest(userId, message, activeVehicleId = null) {
    const text = message.toLowerCase();
    
    // Determine specific intent within the vehicle domain
    if (text.includes('service') || text.includes('maintenance') || text.includes('parts replaced') || text.includes('spent') || text.includes('cost')) {
      return await this._handleServiceQuery(userId, text, activeVehicleId);
    } else if (text.includes('insurance') || text.includes('expired')) {
      return await this._handleInsuranceQuery(userId);
    } else if (text.includes('passport')) {
      return await this._handlePassportQuery(userId);
    } else {
      // Default to general vehicle summary
      return await this._handleVehicleSummary(userId);
    }
  }

  async _handleVehicleSummary(userId) {
    const db = getDb();
    const vehicles = await db.collection('vehicles').find({ ownerId: userId, isArchived: { $ne: true } }).toArray();
    
    if (vehicles.length === 0) {
      return {
        text: "You don't have any vehicles registered yet. You can add one from your Dashboard.",
        type: "text"
      };
    }

    return {
      text: `You have ${vehicles.length} vehicle${vehicles.length > 1 ? 's' : ''} registered. Here is your vehicle summary:`,
      type: "vehicle_summary",
      payload: vehicles
    };
  }

  async _handleServiceQuery(userId, text, activeVehicleId) {
    const db = getDb();
    const vehicles = await db.collection('vehicles').find({ ownerId: userId }).toArray();
    
    if (vehicles.length === 0) {
      return { text: "You don't have any vehicles registered yet.", type: "text" };
    }

    let targetVehicle = null;
    
    // First, try to see if they mentioned a specific vehicle name in the text
    targetVehicle = vehicles.find(v => text.includes(v.brand.toLowerCase()) || text.includes(v.model.toLowerCase()));

    // If not found in text, use activeVehicleId or ask to select
    if (!targetVehicle) {
      if (vehicles.length > 1 && !activeVehicleId) {
        return { 
          text: "You have multiple vehicles. Please select a specific vehicle from the top panel to view its service history.", 
          type: "text" 
        };
      }
      targetVehicle = vehicles.find(v => v._id.toString() === activeVehicleId) || vehicles[0];
    }

    const targetVehicleId = targetVehicle._id.toString();

    const services = await db.collection('services').find({ vehicleId: targetVehicleId }).sort({ serviceDate: -1 }).toArray();

    if (services.length === 0) {
      return { text: `I couldn't find any service history for your ${targetVehicle.brand || ''} ${targetVehicle.model || ''}.`, type: "text" };
    }

    let totalSpent = services.reduce((acc, curr) => acc + (Number(curr.totalCost) || 0), 0);

    return {
      text: `Here is the service history for your ${targetVehicle.brand || ''} ${targetVehicle.model || ''}. You have ${services.length} records totaling ₹${totalSpent}.`,
      type: "service_history",
      payload: services
    };
  }

  async _handleInsuranceQuery(userId) {
    const db = getDb();
    const vehicles = await db.collection('vehicles').find({ ownerId: userId }).toArray();
    
    if (vehicles.length === 0) {
      return { text: "You don't have any vehicles to check insurance for.", type: "text" };
    }

    const vehicleIds = vehicles.map(v => v._id.toString());
    const insuranceRecords = await db.collection('insurance').find({ vehicleId: { $in: vehicleIds } }).toArray();

    return {
      text: `I found ${insuranceRecords.length} insurance record(s) for your vehicles.`,
      type: "insurance_summary",
      payload: insuranceRecords
    };
  }

  async _handlePassportQuery(userId) {
    const db = getDb();
    const vehicles = await db.collection('vehicles').find({ ownerId: userId, isArchived: { $ne: true } }).toArray();
    
    if (vehicles.length === 0) {
      return { text: "You don't have any active vehicles to generate a passport for.", type: "text" };
    }

    return {
      text: "Here is the complete Vehicle Passport for your fleet.",
      type: "passport_detail",
      payload: vehicles
    };
  }

  // --- API Methods for specific endpoints ---
  
  async getVehicleSummary(userId) {
    const db = getDb();
    return await db.collection('vehicles').find({ ownerId: userId, isArchived: { $ne: true } }).toArray();
  }

  async getServiceHistory(userId, vehicleId) {
    const db = getDb();
    const vehicle = await db.collection('vehicles').findOne({ _id: new ObjectId(vehicleId), ownerId: userId });
    if (!vehicle) throw new Error("Vehicle not found or unauthorized");
    return await db.collection('services').find({ vehicleId: vehicleId }).sort({ date: -1 }).toArray();
  }

  async getInsurance(userId, vehicleId) {
    const db = getDb();
    const vehicle = await db.collection('vehicles').findOne({ _id: new ObjectId(vehicleId), ownerId: userId });
    if (!vehicle) throw new Error("Vehicle not found or unauthorized");
    return await db.collection('insurance').find({ vehicleId: vehicleId }).toArray();
  }
}

module.exports = new VehicleAgent();
