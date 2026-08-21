const fs = require('fs');
const path = require('path');

const frontendSrcDir = path.join(__dirname, '..', 'frontend', 'src');

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(fullPath);
    }
  });
  return fileList;
}

const files = scanDir(frontendSrcDir);
let modifiedCount = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // Pattern 1: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/...`
  // or `import.meta.env.VITE_API_URL || 'http://localhost:5000'`
  if (content.includes("import.meta.env.VITE_API_URL || 'http://localhost:5000'")) {
    // Check if API_BASE_URL is imported
    const hasApiBaseUrlImport = content.includes('API_BASE_URL');
    
    // Replace the fallback string with API_BASE_URL
    content = content.replace(/import\.meta\.env\.VITE_API_URL\s*\|\|\s*['"]http:\/\/localhost:5000['"]/g, 'API_BASE_URL');
    
    if (!hasApiBaseUrlImport) {
      // Determine relative path to utils/config
      const relToUtils = path.relative(path.dirname(filePath), path.join(frontendSrcDir, 'utils', 'config')).replace(/\\/g, '/');
      const importStatement = `import { API_BASE_URL } from '${relToUtils.startsWith('.') ? relToUtils : './' + relToUtils}';\n`;
      content = importStatement + content;
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf-8');
      modifiedCount++;
      console.log(`Updated: ${path.relative(frontendSrcDir, filePath)}`);
    }
  }
});

console.log(`\n🎉 Total frontend files updated to use authoritative API_BASE_URL: ${modifiedCount}`);
