# Enhanced Build Debugging Guide

## Overview
This document explains the enhanced debugging capabilities added to help diagnose and resolve build errors.

## New Debugging Tools

### 1. Build Debug Script
```bash
npm run build:debug [platform]
```
Provides comprehensive analysis of:
- System information (memory, CPU, OS)
- Project configuration validation
- Required files verification
- Dependencies status
- Previous build artifacts
- Environment variables
- Memory analysis with recommendations

### 2. Verbose Build Mode
```bash
npm run build:verbose
```
Runs the build with DEBUG=electron-builder for detailed logging of the electron-builder process.

### 3. Enhanced Error Handling
- Automatic error logging to `build-logs/` directory
- Detailed error context capture
- Troubleshooting suggestions based on error type
- Stack trace preservation

### 4. Improved Pre-build Validation
The prebuild script now includes:
- Enhanced file validation
- Memory availability checks
- Configuration validation
- Automatic error reporting

## Usage Examples

### Before Building (Recommended)
```bash
# Run comprehensive debug analysis
npm run build:debug win

# Check system readiness
npm run build:debug
```

### During Build Issues
```bash
# Run with verbose logging
npm run build:verbose

# For memory issues, use portable build
npm run build:win

# For NSIS installer with sufficient memory
npm run build:win-nsis
```

### After Build Errors
```bash
# Check error logs
ls build-logs/

# Analyze specific error
cat build-logs/build-error-[timestamp].json
```

## Error Types and Solutions

### Memory Allocation Errors
```
ERROR: Can't allocate required memory!
```
**Solution**: Use portable build or free memory
```bash
npm run build:win  # Portable only
npm run build:win-nsis  # Requires more memory
```

### Missing Files
```
ENOENT: no such file or file
```
**Solution**: Run debug to identify missing files
```bash
npm run build:debug
```

### Permission Issues
```
EACCES: permission denied
```
**Solution**: Check directory permissions or run as admin

### Configuration Issues
```
ValidationError: Invalid configuration
```
**Solution**: Validate package.json configuration
```bash
npm run build:debug
```

## Log Files Location

### Error Logs
- Directory: `build-logs/`
- Format: `build-error-[timestamp].json`
- Contents: Full error context, system info, stack traces

### Build Logs
- File: `dist/builder-debug.yml`
- File: `dist/builder-effective-config.yaml`
- Console output with verbose mode

## Debug Script Output Analysis

The debug script provides color-coded indicators:
- ✅ Green: Everything is OK
- ⚠️ Yellow: Warning, may need attention
- ❌ Red: Critical issue that needs fixing

## Memory Recommendations

Based on available memory:
- < 1GB: Critical - build will likely fail
- < 2GB: Warning - NSIS may fail, use portable
- 2-4GB: Good for most builds
- > 4GB: Excellent for all build types

## Environment Variables for Debugging

Set these variables for enhanced debugging:
```bash
# Electron Builder debug
DEBUG=electron-builder

# Node memory limit (increase if needed)
NODE_OPTIONS="--max-old-space-size=4096"

# Build cache location
ELECTRON_BUILDER_CACHE=./cache
```

## Troubleshooting Checklist

When build fails:
1. Run `npm run build:debug` to analyze system
2. Check `build-logs/` for detailed error info
3. Verify all required files exist
4. Check available memory
5. Try `npm run build:verbose` for detailed logs
6. Use appropriate build command based on resources

## CI/CD Integration

For automated builds:
```bash
# Debug before build
npm run build:debug

# Use appropriate build based on resources
if [ "$MEMORY_GB" -lt 2 ]; then
  npm run build:win
else
  npm run build:win-nsis
fi
```

This enhanced debugging system provides comprehensive error analysis and helps quickly identify and resolve build issues.
