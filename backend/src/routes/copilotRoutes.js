const express = require('express');
const { requireAuth } = require('../middleware/auth');
const assistantController = require('../controllers/assistantController');

const router = express.Router();

// All CoPilot routes require authentication
router.use(requireAuth);

// POST /api/copilot/chat - Send a message to the assistant
router.post('/chat', assistantController.processMessage);

// GET /api/copilot/history - Get user's chat history
router.get('/history', assistantController.getChatHistory);

// DELETE /api/copilot/history - Clear user's chat history
router.delete('/history', assistantController.clearChatHistory);

// --- New PRD-2 Endpoints ---

// Vehicle Agent APIs
router.get('/vehicle-summary', assistantController.getVehicleSummary);
router.get('/service-history/:vehicleId', assistantController.getServiceHistory);
router.get('/passport/:vehicleId', assistantController.getPassport);
router.get('/insurance/:vehicleId', assistantController.getInsurance);

// Marketplace Agent APIs
router.get('/garages', assistantController.getGarages);
router.get('/garage/:id', assistantController.getGarageById);

// Emergency Agent APIs
router.post('/emergency', assistantController.handleEmergency);
router.get('/nearby-services', assistantController.getNearbyServices);

module.exports = router;
