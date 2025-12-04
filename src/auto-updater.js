#!/usr/bin/env node

/**
 * Auto-Update System for Skid-Inc
 * Handles automatic updates using electron-updater
 */

const { autoUpdater } = require('../up.js');
const { app, dialog, BrowserWindow } = require('electron');
const log = require('electron-log');
const path = require('path');

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

module.exports = AutoUpdateManager;