// Build configuration for electron-builder
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get git commit hash for build metadata
function getGitCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    return 'unknown';
  }
}

// Get build timestamp
function getBuildTimestamp() {
  return new Date().toISOString();
}

// Create build info file
function createBuildInfo() {
  const buildInfo = {
    version: process.env.npm_package_version || '0.0.0',
    commit: getGitCommitHash(),
    timestamp: getBuildTimestamp(),
    platform: process.platform,
    arch: process.arch
  };

  const buildInfoPath = path.join(__dirname, '..', 'src', 'build-info.json');
  fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
  
  console.log('Build info created:', buildInfo);
}

// Export configuration
module.exports = {
  getGitCommitHash,
  getBuildTimestamp,
  createBuildInfo
};

// Run if called directly
if (require.main === module) {
  createBuildInfo();
}