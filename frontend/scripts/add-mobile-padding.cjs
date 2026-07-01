const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'pages');
const pages = [
  'Analytics', 'ServiceHistory', 'Insurance', 'Passport',
  'AddVehicle', 'AddService', 'EditVehicle', 'MyProfile',
  'VehicleDoctor', 'ResaleReport', 'UserDashboard',
  'GarageDashboard', 'GarageProfile', 'GarageServices'
];

pages.forEach(p => {
  const file = path.join(dir, p + '.jsx');
  if (!fs.existsSync(file)) { console.log('Not found:', p); return; }
  let c = fs.readFileSync(file, 'utf8');
  if (c.includes('pb-24')) { console.log('Already done:', p); return; }
  const updated = c.replace(
    /(className=")((max-w-[^\s"]+\s+mx-auto|space-y-\d+)([^"]*))(")/,
    (match, prefix, cls, _g1, _g2, suffix) => {
      return prefix + cls + ' pb-24 lg:pb-8' + suffix;
    }
  );
  if (updated !== c) {
    fs.writeFileSync(file, updated);
    console.log('Updated:', p);
  } else {
    console.log('No match:', p);
  }
});
