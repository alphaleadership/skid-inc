/**
 * UpdateUIManager - Handles the user interface for application updates
 * Connects the auto-updater events to the renderer UI
 */
class UpdateUIManager {
  constructor(notificationManager) {
    this.notificationManager = notificationManager;
    this.isElectron = !!window.electronAPI;
    this.updateInProgress = false;
    this.downloadProgressNotificationId = null;

    if (this.isElectron) {
      this.setupEventListeners();
    }
  }

  /**
   * Setup event listeners for auto-updater events
   */
  setupEventListeners() {
    // Update checking
    window.electronAPI.onUpdateChecking(() => {
      console.log('Checking for updates...');
    });

    // Update available
    window.electronAPI.onUpdateAvailable((info) => {
      this.notificationManager.showNotification(
        `Update Available: v${info.version}`,
        'info',
        10000,
        {
          actions: [
            {
              text: 'Download',
              action: () => this.downloadUpdate()
            }
          ]
        }
      );
    });

    // Update not available
    window.electronAPI.onUpdateNotAvailable(() => {
      console.log('Application is up to date');
    });

    // Update downloading
    window.electronAPI.onUpdateDownloading(() => {
      this.updateInProgress = true;
      this.downloadProgressNotificationId = this.notificationManager.showNotification(
        'Downloading update...',
        'info',
        0,
        { persistent: true }
      );
    });

    // Update download progress
    window.electronAPI.onUpdateDownloadProgress((progress) => {
      if (this.downloadProgressNotificationId) {
        // We could update the message if our notification manager supported it
        // For now, we just log it or we could replace the notification
        console.log(`Download progress: ${progress.percent}%`);
      }
    });

    // Update downloaded
    window.electronAPI.onUpdateDownloaded((info) => {
      this.updateInProgress = false;
      
      // Remove progress notification if exists
      if (this.downloadProgressNotificationId) {
        this.notificationManager.removeNotification(this.downloadProgressNotificationId);
        this.downloadProgressNotificationId = null;
      }

      this.notificationManager.showNotification(
        `Update v${info.version} ready to install`,
        'success',
        0,
        {
          persistent: true,
          actions: [
            {
              text: 'Restart & Install',
              action: () => this.installUpdate()
            },
            {
              text: 'Later',
              action: () => {}
            }
          ]
        }
      );
    });

    // Update error
    window.electronAPI.onUpdateError((error) => {
      this.updateInProgress = false;
      
      if (this.downloadProgressNotificationId) {
        this.notificationManager.removeNotification(this.downloadProgressNotificationId);
        this.downloadProgressNotificationId = null;
      }

      this.notificationManager.showNotification(
        `Update error: ${error.message}`,
        'error',
        5000
      );
    });
  }

  /**
   * Manually check for updates
   */
  async checkForUpdates() {
    if (!this.isElectron) return;
    try {
      this.notificationManager.showNotification('Checking for updates...', 'info', 2000);
      await window.electronAPI.checkForUpdates();
    } catch (error) {
      console.error('Manual update check failed:', error);
    }
  }

  /**
   * Start downloading the update
   */
  async downloadUpdate() {
    if (!this.isElectron) return;
    try {
      await window.electronAPI.downloadUpdate();
    } catch (error) {
      console.error('Failed to start download:', error);
    }
  }

  /**
   * Install the downloaded update and restart
   */
  installUpdate() {
    if (!this.isElectron) return;
    window.electronAPI.installUpdate();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UpdateUIManager;
}

window.UpdateUIManager = UpdateUIManager;
