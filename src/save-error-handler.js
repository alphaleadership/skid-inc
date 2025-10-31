const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * SaveErrorHandler - Handles save operation errors with retry logic, degraded mode, and backup recovery
 * Implements exponential backoff, fallback mechanisms, and automatic recovery strategies
 */
class SaveErrorHandler extends EventEmitter {
  constructor(fileSystemManager, autoSaveManager) {
    super();
    
    this.fileSystemManager = fileSystemManager;
    this.autoSaveManager = autoSaveManager;
    
    // Error handling configuration
    this.maxRetries = 3;
    this.baseBackoffDelay = 1000; // 1 second base delay
    this.maxBackoffDelay = 30000; // 30 seconds maximum delay
    this.degradedModeThreshold = 5; // Number of consecutive failures before degraded mode
    
    // State tracking
    this.consecutiveFailures = 0;
    this.isDegradedMode = false;
    this.lastSuccessfulSave = null;
    this.errorHistory = [];
    this.maxErrorHistorySize = 50;
    
    // Degraded mode configuration
    this.degradedModeConfig = {
      disableAutoSave: true,
      increaseRetryDelay: true,
      useLocalStorageFallback: true,
      notifyUser: true
    };
    
    // Recovery strategies
    this.recoveryStrategies = [
      'retry_with_backoff',
      'use_backup_location',
      'compress_data',
      'fallback_to_localstorage',
      'emergency_memory_save'
    ];
    
    console.log('SaveErrorHandler initialized');
  }

  /**
   * Handles save errors with comprehensive retry and recovery logic
   * @param {Error} error - The original save error
   * @param {Object} gameState - Game state that failed to save
   * @param {string} filename - Target filename
   * @param {string} saveType - Type of save operation
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<Object>} Save result or error information
   */
  async handleSaveError(error, gameState, filename, saveType = 'manual', retryCount = 0) {
    const errorInfo = {
      error: error.message,
      filename: filename,
      saveType: saveType,
      retryCount: retryCount,
      timestamp: Date.now(),
      errorType: this.classifyError(error)
    };
    
    // Log error to history
    this.addToErrorHistory(errorInfo);
    
    // Emit error event
    this.emit('save-error', errorInfo);
    
    console.error(`Save error (attempt ${retryCount + 1}/${this.maxRetries + 1}): ${error.message}`);
    
    // Check if we should retry
    if (retryCount < this.maxRetries && this.shouldRetry(error, retryCount)) {
      return await this.retryWithBackoff(error, gameState, filename, saveType, retryCount);
    }
    
    // Max retries exceeded - handle failure
    return await this.handleMaxRetriesExceeded(error, gameState, filename, saveType);
  }

  /**
   * Retries save operation with exponential backoff
   * @param {Error} originalError - The original error
   * @param {Object} gameState - Game state to save
   * @param {string} filename - Target filename
   * @param {string} saveType - Type of save operation
   * @param {number} retryCount - Current retry count
   * @returns {Promise<Object>} Retry result
   */
  async retryWithBackoff(originalError, gameState, filename, saveType, retryCount) {
    const backoffDelay = this.calculateBackoffDelay(retryCount);
    
    console.log(`Retrying save in ${backoffDelay}ms (attempt ${retryCount + 2}/${this.maxRetries + 1})`);
    
    this.emit('save-retry', {
      filename: filename,
      saveType: saveType,
      retryCount: retryCount + 1,
      maxRetries: this.maxRetries,
      backoffDelay: backoffDelay,
      error: originalError.message
    });
    
    // Wait for backoff delay
    await this.sleep(backoffDelay);
    
    try {
      // Try different recovery strategies based on error type and retry count
      const strategy = this.selectRecoveryStrategy(originalError, retryCount);
      const result = await this.executeRecoveryStrategy(strategy, gameState, filename, saveType);
      
      // Success - reset failure counter
      this.consecutiveFailures = 0;
      this.lastSuccessfulSave = Date.now();
      
      if (this.isDegradedMode) {
        await this.exitDegradedMode();
      }
      
      this.emit('save-recovery-success', {
        filename: filename,
        saveType: saveType,
        strategy: strategy,
        retryCount: retryCount + 1,
        timestamp: Date.now()
      });
      
      return result;
      
    } catch (retryError) {
      // Retry failed - recurse with incremented count
      return await this.handleSaveError(retryError, gameState, filename, saveType, retryCount + 1);
    }
  }

  /**
   * Handles the case when maximum retries have been exceeded
   * @param {Error} error - The final error
   * @param {Object} gameState - Game state that failed to save
   * @param {string} filename - Target filename
   * @param {string} saveType - Type of save operation
   * @returns {Promise<Object>} Final handling result
   */
  async handleMaxRetriesExceeded(error, gameState, filename, saveType) {
    this.consecutiveFailures++;
    
    console.error(`Save failed after ${this.maxRetries} attempts: ${error.message}`);
    
    // Check if we should enter degraded mode
    if (this.consecutiveFailures >= this.degradedModeThreshold && !this.isDegradedMode) {
      await this.enterDegradedMode();
    }
    
    // Try emergency recovery strategies
    const emergencyResult = await this.attemptEmergencyRecovery(gameState, filename, saveType);
    
    if (emergencyResult.success) {
      this.emit('emergency-recovery-success', {
        filename: filename,
        saveType: saveType,
        strategy: emergencyResult.strategy,
        timestamp: Date.now()
      });
      
      return emergencyResult;
    }
    
    // All recovery attempts failed
    this.emit('save-failed-final', {
      filename: filename,
      saveType: saveType,
      error: error.message,
      consecutiveFailures: this.consecutiveFailures,
      isDegradedMode: this.isDegradedMode,
      timestamp: Date.now()
    });
    
    throw new Error(`Save operation failed permanently: ${error.message}`);
  }

  /**
   * Attempts emergency recovery strategies when all retries fail
   * @param {Object} gameState - Game state to save
   * @param {string} filename - Target filename
   * @param {string} saveType - Type of save operation
   * @returns {Promise<Object>} Emergency recovery result
   */
  async attemptEmergencyRecovery(gameState, filename, saveType) {
    console.log('Attempting emergency recovery strategies...');
    
    // Strategy 1: Try saving to a backup location
    try {
      const backupResult = await this.saveToBackupLocation(gameState, filename);
      if (backupResult.success) {
        return { success: true, strategy: 'backup_location', result: backupResult };
      }
    } catch (error) {
      console.warn('Backup location save failed:', error.message);
    }
    
    // Strategy 2: Try localStorage fallback (if in renderer process)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const localStorageResult = await this.saveToLocalStorage(gameState, filename);
        if (localStorageResult.success) {
          return { success: true, strategy: 'localstorage_fallback', result: localStorageResult };
        }
      } catch (error) {
        console.warn('localStorage fallback failed:', error.message);
      }
    }
    
    // Strategy 3: In-memory emergency save
    try {
      const memoryResult = await this.saveToMemory(gameState, filename);
      if (memoryResult.success) {
        return { success: true, strategy: 'memory_save', result: memoryResult };
      }
    } catch (error) {
      console.warn('Memory save failed:', error.message);
    }
    
    return { success: false, strategy: 'none' };
  }

  /**
   * Attempts to recover from backup files when primary save fails
   * @param {string} targetFilename - The filename we were trying to save
   * @returns {Promise<Object>} Recovery result
   */
  async recoverFromBackup(targetFilename) {
    try {
      console.log('Attempting to recover from backup files...');
      
      // Get list of backup files
      const backupFiles = await this.autoSaveManager.getBackupFiles();
      
      if (backupFiles.length === 0) {
        throw new Error('No backup files available for recovery');
      }
      
      // Sort by creation time (newest first)
      const sortedBackups = backupFiles.sort((a, b) => b.created - a.created);
      
      // Try to load the most recent backup
      for (const backup of sortedBackups.slice(0, 3)) { // Try up to 3 most recent backups
        try {
          const backupData = await this.fileSystemManager.readGameData(backup.filename);
          
          if (backupData.success && backupData.data) {
            console.log(`Successfully recovered from backup: ${backup.filename}`);
            
            this.emit('backup-recovery-success', {
              originalFilename: targetFilename,
              backupFilename: backup.filename,
              backupAge: Date.now() - backup.created,
              timestamp: Date.now()
            });
            
            return {
              success: true,
              data: backupData.data,
              backupFilename: backup.filename,
              backupAge: Date.now() - backup.created
            };
          }
        } catch (backupError) {
          console.warn(`Failed to load backup ${backup.filename}: ${backupError.message}`);
          continue;
        }
      }
      
      throw new Error('All backup recovery attempts failed');
      
    } catch (error) {
      console.error('Backup recovery failed:', error.message);
      
      this.emit('backup-recovery-failed', {
        originalFilename: targetFilename,
        error: error.message,
        timestamp: Date.now()
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Enters degraded mode with reduced functionality
   */
  async enterDegradedMode() {
    if (this.isDegradedMode) {
      return;
    }
    
    console.warn('Entering degraded mode due to persistent save failures');
    
    this.isDegradedMode = true;
    
    // Apply degraded mode configuration
    if (this.degradedModeConfig.disableAutoSave && this.autoSaveManager) {
      this.autoSaveManager.stopAutoSave();
    }
    
    this.emit('degraded-mode-entered', {
      consecutiveFailures: this.consecutiveFailures,
      threshold: this.degradedModeThreshold,
      timestamp: Date.now(),
      config: this.degradedModeConfig
    });
  }

  /**
   * Exits degraded mode and restores normal functionality
   */
  async exitDegradedMode() {
    if (!this.isDegradedMode) {
      return;
    }
    
    console.log('Exiting degraded mode - save operations restored');
    
    this.isDegradedMode = false;
    this.consecutiveFailures = 0;
    
    // Restore normal functionality
    if (this.autoSaveManager && this.autoSaveManager.isAutoSaveEnabled()) {
      await this.autoSaveManager.startAutoSave();
    }
    
    this.emit('degraded-mode-exited', {
      timestamp: Date.now()
    });
  }

  /**
   * Classifies error types for appropriate handling strategies
   * @param {Error} error - Error to classify
   * @returns {string} Error classification
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('enospc') || message.includes('disk') || message.includes('space')) {
      return 'disk_space';
    } else if (message.includes('eacces') || message.includes('permission')) {
      return 'permission';
    } else if (message.includes('enoent') || message.includes('not found')) {
      return 'file_not_found';
    } else if (message.includes('ebusy') || message.includes('locked')) {
      return 'file_locked';
    } else if (message.includes('network') || message.includes('timeout')) {
      return 'network';
    } else if (message.includes('corrupted') || message.includes('invalid')) {
      return 'data_corruption';
    } else {
      return 'unknown';
    }
  }

  /**
   * Determines if a retry should be attempted based on error type
   * @param {Error} error - The error to evaluate
   * @param {number} retryCount - Current retry count
   * @returns {boolean} Whether to retry
   */
  shouldRetry(error, retryCount) {
    const errorType = this.classifyError(error);
    
    // Don't retry certain error types
    const nonRetryableErrors = ['permission', 'data_corruption'];
    if (nonRetryableErrors.includes(errorType)) {
      return false;
    }
    
    // Don't retry if in degraded mode and this is an auto-save
    if (this.isDegradedMode && this.degradedModeConfig.disableAutoSave) {
      return false;
    }
    
    return retryCount < this.maxRetries;
  }

  /**
   * Calculates exponential backoff delay
   * @param {number} retryCount - Current retry count
   * @returns {number} Delay in milliseconds
   */
  calculateBackoffDelay(retryCount) {
    const delay = this.baseBackoffDelay * Math.pow(2, retryCount);
    return Math.min(delay, this.maxBackoffDelay);
  }

  /**
   * Selects appropriate recovery strategy based on error and retry count
   * @param {Error} error - The error that occurred
   * @param {number} retryCount - Current retry count
   * @returns {string} Selected recovery strategy
   */
  selectRecoveryStrategy(error, retryCount) {
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case 'disk_space':
        return retryCount === 0 ? 'cleanup_old_files' : 'compress_data';
      case 'file_locked':
        return 'retry_with_backoff';
      case 'permission':
        return 'use_backup_location';
      default:
        return this.recoveryStrategies[retryCount % this.recoveryStrategies.length];
    }
  }

  /**
   * Executes the selected recovery strategy
   * @param {string} strategy - Recovery strategy to execute
   * @param {Object} gameState - Game state to save
   * @param {string} filename - Target filename
   * @param {string} saveType - Type of save operation
   * @returns {Promise<Object>} Strategy execution result
   */
  async executeRecoveryStrategy(strategy, gameState, filename, saveType) {
    console.log(`Executing recovery strategy: ${strategy}`);
    
    switch (strategy) {
      case 'cleanup_old_files':
        await this.autoSaveManager.cleanupOldBackups();
        return await this.fileSystemManager.writeGameData(filename, gameState);
        
      case 'use_backup_location':
        return await this.saveToBackupLocation(gameState, filename);
        
      case 'compress_data':
        return await this.saveCompressedData(gameState, filename);
        
      case 'retry_with_backoff':
      default:
        return await this.fileSystemManager.writeGameData(filename, gameState);
    }
  }

  /**
   * Saves data to an alternative backup location
   * @param {Object} gameState - Game state to save
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} Save result
   */
  async saveToBackupLocation(gameState, filename) {
    // Try saving to a backup subdirectory
    const backupDir = path.join(this.fileSystemManager.getSaveDirectory(), 'emergency');
    
    try {
      await fs.mkdir(backupDir, { recursive: true });
      const backupFilename = `emergency_${filename}`;
      const backupPath = path.join(backupDir, backupFilename);
      
      const jsonData = JSON.stringify(gameState, null, 2);
      await fs.writeFile(backupPath, jsonData, 'utf8');
      
      return {
        success: true,
        filename: backupFilename,
        path: backupPath,
        size: Buffer.byteLength(jsonData, 'utf8'),
        timestamp: Date.now(),
        isEmergencyBackup: true
      };
    } catch (error) {
      throw new Error(`Backup location save failed: ${error.message}`);
    }
  }

  /**
   * Saves compressed data to reduce file size
   * @param {Object} gameState - Game state to save
   * @param {string} filename - Target filename
   * @returns {Promise<Object>} Save result
   */
  async saveCompressedData(gameState, filename) {
    try {
      // Remove non-essential data for compression
      const compressedState = this.compressGameState(gameState);
      return await this.fileSystemManager.writeGameData(filename, compressedState);
    } catch (error) {
      throw new Error(`Compressed save failed: ${error.message}`);
    }
  }

  /**
   * Saves to localStorage as emergency fallback
   * @param {Object} gameState - Game state to save
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} Save result
   */
  async saveToLocalStorage(gameState, filename) {
    try {
      const key = `emergency_save_${filename}`;
      const data = JSON.stringify(gameState);
      
      localStorage.setItem(key, data);
      
      return {
        success: true,
        filename: filename,
        storageType: 'localStorage',
        key: key,
        size: data.length,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`localStorage save failed: ${error.message}`);
    }
  }

  /**
   * Saves to memory as last resort
   * @param {Object} gameState - Game state to save
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} Save result
   */
  async saveToMemory(gameState, filename) {
    try {
      // Store in memory (this would be lost on app restart)
      if (!this.emergencyMemoryStore) {
        this.emergencyMemoryStore = new Map();
      }
      
      this.emergencyMemoryStore.set(filename, {
        data: JSON.parse(JSON.stringify(gameState)), // Deep clone
        timestamp: Date.now()
      });
      
      return {
        success: true,
        filename: filename,
        storageType: 'memory',
        size: JSON.stringify(gameState).length,
        timestamp: Date.now(),
        warning: 'Data stored in memory only - will be lost on app restart'
      };
    } catch (error) {
      throw new Error(`Memory save failed: ${error.message}`);
    }
  }

  /**
   * Compresses game state by removing non-essential data
   * @param {Object} gameState - Original game state
   * @returns {Object} Compressed game state
   */
  compressGameState(gameState) {
    const compressed = { ...gameState };
    
    // Remove or compress non-essential data
    if (compressed.saveMetadata) {
      delete compressed.saveMetadata.retryCount;
    }
    
    // Remove debug information if present
    if (compressed.debug) {
      delete compressed.debug;
    }
    
    // Compress arrays by removing duplicates or old entries
    if (compressed.achievements && Array.isArray(compressed.achievements.owned)) {
      compressed.achievements.owned = [...new Set(compressed.achievements.owned)];
    }
    
    return compressed;
  }

  /**
   * Adds error to history for analysis
   * @param {Object} errorInfo - Error information to store
   */
  addToErrorHistory(errorInfo) {
    this.errorHistory.push(errorInfo);
    
    // Keep history size manageable
    if (this.errorHistory.length > this.maxErrorHistorySize) {
      this.errorHistory.shift();
    }
  }

  /**
   * Gets error statistics and history
   * @returns {Object} Error statistics
   */
  getErrorStatistics() {
    const now = Date.now();
    const recentErrors = this.errorHistory.filter(error => 
      now - error.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    );
    
    const errorsByType = {};
    recentErrors.forEach(error => {
      errorsByType[error.errorType] = (errorsByType[error.errorType] || 0) + 1;
    });
    
    return {
      totalErrors: this.errorHistory.length,
      recentErrors: recentErrors.length,
      consecutiveFailures: this.consecutiveFailures,
      isDegradedMode: this.isDegradedMode,
      lastSuccessfulSave: this.lastSuccessfulSave,
      errorsByType: errorsByType,
      mostCommonError: Object.keys(errorsByType).reduce((a, b) => 
        errorsByType[a] > errorsByType[b] ? a : b, 'none'
      )
    };
  }

  /**
   * Utility function to sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Resets error handler state
   */
  reset() {
    this.consecutiveFailures = 0;
    this.isDegradedMode = false;
    this.errorHistory = [];
    this.lastSuccessfulSave = null;
    
    if (this.emergencyMemoryStore) {
      this.emergencyMemoryStore.clear();
    }
    
    console.log('SaveErrorHandler state reset');
  }

  /**
   * Gets current handler configuration
   * @returns {Object} Current configuration
   */
  getConfiguration() {
    return {
      maxRetries: this.maxRetries,
      baseBackoffDelay: this.baseBackoffDelay,
      maxBackoffDelay: this.maxBackoffDelay,
      degradedModeThreshold: this.degradedModeThreshold,
      isDegradedMode: this.isDegradedMode,
      consecutiveFailures: this.consecutiveFailures,
      degradedModeConfig: { ...this.degradedModeConfig }
    };
  }

  /**
   * Updates handler configuration
   * @param {Object} config - Configuration updates
   */
  updateConfiguration(config) {
    if (config.maxRetries !== undefined) {
      this.maxRetries = Math.max(0, Math.min(10, config.maxRetries));
    }
    if (config.baseBackoffDelay !== undefined) {
      this.baseBackoffDelay = Math.max(100, config.baseBackoffDelay);
    }
    if (config.maxBackoffDelay !== undefined) {
      this.maxBackoffDelay = Math.max(this.baseBackoffDelay, config.maxBackoffDelay);
    }
    if (config.degradedModeThreshold !== undefined) {
      this.degradedModeThreshold = Math.max(1, config.degradedModeThreshold);
    }
    if (config.degradedModeConfig) {
      this.degradedModeConfig = { ...this.degradedModeConfig, ...config.degradedModeConfig };
    }
    
    console.log('SaveErrorHandler configuration updated');
  }
}

module.exports = SaveErrorHandler;