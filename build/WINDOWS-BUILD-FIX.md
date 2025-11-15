# Windows Build Memory Issue Solution

## Problem

The Windows build was failing with memory allocation errors when creating the NSIS installer:

```
ERROR: Can't allocate required memory!
```

This occurred because 7-Zip (used by electron-builder for NSIS) requires significant memory for compression, and the build environment (especially CI/CD) had limited available memory.

## Solution

### 1. Default Build Configuration

The default `npm run build:win` now uses only the **portable** target, which requires much less memory and works reliably in CI/CD environments.

```json
"win": {
  "icon": "icons/icon.png",
  "compression": "store",
  "target": [
    {
      "target": "portable",
      "arch": ["x64"]
    }
  ]
}
```

### 2. Separate NSIS Build Script

For cases where you need the NSIS installer (with proper installation/uninstallation), use the dedicated script:

```bash
npm run build:win-nsis
```

This script:
- Checks available memory
- Temporarily modifies package.json to include NSIS target
- Builds both NSIS installer and portable executable
- Restores original configuration
- Handles errors gracefully

### 3. Build Outputs

**Portable Build (default):**
- `dist/Skid-Inc 0.0.2.exe` - Portable executable
- `dist/win-unpacked/` - Unpacked application directory

**NSIS Build (when available memory permits):**
- `dist/Skid-Inc Setup 0.0.2.exe` - NSIS installer
- `dist/Skid-Inc 0.0.2.exe` - Portable executable

## Usage Recommendations

### For CI/CD (GitHub Actions, etc.)
```bash
npm run build:win  # Uses portable, memory-efficient
```

### For Development/Manual Releases
```bash
npm run build:win-nsis  # Creates installer, requires more memory
```

### For Testing
```bash
npm run build:dir  # Creates unpacked directory for quick testing
```

## Memory Requirements

- **Portable Build**: ~500MB RAM
- **NSIS Build**: ~2GB RAM recommended
- **Directory Build**: ~300MB RAM

## Troubleshooting

If NSIS build fails:
1. Close other applications to free memory
2. Use portable build instead: `npm run build:win`
3. Restart your machine if memory is fragmented
4. Consider building on a machine with more RAM

## Icon Configuration

The build now includes proper application icons:
- `icons/icon.png` (562x561) - Used for all platforms
- Configured in package.json for Windows, macOS, and Linux
- Icons are included in build files automatically

This solution ensures reliable builds in CI/CD while still providing the option for NSIS installers when memory permits.
