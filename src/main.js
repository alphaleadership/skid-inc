const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const AutoSaveManager = require('./auto-save-manager');
const FileSystemManager = require('./filesystem-manager');
const MigrationManager = require('./migration-manager');
const StartupOptimizer = require('./startup-optimizer');

const isDev = process.argv.includes('--dev');

const { autoUpdater } = require('electron-updater');
console.log(autoUpdater)


const log = require('electron-log');


class AutoUpdateManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.updateAvailable = false;
    this.updateDownloaded = false;
    this.setupLogging();
    this.configureUpdater();
    this.setupEventHandlers();
  }

  setupLogging() {
    // Configure electron-log for auto-updater
    log.transports.file.level = 'info';
    log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    
    // Set auto-updater logger
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'info';
  }

  configureUpdater() {
    // Configure auto-updater settings
    autoUpdater.checkForUpdatesAndNotify = false; // We'll handle notifications manually
    autoUpdater.autoDownload = false; // Ask user before downloading
    autoUpdater.allowPrerelease = process.env.NODE_ENV === 'development';
    
    // Set update server URL (GitHub releases by default)
    if (process.env.UPDATE_SERVER_URL) {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: process.env.UPDATE_SERVER_URL
      });
    }
    
    log.info('Auto-updater configured');
  }

  setupEventHandlers() {
    // Update available
    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info);
      this.updateAvailable = true;
      this.showUpdateAvailableDialog(info);
    });

    // No update available
    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info);
      this.updateAvailable = false;
    });

    // Update error
    autoUpdater.on('error', (error) => {
      log.error('Update error:', error);
      this.showUpdateErrorDialog(error);
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      log.info(`Download progress: ${percent}%`);
      this.updateDownloadProgress(progressObj);
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info);
      this.updateDownloaded = true;
      this.showUpdateReadyDialog(info);
    });

    // Before quit for update
    autoUpdater.on('before-quit-for-update', () => {
      log.info('Application will quit for update');
    });
  }

  async checkForUpdates(showNoUpdateDialog = false) {
    try {
      log.info('Checking for updates...');
      
      if (process.env.NODE_ENV === 'development') {
        log.info('Skipping update check in development mode');
        if (showNoUpdateDialog) {
          this.showNoUpdateDialog();
        }
        return;
      }

      const result = await autoUpdater.checkForUpdates();
      
      if (!this.updateAvailable && showNoUpdateDialog) {
        this.showNoUpdateDialog();
      }
      
      return result;
    } catch (error) {
      log.error('Error checking for updates:', error);
      if (showNoUpdateDialog) {
        this.showUpdateErrorDialog(error);
      }
    }
  }

  async downloadUpdate() {
    try {
      log.info('Starting update download...');
      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('Error downloading update:', error);
      this.showUpdateErrorDialog(error);
    }
  }

  installUpdate() {
    log.info('Installing update...');
    autoUpdater.quitAndInstall(false, true);
  }

  showUpdateAvailableDialog(updateInfo) {
    const options = {
      type: 'info',
      title: 'Mise à jour disponible',
      message: `Une nouvelle version de ${app.getName()} est disponible!`,
      detail: `Version ${updateInfo.version} est maintenant disponible. Vous avez actuellement la version ${app.getVersion()}.\n\nVoulez-vous télécharger la mise à jour maintenant?`,
      buttons: ['Télécharger maintenant', 'Plus tard', 'Voir les notes de version'],
      defaultId: 0,
      cancelId: 1
    };

    dialog.showMessageBox(this.mainWindow, options).then((result) => {
      if (result.response === 0) {
        // Download now
        this.downloadUpdate();
      } else if (result.response === 2) {
        // Show release notes
        this.showReleaseNotes(updateInfo);
      }
    });
  }

  showUpdateReadyDialog(updateInfo) {
    const options = {
      type: 'info',
      title: 'Mise à jour prête',
      message: 'La mise à jour a été téléchargée avec succès!',
      detail: `La version ${updateInfo.version} est prête à être installée. L'application va redémarrer pour appliquer la mise à jour.`,
      buttons: ['Redémarrer maintenant', 'Plus tard'],
      defaultId: 0,
      cancelId: 1
    };

    dialog.showMessageBox(this.mainWindow, options).then((result) => {
      if (result.response === 0) {
        this.installUpdate();
      }
    });
  }

  showUpdateErrorDialog(error) {
    const options = {
      type: 'error',
      title: 'Erreur de mise à jour',
      message: 'Une erreur est survenue lors de la mise à jour',
      detail: `Erreur: ${error.message}\n\nVeuillez réessayer plus tard ou télécharger manuellement la dernière version depuis le site web.`,
      buttons: ['OK', 'Ouvrir le site web'],
      defaultId: 0
    };

    dialog.showMessageBox(this.mainWindow, options).then((result) => {
      if (result.response === 1) {
        require('electron').shell.openExternal('https://github.com/TotomInc/skid-inc/releases');
      }
    });
  }

  showNoUpdateDialog() {
    const options = {
      type: 'info',
      title: 'Aucune mise à jour',
      message: 'Vous avez déjà la dernière version!',
      detail: `Vous utilisez actuellement la version ${app.getVersion()}, qui est la plus récente disponible.`,
      buttons: ['OK']
    };

    dialog.showMessageBox(this.mainWindow, options);
  }

  showReleaseNotes(updateInfo) {
    // Open release notes in default browser
    const releaseUrl = `https://github.com/TotomInc/skid-inc/releases/tag/v${updateInfo.version}`;
    require('electron').shell.openExternal(releaseUrl);
    
    // Still show the download dialog
    setTimeout(() => {
      this.showUpdateAvailableDialog(updateInfo);
    }, 1000);
  }

  updateDownloadProgress(progressObj) {
    // Send progress to renderer process
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update-download-progress', {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond
      });
    }
  }

  // Schedule automatic update checks
  scheduleUpdateChecks() {
    // Check for updates on startup (after 10 seconds)
    setTimeout(() => {
      this.checkForUpdates(false);
    }, 10000);

    // Check for updates every 4 hours
    setInterval(() => {
      this.checkForUpdates(false);
    }, 4 * 60 * 60 * 1000);

    log.info('Automatic update checks scheduled');
  }

  // Manual update check (called from menu)
  manualUpdateCheck() {
    this.checkForUpdates(true);
  }

  // Get current update status
  getUpdateStatus() {
    return {
      updateAvailable: this.updateAvailable,
      updateDownloaded: this.updateDownloaded,
      currentVersion: app.getVersion()
    };
  }
}

class ElectronApp {
  constructor() {
    this.mainWindow = null;
    this.autoSaveManager = null;
    this.fileSystemManager = null;
    this.migrationManager = null;
    this.startupOptimizer = null;
    this.autoUpdateManager = null;
    this.setupApp();
  }

  setupApp() {
    // Handle app ready event
    app.whenReady().then(async () => {
      const startupStart = Date.now();
      
      try {
        await this.initializeManagers();
        await this.optimizedStartup();
        this.createWindow();
        this.setupMenu();
        this.setupIPC();
        
        const startupTime = Date.now() - startupStart;
        console.log(`Application startup completed in ${startupTime}ms`);
        
        // Check if startup time meets requirements (< 3 seconds)
        if (startupTime > 3000) {
          console.warn(`Startup time ${startupTime}ms exceeds target of 3000ms`);
        }
        
        // Start post-startup optimizations asynchronously
        this.performPostStartupOptimizations();
        
      } catch (error) {
        console.error('Application startup failed:', error.message);
        // Still create window even if optimization fails
        this.createWindow();
        this.setupMenu();
        this.setupIPC();
      }
    });

    // Handle window closed events
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });
  }

  createWindow() {
    // Create the browser window with minimum size requirements
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1024,
      minHeight: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, '..', 'favicon.png'),
      title: 'Skid-Inc - Idle-game for hackers!'
    });

    // Load the index.html file
    this.mainWindow.loadFile('index.html');

    // Open DevTools in development mode
    if (isDev) {
      this.mainWindow.webContents.openDevTools();
    }

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Initialize auto-updater
   // this.initializeAutoUpdater();
  }

  setupMenu() {
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Save Game',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              this.mainWindow.webContents.send('menu-save-game');
            }
          },
          {
            label: 'Load Game',
            accelerator: 'CmdOrCtrl+O',
            click: () => {
              this.mainWindow.webContents.send('menu-load-game');
            }
          },
          { type: 'separator' },
          {
            label: 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      }
    ];

    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      });

      // Window menu
      template[3].submenu = [
        { role: 'close' },
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ];
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  /**
   * Initialize save managers
   */
  async initializeManagers() {
    try {
      // Initialize file system manager
      this.fileSystemManager = new FileSystemManager();
      await this.fileSystemManager.ensureSaveDirectory();
      
      // Initialize auto-save manager
      this.autoSaveManager = new AutoSaveManager();
      
      // Initialize migration manager
      this.migrationManager = new MigrationManager(this.fileSystemManager);
      
      // Initialize startup optimizer
      this.startupOptimizer = new StartupOptimizer(this.fileSystemManager, this.autoSaveManager);
      
      console.log('Save managers initialized successfully');
    } catch (error) {
      console.error('Failed to initialize save managers:', error.message);
      throw error;
    }
  }

  /**
   * Performs optimized startup sequence
   */
  async optimizedStartup() {
    try {
      console.log('Starting optimized startup sequence...');
      
      // Use startup optimizer for optimized loading
      const startupResult = await this.startupOptimizer.startOptimizedStartup();
      
      if (!startupResult.withinTarget) {
        console.warn(`Startup optimization: ${startupResult.totalTime}ms (target: ${startupResult.targetTime}ms)`);
      }
      
      return startupResult;
    } catch (error) {
      console.error('Optimized startup failed:', error.message);
      // Fall back to basic initialization if optimization fails
      return { success: false, error: error.message };
    }
  }

  /**
   * Performs post-startup optimizations asynchronously
   */
  async performPostStartupOptimizations() {
    try {
      // Wait a moment for the window to be fully loaded
      setTimeout(async () => {
        console.log('Starting post-startup optimizations...');
        
        // Check migration status
        await this.checkMigrationOnStartup();
        
        // Preload recent save files in background
        if (this.startupOptimizer) {
          this.startupOptimizer.preloadSaveFiles().catch(error => {
            console.warn('Background save preloading failed:', error.message);
          });
        }
        
        // Perform maintenance tasks
        if (this.startupOptimizer) {
          this.startupOptimizer.performMaintenance().catch(error => {
            console.warn('Startup maintenance failed:', error.message);
          });
        }
        
        console.log('Post-startup optimizations completed');
      }, 1000); // Wait 1 second after startup
      
    } catch (error) {
      console.warn('Post-startup optimizations failed:', error.message);
    }
  }

  setupIPC() {
    // App ready handler
    ipcMain.handle('app-ready', async () => {
      return { success: true, message: 'Electron app is ready' };
    });

    // Save game state handler
    ipcMain.handle('save-game-state', async (event, gameState) => {
      try {
        if (!gameState) {
          throw new Error('Game state is required');
        }

        // Validate game state structure
        this.validateGameState(gameState);

        // Save using auto-save manager
        const result = await this.autoSaveManager.saveGameState(gameState);
        
        // Notify renderer of successful save
        this.mainWindow?.webContents.send('save-status', {
          success: true,
          filename: result.filename,
          timestamp: result.timestamp,
          type: 'manual'
        });

        return {
          success: true,
          filename: result.filename,
          timestamp: result.timestamp,
          message: 'Game state saved successfully'
        };
      } catch (error) {
        console.error('Save game state failed:', error.message);
        
        // Notify renderer of save failure
        this.mainWindow?.webContents.send('save-status', {
          success: false,
          error: error.message,
          type: 'manual'
        });

        return {
          success: false,
          error: error.message,
          message: 'Failed to save game state'
        };
      }
    });

    // Load game state handler
    ipcMain.handle('load-game-state', async (event) => {
      try {
        const result = await this.autoSaveManager.loadGameState();
        
        return {
          success: true,
          gameState: result.data,
          filename: result.filename,
          timestamp: result.timestamp,
          checksum: result.checksum,
          message: 'Game state loaded successfully'
        };
      } catch (error) {
        console.error('Load game state failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to load game state'
        };
      }
    });

    // Get save list handler
    ipcMain.handle('get-save-list', async (event) => {
      try {
        const saveFiles = await this.fileSystemManager.listSaveFiles();
        
        // Format save files for renderer
        const formattedSaves = saveFiles.map(file => ({
          filename: file.filename,
          displayName: this.formatSaveDisplayName(file.filename),
          size: file.size,
          created: file.created,
          modified: file.modified,
          isBackup: file.isBackup,
          formattedSize: this.formatFileSize(file.size),
          formattedDate: this.formatDate(file.modified)
        }));

        return {
          success: true,
          saves: formattedSaves,
          totalCount: formattedSaves.length,
          message: 'Save list retrieved successfully'
        };
      } catch (error) {
        console.error('Get save list failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          saves: [],
          message: 'Failed to retrieve save list'
        };
      }
    });

    // Delete save handler
    ipcMain.handle('delete-save', async (event, filename) => {
      try {
        if (!filename) {
          throw new Error('Filename is required');
        }

        // Validate filename to prevent path traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
          throw new Error('Invalid filename');
        }

        const result = await this.fileSystemManager.deleteSaveFile(filename);
        
        return {
          success: true,
          filename: result.filename,
          deletedSize: result.deletedSize,
          message: 'Save file deleted successfully'
        };
      } catch (error) {
        console.error('Delete save failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to delete save file'
        };
      }
    });

    // Load specific save file handler
    ipcMain.handle('load-specific-save', async (event, filename) => {
      try {
        if (!filename) {
          throw new Error('Filename is required');
        }

        // Validate filename
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
          throw new Error('Invalid filename');
        }

        const result = await this.fileSystemManager.readGameData(filename);
        
        return {
          success: true,
          gameState: result.data,
          filename: result.filename,
          timestamp: result.timestamp,
          checksum: result.checksum,
          message: 'Specific save loaded successfully'
        };
      } catch (error) {
        console.error('Load specific save failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to load specific save'
        };
      }
    });

    // Get save statistics handler
    ipcMain.handle('get-save-statistics', async (event) => {
      try {
        const autoSaveStats = this.autoSaveManager.getStatistics();
        const diskUsage = await this.fileSystemManager.getDiskUsage();
        
        return {
          success: true,
          statistics: {
            ...autoSaveStats,
            ...diskUsage,
            lastSaveTime: autoSaveStats.lastSaveTime,
            autoSaveEnabled: autoSaveStats.isEnabled
          },
          message: 'Statistics retrieved successfully'
        };
      } catch (error) {
        console.error('Get statistics failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to retrieve statistics'
        };
      }
    });

    // Start auto-save handler
    ipcMain.handle('start-auto-save', async (event, options = {}) => {
      try {
        await this.autoSaveManager.startAutoSave(options);
        
        return {
          success: true,
          message: 'Auto-save started successfully'
        };
      } catch (error) {
        console.error('Start auto-save failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to start auto-save'
        };
      }
    });

    // Stop auto-save handler
    ipcMain.handle('stop-auto-save', async (event) => {
      try {
        this.autoSaveManager.stopAutoSave();
        
        return {
          success: true,
          message: 'Auto-save stopped successfully'
        };
      } catch (error) {
        console.error('Stop auto-save failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to stop auto-save'
        };
      }
    });

    // Update auto-save configuration handler
    ipcMain.handle('update-auto-save-config', async (event, config) => {
      try {
        this.autoSaveManager.updateConfiguration(config);
        
        return {
          success: true,
          message: 'Auto-save configuration updated successfully'
        };
      } catch (error) {
        console.error('Update auto-save config failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to update auto-save configuration'
        };
      }
    });

    // Create manual backup handler
    ipcMain.handle('create-manual-backup', async (event, gameState, backupName = null) => {
      try {
        if (!gameState) {
          throw new Error('Game state is required');
        }

        this.validateGameState(gameState);
        
        const result = await this.autoSaveManager.createManualBackup(gameState, backupName);
        
        return {
          success: true,
          filename: result.filename,
          size: result.size,
          timestamp: result.timestamp,
          message: 'Manual backup created successfully'
        };
      } catch (error) {
        console.error('Create manual backup failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to create manual backup'
        };
      }
    });

    // Get backup files handler
    ipcMain.handle('get-backup-files', async (event) => {
      try {
        const backupFiles = await this.autoSaveManager.getBackupFiles();
        
        const formattedBackups = backupFiles.map(file => ({
          filename: file.filename,
          displayName: this.formatBackupDisplayName(file.filename),
          size: file.size,
          created: file.created,
          modified: file.modified,
          formattedSize: this.formatFileSize(file.size),
          formattedDate: this.formatDate(file.modified)
        }));

        return {
          success: true,
          backups: formattedBackups,
          totalCount: formattedBackups.length,
          message: 'Backup list retrieved successfully'
        };
      } catch (error) {
        console.error('Get backup files failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          backups: [],
          message: 'Failed to retrieve backup list'
        };
      }
    });

    // Migration handlers
    
    // Check migration status handler
    ipcMain.handle('check-migration-status', async (event) => {
      try {
        const migrationCompleted = await this.migrationManager.isMigrationCompleted();
        const statistics = await this.migrationManager.getMigrationStatistics();
        
        return {
          success: true,
          migrationCompleted: migrationCompleted,
          statistics: statistics,
          message: 'Migration status retrieved successfully'
        };
      } catch (error) {
        console.error('Check migration status failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          migrationCompleted: false,
          message: 'Failed to check migration status'
        };
      }
    });

    // Import from localStorage handler
    ipcMain.handle('import-from-localstorage', async (event, localStorageData, customFilename = null) => {
      try {
        if (!localStorageData) {
          throw new Error('localStorage data is required');
        }

        // Decode the localStorage data if it's base64 encoded
        let decodedData;
        if (typeof localStorageData === 'string') {
          decodedData = this.migrationManager.decodeLocalStorageData(localStorageData);
        } else {
          decodedData = localStorageData;
        }

        // Perform the migration
        const migrationResult = await this.migrationManager.importFromLocalStorage(decodedData, customFilename);
        
        // Notify renderer of successful migration
        this.mainWindow?.webContents.send('migration-status', {
          type: 'migration-completed',
          success: true,
          result: migrationResult
        });

        return {
          success: true,
          ...migrationResult,
          message: 'localStorage data imported successfully'
        };
      } catch (error) {
        console.error('Import from localStorage failed:', error.message);
        
        // Notify renderer of migration failure
        this.mainWindow?.webContents.send('migration-status', {
          type: 'migration-failed',
          success: false,
          error: error.message
        });

        return {
          success: false,
          error: error.message,
          message: 'Failed to import localStorage data'
        };
      }
    });

    // Get migration statistics handler
    ipcMain.handle('get-migration-statistics', async (event) => {
      try {
        const statistics = await this.migrationManager.getMigrationStatistics();
        
        return {
          success: true,
          statistics: statistics,
          message: 'Migration statistics retrieved successfully'
        };
      } catch (error) {
        console.error('Get migration statistics failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          statistics: {},
          message: 'Failed to retrieve migration statistics'
        };
      }
    });

    // Reset migration status handler (for testing/debugging)
    ipcMain.handle('reset-migration-status', async (event) => {
      try {
        await this.migrationManager.resetMigrationStatus();
        
        return {
          success: true,
          message: 'Migration status reset successfully'
        };
      } catch (error) {
        console.error('Reset migration status failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to reset migration status'
        };
      }
    });

    // Decode localStorage data handler (for validation before import)
    ipcMain.handle('decode-localstorage-data', async (event, encodedData) => {
      try {
        if (!encodedData) {
          throw new Error('Encoded data is required');
        }

        const decodedData = this.migrationManager.decodeLocalStorageData(encodedData);
        
        // Extract basic information for preview
        const preview = {
          version: decodedData.version || 'unknown',
          playerLevel: decodedData.player?.level || 0,
          playerMoney: decodedData.player?.totalMoney || 0,
          playerExp: decodedData.player?.totalExp || 0,
          scriptsCompleted: decodedData.script?.totalCompleted || 0,
          achievementsCount: decodedData.achievements?.owned?.length || 0,
          dataSize: JSON.stringify(decodedData).length
        };

        return {
          success: true,
          preview: preview,
          hasValidData: true,
          message: 'localStorage data decoded successfully'
        };
      } catch (error) {
        console.error('Decode localStorage data failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          hasValidData: false,
          message: 'Failed to decode localStorage data'
        };
      }
    });

    // Setup auto-save event forwarding to renderer
    this.setupAutoSaveEventForwarding();

    // Startup optimization handlers
    this.setupStartupOptimizationHandlers();

    // Auto-updater handlers
    this.setupAutoUpdaterHandlers();

    console.log('IPC handlers configured successfully');
  }

  /**
   * Setup IPC handlers for startup optimization features
   */
  setupStartupOptimizationHandlers() {
    // Get startup statistics handler
    ipcMain.handle('get-startup-statistics', async (event) => {
      try {
        if (!this.startupOptimizer) {
          return {
            success: false,
            error: 'Startup optimizer not initialized',
            message: 'Startup optimizer is not available'
          };
        }

        const statistics = this.startupOptimizer.getStartupStatistics();
        
        return {
          success: true,
          statistics: statistics,
          message: 'Startup statistics retrieved successfully'
        };
      } catch (error) {
        console.error('Get startup statistics failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to retrieve startup statistics'
        };
      }
    });

    // Load save file with optimization handler
    ipcMain.handle('load-save-optimized', async (event, filename) => {
      try {
        if (!filename) {
          throw new Error('Filename is required');
        }

        // Validate filename
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
          throw new Error('Invalid filename');
        }

        let result;
        
        // Use optimized loading if startup optimizer is available
        if (this.startupOptimizer) {
          result = await this.startupOptimizer.loadSaveFileOptimized(filename);
        } else {
          // Fall back to regular loading
          result = await this.fileSystemManager.readGameData(filename);
        }
        
        return {
          success: true,
          gameState: result.data,
          filename: result.filename,
          timestamp: result.timestamp,
          checksum: result.checksum,
          wasPreloaded: result.wasPreloaded || false,
          loadTime: result.loadTime || 0,
          message: 'Save loaded with optimization'
        };
      } catch (error) {
        console.error('Optimized save load failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to load save with optimization'
        };
      }
    });

    // Get preloaded save metadata handler
    ipcMain.handle('get-preloaded-saves', async (event) => {
      try {
        if (!this.startupOptimizer) {
          return {
            success: false,
            error: 'Startup optimizer not initialized',
            preloadedSaves: [],
            message: 'Startup optimizer is not available'
          };
        }

        const preloadedSaves = [];
        
        // Get all preloaded save files
        const saveFiles = await this.fileSystemManager.listSaveFiles();
        
        for (const file of saveFiles) {
          const preloadedMeta = this.startupOptimizer.getPreloadedSaveMetadata(file.filename);
          if (preloadedMeta) {
            preloadedSaves.push({
              filename: file.filename,
              displayName: this.formatSaveDisplayName(file.filename),
              size: file.size,
              modified: file.modified,
              preloaded: true,
              preloadedMetadata: preloadedMeta,
              formattedSize: this.formatFileSize(file.size),
              formattedDate: this.formatDate(file.modified)
            });
          }
        }
        
        return {
          success: true,
          preloadedSaves: preloadedSaves,
          totalPreloaded: preloadedSaves.length,
          message: 'Preloaded saves retrieved successfully'
        };
      } catch (error) {
        console.error('Get preloaded saves failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          preloadedSaves: [],
          message: 'Failed to retrieve preloaded saves'
        };
      }
    });

    // Clear startup caches handler
    ipcMain.handle('clear-startup-caches', async (event) => {
      try {
        if (!this.startupOptimizer) {
          return {
            success: false,
            error: 'Startup optimizer not initialized',
            message: 'Startup optimizer is not available'
          };
        }

        this.startupOptimizer.clearCaches();
        
        return {
          success: true,
          message: 'Startup caches cleared successfully'
        };
      } catch (error) {
        console.error('Clear startup caches failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to clear startup caches'
        };
      }
    });

    // Update startup optimization configuration handler
    ipcMain.handle('update-startup-config', async (event, config) => {
      try {
        if (!this.startupOptimizer) {
          return {
            success: false,
            error: 'Startup optimizer not initialized',
            message: 'Startup optimizer is not available'
          };
        }

        this.startupOptimizer.updateConfiguration(config);
        
        return {
          success: true,
          message: 'Startup configuration updated successfully'
        };
      } catch (error) {
        console.error('Update startup config failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to update startup configuration'
        };
      }
    });

    console.log('Startup optimization IPC handlers configured');
  }

  /**
   * Setup IPC handlers for auto-updater functionality
   */
  setupAutoUpdaterHandlers() {
    // Check for updates manually
    ipcMain.handle('check-for-updates', async (event) => {
      try {
        if (!this.autoUpdateManager) {
          return {
            success: false,
            error: 'Auto-updater not initialized',
            message: 'Auto-updater is not available'
          };
        }

        await this.autoUpdateManager.checkForUpdates(true);
        
        return {
          success: true,
          message: 'Update check completed'
        };
      } catch (error) {
        console.error('Manual update check failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to check for updates'
        };
      }
    });

    // Get update status
    ipcMain.handle('get-update-status', async (event) => {
      try {
        if (!this.autoUpdateManager) {
          return {
            success: false,
            error: 'Auto-updater not initialized',
            status: { updateAvailable: false, updateDownloaded: false, currentVersion: app.getVersion() }
          };
        }

        const status = this.autoUpdateManager.getUpdateStatus();
        
        return {
          success: true,
          status: status,
          message: 'Update status retrieved successfully'
        };
      } catch (error) {
        console.error('Get update status failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          status: { updateAvailable: false, updateDownloaded: false, currentVersion: app.getVersion() },
          message: 'Failed to get update status'
        };
      }
    });

    // Download update
    ipcMain.handle('download-update', async (event) => {
      try {
        if (!this.autoUpdateManager) {
          return {
            success: false,
            error: 'Auto-updater not initialized',
            message: 'Auto-updater is not available'
          };
        }

        await this.autoUpdateManager.downloadUpdate();
        
        return {
          success: true,
          message: 'Update download started'
        };
      } catch (error) {
        console.error('Download update failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to download update'
        };
      }
    });

    // Install update
    ipcMain.handle('install-update', async (event) => {
      try {
        if (!this.autoUpdateManager) {
          return {
            success: false,
            error: 'Auto-updater not initialized',
            message: 'Auto-updater is not available'
          };
        }

        this.autoUpdateManager.installUpdate();
        
        return {
          success: true,
          message: 'Update installation started - app will restart'
        };
      } catch (error) {
        console.error('Install update failed:', error.message);
        
        return {
          success: false,
          error: error.message,
          message: 'Failed to install update'
        };
      }
    });

    console.log('Auto-updater IPC handlers configured');
  }

  /**
   * Setup event forwarding from auto-save manager to renderer process
   */
  setupAutoSaveEventForwarding() {
    if (!this.autoSaveManager) return;

    // Forward auto-save events to renderer
    this.autoSaveManager.on('save-success', (data) => {
      this.mainWindow?.webContents.send('auto-save-event', {
        type: 'save-success',
        data: data
      });
    });

    this.autoSaveManager.on('save-failed', (data) => {
      this.mainWindow?.webContents.send('auto-save-event', {
        type: 'save-failed',
        data: data
      });
    });

    this.autoSaveManager.on('save-retry', (data) => {
      this.mainWindow?.webContents.send('auto-save-event', {
        type: 'save-retry',
        data: data
      });
    });

    this.autoSaveManager.on('backup-created', (data) => {
      this.mainWindow?.webContents.send('auto-save-event', {
        type: 'backup-created',
        data: data
      });
    });

    this.autoSaveManager.on('backup-cleanup', (data) => {
      this.mainWindow?.webContents.send('auto-save-event', {
        type: 'backup-cleanup',
        data: data
      });
    });

    this.autoSaveManager.on('auto-save-error', (data) => {
      this.mainWindow?.webContents.send('auto-save-event', {
        type: 'auto-save-error',
        data: data
      });
    });
  }

  /**
   * Validates game state structure
   * @param {Object} gameState - Game state to validate
   * @throws {Error} If validation fails
   */
  validateGameState(gameState) {
    if (!gameState || typeof gameState !== 'object') {
      throw new Error('Game state must be a valid object');
    }

    // Check for required top-level properties
    const requiredProps = ['player', 'script', 'server', 'battery'];
    for (const prop of requiredProps) {
      if (!gameState.hasOwnProperty(prop)) {
        throw new Error(`Game state missing required property: ${prop}`);
      }
    }

    // Validate player object
    if (!gameState.player || typeof gameState.player !== 'object') {
      throw new Error('Game state player must be a valid object');
    }

    // Validate critical player properties
    const playerProps = ['username', 'money', 'exp', 'level'];
    for (const prop of playerProps) {
      if (!gameState.player.hasOwnProperty(prop)) {
        throw new Error(`Player object missing required property: ${prop}`);
      }
    }
  }

  /**
   * Formats save file display name
   * @param {string} filename - Original filename
   * @returns {string} Formatted display name
   */
  formatSaveDisplayName(filename) {
    // Remove file extension and format timestamp
    const nameWithoutExt = filename.replace('.json', '');
    const parts = nameWithoutExt.split('_');
    
    if (parts.length >= 2) {
      const saveType = parts[0];
      const timestamp = parts.slice(1).join('_');
      
      try {
        const date = new Date(timestamp.replace(/-/g, ':'));
        return `${saveType.charAt(0).toUpperCase() + saveType.slice(1)} - ${this.formatDate(date)}`;
      } catch (error) {
        return nameWithoutExt;
      }
    }
    
    return nameWithoutExt;
  }

  /**
   * Formats backup file display name
   * @param {string} filename - Original filename
   * @returns {string} Formatted display name
   */
  formatBackupDisplayName(filename) {
    const nameWithoutExt = filename.replace('.json', '');
    
    if (nameWithoutExt.includes('backup_manual_')) {
      const parts = nameWithoutExt.split('_');
      const customName = parts.slice(2, -1).join('_');
      return `Manual Backup${customName ? ` - ${customName}` : ''}`;
    } else if (nameWithoutExt.startsWith('backup_')) {
      return 'Auto Backup';
    }
    
    return nameWithoutExt;
  }

  /**
   * Formats file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size string
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Formats date for display
   * @param {Date} date - Date to format
   * @returns {string} Formatted date string
   */
  formatDate(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    
    return date.toLocaleString();
  }

  /**
   * Initialize auto-updater system
   */
  initializeAutoUpdater() {
    try {
      if (!this.mainWindow) {
        console.warn('Cannot initialize auto-updater: main window not available');
        return;
      }

      // Initialize auto-updater
   //   this.autoUpdateManager = new AutoUpdateManager(this.mainWindow);
      
      // Schedule automatic update checks
  //    this.autoUpdateManager.scheduleUpdateChecks();
      
      console.log('Auto-updater initialized successfully');
    } catch (error) {
      console.error('Failed to initialize auto-updater:', error.message);
      // Don't throw error - auto-updater is not critical for app functionality
    }
  }

  /**
   * Check migration status on startup and notify renderer if needed
   */
  async checkMigrationOnStartup() {
    try {
      // Wait a moment for the window to be fully loaded
      setTimeout(async () => {
        const migrationCompleted = await this.migrationManager.isMigrationCompleted();
        
        if (!migrationCompleted) {
          console.log('Migration not completed, renderer will check for localStorage data');
          
          // Send migration prompt to renderer - it will handle localStorage detection
          this.mainWindow?.webContents.send('migration-prompt', {
            type: 'startup-check',
            migrationCompleted: false,
            message: 'Check for localStorage data to migrate'
          });
        } else {
          console.log('Migration already completed');
        }
      }, 3000); // Wait 3 seconds for the game to load
    } catch (error) {
      console.error('Error checking migration on startup:', error);
    }
  }
}

// Create the Electron app instance
new ElectronApp();
