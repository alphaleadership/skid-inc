# Skid-Inc Build and Deployment Scripts

This directory contains automated scripts for building, packaging, and deploying Skid-Inc across all supported platforms.

## Scripts Overview

### 🔨 `build-all.js`
**Automated Build System**

Comprehensive build script that handles multi-platform compilation with error handling, retry logic, and detailed reporting.

#### Features
- **Multi-platform support**: Windows, macOS, Linux
- **Error handling**: Automatic retries with exponential backoff
- **Progress monitoring**: Real-time build status and logging
- **Environment validation**: Checks prerequisites before building
- **Build reports**: Detailed JSON reports with metrics
- **Artifact verification**: Validates generated files

#### Usage
```bash
# Run automated build for all platforms
node scripts/build-all.js

# Or use npm script
npm run build:automated
```

#### Configuration
Edit the `BUILD_CONFIG` object to customize:
- `platforms`: Array of platforms to build
- `maxRetries`: Number of retry attempts
- `timeout`: Build timeout in milliseconds
- `outputDir`: Build output directory

### 📦 `deploy.js`
**Deployment Manager**

Handles packaging, checksumming, and preparation of build artifacts for distribution.

#### Features
- **Artifact collection**: Gathers all distributable files
- **Checksum generation**: SHA256 hashes for integrity verification
- **Release documentation**: Auto-generated release notes
- **Manifest creation**: JSON metadata for update system
- **Archive creation**: ZIP packages for easy distribution
- **Platform detection**: Automatic platform categorization

#### Usage
```bash
# Deploy built artifacts
node scripts/deploy.js

# Or use npm script
npm run deploy

# Full build and deploy
npm run release
```

#### Output Structure
```
releases/v[version]/
├── [Platform executables and installers]
├── checksums.txt              # All file checksums
├── [file].sha256             # Individual checksums
├── RELEASE_NOTES.md          # Generated release notes
├── manifest.json             # Update system metadata
└── skid-inc-[version]-release.zip  # Complete archive
```

### 🔄 `auto-update.js`
**Auto-Update System Setup**

Configures the automatic update system for the Electron application.

#### Features
- **Dependency installation**: Installs electron-updater and electron-log
- **Module generation**: Creates auto-updater integration code
- **Main process integration**: Updates main.js with update handlers
- **Renderer UI**: Creates update notification interface
- **Configuration files**: Sets up update configuration

#### Usage
```bash
# Set up auto-update system
node scripts/auto-update.js

# Or use npm script
npm run setup-updates
```

#### Generated Files
- `src/auto-updater.js` - Main process update handler
- `src/renderer/update-manager.js` - Renderer update UI
- `build/update-config.json` - Update configuration
- Updated `package.json` - Publish configuration

## Quick Start

### 1. Initial Setup
```bash
# Install dependencies
npm install

# Set up auto-updates (one-time)
npm run setup-updates
```

### 2. Development Build
```bash
# Test build (current platform only)
npm run build:dir
```

### 3. Production Release
```bash
# Full automated release process
npm run release
```

## Environment Variables

### Code Signing (Optional)

#### Windows
```bash
set WIN_CSC_LINK=path\to\certificate.p12
set WIN_CSC_KEY_PASSWORD=your_password
```

#### macOS
```bash
export CSC_NAME="Developer ID Application: Your Name"
export APPLE_ID=your@apple.id
export APPLE_ID_PASSWORD=app_specific_password
export APPLE_TEAM_ID=your_team_id
```

### Build Configuration
```bash
# Skip code signing
export NODE_ENV=development

# Enable CI mode
export CI=true

# Custom output directory
export BUILD_OUTPUT_DIR=custom-dist
```

## Platform Requirements

### Windows
- **OS**: Windows 10/11 (64-bit)
- **Tools**: Visual Studio Build Tools (for native modules)
- **Optional**: Code signing certificate

### macOS
- **OS**: macOS 10.15+ (Intel or Apple Silicon)
- **Tools**: Xcode with command line tools
- **Optional**: Apple Developer account for signing

### Linux
- **OS**: Ubuntu 18.04+ or equivalent
- **Tools**: Build essentials (`build-essential` package)
- **Libraries**: Standard development libraries

## Script Configuration

### Build Configuration (`build-all.js`)
```javascript
const BUILD_CONFIG = {
  platforms: ['win', 'mac', 'linux'],  // Platforms to build
  outputDir: 'dist',                   // Output directory
  logFile: 'build.log',               // Log file name
  maxRetries: 3,                      // Retry attempts
  timeout: 300000                     // 5 minute timeout
};
```

### Deploy Configuration (`deploy.js`)
```javascript
const DEPLOY_CONFIG = {
  outputDir: 'dist',                  // Source directory
  releaseDir: 'releases',             // Release directory
  checksumAlgorithm: 'sha256',       // Hash algorithm
  compressionLevel: 9                 // ZIP compression
};
```

### Update Configuration (`auto-update.js`)
```javascript
const UPDATE_CONFIG = {
  provider: 'github',                 // Update provider
  owner: 'TotomInc',                 // Repository owner
  repo: 'skid-inc',                  // Repository name
  updateCheckInterval: 86400000,      // 24 hours
  allowPrerelease: false,            // Beta versions
  allowDowngrade: false              // Prevent downgrades
};
```

## Logging and Monitoring

### Log Files
- `build.log` - Build process logs
- `deploy.log` - Deployment logs (if enabled)
- `dist/build-report.json` - Build metrics and results

### Log Levels
- **INFO**: General information
- **WARN**: Warnings and non-critical issues
- **ERROR**: Errors and failures
- **SUCCESS**: Successful operations

### Monitoring Build Progress
```bash
# Watch build log in real-time
tail -f build.log

# Check build report
cat dist/build-report.json | jq .
```

## Troubleshooting

### Common Issues

#### "electron-builder not found"
```bash
npm install electron-builder --save-dev
```

#### "Permission denied"
```bash
# Make scripts executable
chmod +x scripts/*.js

# Or run with node explicitly
node scripts/build-all.js
```

#### "Platform not supported"
- macOS builds require macOS system
- Some platforms may be skipped automatically
- Check platform requirements above

#### "Code signing failed"
- Verify certificates are installed
- Check environment variables
- Try building without signing first

### Build Failures

#### Clean Build Environment
```bash
# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clean build directory
rm -rf dist
```

#### Debug Mode
```bash
# Enable verbose logging
DEBUG=electron-builder node scripts/build-all.js

# Check specific platform
npm run build:win  # Test Windows build only
```

### Deployment Issues

#### Missing Artifacts
- Ensure build completed successfully
- Check `dist/` directory for files
- Verify file permissions

#### Checksum Errors
- Rebuild affected packages
- Check for file corruption
- Verify disk space availability

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Build Application
  run: npm run build:automated
  env:
    CSC_NAME: ${{ secrets.CSC_NAME }}
    WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
    WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}

- name: Deploy Artifacts
  run: npm run deploy
```

### Jenkins Pipeline
```groovy
stage('Build') {
    steps {
        sh 'npm run build:automated'
    }
}

stage('Deploy') {
    steps {
        sh 'npm run deploy'
        archiveArtifacts 'releases/**/*'
    }
}
```

## Security Considerations

### Secure Builds
- Use isolated build environments
- Verify dependency integrity
- Store certificates securely
- Enable audit logging

### Distribution Security
- Generate and verify checksums
- Use HTTPS for distribution
- Implement signature verification
- Monitor for tampering

## Performance Optimization

### Build Performance
- Use SSD storage for faster I/O
- Increase available RAM
- Use parallel builds when possible
- Cache dependencies between builds

### Deployment Optimization
- Compress artifacts efficiently
- Use CDN for distribution
- Implement delta updates
- Monitor bandwidth usage

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Review and rotate certificates annually
- Monitor build performance metrics
- Update documentation as needed

### Version Updates
- Update electron-builder regularly
- Test with new Electron versions
- Verify platform compatibility
- Update signing certificates before expiration

---

*These scripts are actively maintained. For issues or feature requests, please use the GitHub issue tracker.*