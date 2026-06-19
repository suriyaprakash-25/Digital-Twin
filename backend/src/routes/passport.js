const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const calculateHealthScore = require('../utils/healthCalc');
const generateQRCode = require('../utils/generateQRCode');
const PDFDocument = require('pdfkit');

const router = express.Router();

router.get('/:vehicleId', async (req, res) => {
  const { vehicleId } = req.params;
  const db = getDb();

  let vehicleObjectId;
  try {
    vehicleObjectId = new ObjectId(vehicleId);
  } catch (e) {
    return res.status(400).json({ msg: 'Invalid vehicle ID' });
  }

  try {
    const vehicle = await db.collection('vehicles').findOne({ _id: vehicleObjectId, isArchived: { $ne: true } });
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }

    // Fetch associated service records, sorting latest first
    const services = await db.collection('services')
      .find({ vehicleId: String(vehicleId), isArchived: { $ne: true } })
      .sort({ serviceDate: -1 })
      .toArray();

    // Verify / generate QR Code (data URL)
    let qrCodeUrl = vehicle.qrCodeUrl;
    if (!qrCodeUrl) {
      const passportUrl = `https://driveportz.in/passport/${vehicleId}`;
      try {
        qrCodeUrl = await generateQRCode(passportUrl);
        await db.collection('vehicles').updateOne(
          { _id: vehicleObjectId },
          { $set: { qrCodeUrl } }
        );
      } catch (qrErr) {
        console.error('Failed to generate or store QR code', qrErr);
      }
    }

    // Calculate vehicle health
    let healthScore = 100;
    try {
      const healthData = calculateHealthScore(vehicle, services);
      healthScore = healthData.healthScore;
    } catch (hErr) {
      console.error('Failed to calculate vehicle health, defaulting to 100', hErr);
    }

    // Fetch current owner user details
    let ownerDetails = {
      name: vehicle.ownerName || 'Unknown Owner',
      email: '',
      phone: vehicle.phone || ''
    };

    if (vehicle.ownerId) {
      try {
        const ownerUser = await db.collection('users').findOne({ _id: new ObjectId(vehicle.ownerId) });
        if (ownerUser) {
          ownerDetails.name = ownerUser.name || ownerDetails.name;
          ownerDetails.email = ownerUser.email || '';
          ownerDetails.phone = ownerUser.phone || ownerDetails.phone;
        }
      } catch (userErr) {
        console.error('Failed to look up owner details', userErr);
      }
    }

    // Fetch ownership history
    let ownershipHistory = [];
    try {
      ownershipHistory = await db.collection('ownershipHistory')
        .find({ vehicleId: String(vehicleId) })
        .sort({ fromDate: 1 })
        .toArray();
    } catch (hErr) {
      console.error('Failed to fetch ownership history', hErr);
    }

    if (ownershipHistory.length === 0) {
      const fallbackFromDate = vehicle.purchaseDate
        ? new Date(vehicle.purchaseDate).toISOString()
        : vehicle.createdAt || new Date(2024, 0, 1).toISOString();
      ownershipHistory.push({
        vehicleId: String(vehicleId),
        ownerId: vehicle.ownerId,
        ownerName: vehicle.ownerName || 'Original Owner',
        fromDate: fallbackFromDate,
        toDate: null
      });
    }

    // Extract parts replaced
    const partsReplaced = [];
    services.forEach(s => {
      if (Array.isArray(s.partsReplaced)) {
        s.partsReplaced.forEach(p => {
          if (p.partName) {
            partsReplaced.push({
              partName: p.partName,
              brand: p.brand || 'Unknown Brand',
              cost: p.cost || 0,
              date: s.serviceDate,
              garageName: s.garageName || 'Unknown Garage'
            });
          }
        });
      }
    });

    return res.status(200).json({
      vehicle: {
        id: String(vehicle._id),
        vehicleNumber: vehicle.vehicleNumber,
        brand: vehicle.brand,
        model: vehicle.model,
        variant: vehicle.variant,
        year: vehicle.manufacturingYear || vehicle.year,
        fuelType: vehicle.fuelType,
        color: vehicle.color,
        registrationDate: vehicle.registrationDate,
        registeredRTO: vehicle.registeredRTO,
        chassisNumber: vehicle.chassisNumber,
        engineNumber: vehicle.engineNumber,
        currentOdometerKm: vehicle.currentOdometerKm,
        qrCodeUrl: qrCodeUrl || null
      },
      owner: ownerDetails,
      healthScore,
      services: services.map((s) => ({
        id: String(s._id),
        serviceDate: s.serviceDate,
        garageName: s.garageName || 'Unknown Garage',
        serviceType: s.serviceType,
        totalCost: s.totalCost || s.cost || 0,
        verifiedService: s.verifiedService === true
      })),
      ownershipHistory: ownershipHistory.map(h => ({
        id: String(h._id || ''),
        ownerName: h.ownerName,
        fromDate: h.fromDate,
        toDate: h.toDate
      })),
      partsReplaced
    });
  } catch (err) {
    console.error('Error fetching vehicle passport details:', err);
    return res.status(500).json({ msg: 'Server error fetching vehicle passport', error: String(err && err.message ? err.message : err) });
  }
});

// GET /api/passport/pdf/:vehicleId
router.get('/pdf/:vehicleId', async (req, res) => {
  const { vehicleId } = req.params;
  const db = getDb();

  let vehicleObjectId;
  try {
    vehicleObjectId = new ObjectId(vehicleId);
  } catch (e) {
    return res.status(400).json({ msg: 'Invalid vehicle ID' });
  }

  try {
    const vehicle = await db.collection('vehicles').findOne({ _id: vehicleObjectId, isArchived: { $ne: true } });
    if (!vehicle) {
      return res.status(404).json({ msg: 'Vehicle not found' });
    }

    // Fetch associated service records, sorting latest first
    const services = await db.collection('services')
      .find({ vehicleId: String(vehicleId), isArchived: { $ne: true } })
      .sort({ serviceDate: -1 })
      .toArray();

    // Fetch insurance records
    const insuranceRecords = await db.collection('insurance')
      .find({ vehicleId: String(vehicleId) })
      .sort({ expiryDate: -1 })
      .toArray();

    // Fetch ownership history
    let ownershipHistory = await db.collection('ownershipHistory')
      .find({ vehicleId: String(vehicleId) })
      .sort({ fromDate: 1 })
      .toArray();

    if (ownershipHistory.length === 0) {
      const fallbackFromDate = vehicle.purchaseDate
        ? new Date(vehicle.purchaseDate).toISOString()
        : vehicle.createdAt || new Date(2024, 0, 1).toISOString();
      ownershipHistory.push({
        ownerName: vehicle.ownerName || 'Original Owner',
        fromDate: fallbackFromDate,
        toDate: null
      });
    }

    // Extract parts replaced
    const partsReplaced = [];
    services.forEach(s => {
      if (Array.isArray(s.partsReplaced)) {
        s.partsReplaced.forEach(p => {
          if (p.partName) {
            partsReplaced.push({
              partName: p.partName,
              brand: p.brand || 'Unknown Brand',
              cost: p.cost || 0,
              date: s.serviceDate,
              garageName: s.garageName || 'Unknown Garage'
            });
          }
        });
      }
    });

    // Calculate score
    const healthResult = calculateHealthScore(vehicle, services);

    // Fetch owner details
    let ownerDetails = {
      name: vehicle.ownerName || 'Unknown Owner',
      email: '',
      phone: vehicle.phone || ''
    };
    if (vehicle.ownerId) {
      const ownerUser = await db.collection('users').findOne({ _id: new ObjectId(vehicle.ownerId) });
      if (ownerUser) {
        ownerDetails.name = ownerUser.name || ownerDetails.name;
        ownerDetails.email = ownerUser.email || '';
        ownerDetails.phone = ownerUser.phone || ownerDetails.phone;
      }
    }

    // Initialize PDF Document
    const doc = new PDFDocument({ margin: 50 });

    // Set Response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=passport_${vehicle.vehicleNumber || 'vehicle'}.pdf`);

    doc.pipe(res);

    // Styling & Layout
    const primaryColor = '#0d9488'; // Teal-600
    const darkColor = '#0f172a'; // Slate-900

    // Header Title
    doc.fillColor(primaryColor).fontSize(24).font('Helvetica-Bold').text('Driveportz Digital Passport', { align: 'center' });
    doc.fillColor(darkColor).fontSize(10).font('Helvetica').text(`Generated on ${new Date().toLocaleDateString()} • Verified Digital Twin Report`, { align: 'center', paragraphGap: 20 });

    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1.5);

    // Row 1: Vehicle Info & Owner Info
    const startY = doc.y;
    
    // Left column: Vehicle Info
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('Vehicle Information', 50, startY);
    doc.fontSize(10).font('Helvetica').fillColor(darkColor);
    doc.moveDown(0.5);
    doc.text(`Vehicle Number: ${vehicle.vehicleNumber || 'N/A'}`, { font: 'Helvetica-Bold' });
    doc.text(`Brand / Make: ${vehicle.brand || 'N/A'}`);
    doc.text(`Model: ${vehicle.model || 'N/A'}`);
    doc.text(`Variant: ${vehicle.variant || 'N/A'}`);
    doc.text(`Manufacturing Year: ${vehicle.year || vehicle.manufacturingYear || 'N/A'}`);
    doc.text(`Fuel Type: ${vehicle.fuelType || 'N/A'}`);
    doc.text(`Odometer Overage: ${vehicle.currentOdometerKm?.toLocaleString() || 0} km`);
    if (vehicle.chassisNumber) doc.text(`Chassis Number: ${vehicle.chassisNumber}`);
    if (vehicle.engineNumber) doc.text(`Engine Number: ${vehicle.engineNumber}`);

    // Right column: Owner & Health
    const rightColX = 320;
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('Current Owner', rightColX, startY);
    doc.fontSize(10).font('Helvetica').fillColor(darkColor);
    doc.moveDown(0.5);
    doc.text(`Name: ${ownerDetails.name}`);
    if (ownerDetails.email) doc.text(`Email: ${ownerDetails.email}`);
    if (ownerDetails.phone) doc.text(`Phone: ${ownerDetails.phone}`);
    
    doc.moveDown(1.5);
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('Vehicle Health Score', rightColX);
    doc.fontSize(10).font('Helvetica').fillColor(darkColor);
    doc.moveDown(0.5);
    doc.fontSize(18).font('Helvetica-Bold').fillColor(primaryColor).text(`${healthResult.healthScore} / 100`, { paragraphGap: 3 });
    doc.fontSize(11).font('Helvetica-Bold').fillColor(
      healthResult.healthScore >= 85 ? '#10b981' : // Green
      healthResult.healthScore >= 70 ? '#3b82f6' : // Blue
      healthResult.healthScore >= 50 ? '#f59e0b' : // Orange
      '#ef4444' // Red
    ).text(`${healthResult.conditionLevel} Condition`, { paragraphGap: 10 });

    doc.moveDown(1);
    
    // Add QR Code if present
    if (vehicle.qrCodeUrl && vehicle.qrCodeUrl.startsWith('data:image/png;base64,')) {
      try {
        const base64Data = vehicle.qrCodeUrl.replace(/^data:image\/png;base64,/, "");
        const qrBuffer = Buffer.from(base64Data, 'base64');
        doc.image(qrBuffer, rightColX, doc.y, { width: 90 });
        doc.fillColor('#64748b').fontSize(8).font('Helvetica-Oblique').text('Scan to View Online Passport', rightColX + 3, doc.y + 95);
      } catch (qrErr) {
        console.error('Failed to embed QR code in PDF:', qrErr);
      }
    }

    // Set Y position back down to clear columns
    doc.y = Math.max(doc.y + 110, startY + 220);
    doc.moveDown(1.5);

    // Section: Insurance Records
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('Insurance Coverages', 50);
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(50, doc.y + 3).lineTo(562, doc.y + 3).stroke();
    doc.moveDown(0.8);
    
    if (insuranceRecords.length === 0) {
      doc.fillColor('#64748b').fontSize(10).font('Helvetica-Oblique').text('No insurance policy history registered.', 50);
      doc.moveDown(1);
    } else {
      doc.fontSize(9).font('Helvetica-Bold').fillColor(darkColor);
      doc.text('Provider', 50, doc.y, { width: 150, continued: true });
      doc.text('Policy Number', { width: 130, continued: true });
      doc.text('Start Date', { width: 90, continued: true });
      doc.text('Expiry Date', { width: 90, continued: true });
      doc.text('Status', { width: 70 });
      doc.font('Helvetica').moveDown(0.3);
      
      insuranceRecords.slice(0, 5).forEach(policy => {
        const active = new Date(policy.expiryDate) >= new Date();
        doc.text(policy.provider, 50, doc.y, { width: 150, continued: true });
        doc.text(policy.policyNumber, { width: 130, continued: true });
        doc.text(policy.startDate, { width: 90, continued: true });
        doc.text(policy.expiryDate, { width: 90, continued: true });
        doc.fillColor(active ? '#10b981' : '#ef4444').font('Helvetica-Bold').text(active ? 'Active' : 'Expired', { width: 70 });
        doc.fillColor(darkColor).font('Helvetica').moveDown(0.2);
      });
      doc.moveDown(1);
    }

    // Section: Ownership Timeline
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('Ownership History Logs', 50);
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(50, doc.y + 3).lineTo(562, doc.y + 3).stroke();
    doc.moveDown(0.8);

    ownershipHistory.forEach((h, index) => {
      const from = new Date(h.fromDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      const to = h.toDate ? new Date(h.toDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'Present';
      doc.fontSize(10).fillColor(darkColor).font('Helvetica-Bold').text(`Owner #${index + 1}: ${h.ownerName}`, 50, doc.y, { continued: true });
      doc.fillColor('#64748b').font('Helvetica').text(`   (Period: ${from} to ${to})`);
      doc.moveDown(0.3);
    });
    doc.moveDown(1);

    // Section: Replaced Components
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('Parts Replaced Lifecycle', 50);
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(50, doc.y + 3).lineTo(562, doc.y + 3).stroke();
    doc.moveDown(0.8);

    if (partsReplaced.length === 0) {
      doc.fillColor('#64748b').fontSize(10).font('Helvetica-Oblique').text('No consumable component replacements logged.', 50);
      doc.moveDown(1);
    } else {
      doc.fontSize(9).font('Helvetica-Bold').fillColor(darkColor);
      doc.text('Part Name', 50, doc.y, { width: 150, continued: true });
      doc.text('Brand', { width: 120, continued: true });
      doc.text('Replacement Date', { width: 110, continued: true });
      doc.text('Cost', { width: 80, continued: true });
      doc.text('Workshop', { width: 100 });
      doc.font('Helvetica').moveDown(0.3);

      partsReplaced.slice(0, 8).forEach(part => {
        doc.text(part.partName, 50, doc.y, { width: 150, continued: true });
        doc.text(part.brand, { width: 120, continued: true });
        doc.text(part.date, { width: 110, continued: true });
        doc.text(`₹${part.cost}`, { width: 80, continued: true });
        doc.text(part.garageName, { width: 100 });
        doc.moveDown(0.2);
      });
      doc.moveDown(1);
    }

    // Add a new page if service timeline is long
    if (services.length > 0) {
      doc.addPage();
      doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('Verified Service Log History', 50, 50);
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(50, doc.y + 3).lineTo(562, doc.y + 3).stroke();
      doc.moveDown(0.8);

      services.slice(0, 15).forEach((s) => {
        const date = new Date(s.serviceDate).toLocaleDateString();
        doc.fontSize(10).fillColor(darkColor).font('Helvetica-Bold').text(`${date} - ${s.serviceType}`, 50, doc.y);
        doc.fontSize(9).fillColor('#475569').font('Helvetica').text(`Workshop: ${s.garageName || 'Unknown Garage'} | Category: ${s.serviceCategory} | Total Cost: ₹${(s.totalCost || s.cost || 0).toLocaleString()}`);
        if (s.verifiedService) {
          doc.fillColor('#10b981').font('Helvetica-Bold').text('✔ Verified Maintenance Log');
        }
        doc.moveDown(0.5);
      });
    }

    doc.end();
  } catch (err) {
    console.error('Error generating PDF passport:', err);
    return res.status(500).json({ msg: 'Server error generating PDF passport', error: String(err && err.message ? err.message : err) });
  }
});

module.exports = router;
