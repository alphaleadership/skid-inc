# Skid-Inc Deployment Guide

This guide covers the complete deployment process for Skid-Inc, from building to distribution across all supported platforms.

## Overview

The deployment system consists of three main components:

1. **Automated Build System** (`scripts/build-all.js`)
2. **Deployment Manager** (`scripts/deploy.js`)
3. **Auto-Update System** (`scripts/auto-update.js`)

## Prerequisites

### Development Environment

#### Required Software
- **Node.js**: Version 16 or later
- **npm**: Version 8 or later
- **Git**: For version control and releases
- **Platform-specific tools** (see below)

#### Platform-Specific Requirements

##### Windows Development
- **Windows 10/11**: 64-bit
- **Visual Studio Build Tools**: For native modules
- **Windows SDK**: Latest version
- **Code Signing Certificate**: For signed releases (optional)

##### macOS Development
- **macOS 10.15+**: Intel or Apple Silicon
- **Xcode**: Latest version with command line tools
- **Apple Developer Account**: For code signing and notarization
- **Developer ID Certificate**: For distribution outside App Store

##### Linux Development
- **Ubuntu 18.04+** or equivalent
- **Build essentials**: `sudo apt-get install build-essential`
- **Additional libraries**: See installation guide

### Environment Setup

#### 1. Clone Repository
```bash
git clone https://github.com/TotomInc/skid-inc.git
cd skid-inc
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Verify Setup
```bash
npm run electron-dev  # Test development build
npm run build:dir     # Test packaging
```

## Build System

### Automated Building

#### Quick Build (Current Platform)
```bash
npm run build:automated
```

#### Platform-Specific Builds
```bash
npm run build:win     # Windows only
npm run build:mac     # macOS only (requires macOS)
npm run build:linux   # Linux only
```

#### Multi-Platform Build
```bash
npm run build:all     # All platforms (limited by current OS)
```

### Build Configuration

#### Build Script Features
- **Environment Validation**: Checks prerequisites
- **Automatic Cleanup**: Removes old build artifacts
- **Error Handling**: Retry logic with exponential backoff
- **Progress Logging**: Detailed build logs
- **Artifact Verification**: Validates generated files
- **Build Reports**: JSON reports with metadata

#### Customizing Builds

Edit `scripts/build-all.js` to modify:
- **Retry Attempts**: `maxRetries` setting
- **Timeout Values**: `timeout` configuration
- **Platform Selection**: `platforms` array
- **Output Directory**: `outputDir` setting

### Build Artifacts

#### Generated Files

##### Windows
- `Skid-Inc Setup [version].exe` - NSIS installer
- `Skid-Inc [version].exe` - Portable executable
- `latest.yml` - Update metadata

##### macOS
- `Skid-Inc-[version].dmg` - DMG installer
- `Skid-Inc-[version]-mac.zip` - ZIP archive
- `latest-mac.yml` - Update metadata

##### Linux
- `Skid-Inc-[version].AppImage` - Universal AppImage
- `skid-inc_[version]_amd64.deb` - Debian package
- `skid-inc-[version].x86_64.rpm` - RPM package
- `latest-linux.yml` - Update metadata

## Deployment Process

### Automated Deployment

#### Full Release Process
```bash
npm run release  # Build + Deploy
```

#### Manual Steps
```bash
npm run build:automated  # Build all platforms
npm run deploy          # Package for distribution
```

### Deployment Features

#### Package Management
- **Artifact Collection**: Gathers all distributable files
- **Checksum Generation**: SHA256 hashes for verification
- **Release Notes**: Automated generation
- **Manifest Creation**: JSON metadata for updates
- **Archive Creation**: ZIP archives for easy distribution

#### File Organization
```
releases/
└── v[version]/
    ├── Skid-Inc Setup [version].exe
    ├── Skid-Inc [version].exe
    ├── Skid-Inc-[version].dmg
    ├── Skid-Inc-[version]-mac.zip
    ├── Skid-Inc-[version].AppImage
    ├── skid-inc_[version]_amd64.deb
    ├── skid-inc-[version].x86_64.rpm
    ├── checksums.txt
    ├── RELEASE_NOTES.md
    ├── manifest.json
    └── [individual checksum files]
```

### Distribution Channels

#### GitHub Releases
1. **Automated**: Configure GitHub Actions (see CI/CD section)
2. **Manual**: Upload files from `releases/` directory

#### Direct Distribution
- **Website**: Host files on your own server
- **CDN**: Use content delivery network for global distribution
- **Package Managers**: Submit to platform-specific stores

## Code Signing

### Windows Code Signing

#### Certificate Setup
```bash
# Set environment variables
set WIN_CSC_LINK=path\to\certificate.p12
set WIN_CSC_KEY_PASSWORD=your_password
```

#### Certificate Types
- **EV Code Signing**: Extended validation (recommended)
- **Standard Code Signing**: Basic signing
- **Self-Signed**: For testing only

#### Signing Process
- Automatic during build if certificate configured
- Manual signing: Use `signtool.exe`
- Timestamp servers ensure long-term validity

### macOS Code Signing

#### Developer Setup
```bash
# Set environment variables
export CSC_NAME="Developer ID Application: Your Name"
export APPLE_ID=your@apple.id
export APPLE_ID_PASSWORD=app_specific_password
export APPLE_TEAM_ID=your_team_id
```

#### Notarization Process
1. **Build**: Create signed application
2. **Upload**: Submit to Apple for notarization
3. **Staple**: Attach notarization ticket
4. **Distribute**: Release notarized application

#### Certificate Management
- **Developer ID**: For distribution outside App Store
- **Mac App Store**: For App Store distribution
- **Keychain**: Secure certificate storage

### Linux Signing

#### Package Signing
- **DEB**: Use `dpkg-sig` for Debian packages
- **RPM**: Use `rpm --addsign` for RPM packages
- **AppImage**: Digital signatures for AppImages

## Auto-Update System

### Setup Auto-Updates

#### Initial Configuration
```bash
npm run setup-updates
```

This script:
- Installs required dependencies
- Creates auto-updater modules
- Updates main process integration
- Configures update settings

### Update Configuration

#### Update Settings
```json
{
  "provider": "github",
  "owner": "TotomInc",
  "repo": "skid-inc",
  "updateCheckInterval": 86400000,
  "allowPrerelease": false,
  "allowDowngrade": false
}
```

#### Update Process
1. **Check**: Application checks for updates periodically
2. **Download**: User confirms download of available updates
3. **Install**: Application restarts to install updates
4. **Verify**: Update integrity verification

### Update Channels

#### Release Channels
- **Stable**: Production releases only
- **Beta**: Pre-release versions
- **Alpha**: Development builds

#### Channel Configuration
Edit `src/auto-updater.js`:
```javascript
autoUpdater.allowPrerelease = true;  // Enable beta/alpha
```

## CI/CD Integration

### GitHub Actions

#### Workflow Configuration
Create `.github/workflows/build.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
    runs-on: ${{ matrix.os }}
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run build:automated
      env:
        CSC_NAME: ${{ secrets.CSC_NAME }}
        CSC_LINK: ${{ secrets.CSC_LINK }}
        CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
        WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
        WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: ${{ matrix.os }}-build
        path: dist/
```

#### Secrets Configuration
Set these secrets in GitHub repository settings:
- `CSC_NAME`: macOS certificate name
- `CSC_LINK`: Base64 encoded certificate
- `CSC_KEY_PASSWORD`: Certificate password
- `WIN_CSC_LINK`: Windows certificate path
- `WIN_CSC_KEY_PASSWORD`: Windows certificate password

### Alternative CI Systems

#### Jenkins
- Use similar workflow with Jenkins pipeline
- Configure build agents for each platform
- Set up artifact storage and deployment

#### GitLab CI
- Use GitLab runners for multi-platform builds
- Configure container-based builds
- Implement deployment pipelines

## Release Management

### Version Management

#### Semantic Versioning
- **Major**: Breaking changes (1.0.0 → 2.0.0)
- **Minor**: New features (1.0.0 → 1.1.0)
- **Patch**: Bug fixes (1.0.0 → 1.0.1)

#### Version Updates
```bash
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0
```

### Release Process

#### 1. Pre-Release
- Update version number
- Update changelog
- Test all platforms
- Verify auto-update functionality

#### 2. Build and Test
```bash
npm run build:automated
npm run deploy
```

#### 3. Quality Assurance
- Test installers on clean systems
- Verify update process
- Check code signing
- Validate checksums

#### 4. Distribution
- Upload to GitHub Releases
- Update download links
- Notify users of new version
- Monitor for issues

### Rollback Procedures

#### Emergency Rollback
1. **Remove**: Delete problematic release
2. **Revert**: Restore previous version
3. **Notify**: Inform users of rollback
4. **Fix**: Address issues in development
5. **Re-release**: Deploy corrected version

## Monitoring and Analytics

### Build Monitoring

#### Build Metrics
- Build success/failure rates
- Build duration trends
- Platform-specific issues
- Resource usage patterns

#### Error Tracking
- Build log analysis
- Failure pattern identification
- Performance bottlenecks
- Resource constraints

### Update Analytics

#### Update Metrics
- Update adoption rates
- Platform distribution
- Update failure rates
- User retention after updates

#### User Feedback
- Crash reports
- Performance metrics
- Feature usage statistics
- User satisfaction surveys

## Troubleshooting

### Common Build Issues

#### "Module not found"
```bash
npm ci                    # Clean install
npm run postinstall      # Rebuild native modules
```

#### "Permission denied"
```bash
# Windows: Run as Administrator
# macOS/Linux: Check file permissions
chmod +x scripts/*.js
```

#### "Code signing failed"
- Verify certificate validity
- Check environment variables
- Ensure certificate chain is complete
- Test with simple signing operation

### Deployment Issues

#### "Checksum mismatch"
- Rebuild affected packages
- Verify file integrity
- Check for corruption during transfer
- Regenerate checksums

#### "Update server unreachable"
- Verify network connectivity
- Check firewall settings
- Validate update server configuration
- Test with different network

### Platform-Specific Issues

#### Windows
- **Antivirus interference**: Add build directory to exclusions
- **Path length limits**: Use shorter paths or enable long paths
- **Permission issues**: Run with elevated privileges

#### macOS
- **Gatekeeper blocking**: Proper code signing and notarization
- **Xcode issues**: Update to latest version
- **Certificate problems**: Verify in Keychain Access

#### Linux
- **Missing dependencies**: Install build essentials
- **Permission issues**: Check file ownership
- **Library conflicts**: Use clean build environment

## Security Considerations

### Build Security

#### Secure Build Environment
- Use isolated build machines
- Regular security updates
- Access control and monitoring
- Secure credential storage

#### Supply Chain Security
- Dependency verification
- Package integrity checking
- Vulnerability scanning
- Regular dependency updates

### Distribution Security

#### File Integrity
- Cryptographic signatures
- Checksum verification
- Secure distribution channels
- Tamper detection

#### Update Security
- Signed updates only
- Secure update channels
- Rollback capabilities
- Update verification

---

*This deployment guide is maintained alongside the codebase. For the latest procedures and best practices, refer to the repository documentation.*