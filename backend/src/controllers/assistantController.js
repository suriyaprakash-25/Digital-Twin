/**
 * Assistant Controller
 * Central hub for receiving CoPilot messages, authenticating users,
 * identifying intent, and routing to the appropriate agent.
 */

const { getDb } = require('../db');
const { detectIntent } = require('../services/intentService');
const platformAgent = require('../services/platformAgent');
const knowledgeBaseAgent = require('../services/knowledgeBaseAgent');
const vehicleAgent = require('../services/vehicleAgent');
const marketplaceAgent = require('../services/marketplaceAgent');
const emergencyAgent = require('../services/emergencyAgent');

const processMessage = async (req, res) => {
  try {
    const { message, activeVehicleId, imageBase64 } = req.body;
    const userId = req.user.id;
    const db = getDb();

    if (!message && !imageBase64) {
      return res.status(400).json({ success: false, error: 'Message or image is required' });
    }

    // Determine Intent (pass imageBase64 as well, since an image alone might mean diagnosis)
    const intent = detectIntent(message, imageBase64);

    let aiResponse;
    let type = 'text';
    let payload = null;

    // Route to appropriate agent
    switch (intent) {
      case 'vehicle':
        // Wait, for vehicle intent we should use activeVehicleId if available
        aiResponse = await vehicleAgent.handleRequest(userId, message, activeVehicleId);
        type = aiResponse.type || 'text';
        payload = aiResponse.payload || null;
        break;
      case 'marketplace':
        aiResponse = await marketplaceAgent.handleRequest(userId, message);
        type = aiResponse.type || 'text';
        payload = aiResponse.payload || null;
        break;
      case 'emergency':
        aiResponse = await emergencyAgent.handleRequest(userId, message);
        type = aiResponse.type || 'text';
        payload = aiResponse.payload || null;
        break;
      case 'diagnosis':
        const { handleDiagnosisRequest } = require('../services/aiDoctorAgent');
        aiResponse = await handleDiagnosisRequest(userId, message, activeVehicleId, imageBase64);
        type = aiResponse.type || 'text';
        payload = aiResponse.payload || null;
        break;
      case 'predictive':
        const { handlePredictiveRequest } = require('../services/predictiveMaintenanceAgent');
        aiResponse = await handlePredictiveRequest(userId, message, activeVehicleId);
        type = aiResponse.type || 'text';
        payload = aiResponse.payload || null;
        break;
      case 'insights':
        const { handleInsightsRequest } = require('../services/vehicleInsightsAgent');
        aiResponse = await handleInsightsRequest(userId, message, activeVehicleId);
        type = aiResponse.type || 'text';
        payload = aiResponse.payload || null;
        break;
      case 'reminder':
        const { handleReminderRequest } = require('../services/reminderAgent');
        aiResponse = await handleReminderRequest(userId, message, activeVehicleId);
        type = aiResponse.type || 'text';
        payload = aiResponse.payload || null;
        break;
      case 'knowledge_base':
      case 'general':
      default:
        try {
          const { analyzeWithGroq } = require('../services/groqService');
          const { ObjectId: ObjId } = require('mongodb');

          // Fetch recent chat history for memory context
          const recentHistory = await db.collection('chat_history')
            .find({ userId: new ObjId(userId) })
            .sort({ createdAt: -1 })
            .limit(5)
            .toArray();

          // Contextual routing: If the bot previously asked the user to specify a vehicle for service history
          if (recentHistory.length > 0 && recentHistory[0].response && recentHistory[0].response.includes('view its service history')) {
            aiResponse = await vehicleAgent._handleServiceQuery(userId, message, activeVehicleId);
            type = aiResponse.type || 'text';
            payload = aiResponse.payload || null;
            
            // Skip the LLM call entirely
            break;
          }

          let historyContext = recentHistory.reverse().map(h => `User: ${h.message}\nAssistant: ${h.response}`).join('\n');

          // Fetch user's vehicles to inject as context (prevents hallucination)
          const userVehicles = await db.collection('vehicles').find({ ownerId: userId, isArchived: { $ne: true } }).toArray();
          const vehicleContext = userVehicles.length > 0
            ? `User's Registered Vehicles:\n${userVehicles.map((v, i) => `${i + 1}. ${v.brand} ${v.model} (${v.manufacturingYear}), Mileage: ${v.currentOdometerKm || 'N/A'} km`).join('\n')}`
            : 'User has no registered vehicles.';

          const fallbackResponse = await analyzeWithGroq({
            systemInstruction: "You are DrivePortz CoPilot, a helpful AI mobility assistant. You have access to the user's vehicle details provided in the context below. Answer questions based ONLY on this context. Do NOT pretend to check service records, do NOT hallucinate data, and do NOT offer to schedule appointments. If the user asks for service history or insurance, tell them to use the Quick Actions menu or explicitly ask 'show me my service history'. CRITICAL RULE: If the user asks about ANYTHING unrelated to vehicles, the DrivePortz platform, garages, or automotive contexts (such as coding, math, Python, or general trivia), you MUST politely refuse to answer and remind them that you are strictly an automotive mobility assistant.",
            prompt: `${vehicleContext}\n\nRecent Conversation:\n${historyContext}\n\nUser: ${message || '(Image uploaded)'}\nRespond helpfully using ONLY the actual vehicle data provided above.`
          });

          aiResponse = { text: typeof fallbackResponse === 'string' ? fallbackResponse : JSON.stringify(fallbackResponse) };
        } catch (aiErr) {
          console.error('AI fallback error:', aiErr.message);
          aiResponse = { text: "I'm not sure about that. Try asking me about your vehicles, nearby garages, or an emergency." };
        }
        break;
    }

    const { ObjectId } = require('mongodb');
    // 3. Store in History
    await db.collection('chat_history').insertOne({
      userId: new ObjectId(userId),
      message: message || '[Image Attachment]',
      response: aiResponse.text,
      type: type,
      payload: payload,
      intent,
      activeVehicleId,
      hasImage: !!imageBase64,
      createdAt: new Date()
    });

    res.json({
      success: true,
      data: {
        response: aiResponse.text,
        type: type,
        payload: payload
      }
    });
  } catch (error) {
    console.error('CoPilot processing error:', error);
    res.status(500).json({ success: false, error: 'Failed to process message' });
  }
};

const getChatHistory = async (req, res) => {
  const userId = req.user.id;

  try {
    const db = getDb();
    const chatHistoryCol = db.collection('chat_history');

    const history = await chatHistoryCol
      .find({ userId })
      .sort({ createdAt: 1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Error fetching chat history:', error);
    return res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};

const clearChatHistory = async (req, res) => {
  const userId = req.user.id;

  try {
    const db = getDb();
    const chatHistoryCol = db.collection('chat_history');

    await chatHistoryCol.deleteMany({ userId });

    return res.status(200).json({
      success: true,
      message: 'Chat history cleared successfully'
    });

  } catch (error) {
    console.error('Error clearing chat history:', error);
    return res.status(500).json({ error: 'Failed to clear chat history' });
  }
};

// --- New PRD-2 Endpoints ---

const getVehicleSummary = async (req, res) => {
  try {
    const data = await vehicleAgent.getVehicleSummary(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getServiceHistory = async (req, res) => {
  try {
    const data = await vehicleAgent.getServiceHistory(req.user.id, req.params.vehicleId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPassport = async (req, res) => {
  // Can just redirect to vehicle summary for now
  try {
    const data = await vehicleAgent.getVehicleSummary(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getInsurance = async (req, res) => {
  try {
    const data = await vehicleAgent.getInsurance(req.user.id, req.params.vehicleId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getGarages = async (req, res) => {
  try {
    const data = await marketplaceAgent.getGarages();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getGarageById = async (req, res) => {
  try {
    const data = await marketplaceAgent.getGarageById(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const handleEmergency = async (req, res) => {
  const { lat, lng, category, radius } = req.body;
  try {
    const data = await emergencyAgent.findNearbyServices(lat, lng, category, radius);
    
    // Log emergency request to chat history optionally
    const db = getDb();
    await db.collection('chat_history').insertOne({
      userId: req.user.id,
      message: `Emergency: ${category}`,
      response: `Found ${data.length} nearby services.`,
      type: "emergency_list",
      payload: data,
      intent: 'emergency',
      createdAt: new Date()
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getNearbyServices = async (req, res) => {
  const { lat, lng, category, radius } = req.query;
  try {
    const data = await emergencyAgent.findNearbyServices(lat, lng, category, radius);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  processMessage,
  getChatHistory,
  clearChatHistory,
  getVehicleSummary,
  getServiceHistory,
  getPassport,
  getInsurance,
  getGarages,
  getGarageById,
  handleEmergency,
  getNearbyServices
};
