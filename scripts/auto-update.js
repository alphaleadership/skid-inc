#!/usr/bin/env node

/**
 * Auto-update system for Skid-Inc
 * Handles automatic updates using electron-updater
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration for auto-update system
const UPDATE_CONFIG = {
  provider: 'github',
  owner: 'TotomInc',
  repo: 'skid-inc',
  updateCheckInterval: 24 * 60 * 60 * 1000, // 24 hours
  allowPrerelease: false,
  allowDowngrade: false
};

class AutoUpdateManager {
  constructor() {
    this.packageInfo = this.loadPackageInfo();
  }

  loadPackageInfo() {
    try {
      return JSON.parse(fs.readFileSync('package.json', 'utf8'));
    } catch (error) {
      throw new Error('Failed to load package.json');
    }
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async setupAutoUpdater() {
    this.log('Setting up auto-updater configuration...');

    // Install electron-updater if not already installed
    try {
      require.resolve('electron-updater');
      this.log('electron-updater is already installed');
    } catch (error) {
      this.log('Installing electron-updater...');
      execSync('npm install electron-updater', { stdio: 'inherit' });
    }

    // Create auto-updater module
    await this.createUpdaterModule();
    
    // Update main process to include auto-updater
    await this.updateMainProcess();
    
    // Create update configuration
    await this.createUpdateConfig();
    
    // Update package.json with publish configuration
    await this.updatePackageJson();
    
    this.log('Auto-updater setup completed successfully!');
  }

  async createUpdaterModule() {
    this.log('Creating auto-updater module...');

    const updaterCode = `/**
 * Auto-updater module for Skid-Inc
 * Handles automatic application updates
 */

const { autoUpdater } = require('../up.js');
const { dialog, BrowserWindow } = require('electron');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

class AutoUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.updateAvailable = false;
    this.updateDownloaded = false;
    
    this.setupEventHandlers();
    this.configureUpdater();
  }

  configureUpdater() {
    // Configure auto-updater settings
    autoUpdater.checkForUpdatesAndNotify = false; // We'll handle notifications manually
    autoUpdater.autoDownload = false; // Ask user before downloading
    autoUpdater.allowPrerelease = ${UPDATE_CONFIG.allowPrerelease};
    autoUpdater.allowDowngrade = ${UPDATE_CONFIG.allowDowngrade};
    
    log.info('Auto-updater configured');
  }

  setupEventHandlers() {
    // Update available
    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info.version);
      this.updateAvailable = true;
      this.showUpdateAvailableDialog(info);
    });

    // No update available
    autoUpdater.on('update-not-available', (info) => {
      log.info('No update available');
      this.updateAvailable = false;
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info.version);
      this.updateDownloaded = true;
      this.showUpdateReadyDialog(info);
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      log.info(\`Download progress: \${percent}%\`);
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-progress', {
          percent: percent,
          transferred: progressObj.transferred,
          total: progressObj.total
        });
      }
    });

    // Error handling
    autoUpdater.on('error', (error) => {
      log.error('Auto-updater error:', error);
      this.showUpdateErrorDialog(error);
    });
  }

  async checkForUpdates(showNoUpdateDialog = false) {
    try {
      log.info('Checking for updates...');
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-checking');
      }
      
      const result = await autoUpdater.checkForUpdates();
      
      if (!this.updateAvailable && showNoUpdateDialog) {
        this.showNoUpdateDialog();
      }
      
      return result;
    } catch (error) {
      log.error('Failed to check for updates:', error);
      
      if (showNoUpdateDialog) {
        this.showUpdateErrorDialog(error);
      }
      
      throw error;
    }
  }

  async downloadUpdate() {
    try {
      log.info('Starting update download...');
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-downloading');
      }
      
      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('Failed to download update:', error);
      this.showUpdateErrorDialog(error);
      throw error;
    }
  }

  quitAndInstall() {
    log.info('Quitting and installing update...');
    autoUpdater.quitAndInstall();
  }

  showUpdateAvailableDialog(info) {
    const options = {
      type: 'info',
      title: 'Update Available',
      message: \`A new version of Skid-Inc is available!\`,
      detail: \`Version \${info.version} is now available. You are currently using version \${this.getCurrentVersion()}.\n\nWould you like to download and install the update?\`,
      buttons: ['Download Update', 'Later'],
      defaultId: 0,
      cancelId: 1
    };

    dialog.showMessageBox(this.mainWindow, options).then((result) => {
      if (result.response === 0) {
        this.downloadUpdate();
      }
    });
  }

  showUpdateReadyDialog(info) {
    const options = {
      type: 'info',
      title: 'Update Ready',
      message: \`Update downloaded successfully!\`,
      detail: \`Version \${info.version} has been downloaded and is ready to install. The application will restart to complete the installation.\`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    };

    dialog.showMessageBox(this.mainWindow, options).then((result) => {
      if (result.response === 0) {
        this.quitAndInstall();
      }
    });
  }

  showNoUpdateDialog() {
    const options = {
      type: 'info',
      title: 'No Updates',
      message: 'You are using the latest version of Skid-Inc!',
      detail: \`Current version: \${this.getCurrentVersion()}\`,
      buttons: ['OK']
    };

    dialog.showMessageBox(this.mainWindow, options);
  }

  showUpdateErrorDialog(error) {
    const options = {
      type: 'error',
      title: 'Update Error',
      message: 'Failed to check for updates',
      detail: \`An error occurred while checking for updates: \${error.message}\n\nPlease try again later or check for updates manually.\`,
      buttons: ['OK']
    };

    dialog.showMessageBox(this.mainWindow, options);
  }

  getCurrentVersion() {
    try {
      const packageJson = require('../../package.json');
      return packageJson.version;
    } catch (error) {
      return 'Unknown';
    }
  }

  startPeriodicCheck() {
    // Check for updates every 24 hours
    setInterval(() => {
      this.checkForUpdates(false);
    }, ${UPDATE_CONFIG.updateCheckInterval});
    
    log.info('Periodic update check started');
  }
}

module.exports = AutoUpdater;`;

    const updaterPath = path.join('src', 'auto-updater.js');
    fs.writeFileSync(updaterPath, updaterCode);
    this.log(`Auto-updater module created: ${updaterPath}`);
  }

  async updateMainProcess() {
    this.log('Updating main process to include auto-updater...');

    const mainPath = path.join('src', 'main.js');
    
    if (!fs.existsSync(mainPath)) {
      throw new Error('Main process file not found: src/main.js');
    }

    let mainContent = fs.readFileSync(mainPath, 'utf8');

    // Check if auto-updater is already integrated
    if (mainContent.includes('auto-updater.js')) {
      this.log('Auto-updater already integrated in main process');
      return;
    }

    // Add auto-updater import and initialization
    const autoUpdaterIntegration = `
// Auto-updater integration
const AutoUpdater = require('./auto-updater');
let autoUpdater = null;`;

    // Find the place to add the import (after other requires)
    const requireRegex = /const\s+\{[^}]+\}\s*=\s*require\([^)]+\);?\s*$/gm;
    const matches = [...mainContent.matchAll(requireRegex)];
    
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const insertIndex = lastMatch.index + lastMatch[0].length;
      mainContent = mainContent.slice(0, insertIndex) + autoUpdaterIntegration + mainContent.slice(insertIndex);
    } else {
      // If no requires found, add at the beginning
      mainContent = autoUpdaterIntegration + '\n' + mainContent;
    }

    // Add auto-updater initialization after window creation
    const windowCreationRegex = /mainWindow\s*=\s*new\s+BrowserWindow\([^}]+\}\s*\);?/;
    const windowMatch = mainContent.match(windowCreationRegex);
    
    if (windowMatch) {
      const autoUpdaterInit = `
  
  // Initialize auto-updater
  if (!isDev) {
    autoUpdater = new AutoUpdater(mainWindow);
    
    // Check for updates on startup (after 5 seconds)
    setTimeout(() => {
      autoUpdater.checkForUpdates(false);
      autoUpdater.startPeriodicCheck();
    }, 5000);
  }`;
      
      const insertIndex = windowMatch.index + windowMatch[0].length;
      mainContent = mainContent.slice(0, insertIndex) + autoUpdaterInit + mainContent.slice(insertIndex);
    }

    // Add IPC handlers for manual update checks
    const ipcHandlers = `
// IPC handlers for auto-updater
ipcMain.handle('check-for-updates', async () => {
  if (autoUpdater) {
    return await autoUpdater.checkForUpdates(true);
  }
  return null;
});

ipcMain.handle('download-update', async () => {
  if (autoUpdater) {
    return await autoUpdater.downloadUpdate();
  }
});

ipcMain.handle('quit-and-install', () => {
  if (autoUpdater) {
    autoUpdater.quitAndInstall();
  }
});`;

    // Add IPC handlers before app.whenReady()
    const appReadyRegex = /app\.whenReady\(\)/;
    const appReadyMatch = mainContent.match(appReadyRegex);
    
    if (appReadyMatch) {
      const insertIndex = appReadyMatch.index;
      mainContent = mainContent.slice(0, insertIndex) + ipcHandlers + '\n\n' + mainContent.slice(insertIndex);
    }

    fs.writeFileSync(mainPath, mainContent);
    this.log('Main process updated with auto-updater integration');
  }

  async createUpdateConfig() {
    this.log('Creating update configuration...');

    const updateConfig = {
      provider: UPDATE_CONFIG.provider,
      owner: UPDATE_CONFIG.owner,
      repo: UPDATE_CONFIG.repo,
      updaterCacheDirName: 'skid-inc-updater',
      publishAutoUpdate: true
    };

    const configPath = path.join('build', 'update-config.json');
    fs.writeFileSync(configPath, JSON.stringify(updateConfig, null, 2));
    this.log(`Update configuration saved: ${configPath}`);
  }

  async updatePackageJson() {
    this.log('Updating package.json with publish configuration...');

    // Update the publish configuration in package.json
    const packageJson = { ...this.packageInfo };

    if (!packageJson.build) {
      packageJson.build = {};
    }

    packageJson.build.publish = {
      provider: UPDATE_CONFIG.provider,
      owner: UPDATE_CONFIG.owner,
      repo: UPDATE_CONFIG.repo
    };

    // Add electron-updater to dependencies if not present
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    if (!packageJson.dependencies['electron-updater']) {
      packageJson.dependencies['electron-updater'] = '^6.1.7';
    }

    if (!packageJson.dependencies['electron-log']) {
      packageJson.dependencies['electron-log'] = '^5.0.1';
    }

    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    this.log('package.json updated with auto-updater configuration');
  }

  async createRendererUpdateUI() {
    this.log('Creating renderer update UI components...');

    const updateUICode = `/**
 * Update UI components for the renderer process
 */

class UpdateManager {
  constructor() {
    this.updateStatus = 'idle';
    this.updateProgress = 0;
    this.createUpdateUI();
    this.setupIPC();
  }

  createUpdateUI() {
    // Create update notification container
    const updateContainer = document.createElement('div');
    updateContainer.id = 'update-container';
    updateContainer.style.cssText = \`
      position: fixed;
      top: 10px;
      right: 10px;
      background: #2c3e50;
      color: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 300px;
      display: none;
      font-family: Arial, sans-serif;
      font-size: 14px;
    \`;

    // Create update content
    updateContainer.innerHTML = \`
      <div id="update-title" style="font-weight: bold; margin-bottom: 8px;">Update Available</div>
      <div id="update-message" style="margin-bottom: 10px;">Checking for updates...</div>
      <div id="update-progress" style="display: none;">
        <div style="background: #34495e; height: 6px; border-radius: 3px; margin: 8px 0;">
          <div id="update-progress-bar" style="background: #3498db; height: 100%; border-radius: 3px; width: 0%; transition: width 0.3s;"></div>
        </div>
        <div id="update-progress-text" style="font-size: 12px; color: #bdc3c7;">0%</div>
      </div>
      <div id="update-buttons" style="margin-top: 10px;">
        <button id="update-check-btn" style="background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 4px; margin-right: 8px; cursor: pointer;">Check for Updates</button>
        <button id="update-close-btn" style="background: #95a5a6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">Close</button>
      </div>
    \`;

    document.body.appendChild(updateContainer);
    this.updateContainer = updateContainer;

    // Setup button handlers
    document.getElementById('update-check-btn').addEventListener('click', () => {
      this.checkForUpdates();
    });

    document.getElementById('update-close-btn').addEventListener('click', () => {
      this.hideUpdateUI();
    });
  }

  setupIPC() {
    if (window.electronAPI) {
      // Listen for update events from main process
      window.electronAPI.onUpdateChecking(() => {
        this.showUpdateUI('Checking for updates...', 'checking');
      });

      window.electronAPI.onUpdateProgress((progress) => {
        this.updateProgress = progress.percent;
        this.showProgress(progress.percent);
      });

      window.electronAPI.onUpdateDownloading(() => {
        this.showUpdateUI('Downloading update...', 'downloading');
        this.showProgress(0);
      });
    }
  }

  async checkForUpdates() {
    if (window.electronAPI && window.electronAPI.checkForUpdates) {
      try {
        this.showUpdateUI('Checking for updates...', 'checking');
        await window.electronAPI.checkForUpdates();
      } catch (error) {
        this.showUpdateUI('Failed to check for updates', 'error');
        console.error('Update check failed:', error);
      }
    } else {
      this.showUpdateUI('Updates not available in web version', 'info');
    }
  }

  showUpdateUI(message, status = 'idle') {
    this.updateStatus = status;
    
    const container = this.updateContainer;
    const messageEl = document.getElementById('update-message');
    const progressEl = document.getElementById('update-progress');
    const checkBtn = document.getElementById('update-check-btn');
    
    messageEl.textContent = message;
    container.style.display = 'block';
    
    if (status === 'downloading') {
      progressEl.style.display = 'block';
      checkBtn.style.display = 'none';
    } else {
      progressEl.style.display = 'none';
      checkBtn.style.display = status === 'idle' ? 'inline-block' : 'none';
    }
    
    // Auto-hide after 5 seconds for info messages
    if (status === 'info' || status === 'error') {
      setTimeout(() => {
        this.hideUpdateUI();
      }, 5000);
    }
  }

  showProgress(percent) {
    const progressBar = document.getElementById('update-progress-bar');
    const progressText = document.getElementById('update-progress-text');
    
    if (progressBar && progressText) {
      progressBar.style.width = percent + '%';
      progressText.textContent = Math.round(percent) + '%';
    }
  }

  hideUpdateUI() {
    this.updateContainer.style.display = 'none';
  }
}

// Initialize update manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new UpdateManager();
  });
} else {
  new UpdateManager();
}`;

    const rendererUpdatePath = path.join('src', 'renderer', 'update-manager.js');
    
    // Create renderer directory if it doesn't exist
    const rendererDir = path.dirname(rendererUpdatePath);
    if (!fs.existsSync(rendererDir)) {
      fs.mkdirSync(rendererDir, { recursive: true });
    }
    
    fs.writeFileSync(rendererUpdatePath, updateUICode);
    this.log(`Renderer update UI created: ${rendererUpdatePath}`);
  }

  async setup() {
    try {
      await this.setupAutoUpdater();
      await this.createRendererUpdateUI();
      
      this.log('='.repeat(60));
      this.log('AUTO-UPDATE SETUP COMPLETE');
      this.log('='.repeat(60));
      this.log('Next steps:');
      this.log('1. Run "npm install" to install new dependencies');
      this.log('2. Include update-manager.js in your HTML files');
      this.log('3. Set up GitHub releases for distribution');
      this.log('4. Configure code signing for auto-updates to work');
      this.log('='.repeat(60));
      
    } catch (error) {
      this.log(`Auto-update setup failed: ${error.message}`, 'ERROR');
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const updateManager = new AutoUpdateManager();
  await updateManager.setup();
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Auto-update setup failed:', error);
    process.exit(1);
  });
}

module.exports = { AutoUpdateManager };