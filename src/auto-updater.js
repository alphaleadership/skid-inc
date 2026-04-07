const { app, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

const isDev = process.argv.includes('--dev');

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
    // Checking for updates
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for update...');
      this.forwardEvent('update-checking');
    });

    // Update available
    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info);
      this.updateAvailable = true;
      this.forwardEvent('update-available', info);
      this.showUpdateAvailableDialog(info);
    });

    // No update available
    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info);
      this.updateAvailable = false;
      this.forwardEvent('update-not-available', info);
    });

    // Update error
    autoUpdater.on('error', (error) => {
      log.error('Update error:', error);
      this.forwardEvent('update-error', { message: error.message });
      // We don't always show a dialog for errors unless it's a manual check
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
      this.forwardEvent('update-downloaded', info);
      this.showUpdateReadyDialog(info);
    });

    // Before quit for update
    autoUpdater.on('before-quit-for-update', () => {
      log.info('Application will quit for update');
    });
  }

  forwardEvent(channel, data = null) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  async checkForUpdates(showNoUpdateDialog = false) {
    try {
      log.info('Checking for updates...');
      
      if (isDev) {
        log.info('Skipping update check in development mode');
        if (showNoUpdateDialog) {
          this.showNoUpdateDialog();
        }
        return { success: false, message: 'Dev mode' };
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
      return { success: false, error: error.message };
    }
  }

  async downloadUpdate() {
    try {
      log.info('Starting update download...');
      this.forwardEvent('update-downloading');
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
        this.downloadUpdate();
      } else if (result.response === 2) {
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
    const releaseUrl = `https://github.com/alphaleadership/skid-inc/releases/tag/v${updateInfo.version}`;
    require('electron').shell.openExternal(releaseUrl);
    
    setTimeout(() => {
      this.showUpdateAvailableDialog(updateInfo);
    }, 1000);
  }

  updateDownloadProgress(progressObj) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update-download-progress', {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond
      });
    }
  }

  scheduleUpdateChecks() {
    setTimeout(() => {
      this.checkForUpdates(false);
    }, 10000);

    setInterval(() => {
      this.checkForUpdates(false);
    }, 4 * 60 * 60 * 1000);

    log.info('Automatic update checks scheduled');
  }

  manualUpdateCheck() {
    return this.checkForUpdates(true);
  }

  getUpdateStatus() {
    return {
      updateAvailable: this.updateAvailable,
      updateDownloaded: this.updateDownloaded,
      currentVersion: app.getVersion()
    };
  }
}

module.exports = AutoUpdateManager;
