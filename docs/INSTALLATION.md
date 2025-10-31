# Skid-Inc Installation Guide

This guide covers installation instructions for all supported platforms and deployment scenarios.

## System Requirements

### Minimum Requirements
- **RAM**: 4 GB
- **Storage**: 500 MB free space
- **Network**: Internet connection for updates

### Platform-Specific Requirements

#### Windows
- **OS**: Windows 10 (64-bit) or later
- **Architecture**: x64
- **Additional**: No additional requirements

#### macOS
- **OS**: macOS 10.15 (Catalina) or later
- **Architecture**: Intel x64 or Apple Silicon (M1/M2)
- **Additional**: May require allowing app in Security & Privacy settings

#### Linux
- **OS**: Ubuntu 18.04+ or equivalent distribution
- **Architecture**: x64
- **Additional**: May require additional libraries (see Linux-specific section)

## Installation Methods

### Windows Installation

#### Method 1: Installer (Recommended)
1. Download `Skid-Inc Setup [version].exe` from the releases page
2. Run the installer as Administrator (right-click → "Run as administrator")
3. Follow the installation wizard:
   - Choose installation directory (default: `C:\\Program Files\\Skid-Inc`)
   - Select additional tasks (desktop shortcut, start menu entry)
   - Click "Install" to begin installation
4. Launch Skid-Inc from the desktop shortcut or Start menu

#### Method 2: Portable Version
1. Download `Skid-Inc [version].exe` (portable version)
2. Create a folder for Skid-Inc (e.g., `C:\\Games\\Skid-Inc`)
3. Move the executable to this folder
4. Double-click to run (no installation required)
5. All data will be stored in the same folder

#### Windows Troubleshooting
- **"Windows protected your PC"**: Click "More info" → "Run anyway"
- **Antivirus warnings**: Add Skid-Inc to your antivirus whitelist
- **Permission errors**: Run as Administrator or install to a different directory

### macOS Installation

#### Method 1: DMG Installer (Recommended)
1. Download `Skid-Inc-[version].dmg`
2. Double-click the DMG file to mount it
3. Drag the Skid-Inc app to the Applications folder
4. Eject the DMG file
5. Launch Skid-Inc from Applications or Launchpad

#### Method 2: ZIP Archive
1. Download `Skid-Inc-[version]-mac.zip`
2. Extract the ZIP file
3. Move `Skid-Inc.app` to your Applications folder
4. Launch from Applications

#### macOS Troubleshooting
- **"App can't be opened because it is from an unidentified developer"**:
  1. Right-click the app → "Open"
  2. Click "Open" in the dialog
  3. Or go to System Preferences → Security & Privacy → General → "Open Anyway"
- **Gatekeeper issues**: Run `xattr -cr /Applications/Skid-Inc.app` in Terminal
- **Notarization warnings**: The app is safe; Apple's security check may take time

### Linux Installation

#### Method 1: AppImage (Universal)
1. Download `Skid-Inc-[version].AppImage`
2. Make it executable: `chmod +x Skid-Inc-[version].AppImage`
3. Run directly: `./Skid-Inc-[version].AppImage`
4. Optional: Integrate with system using AppImageLauncher

#### Method 2: DEB Package (Debian/Ubuntu)
1. Download `skid-inc_[version]_amd64.deb`
2. Install: `sudo dpkg -i skid-inc_[version]_amd64.deb`
3. Fix dependencies if needed: `sudo apt-get install -f`
4. Launch: `skid-inc` or from applications menu

#### Method 3: RPM Package (Red Hat/Fedora)
1. Download `skid-inc-[version].x86_64.rpm`
2. Install: `sudo rpm -i skid-inc-[version].x86_64.rpm`
3. Or with dnf: `sudo dnf install skid-inc-[version].x86_64.rpm`
4. Launch: `skid-inc` or from applications menu

#### Linux Dependencies
Most distributions include required libraries, but you may need:
```bash
# Ubuntu/Debian
sudo apt-get install libgtk-3-0 libxss1 libasound2 libdrm2 libxrandr2 libxcomposite1 libxdamage1 libxfixes3

# Fedora/CentOS
sudo dnf install gtk3 libXScrnSaver alsa-lib libdrm libXrandr libXcomposite libXdamage libXfixes

# Arch Linux
sudo pacman -S gtk3 libxss alsa-lib libdrm libxrandr libxcomposite libxdamage libxfixes
```

## Post-Installation Setup

### First Launch
1. **Data Migration**: If you have existing save data from the web version, the app will offer to import it
2. **Settings Configuration**: Configure game settings and preferences
3. **Auto-Updates**: The app will check for updates automatically (can be disabled in settings)

### Data Locations

#### Windows
- **Installed Version**: `%APPDATA%\\Skid-Inc\\`
- **Portable Version**: Same folder as executable

#### macOS
- **Application Data**: `~/Library/Application Support/Skid-Inc/`
- **Logs**: `~/Library/Logs/Skid-Inc/`

#### Linux
- **Application Data**: `~/.config/Skid-Inc/`
- **Logs**: `~/.local/share/Skid-Inc/logs/`

### Backup and Restore

#### Creating Backups
1. Close Skid-Inc completely
2. Copy the entire data directory (see locations above)
3. Store backup in a safe location

#### Restoring from Backup
1. Close Skid-Inc completely
2. Replace the data directory with your backup
3. Restart Skid-Inc

## Network Configuration

### Firewall Settings
Skid-Inc needs internet access for:
- Automatic updates
- Online features (if any)

**Windows Firewall**: Usually prompts automatically
**macOS Firewall**: Configure in System Preferences → Security & Privacy → Firewall
**Linux Firewall**: Configure based on your distribution (ufw, firewalld, etc.)

### Proxy Configuration
If you're behind a corporate proxy:
1. Skid-Inc uses system proxy settings by default
2. For manual configuration, set environment variables:
   ```bash
   export HTTP_PROXY=http://proxy.company.com:8080
   export HTTPS_PROXY=http://proxy.company.com:8080
   ```

## Updates

### Automatic Updates
- Enabled by default
- Checks for updates every 24 hours
- Downloads and installs with user confirmation
- Can be disabled in application settings

### Manual Updates
1. **In-App**: Help → Check for Updates
2. **Manual Download**: Download new version and install over existing

### Update Troubleshooting
- **Update fails**: Check internet connection and firewall settings
- **Permission errors**: Run as Administrator/sudo for system-wide installations
- **Corrupted update**: Download and install manually

## Uninstallation

### Windows
- **Installer Version**: Use "Add or Remove Programs" in Windows Settings
- **Portable Version**: Delete the application folder

### macOS
1. Move Skid-Inc.app to Trash
2. Delete data folder: `~/Library/Application Support/Skid-Inc/`
3. Empty Trash

### Linux
- **DEB**: `sudo apt-get remove skid-inc`
- **RPM**: `sudo rpm -e skid-inc`
- **AppImage**: Delete the AppImage file and data folder

## Troubleshooting

### Common Issues

#### Application Won't Start
1. Check system requirements
2. Verify file integrity (re-download if necessary)
3. Check antivirus/firewall settings
4. Run as Administrator/sudo
5. Check logs for error messages

#### Performance Issues
1. Close other applications to free memory
2. Check available disk space
3. Disable hardware acceleration in settings
4. Update graphics drivers

#### Save Data Issues
1. Check data directory permissions
2. Verify backup integrity
3. Try running as Administrator/sudo
4. Check disk space

### Getting Help

#### Log Files
Always include log files when reporting issues:
- **Windows**: `%APPDATA%\\Skid-Inc\\logs\\`
- **macOS**: `~/Library/Logs/Skid-Inc/`
- **Linux**: `~/.local/share/Skid-Inc/logs/`

#### Support Channels
- **GitHub Issues**: https://github.com/TotomInc/skid-inc/issues
- **Documentation**: Check this guide and other docs
- **Community**: Look for community forums or Discord

#### Reporting Bugs
Include the following information:
1. Operating system and version
2. Skid-Inc version
3. Steps to reproduce the issue
4. Log files
5. Screenshots (if applicable)

## Advanced Configuration

### Command Line Options
```bash
# Windows
Skid-Inc.exe --help

# macOS
/Applications/Skid-Inc.app/Contents/MacOS/Skid-Inc --help

# Linux
skid-inc --help
```

Common options:
- `--dev`: Enable development mode
- `--disable-updates`: Disable automatic updates
- `--data-dir=PATH`: Use custom data directory
- `--log-level=LEVEL`: Set logging level (error, warn, info, debug)

### Environment Variables
- `SKID_INC_DATA_DIR`: Override default data directory
- `SKID_INC_LOG_LEVEL`: Set logging level
- `SKID_INC_DISABLE_UPDATES`: Disable automatic updates

### Configuration Files
Advanced users can edit configuration files directly:
- `config.json`: Application settings
- `user-preferences.json`: User preferences
- `game-settings.json`: Game-specific settings

**Warning**: Editing configuration files manually may cause issues. Always backup before making changes.

---

*This installation guide is updated with each release. For the latest version, visit the GitHub repository.*