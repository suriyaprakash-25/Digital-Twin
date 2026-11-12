/**
 * Renders the passport PDF from an already audience-filtered model (passportService.getPdfModel).
 * Synchronous after the model is built, so no error can occur after response headers are sent
 * because of a late database or QR failure. Layout unchanged from the original route.
 */
const PDFDocument = require('pdfkit');
const { PDF } = require('./constants');

const C = PDF.COLORS;
const LEFT = PDF.MARGIN;
const RIGHT = PDF.RIGHT_COLUMN_X;

function healthColor(score) {
  if (score >= PDF.HEALTH_BANDS.EXCELLENT) return C.GOOD;
  if (score >= PDF.HEALTH_BANDS.GOOD) return C.INFO;
  if (score >= PDF.HEALTH_BANDS.AVERAGE) return C.WARN;
  return C.BAD;
}

const monthYear = (value) => new Date(value).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

function sectionHeading(doc, title) {
  doc.fillColor(C.PRIMARY).fontSize(14).font('Helvetica-Bold').text(title, LEFT);
  doc.strokeColor(C.SOFT_RULE).lineWidth(0.5).moveTo(LEFT, doc.y + 3).lineTo(PDF.PAGE_RIGHT_X, doc.y + 3).stroke();
  doc.moveDown(0.8);
}

function emptyNote(doc, text) {
  doc.fillColor(C.MUTED).fontSize(10).font('Helvetica-Oblique').text(text, LEFT);
  doc.moveDown(1);
}

function renderHeader(doc, model) {
  doc.fillColor(C.PRIMARY).fontSize(24).font('Helvetica-Bold').text('Driveportz Passport', { align: 'center' });
  const scope = model.audience === 'owner' ? 'Owner Copy' : 'Public Copy';
  doc.fillColor(C.DARK).fontSize(10).font('Helvetica').text(`Generated on ${new Date().toLocaleDateString()} • Verified Driveportz Report • ${scope}`, { align: 'center', paragraphGap: 20 });
  doc.strokeColor(C.RULE).lineWidth(1).moveTo(LEFT, doc.y).lineTo(PDF.PAGE_RIGHT_X, doc.y).stroke();
  doc.moveDown(1.5);
}

function renderVehicleAndOwner(doc, model) {
  const { vehicle, owner, health } = model;
  const startY = doc.y;
  doc.fillColor(C.PRIMARY).fontSize(14).font('Helvetica-Bold').text('Vehicle Information', LEFT, startY);
  doc.fontSize(10).font('Helvetica').fillColor(C.DARK);
  doc.moveDown(0.5);
  doc.text(`Vehicle Number: ${vehicle.vehicleNumber || 'N/A'}`);
  doc.text(`Brand / Make: ${vehicle.brand || 'N/A'}`);
  doc.text(`Model: ${vehicle.model || 'N/A'}`);
  doc.text(`Variant: ${vehicle.variant || 'N/A'}`);
  doc.text(`Manufacturing Year: ${vehicle.year || 'N/A'}`);
  doc.text(`Fuel Type: ${vehicle.fuelType || 'N/A'}`);
  doc.text(`Odometer Overage: ${(vehicle.currentOdometerKm || 0).toLocaleString()} km`);
  if (vehicle.chassisNumber) doc.text(`Chassis Number: ${vehicle.chassisNumber}`);
  if (vehicle.engineNumber) doc.text(`Engine Number: ${vehicle.engineNumber}`);

  doc.fillColor(C.PRIMARY).fontSize(14).font('Helvetica-Bold').text('Current Owner', RIGHT, startY);
  doc.fontSize(10).font('Helvetica').fillColor(C.DARK);
  doc.moveDown(0.5);
  doc.text(`Name: ${owner.name}`);
  if (owner.email) doc.text(`Email: ${owner.email}`);
  if (owner.phone) doc.text(`Phone: ${owner.phone}`);

  doc.moveDown(1.5);
  doc.fillColor(C.PRIMARY).fontSize(14).font('Helvetica-Bold').text('Vehicle IQ Score', RIGHT);
  doc.moveDown(0.5);
  doc.fontSize(18).font('Helvetica-Bold').fillColor(C.PRIMARY).text(`${health.healthScore} / 100`, { paragraphGap: 3 });
  doc.fontSize(11).font('Helvetica-Bold').fillColor(healthColor(health.healthScore)).text(`${health.conditionLevel} Condition`, { paragraphGap: 10 });
  doc.moveDown(1);

  if (model.qrPng) {
    doc.image(model.qrPng, RIGHT, doc.y, { width: PDF.QR_WIDTH });
    doc.fillColor(C.MUTED).fontSize(8).font('Helvetica-Oblique').text('Scan to View Online Passport', RIGHT + 3, doc.y + 95);
  }
  doc.y = Math.max(doc.y + 110, startY + 220);
  doc.moveDown(1.5);
}

function renderInsurance(doc, insurance) {
  sectionHeading(doc, 'Insurance Coverages');
  if (insurance.length === 0) return emptyNote(doc, 'No insurance policy history registered.');
  doc.fontSize(9).font('Helvetica-Bold').fillColor(C.DARK);
  doc.text('Provider', LEFT, doc.y, { width: 150, continued: true });
  doc.text('Policy Number', { width: 130, continued: true });
  doc.text('Start Date', { width: 90, continued: true });
  doc.text('Expiry Date', { width: 90, continued: true });
  doc.text('Status', { width: 70 });
  doc.font('Helvetica').moveDown(0.3);
  for (const policy of insurance.slice(0, PDF.MAX_INSURANCE_ROWS)) {
    doc.text(policy.provider, LEFT, doc.y, { width: 150, continued: true });
    doc.text(policy.policyNumber, { width: 130, continued: true });
    doc.text(policy.startDate, { width: 90, continued: true });
    doc.text(policy.expiryDate, { width: 90, continued: true });
    doc.fillColor(policy.active ? C.GOOD : C.BAD).font('Helvetica-Bold').text(policy.active ? 'Active' : 'Expired', { width: 70 });
    doc.fillColor(C.DARK).font('Helvetica').moveDown(0.2);
  }
  return doc.moveDown(1);
}

function renderOwnership(doc, history) {
  sectionHeading(doc, 'Ownership History Logs');
  history.forEach((h, index) => {
    const to = h.toDate ? monthYear(h.toDate) : 'Present';
    doc.fontSize(10).fillColor(C.DARK).font('Helvetica-Bold').text(`Owner #${index + 1}: ${h.ownerName}`, LEFT, doc.y, { continued: true });
    doc.fillColor(C.MUTED).font('Helvetica').text(`   (Period: ${monthYear(h.fromDate)} to ${to})`);
    doc.moveDown(0.3);
  });
  doc.moveDown(1);
}

function renderParts(doc, parts) {
  sectionHeading(doc, 'Parts Replaced Lifecycle');
  if (parts.length === 0) return emptyNote(doc, 'No consumable component replacements logged.');
  doc.fontSize(9).font('Helvetica-Bold').fillColor(C.DARK);
  doc.text('Part Name', LEFT, doc.y, { width: 150, continued: true });
  doc.text('Brand', { width: 120, continued: true });
  doc.text('Replacement Date', { width: 110, continued: true });
  doc.text('Cost', { width: 80, continued: true });
  doc.text('Workshop', { width: 100 });
  doc.font('Helvetica').moveDown(0.3);
  for (const part of parts.slice(0, PDF.MAX_PART_ROWS)) {
    doc.text(part.partName, LEFT, doc.y, { width: 150, continued: true });
    doc.text(part.brand, { width: 120, continued: true });
    doc.text(String(part.date || ''), { width: 110, continued: true });
    doc.text(`₹${part.cost}`, { width: 80, continued: true });
    doc.text(part.garageName, { width: 100 });
    doc.moveDown(0.2);
  }
  return doc.moveDown(1);
}

function renderServices(doc, services) {
  if (services.length === 0) return;
  doc.addPage();
  doc.fillColor(C.PRIMARY).fontSize(14).font('Helvetica-Bold').text('Verified Service Log History', LEFT, LEFT);
  doc.strokeColor(C.SOFT_RULE).lineWidth(0.5).moveTo(LEFT, doc.y + 3).lineTo(PDF.PAGE_RIGHT_X, doc.y + 3).stroke();
  doc.moveDown(0.8);
  for (const s of services.slice(0, PDF.MAX_SERVICE_ROWS)) {
    doc.fontSize(10).fillColor(C.DARK).font('Helvetica-Bold').text(`${new Date(s.serviceDate).toLocaleDateString()} - ${s.serviceType}`, LEFT, doc.y);
    doc.fontSize(9).fillColor(C.BODY).font('Helvetica').text(`Workshop: ${s.garageName} | Category: ${s.serviceCategory} | Total Cost: ₹${Number(s.totalCost).toLocaleString()}`);
    if (s.verified) doc.fillColor(C.GOOD).font('Helvetica-Bold').text('✔ Verified Maintenance Log');
    if (s.unconfirmed) doc.fillColor(C.WARN).font('Helvetica-Bold').text('Unconfirmed walk-in record (awaiting owner confirmation)');
    doc.moveDown(0.5);
  }
}

/** Streams the PDF to `writable` (an Express response). */
function writePassportPdf(model, writable) {
  const doc = new PDFDocument({ margin: PDF.MARGIN });
  doc.pipe(writable);
  renderHeader(doc, model);
  renderVehicleAndOwner(doc, model);
  renderInsurance(doc, model.insurance);
  renderOwnership(doc, model.ownershipHistory);
  renderParts(doc, model.partsReplaced);
  renderServices(doc, model.services);
  doc.end();
}

module.exports = { writePassportPdf };
