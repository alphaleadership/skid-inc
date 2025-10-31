# Build Configuration for Skid-Inc

This directory contains build configuration files for creating distributable packages of Skid-Inc using electron-builder.

## Files

- `build-config.js` - Build configuration and metadata generation
- `code-signing.js` - Code signing configuration for different platforms
- `prebuild.js` - Pre-build validation and setup script
- `installer.nsh` - Custom NSIS installer script for Windows
- `entitlements.mac.plist` - macOS entitlements for code signing
- `background.png` - Background image for macOS DMG installer

## Building

### Prerequisites

1. Install dependencies: `npm install`
2. For code signing, set up environment variables (see Code Signing section)

### Build Commands

- `npm run build` - Build for current platform
- `npm run build:win` - Build for Windows (NSIS installer + portable)
- `npm run build:mac` - Build for macOS (DMG + ZIP)
- `npm run build:linux` - Build for Linux (AppImage + DEB + RPM)
- `npm run build:all` - Build for all platforms
- `npm run build:dir` - Build unpacked directory (for testing)

### Output

Built packages are created in the `dist/` directory:

- Windows: `.exe` installer and portable `.exe`
- macOS: `.dmg` installer and `.zip` archive
- Linux: `.AppImage`, `.deb`, and `.rpm` packages

## Code Signing

### Windows

Set these environment variables:
```bash
WIN_CSC_LINK=path/to/certificate.p12
WIN_CSC_KEY_PASSWORD=certificate_password
```

### macOS

Set these environment variables:
```bash
CSC_NAME="Developer ID Application: Your Name"
APPLE_ID=your@apple.id
APPLE_ID_PASSWORD=app_specific_password
APPLE_TEAM_ID=your_team_id
```

For CI/CD, you can also use:
```bash
CSC_LINK=base64_encoded_certificate
CSC_KEY_PASSWORD=certificate_password
```

## Platform-Specific Notes

### Windows
- Creates NSIS installer with custom shortcuts
- Supports both x64 and x86 architectures
- Portable version available

### macOS
- Universal builds for Intel and Apple Silicon
- Notarization support (requires Apple Developer account)
- DMG with custom background and layout

### Linux
- AppImage for universal compatibility
- DEB package for Debian/Ubuntu
- RPM package for Red Hat/Fedora
- Desktop integration included

## Troubleshooting

### Icon Issues
- Ensure `icons/icon.png` is at least 256x256 pixels
- For best results, use 512x512 or 1024x1024 pixels
- The icon should be in PNG format

### Code Signing Issues
- Verify certificates are valid and not expired
- Check environment variables are set correctly
- For macOS, ensure Xcode command line tools are installed

### Build Failures
- Run `npm run prebuild` to validate configuration
- Check that all required files exist
- Ensure sufficient disk space for builds

## Environment Variables

| Variable | Platform | Description |
|----------|----------|-------------|
| `WIN_CSC_LINK` | Windows | Path to code signing certificate |
| `WIN_CSC_KEY_PASSWORD` | Windows | Certificate password |
| `CSC_NAME` | macOS | Developer ID name |
| `APPLE_ID` | macOS | Apple ID for notarization |
| `APPLE_ID_PASSWORD` | macOS | App-specific password |
| `APPLE_TEAM_ID` | macOS | Apple Developer Team ID |
| `CI` | All | Set to 'true' in CI environments |
| `NODE_ENV` | All | Set to 'development' to skip signing |