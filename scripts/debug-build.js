#!/usr/bin/env node

/**
 * Enhanced Build Debug Script
 * 
 * Provides comprehensive debugging information for build failures
 * Usage: node scripts/debug-build.js [platform]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = process.argv[2] || 'win';

console.log('🔍 Enhanced Build Debug Tool');
console.log('================================');

// System Information
console.log('\n📊 System Information:');
console.log(`Platform: ${os.platform()}`);
console.log(`Architecture: ${os.arch()}`);
console.log(`Node.js: ${process.version}`);
console.log(`Total Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`Free Memory: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`CPU Cores: ${os.cpus().length}`);

// Project Information
console.log('\n📁 Project Information:');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log(`Project: ${packageJson.name}`);
console.log(`Version: ${packageJson.version}`);
console.log(`Electron Builder: ${packageJson.devDependencies['electron-builder']}`);

// Check Required Files
console.log('\n📋 Required Files Check:');
const requiredFiles = [
  'package.json',
  'src/main.js',
  'index.html',
  'favicon.png',
  'icons/icon.png'
];

requiredFiles.forEach(file => {
  const exists = fs.existsSync(file);
  const size = exists ? fs.statSync(file).size : 0;
  console.log(`${exists ? '✅' : '❌'} ${file} ${exists ? `(${size} bytes)` : '(missing)'}`);
});

// Check Build Dependencies
console.log('\n📦 Build Dependencies:');
const buildDeps = ['electron-builder', 'electron'];
buildDeps.forEach(dep => {
  const version = packageJson.devDependencies[dep] || packageJson.dependencies[dep];
  console.log(`${version ? '✅' : '❌'} ${dep}: ${version || 'missing'}`);
});

// Check Node Modules
console.log('\n📂 Node Modules Status:');
const nodeModulesPath = 'node_modules';
if (fs.existsSync(nodeModulesPath)) {
  console.log('✅ node_modules directory exists');
  
  // Check electron-builder
  const electronBuilderPath = path.join(nodeModulesPath, 'electron-builder');
  console.log(`${fs.existsSync(electronBuilderPath) ? '✅' : '❌'} electron-builder installed`);
  
  // Check electron
  const electronPath = path.join(nodeModulesPath, 'electron');
  console.log(`${fs.existsSync(electronPath) ? '✅' : '❌'} electron installed`);
} else {
  console.log('❌ node_modules directory missing');
}

// Check Previous Build Artifacts
console.log('\n🗂️  Previous Build Artifacts:');
const distPath = 'dist';
if (fs.existsSync(distPath)) {
  const files = fs.readdirSync(distPath);
  if (files.length > 0) {
    console.log(`Found ${files.length} files in dist/:`);
    files.forEach(file => {
      const filePath = path.join(distPath, file);
      const stats = fs.statSync(filePath);
      console.log(`  - ${file} (${stats.isDirectory() ? 'directory' : `${stats.size} bytes`})`);
    });
  } else {
    console.log('dist/ directory is empty');
  }
} else {
  console.log('dist/ directory does not exist');
}

// Environment Variables
console.log('\n🌍 Environment Variables:');
const envVars = [
  'NODE_ENV',
  'ELECTRON_BUILDER_CACHE',
  'ELECTRON_CACHE',
  'APPDATA',
  'LOCALAPPDATA',
  'TEMP',
  'TMP'
];

envVars.forEach(envVar => {
  const value = process.env[envVar];
  console.log(`${envVar}: ${value || 'not set'}`);
});

// Configuration Analysis
console.log('\n⚙️  Build Configuration Analysis:');
const buildConfig = packageJson.build;
console.log(`App ID: ${buildConfig.appId}`);
console.log(`Product Name: ${buildConfig.productName}`);
console.log(`Compression: ${buildConfig.compression || 'default'}`);
console.log(`Output Directory: ${buildConfig.directories.output}`);

if (buildConfig[platform]) {
  const platformConfig = buildConfig[platform];
  console.log(`${platform.toUpperCase()} Targets: ${JSON.stringify(platformConfig.target || [])}`);
  console.log(`${platform.toUpperCase()} Icon: ${platformConfig.icon || 'default'}`);
  console.log(`${platform.toUpperCase()} Compression: ${platformConfig.compression || 'default'}`);
}

// Memory Analysis
console.log('\n💾 Memory Analysis:');
const freeMemoryGB = os.freemem() / (1024 * 1024 * 1024);
const totalMemoryGB = os.totalmem() / (1024 * 1024 * 1024);

if (freeMemoryGB < 1) {
  console.log('❌ Critical: Very low memory available');
} else if (freeMemoryGB < 2) {
  console.log('⚠️  Warning: Low memory, NSIS build may fail');
} else if (freeMemoryGB < 4) {
  console.log('✅ Sufficient memory for most builds');
} else {
  console.log('✅ Excellent memory available');
}

// Recommendations
console.log('\n💡 Recommendations:');
if (!fs.existsSync('node_modules')) {
  console.log('- Run: npm install');
}

if (!fs.existsSync('icons/icon.png')) {
  console.log('- Create icons/icon.png for proper application icons');
}

if (freeMemoryGB < 2 && platform === 'win') {
  console.log('- Use: npm run build:win (portable only)');
  console.log('- Or: npm run build:win-nsis (requires more memory)');
}

if (fs.existsSync(distPath) && fs.readdirSync(distPath).length > 0) {
  console.log('- Consider cleaning dist/ directory: rm -rf dist/*');
}

// Test Build Command
console.log('\n🚀 Suggested Build Commands:');
console.log(`- Basic build: npm run build:${platform}`);
if (platform === 'win') {
  console.log('- Portable only: npm run build:win');
  console.log('- NSIS installer: npm run build:win-nsis');
  console.log('- Directory build: npm run build:dir');
}
console.log(`- Verbose build: DEBUG=electron-builder npm run build:${platform}`);

// Log File Location
console.log('\n📝 Log Files:');
console.log('- Build logs will appear in console output');
console.log('- Additional logs: dist/builder-debug.yml');
console.log('- Effective config: dist/builder-effective-config.yaml');

console.log('\n✨ Debug analysis complete!');
