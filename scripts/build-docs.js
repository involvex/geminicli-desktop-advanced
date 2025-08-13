#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building documentation for GitHub Pages...');

// Build frontend with correct base path
process.env.VITE_BASE_PATH = '/geminicli-desktop-advanced/';
execSync('cd frontend && npm run build', { stdio: 'inherit' });

// Create docs-build directory
const docsBuildDir = path.join(__dirname, '..', 'docs-build');
if (fs.existsSync(docsBuildDir)) {
  fs.rmSync(docsBuildDir, { recursive: true });
}
fs.mkdirSync(docsBuildDir, { recursive: true });

// Copy frontend build
const frontendDistDir = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDistDir)) {
  execSync(`cp -r ${frontendDistDir}/* ${docsBuildDir}/`, { stdio: 'inherit' });
}

// Copy docs as fallback
const docsDir = path.join(__dirname, '..', 'docs');
if (fs.existsSync(docsDir)) {
  execSync(`cp ${docsDir}/index.html ${docsBuildDir}/docs.html`, { stdio: 'inherit' });
}

console.log('Documentation build complete!');