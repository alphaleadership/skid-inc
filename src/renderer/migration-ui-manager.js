/**
 * MigrationUIManager - Handles the user interface for localStorage migration
 * Manages migration prompts, progress, and user interactions
 */
class MigrationUIManager {
  constructor() {
    this.isElectron = typeof window.electronAPI !== 'undefined';
    this.migrationModal = null;
    this.migrationInProgress = false;
    this.localStorageKey = 'SKINC'; // Key used by the original game

    this.initializeEventListeners();
  }

  /**
   * Initialize event listeners for migration events
   */
  initializeEventListeners() {
    if (!this.isElectron) {
      console.log('Migration UI not available in web mode');
      return;
    }

    // Listen for migration status events
    window.electronAPI.onMigrationStatus((event, status) => {
      this.handleMigrationStatus(status);
    });

    console.log('Migration UI Manager initialized');
  }

  /**
   * Check for localStorage data and prompt migration on startup
   */
  async checkAndPromptMigration() {
    if (!this.isElectron) {
      return;
    }

    try {
      // Check if migration has already been completed
      const migrationStatus = await window.electronAPI.checkMigrationStatus();

      if (migrationStatus.success && migrationStatus.migrationCompleted) {
        console.log('Migration already completed, skipping check');
        return;
      }

      // Check for localStorage data
      const localStorageData = this.detectLocalStorageData();

      if (localStorageData.found) {
        console.log('localStorage data detected, prompting migration');
        await this.showMigrationPrompt(localStorageData);
      } else {
        console.log('No localStorage data found for migration');
      }
    } catch (error) {
      console.error('Error checking migration status:', error);
    }
  }

  /**
   * Detect localStorage data that can be migrated
   * @returns {Object} Detection result
   */
  detectLocalStorageData() {
    try {
      const localStorageData = localStorage.getItem(this.localStorageKey);

      if (!localStorageData) {
        return {
          found: false,
          reason: 'No localStorage data found'
        };
      }

      // Try to decode and validate the data
      try {
        // The original game uses base64 encoding, so we need to decode it
        const decodedData = this.decodeLocalStorageData(localStorageData);

        return {
          found: true,
          dataSize: localStorageData.length,
          gameVersion: decodedData.version || 'unknown',
          playerLevel: decodedData.player?.level || 0,
          playerMoney: decodedData.player?.totalMoney || 0,
          lastSave: Date.now(), // We don't have this info in localStorage
          encodedData: localStorageData
        };
      } catch (decodeError) {
        console.warn('Failed to decode localStorage data:', decodeError.message);
        return {
          found: true,
          dataSize: localStorageData.length,
          gameVersion: 'unknown',
          playerLevel: 0,
          playerMoney: 0,
          lastSave: null,
          encodedData: localStorageData,
          decodeError: decodeError.message
        };
      }
    } catch (error) {
      console.error('Error detecting localStorage data:', error);
      return {
        found: false,
        error: error.message,
        reason: 'Error during detection'
      };
    }
  }

  /**
   * Decode localStorage data using the same method as the original game
   * @param {string} encodedData - Base64 encoded data
   * @returns {Object} Decoded game data
   */
  decodeLocalStorageData(encodedData) {
    try {
      // Custom base64 decode function matching the original game
      const decodedString = decodeURIComponent(
        atob(encodedData)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );

      return JSON.parse(decodedString);
    } catch (error) {
      throw new Error(`Failed to decode localStorage data: ${error.message}`);
    }
  }

  /**
   * Show migration prompt to user
   * @param {Object} localStorageData - Detected localStorage data
   */
  async showMigrationPrompt(localStorageData) {
    return new Promise((resolve) => {
      this.createMigrationModal(localStorageData, resolve);
    });
  }

  /**
   * Create and display migration modal
   * @param {Object} localStorageData - Detected localStorage data
   * @param {Function} resolve - Promise resolve function
   */
  createMigrationModal(localStorageData, resolve) {
    // Remove existing modal if present
    this.removeMigrationModal();

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'migration-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Ubuntu Mono', monospace;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'migration-modal';
    modal.style.cssText = `
      background-color: #1a1a1a;
      color: #00ff00;
      border: 2px solid #00ff00;
      border-radius: 8px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
      text-align: center;
    `;

    // Create modal content HTML
    modal.innerHTML = `
      <div class="migration-header">
        <h2 style="margin: 0 0 20px 0; color: #00ff00; font-size: 24px;">
          🔄 Data Migration Available
        </h2>
      </div>
      
      <div class="migration-content">
        <p style="margin: 0 0 15px 0; font-size: 16px; line-height: 1.5;">
          Previous game data has been detected in your browser's localStorage.
        </p>
        
        <div class="migration-details" style="background-color: #2a2a2a; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: left;">
          <h3 style="margin: 0 0 10px 0; color: #ffff00; font-size: 16px;">Data Preview:</h3>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li>Game Version: ${localStorageData.gameVersion || 'Unknown'}</li>
            <li>Player Level: ${localStorageData.playerLevel || 0}</li>
            <li>Total Money: $${this.formatNumber(localStorageData.playerMoney || 0)}</li>
            <li>Data Size: ${this.formatBytes(localStorageData.dataSize || 0)}</li>
          </ul>
        </div>
        
        <p style="margin: 15px 0; font-size: 14px; color: #cccccc;">
          Would you like to migrate this data to the new file-based save system?
          This will preserve your progress and create a backup of the original data.
        </p>
        
        <div class="migration-warning" style="background-color: #3a2a00; border: 1px solid #ffaa00; padding: 10px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 0; font-size: 12px; color: #ffaa00;">
            ⚠️ This process is safe and creates backups, but it's recommended to export your save manually as an additional precaution.
          </p>
        </div>
      </div>
      
      <div class="migration-actions" style="margin-top: 25px;">
        <button id="migrate-accept" style="
          background-color: #00aa00;
          color: white;
          border: none;
          padding: 12px 24px;
          margin: 0 10px;
          border-radius: 5px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          font-family: inherit;
        ">
          ✅ Migrate Data
        </button>
        
        <button id="migrate-decline" style="
          background-color: #aa0000;
          color: white;
          border: none;
          padding: 12px 24px;
          margin: 0 10px;
          border-radius: 5px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          font-family: inherit;
        ">
          ❌ Skip Migration
        </button>
      </div>
      
      <div class="migration-progress" id="migration-progress" style="display: none; margin-top: 20px;">
        <div style="background-color: #333; height: 20px; border-radius: 10px; overflow: hidden;">
          <div id="migration-progress-bar" style="
            background-color: #00ff00;
            height: 100%;
            width: 0%;
            transition: width 0.3s ease;
          "></div>
        </div>
        <p id="migration-status" style="margin: 10px 0 0 0; font-size: 14px;">
          Preparing migration...
        </p>
      </div>
    `;

    // Add event listeners
    const acceptButton = modal.querySelector('#migrate-accept');
    const declineButton = modal.querySelector('#migrate-decline');

    acceptButton.addEventListener('click', () => {
      this.startMigration(localStorageData, resolve);
    });

    declineButton.addEventListener('click', () => {
      this.declineMigration(resolve);
    });

    // Add hover effects
    [acceptButton, declineButton].forEach(button => {
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.05)';
        button.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.3)';
      });

      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = 'none';
      });
    });

    // Assemble and show modal
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.migrationModal = overlay;

    // Animate in
    overlay.style.opacity = '0';
    modal.style.transform = 'scale(0.8)';

    requestAnimationFrame(() => {
      overlay.style.transition = 'opacity 0.3s ease';
      modal.style.transition = 'transform 0.3s ease';
      overlay.style.opacity = '1';
      modal.style.transform = 'scale(1)';
    });
  }

  /**
   * Start the migration process
   * @param {Object} localStorageData - localStorage data to migrate
   * @param {Function} resolve - Promise resolve function
   */
  async startMigration(localStorageData, resolve) {
    if (this.migrationInProgress) {
      return;
    }

    this.migrationInProgress = true;

    try {
      // Show progress UI
      this.showMigrationProgress();

      // Update progress
      this.updateMigrationProgress(10, 'Validating localStorage data...');

      // Validate data with main process
      const validationResult = await window.electronAPI.decodeLocalStorageData(localStorageData.encodedData);

      if (!validationResult.success) {
        throw new Error(`Data validation failed: ${validationResult.error}`);
      }

      this.updateMigrationProgress(30, 'Starting migration process...');

      // Perform migration
      const migrationResult = await window.electronAPI.importFromLocalStorage(localStorageData.encodedData);

      if (!migrationResult.success) {
        throw new Error(`Migration failed: ${migrationResult.error}`);
      }

      this.updateMigrationProgress(80, 'Finalizing migration...');

      // Show success
      this.updateMigrationProgress(100, 'Migration completed successfully!');

      // Show success notification
      if (window.notificationManager) {
        window.notificationManager.showNotification(
          `Migration completed! Saved as: ${migrationResult.filename}`,
          'success',
          5000
        );
      }

      // Wait a moment then close
      setTimeout(() => {
        this.removeMigrationModal();
        resolve({ migrated: true, result: migrationResult });
      }, 2000);

    } catch (error) {
      console.error('Migration failed:', error);

      this.updateMigrationProgress(0, `Migration failed: ${error.message}`, true);

      if (window.notificationManager) {
        window.notificationManager.showNotification(
          `Migration failed: ${error.message}`,
          'error',
          5000
        );
      }

      // Show retry option
      setTimeout(() => {
        this.showMigrationRetry(localStorageData, resolve, error);
      }, 2000);
    }

    this.migrationInProgress = false;
  }

  /**
   * Show migration progress UI
   */
  showMigrationProgress() {
    if (!this.migrationModal) return;

    const actionsDiv = this.migrationModal.querySelector('.migration-actions');
    const progressDiv = this.migrationModal.querySelector('#migration-progress');

    if (actionsDiv) actionsDiv.style.display = 'none';
    if (progressDiv) progressDiv.style.display = 'block';
  }

  /**
   * Update migration progress
   * @param {number} percentage - Progress percentage (0-100)
   * @param {string} status - Status message
   * @param {boolean} isError - Whether this is an error state
   */
  updateMigrationProgress(percentage, status, isError = false) {
    if (!this.migrationModal) return;

    const progressBar = this.migrationModal.querySelector('#migration-progress-bar');
    const statusText = this.migrationModal.querySelector('#migration-status');

    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
      progressBar.style.backgroundColor = isError ? '#ff0000' : '#00ff00';
    }

    if (statusText) {
      statusText.textContent = status;
      statusText.style.color = isError ? '#ff0000' : '#00ff00';
    }
  }

  /**
   * Show migration retry option
   * @param {Object} localStorageData - Original localStorage data
   * @param {Function} resolve - Promise resolve function
   * @param {Error} error - Previous error
   */
  showMigrationRetry(localStorageData, resolve, error) {
    if (!this.migrationModal) return;

    const progressDiv = this.migrationModal.querySelector('#migration-progress');

    if (progressDiv) {
      progressDiv.innerHTML = `
        <div style="text-align: center; margin-top: 20px;">
          <p style="color: #ff0000; margin: 0 0 15px 0;">
            Migration failed: ${error.message}
          </p>
          <button id="retry-migration" style="
            background-color: #ffaa00;
            color: black;
            border: none;
            padding: 10px 20px;
            margin: 0 10px;
            border-radius: 5px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            font-family: inherit;
          ">
            🔄 Retry Migration
          </button>
          <button id="skip-migration" style="
            background-color: #666;
            color: white;
            border: none;
            padding: 10px 20px;
            margin: 0 10px;
            border-radius: 5px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            font-family: inherit;
          ">
            Skip for Now
          </button>
        </div>
      `;

      const retryButton = progressDiv.querySelector('#retry-migration');
      const skipButton = progressDiv.querySelector('#skip-migration');

      retryButton.addEventListener('click', () => {
        this.startMigration(localStorageData, resolve);
      });

      skipButton.addEventListener('click', () => {
        this.declineMigration(resolve);
      });
    }
  }

  /**
   * Decline migration
   * @param {Function} resolve - Promise resolve function
   */
  declineMigration(resolve) {
    console.log('Migration declined by user');

    if (window.notificationManager) {
      window.notificationManager.showNotification(
        'Migration skipped. You can migrate later from the options menu.',
        'info',
        4000
      );
    }

    this.removeMigrationModal();
    resolve({ migrated: false, reason: 'User declined' });
  }

  /**
   * Handle migration status events from main process
   * @param {Object} status - Migration status
   */
  handleMigrationStatus(status) {
    console.log('Migration status received:', status);

    if (status.type === 'migration-completed' && status.success) {
      if (window.notificationManager) {
        window.notificationManager.showNotification(
          'Migration completed successfully!',
          'success',
          3000
        );
      }
    } else if (status.type === 'migration-failed') {
      if (window.notificationManager) {
        window.notificationManager.showNotification(
          `Migration failed: ${status.error}`,
          'error',
          5000
        );
      }
    }
  }

  /**
   * Remove migration modal
   */
  removeMigrationModal() {
    if (this.migrationModal) {
      // Animate out
      this.migrationModal.style.opacity = '0';

      setTimeout(() => {
        if (this.migrationModal && this.migrationModal.parentNode) {
          this.migrationModal.parentNode.removeChild(this.migrationModal);
        }
        this.migrationModal = null;
      }, 300);
    }
  }

  /**
   * Format number with commas
   * @param {number} num - Number to format
   * @returns {string} Formatted number
   */
  formatNumber(num) {
    return num.toLocaleString();
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Manually trigger migration check (for options menu)
   */
  async manualMigrationCheck() {
    console.log('Manual migration check triggered');
    await this.checkAndPromptMigration();
  }

  /**
   * Get migration statistics
   * @returns {Promise<Object>} Migration statistics
   */
  async getMigrationStatistics() {
    if (!this.isElectron) {
      return { available: false };
    }

    try {
      const result = await window.electronAPI.getMigrationStatistics();
      return result.success ? result.statistics : { error: result.error };
    } catch (error) {
      console.error('Error getting migration statistics:', error);
      return { error: error.message };
    }
  }

  /**
   * Cleanup method
   */
  cleanup() {
    this.removeMigrationModal();

    if (this.isElectron) {
      window.electronAPI.removeMigrationStatusListener();
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MigrationUIManager;
}

// Make available globally
window.MigrationUIManager = MigrationUIManager;