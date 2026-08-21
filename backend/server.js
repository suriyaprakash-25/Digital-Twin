// Driveportz Backend Server
const path = require('path');
const fs = require('fs');

const express = require('express');
const cors = require('cors');

const { loadConfig } = require('./src/config');
const { connectToMongo, getMongoStatus, getDb } = require('./src/db');
const { initFirebase, getFirebaseInitError } = require('./src/firebase');

const authRoutes = require('./src/routes/auth');
const vehicleRoutes = require('./src/routes/vehicles');
const serviceRoutes = require('./src/routes/services');
const healthRoutes = require('./src/routes/health');
const reminderRoutes = require('./src/routes/reminders');
const resaleRoutes = require('./src/routes/resale');
const garageRoutes = require('./src/routes/garage');
const analyticsRoutes = require('./src/routes/analytics');
const marketplaceRoutes = require('./src/routes/marketplace');
const garagesRoutes = require('./src/routes/garages');
const bookingRoutes = require('./src/routes/bookings');
const notificationRoutes = require('./src/routes/notifications');
const adminRoutes = require('./src/routes/admin');
const passportRoutes = require('./src/routes/passport');
const insuranceRoutes = require('./src/routes/insurance');
const ownershipRoutes = require('./src/routes/ownership');
const vehicleDoctorRoutes = require('./src/routes/vehicleDoctorRoutes');
const copilotRoutes = require('./src/routes/copilotRoutes');
const garageAvailabilityRoutes = require('./src/routes/garageAvailabilityRoutes');
const feedbackRoutes = require('./src/routes/feedbackRoutes');
const adminFeedbackRoutes = require('./src/routes/adminFeedbackRoutes');
const paymentRoutes = require('./src/routes/payments');
const invoiceRoutes = require('./src/routes/invoices');
const earningsRoutes = require('./src/routes/earnings');
const reconciliationRoutes = require('./src/routes/reconciliation');
const { userDisputeRouter, garageDisputeRouter, adminDisputeRouter } = require('./src/routes/disputes');
const { ensurePaymentIndexes } = require('./src/models/Payment');
const { ensureEarningsIndexes } = require('./src/models/Earnings');
const { ensureReconciliationIndexes } = require('./src/models/Reconciliation');
const { ensureDisputeIndexes } = require('./src/models/Dispute');

const app = express();
const config = loadConfig();

// Enable CORS
const allowedOrigins = [
  'https://www.driveportz.com',
  'https://driveportz.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.driveportz.com') || origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true); // Fallback allow to avoid unexpected blocking during domain transitions
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Razorpay-Signature']
}));

// Body parsing with rawBody retention for webhook signature verification
app.use(express.json({
  limit: '20mb',
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.includes('/api/payments/webhook')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true }));

// Uploads folder (mirrors Flask behavior)
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// Static uploads
app.use('/uploads', express.static(uploadsDir));

// Root
app.get('/', (req, res) => {
  res.send('Mobility Driveportz API is running!');
});

// Simple status endpoint to confirm DB connectivity
app.get('/api/status', async (req, res) => {
  const status = getMongoStatus();
  let pingOk = false;

  try {
    if (status.connected) {
      await getDb().command({ ping: 1 });
      pingOk = true;
    }
  } catch (e) {
    pingOk = false;
  }

  res.status(status.connected && pingOk ? 200 : 503).json({
    ok: status.connected && pingOk,
    mongo: {
      connected: status.connected,
      dbName: status.dbName,
      pingOk,
      lastError: status.lastError
    },
    firebase: {
      initialized: Boolean(initFirebase(config)),
      lastError: getFirebaseInitError()
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/resale', resaleRoutes);
app.use('/api/garage', garageRoutes);
app.use('/api/garage/availability', garageAvailabilityRoutes);
app.use('/api/analytics', analyticsRoutes);

// Marketplace + two-sided garage workflows
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/garages', garagesRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/passport', passportRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/ownership', ownershipRoutes);
app.use('/api/vehicle-doctor', vehicleDoctorRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin/feedback', adminFeedbackRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/garage/invoices', invoiceRoutes);
app.use('/api/garage', earningsRoutes);
app.use('/api/garage/earnings', earningsRoutes);
app.use('/api/admin/reconciliation', reconciliationRoutes);
app.use('/api/disputes', userDisputeRouter);
app.use('/api/garage/disputes', garageDisputeRouter);
app.use('/api/admin/disputes', adminDisputeRouter);

// Start after DB connects
(async () => {
  await connectToMongo(config);
  await ensurePaymentIndexes();
  await ensureEarningsIndexes();
  await ensureReconciliationIndexes();
  await ensureDisputeIndexes();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${config.port}`);
  });
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Restart trigger for DrivePortz CoPilot PRD-3
