const path = require('path');
const fs = require('fs');

const express = require('express');
const cors = require('cors');

const { loadConfig } = require('./src/config');
const { connectToMongo, getMongoStatus, getDb } = require('./src/db');

const authRoutes = require('./src/routes/auth');
const vehicleRoutes = require('./src/routes/vehicles');
const serviceRoutes = require('./src/routes/services');
const healthRoutes = require('./src/routes/health');
const reminderRoutes = require('./src/routes/reminders');
const resaleRoutes = require('./src/routes/resale');
const garageRoutes = require('./src/routes/garage');
const analyticsRoutes = require('./src/routes/analytics');

const app = express();
const config = loadConfig();

// Enable CORS
app.use(cors());

// Body parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Uploads folder (mirrors Flask behavior)
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// Static uploads
app.use('/uploads', express.static(uploadsDir));

// Root
app.get('/', (req, res) => {
  res.send('Mobility Digital Twin API is running!');
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
app.use('/api/analytics', analyticsRoutes);

// Start after DB connects
(async () => {
  await connectToMongo(config);
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${config.port}`);
  });
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
