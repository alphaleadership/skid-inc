const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const LogRocket = require('logrocket');
const fsModule = require('fs');
const fs = fsModule.promises;
const path = require('path');
const AutoSaveManager = require('./auto-save-manager');
const FileSystemManager = require('./filesystem-manager');
const MigrationManager = require('./migration-manager');
const StartupOptimizer = require('./startup-optimizer');
const ModLoader = require('./modding/mod-loader');


LogRocket.init('kw8sds/skidinc');

function reportErrorToLogRocket(error, context = {}) {
  if (typeof LogRocket.captureException !== 'function') {
    return;
  }

  const normalizedError = error instanceof Error ? error : new Error(String(error));
  LogRocket.captureException(normalizedError, {
    tags: { process: 'main' },
    extra: context
  });
}

process.on('uncaughtException', (error) => {
  reportErrorToLogRocket(error, { type: 'uncaughtException' });
});

process.on('unhandledRejection', (reason) => {
  reportErrorToLogRocket(reason, { type: 'unhandledRejection' });
});

const isDev = process.argv.includes('--dev');
const isSafeStart = process.argv.includes('--safe-start') || process.argv.includes('--disable-mods');

// Import electron-updater only if not in development mode
let autoUpdater;
if (!isDev) {
  autoUpdater = require('electron-updater').autoUpdater;
  console.log('Auto-updater initialized');
} else {
  console.log('Auto-updater disabled in development mode');
}

const log = require('electron-log');

class AutoUpdateManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.updateAvailable = false;
    this.updateDownloaded = false;
    if (!isDev) {
      this.setupLogging();
      this.configureUpdater();
      this.setupEventHandlers();
    }
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
    autoUpdater.autoDownload = false; // Ask user before downloading
    autoUpdater.allowPrerelease = process.env.NODE_ENV === 'development';
    
    // Use custom update server when provided, otherwise rely on publish config
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
      
      if (isDev) {
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
        require('electron').shell.openExternal('https://github.com/alphaleadership/skid-inc/releases');
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
    const releaseUrl = `https://github.com/alphaleadership/skid-inc/releases/tag/v${updateInfo.version}`;
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
    this.modErrors = [];
    this.modLoader = null;
    this.gameVersion = this.readGameVersionFromSource();
    this.setupApp();
  }

  readGameVersionFromSource() {
    try {
      const corePath = path.join(__dirname, '..', 'app', 'js', 'core.js');
      const source = fsModule.readFileSync(corePath, 'utf8');
      const match = source.match(/skidinc\.version\s*=\s*([0-9]+(?:\.[0-9]+)?)/);

      if (!match) {
        throw new Error('Unable to find skidinc.version assignment in app/js/core.js');
      }

      return `${match[1]}`;
    } catch (error) {
      console.warn(`Failed to detect game version from source, using fallback: ${error.message}`);
      return '0.0.0';
    }
  }

  createSuccessResponse(data = null) {
    return {
      success: true,
      data,
      error: null,
      code: null
    };
  }

  createErrorResponse(error, code = 'INTERNAL_ERROR') {
    return {
      success: false,
      data: null,
      error: error?.message || String(error),
      code
    };
  }

  getModsDirectory() {
    return path.join(app.getPath('userData'), 'mods');
  }

  getModsStatePath() {
    return path.join(this.getModsDirectory(), 'mods-state.json');
  }

  async ensureModsDirectory() {
    await fs.mkdir(this.getModsDirectory(), { recursive: true });
  }

  validateModId(modId) {
    if (typeof modId !== 'string' || !modId.trim()) {
      throw new Error('modId must be a non-empty string');
    }

    if (modId.includes('/') || modId.includes('\\') || modId.includes('..')) {
      throw new Error('modId contains invalid path characters');
    }

    return modId.trim();
  }

  async readModsState() {
    try {
      const raw = await fs.readFile(this.getModsStatePath(), 'utf8');
      const state = JSON.parse(raw);
      return (state && typeof state === 'object') ? state : {};
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {};
      }

      throw error;
    }
  }

  async writeModsState(state) {
    await fs.writeFile(this.getModsStatePath(), JSON.stringify(state, null, 2), 'utf8');
  }

  async listMods() {
    await this.ensureModsDirectory();
    const entries = await fs.readdir(this.getModsDirectory(), { withFileTypes: true });
    const state = await this.readModsState();

    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => ({
        modId: entry.name,
        enabled: state[entry.name] !== false
      }))
      .sort((a, b) => a.modId.localeCompare(b.modId));
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
        await this.initializeModLoader();
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
        await this.initializeModLoader();
        this.setupIPC();
      }
    });

    // Handle window closed events
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    let isQuitting = false;
    app.on('before-quit', async (event) => {
      if (isQuitting) return;
      if (this.modLoader) {
        event.preventDefault();
        isQuitting = true;
        try {
          await this.modLoader.unloadAllMods();
        } catch (error) {
          console.error('Error unloading mods:', error.message);
        }
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });
  }

  async initializeModLoader() {
    try {
      this.modLoader = new ModLoader({
        appVersion: app.getVersion(),
        gameVersion: this.gameVersion,
        safeStart: isSafeStart
      });
      const state = await this.modLoader.initialize();
      const safeStartMessage = isSafeStart ? ' (safe-start mode active)' : '';
      console.log(`Mod loader initialized with ${state.mods.length} mod(s)${safeStartMessage}`);
    } catch (error) {
      console.error('Failed to initialize mod loader:', error.message);
    }
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
    if (!isDev) {
      this.autoUpdateManager = new AutoUpdateManager(this.mainWindow);
      this.autoUpdateManager.scheduleUpdateChecks();
    }
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

    this.setupModsIPCHandlers();

    // Setup auto-save event forwarding to renderer
    this.setupAutoSaveEventForwarding();

    // Startup optimization handlers
    this.setupStartupOptimizationHandlers();

    // Auto-updater handlers
    this.setupAutoUpdaterHandlers();

    console.log('IPC handlers configured successfully');
  }

  setupModsIPCHandlers() {
    ipcMain.handle('mods-list', async () => {
      try {
        const mods = await this.listMods();
        return this.createSuccessResponse({ mods });
      } catch (error) {
        this.modErrors.push({ action: 'mods-list', error: error.message, timestamp: Date.now() });
        return this.createErrorResponse(error, 'MODS_LIST_FAILED');
      }
    });

    ipcMain.handle('mods-enable', async (event, modId) => {
      try {
        const normalizedModId = this.validateModId(modId);
        await this.ensureModsDirectory();
        const modPath = path.join(this.getModsDirectory(), normalizedModId);
        const stats = await fs.stat(modPath);

        if (!stats.isDirectory()) {
          throw new Error(`Mod "${normalizedModId}" is not a directory`);
        }

        const state = await this.readModsState();
        state[normalizedModId] = true;
        await this.writeModsState(state);

        return this.createSuccessResponse({ modId: normalizedModId, enabled: true });
      } catch (error) {
        this.modErrors.push({ action: 'mods-enable', modId, error: error.message, timestamp: Date.now() });
        const code = error.code === 'ENOENT' ? 'MOD_NOT_FOUND' : 'MOD_ENABLE_FAILED';
        return this.createErrorResponse(error, code);
      }
    });

    ipcMain.handle('mods-disable', async (event, modId) => {
      try {
        const normalizedModId = this.validateModId(modId);
        const state = await this.readModsState();
        state[normalizedModId] = false;
        await this.writeModsState(state);

        return this.createSuccessResponse({ modId: normalizedModId, enabled: false });
      } catch (error) {
        this.modErrors.push({ action: 'mods-disable', modId, error: error.message, timestamp: Date.now() });
        return this.createErrorResponse(error, 'MOD_DISABLE_FAILED');
      }
    });

    ipcMain.handle('mods-reload', async () => {
      try {
        const mods = await this.listMods();
        return this.createSuccessResponse({
          reloadedAt: Date.now(),
          totalMods: mods.length,
          enabledMods: mods.filter((mod) => mod.enabled).length
        });
      } catch (error) {
        this.modErrors.push({ action: 'mods-reload', error: error.message, timestamp: Date.now() });
        return this.createErrorResponse(error, 'MODS_RELOAD_FAILED');
      }
    });

    ipcMain.handle('mods-get-errors', async () => {
      try {
        return this.createSuccessResponse({ errors: [...this.modErrors] });
      } catch (error) {
        return this.createErrorResponse(error, 'MODS_GET_ERRORS_FAILED');
      }
    });

    ipcMain.handle('mods-open-directory', async () => {
      try {
        await this.ensureModsDirectory();
        const modsDirectory = this.getModsDirectory();
        const openResult = await shell.openPath(modsDirectory);

        if (openResult) {
          throw new Error(openResult);
        }

        return this.createSuccessResponse({ path: modsDirectory });
      } catch (error) {
        this.modErrors.push({ action: 'mods-open-directory', error: error.message, timestamp: Date.now() });
        return this.createErrorResponse(error, 'MODS_OPEN_DIRECTORY_FAILED');
      }
    });
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
            });
          }
        }

        return {
          success: true,
          preloadedSaves: preloadedSaves,
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

    // Setup auto-save event forwarding to renderer
    this.setupAutoSaveEventForwarding();

    // Auto-updater handlers
    this.setupAutoUpdaterHandlers();

    console.log('IPC handlers configured successfully');
  }

  /**
   * Setup IPC handlers for auto-updater features
   */
  setupAutoUpdaterHandlers() {
    if (!isDev && this.autoUpdateManager) {
      // Check for updates handler
      ipcMain.handle('check-for-updates', async (event) => {
        return this.autoUpdateManager.checkForUpdates(true);
      });

      // Download update handler
      ipcMain.handle('download-update', async (event) => {
        return this.autoUpdateManager.downloadUpdate();
      });

      // Install update handler
      ipcMain.handle('install-update', async (event) => {
        this.autoUpdateManager.installUpdate();
        return { success: true };
      });

      // Get update status handler
      ipcMain.handle('get-update-status', async (event) => {
        return this.autoUpdateManager.getUpdateStatus();
      });
    }
  }

  /**
   * Setup event forwarding for auto-save events
   */
  setupAutoSaveEventForwarding() {
    if (this.autoSaveManager) {
      this.autoSaveManager.on('save-started', (info) => {
        this.mainWindow?.webContents.send('auto-save-status', {
          type: 'save-started',
          ...info
        });
      });

      this.autoSaveManager.on('save-completed', (info) => {
        this.mainWindow?.webContents.send('auto-save-status', {
          type: 'save-completed',
          ...info
        });
      });

      this.autoSaveManager.on('save-error', (error) => {
        this.mainWindow?.webContents.send('auto-save-status', {
          type: 'save-error',
          error: error.message
        });
      });
    }
  }

  /**
   * Check migration status on startup
   */
  async checkMigrationOnStartup() {
    try {
      const migrationCompleted = await this.migrationManager.isMigrationCompleted();
      
      if (!migrationCompleted) {
        // Notify renderer that migration is needed
        this.mainWindow?.webContents.send('migration-status', {
          type: 'migration-needed',
          migrationCompleted: false
        });
      }
    } catch (error) {
      console.error('Migration check on startup failed:', error.message);
    }
  }

  /**
   * Format save display name
   */
  formatSaveDisplayName(filename) {
    // Remove timestamp and extension for display
    return filename.replace(/^\d+_/, '').replace(/.json$/, '');
  }

  /**
   * Format backup display name
   */
  formatBackupDisplayName(filename) {
    // Remove backup prefix and extension for display
    return filename.replace(/^backup_/, '').replace(/.json$/, '');
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Format date for display
   */
  formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  /**
   * Validate game state structure
   */
  validateGameState(gameState) {
    if (!gameState || typeof gameState !== 'object') {
      throw new Error('Invalid game state: must be an object');
    }

    // Add more validation as needed
    return true;
  }
}

// Start the application
new ElectronApp();
