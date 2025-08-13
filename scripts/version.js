#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function updateVersion(type = 'patch') {
  // Read current version from package.json
  const packagePath = path.join(__dirname, '../frontend/package.json');
  const tauriConfigPath = path.join(__dirname, '../crates/tauri-app/tauri.conf.json');
  
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
  
  const [major, minor, patch] = packageJson.version.split('.').map(Number);
  
  let newVersion;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
  
  // Update package.json
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  
  // Update tauri.conf.json
  tauriConfig.version = newVersion;
  fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2) + '\n');
  
  console.log(`Version updated to ${newVersion}`);
  return newVersion;
}

// Get version type from command line args
const versionType = process.argv[2] || 'patch';
const newVersion = updateVersion(versionType);

// Update homepage download link
const indexPath = path.join(__dirname, '../docs/index.html');
if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, 'utf8');
  indexContent = indexContent.replace(/Download v[\d.]+/g, `Download v${newVersion}`);
  fs.writeFileSync(indexPath, indexContent);
}

process.exit(0);