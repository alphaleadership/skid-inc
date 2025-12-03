#!/usr/bin/env node

/**
 * NSIS Installer Build Script
 * 
 * This script builds the Windows NSIS installer separately.
 * Use this when you have sufficient memory available.
 * 
 * Usage: node scripts/build-nsis.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Building NSIS installer for Windows...');

try {
  // Check if we're on Windows
  if (process.platform !== 'win32') {
    console.log('❌ NSIS installer build is only supported on Windows');
    process.exit(1);
  }

  // Check available memory (simple check)
  const os = require('os');
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const freeMemoryGB = freeMemory / (1024 * 1024 * 1024);

  console.log(`💾 Available memory: ${freeMemoryGB.toFixed(2)} GB`);

  if (freeMemoryGB < 2) {
    console.log('⚠️  Warning: Low memory detected. NSIS build may fail.');
    console.log('💡 Consider closing other applications or using portable build instead.');
  }

  // Backup current package.json
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJsonBackup = path.join(__dirname, '..', 'package.json.backup');
  
  console.log('📋 Backing up package.json...');
  fs.copyFileSync(packageJsonPath, packageJsonBackup);

  // Read and modify package.json to include NSIS
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Store original win config
  const originalWinConfig = packageJson.build.win;
  
  // Set NSIS configuration with compression
  packageJson.build.win = {
    ...originalWinConfig,"forceCodeSigning": false,
    target: [
      {
        "target": "nsis",
        "arch": ["x64"],"forceCodeSigning": false
      },
      {
        "target": "portable", 
        "arch": ["x64"],"forceCodeSigning": false
      }
    ]
  };

  // Write modified package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('📝 Updated package.json for NSIS build');

  try {
    // Run the build
    console.log('🚀 Starting NSIS build...');
    execSync('npm run build:win', { stdio: 'inherit' });
    
    console.log('✅ NSIS installer built successfully!');
    console.log('📁 Check the dist/ directory for the installer files');
    
  } finally {
    // Restore original package.json
    console.log('🔄 Restoring original package.json...');
    fs.copyFileSync(packageJsonBackup, packageJsonPath);
    fs.unlinkSync(packageJsonBackup);
  }

} catch (error) {
  console.error('❌ NSIS build failed:', error.message);
  
  // Restore package.json if it exists
  const packageJsonBackup = path.join(__dirname, '..', 'package.json.backup');
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  if (fs.existsSync(packageJsonBackup)) {
    console.log('🔄 Restoring package.json after error...');
    fs.copyFileSync(packageJsonBackup, packageJsonPath);
    fs.unlinkSync(packageJsonBackup);
  }
  
  process.exit(1);
}
