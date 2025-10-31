#!/usr/bin/env node

// Pre-build script for Skid-Inc Electron app
const fs = require('fs');
const path = require('path');
const { createBuildInfo } = require('./build-config');

console.log('Starting pre-build process...');

// 1. Create build info
console.log('Creating build info...');
createBuildInfo();

// 2. Validate required files
console.log('Validating required files...');
const requiredFiles = [
  'src/main.js',
  'index.html',
  'package.json'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`Required file missing: ${file}`);
    process.exit(1);
  }
}

// 3. Check icon file size (should be at least 256x256 for proper scaling)
console.log('Validating icon file...');
const iconPath = path.join(__dirname, '..', 'favicon.png');
if (fs.existsSync(iconPath)) {
  const stats = fs.statSync(iconPath);
  if (stats.size < 1000) { // Very small file, likely not a proper icon
    console.warn('Warning: Icon file seems very small. Consider using a higher resolution icon (256x256 or larger).');
  }
} else {
  console.warn('Warning: No icon file found. Consider adding a proper application icon.');
}

// 4. Clean previous builds
console.log('Cleaning previous builds...');
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  fs.rmSync(distPath, { recursive: true, force: true });
  console.log('Cleaned dist directory');
}

// 5. Validate package.json
console.log('Validating package.json...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!packageJson.main) {
  console.error('package.json missing main field');
  process.exit(1);
}

if (!packageJson.build) {
  console.error('package.json missing build configuration');
  process.exit(1);
}

console.log('Pre-build process completed successfully!');
console.log(`Building version: ${packageJson.version}`);
console.log(`App ID: ${packageJson.build.appId}`);
console.log(`Product Name: ${packageJson.build.productName}`);