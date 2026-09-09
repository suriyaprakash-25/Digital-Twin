const { getDb } = require('./src/db');
const { detectIntent } = require('./src/services/intentService');
const { analyzeWithGroq } = require('./src/services/groqService');
const vehicleAgent = require('./src/services/vehicleAgent');
const marketplaceAgent = require('./src/services/marketplaceAgent');
const emergencyAgent = require('./src/services/emergencyAgent');
const { handleDiagnosisRequest } = require('./src/services/aiDoctorAgent');
const { ObjectId: ObjId } = require('mongodb');
require('dotenv').config();

// We need to mock the entire processMessage logic to test accurately
async function processMessage(userId, message) {
  const db = getDb();
  const activeVehicleId = null;
  const imageBase64 = null;
  const intent = detectIntent(message, imageBase64);
  
  let aiResponse;
  let type = 'text';
  let payload = null;

  switch (intent) {
    case 'vehicle':
      aiResponse = await vehicleAgent.handleRequest(userId, message, activeVehicleId);
      break;
    case 'marketplace':
      aiResponse = await marketplaceAgent.handleRequest(userId, message);
      break;
    case 'emergency':
      aiResponse = await emergencyAgent.handleRequest(userId, message);
      break;
    case 'diagnosis':
      aiResponse = await handleDiagnosisRequest(userId, message, activeVehicleId, imageBase64);
      break;
    case 'garage_dashboard':
    case 'knowledge_base':
    case 'general':
    default:
      try {
        const user = await db.collection('users').findOne({ _id: new ObjId(userId) });
        const role = user?.role || 'USER';
        let roleContext = '';
        if (role === 'GARAGE') {
           const garage = await db.collection('garages').findOne({ ownerUserId: String(userId) });
           if (garage) {
               const bookings = await db.collection('bookings').find({ garageId: garage._id }).toArray();
               const requested = bookings.filter(b => b.status === 'REQUESTED').length;
               const completed = bookings.filter(b => b.status === 'COMPLETED').length;
               const inProgress = bookings.filter(b => b.status === 'IN_PROGRESS' || b.status === 'ACCEPTED').length;
               
               const payments = await db.collection('payments').find({ garageId: String(userId), status: 'CAPTURED' }).toArray();
               const totalRevenue = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
               
               const reviews = await db.collection('reviews').find({ targetId: String(garage._id) }).toArray();
               const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : 'No ratings yet';

               roleContext = `User is a GARAGE PARTNER. Garage Name: ${garage.name}. Total Booking Requests: ${bookings.length}. Pending/Requested: ${requested}. In Progress/Accepted: ${inProgress}. Completed: ${completed}. Total Revenue/Earnings: ₹${totalRevenue.toFixed(2)}. Garage Rating: ${avgRating} (${reviews.length} reviews).`;
           } else {
               roleContext = 'User is a Garage Partner but has not set up their Garage Profile yet.';
           }
        } else {
           const userVehicles = await db.collection('vehicles').find({ ownerId: userId, isArchived: { $ne: true } }).toArray();
           roleContext = userVehicles.length > 0
             ? `User's Registered Vehicles:\n${userVehicles.map((v, i) => `${i + 1}. ${v.brand} ${v.model} (${v.manufacturingYear}), Mileage: ${v.currentOdometerKm || 'N/A'} km`).join('\n')}`
             : 'User is a vehicle owner with no registered vehicles.';
        }

        const fallbackResponse = await analyzeWithGroq({
          systemInstruction: "You are DrivePortz CoPilot, a helpful AI mobility assistant. You have access to the user's role and data provided in the context below. Answer questions based ONLY on this context. Do NOT pretend to check records you don't have, do NOT hallucinate data. If the user asks for service history or insurance, tell them to use the Quick Actions menu. CRITICAL RULE: If the user asks about ANYTHING unrelated to vehicles, the DrivePortz platform, garages, their role, or automotive contexts (such as coding, math, Python, or general trivia), you MUST politely refuse to answer and remind them that you are strictly an automotive mobility assistant.",
          prompt: `[CONTEXT START]\n${roleContext}\n[CONTEXT END]\n\nRecent Conversation:\n\nUser: ${message}\nRespond helpfully using ONLY the actual data provided above.`
        });

        aiResponse = { text: typeof fallbackResponse === 'string' ? fallbackResponse : JSON.stringify(fallbackResponse) };
      } catch (aiErr) {
        aiResponse = { text: "I'm not sure about that. Try asking me about your vehicles, nearby garages, or an emergency." };
      }
      break;
  }
  
  return { intent, response: aiResponse.text };
}

async function runAudit() {
  const server = require('./server.js');
  
  // Wait for db connection
  let db;
  for (let i = 0; i < 20; i++) {
    try {
      db = getDb();
      if (db) break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  if (!db) {
    console.error("Failed to connect to DB");
    process.exit(1);
  }

  const garageUser = await db.collection('users').findOne({ role: 'GARAGE' });
  const normalUser = await db.collection('users').findOne({ role: 'USER' });

  const garageQueries = [
    "Who am I and what is my role?",
    "I want to add a new service offering to my garage, how do I do that?",
    "Are my earnings taxed by DrivePortz?",
    "What is my current garage rating and exactly how many reviews do I have?",
    "Can you help me diagnose a broken transmission on a customer's car?"
  ];

  const userQueries = [
    "How do I book a service for my car?",
    "My brake warning light just came on, what should I do?",
    "Can you remind me to renew my insurance next month?",
    "What is the service history for my car?",
    "What are the common maintenance issues with a Suzuki Vitara?"
  ];

  console.log("=== GARAGE PARTNER AUDIT ===");
  if (!garageUser) console.log("No Garage user found.");
  else {
    for (const q of garageQueries) {
      console.log(`Q: ${q}`);
      const res = await processMessage(String(garageUser._id), q);
      console.log(`Intent: ${res.intent}`);
      console.log(`A: ${res.response}\n`);
    }
  }

  console.log("=== USER AUDIT ===");
  if (!normalUser) console.log("No normal user found.");
  else {
    for (const q of userQueries) {
      console.log(`Q: ${q}`);
      const res = await processMessage(String(normalUser._id), q);
      console.log(`Intent: ${res.intent}`);
      console.log(`A: ${res.response}\n`);
    }
  }
  process.exit(0);
}

runAudit();
