// Code signing configuration for different platforms
const path = require('path');

// Windows code signing configuration
const windowsCodeSigning = {
  // Certificate file path (should be set via environment variable)
  certificateFile: process.env.WIN_CSC_LINK,
  // Certificate password (should be set via environment variable)
  certificatePassword: process.env.WIN_CSC_KEY_PASSWORD,
  // Timestamp server for Windows
  timestampUrl: 'http://timestamp.digicert.com',
  // Additional signing options
  signingHashAlgorithms: ['sha256'],
  additionalCertificateFile: process.env.WIN_CSC_LINK_ADDITIONAL
};

// macOS code signing configuration
const macCodeSigning = {
  // Developer ID Application certificate
  identity: process.env.CSC_NAME || process.env.MAC_CSC_NAME,
  // Keychain path
  keychain: process.env.CSC_KEYCHAIN,
  // Keychain password
  keychainPassword: process.env.CSC_KEYCHAIN_PASSWORD,
  // Apple ID for notarization
  appleId: process.env.APPLE_ID,
  // App-specific password for notarization
  appleIdPassword: process.env.APPLE_ID_PASSWORD,
  // Team ID
  teamId: process.env.APPLE_TEAM_ID
};

// Environment-specific configuration
const getCodeSigningConfig = () => {
  const isCI = process.env.CI === 'true';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    console.log('Development build - code signing disabled');
    return {
      sign: false,
      mac: { identity: null },
      win: { certificateFile: null }
    };
  }
  
  if (isCI) {
    console.log('CI build - using environment variables for code signing');
    return {
      sign: true,
      mac: macCodeSigning,
      win: windowsCodeSigning
    };
  }
  
  console.log('Local build - code signing configuration from environment');
  return {
    sign: !!(process.env.CSC_NAME || process.env.WIN_CSC_LINK),
    mac: macCodeSigning,
    win: windowsCodeSigning
  };
};

module.exports = {
  windowsCodeSigning,
  macCodeSigning,
  getCodeSigningConfig
};