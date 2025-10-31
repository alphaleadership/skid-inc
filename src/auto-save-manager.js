const FileSystemManager = require('./filesystem-manager');
const SaveErrorHandler = require('./save-error-handler');
const DataValidator = require('./data-validator');
const PerformanceManager = require('./performance-manager');
const { EventEmitter } = require('events');

/**
 * AutoSaveManager - Handles automatic saving of game state with periodic and change-based triggers
 * Implements retry logic with exponential backoff and manages save intervals
 */
class AutoSaveManager extends EventEmitter {
  constructor(saveDirectory = null) {
    super();
    
    this.performanceManager = new PerformanceManager();
    this.fileSystemManager = new FileSystemManager(saveDirectory, this.performanceManager);
    this.dataValidator = new DataValidator();
    this.errorHandler = new SaveErrorHandler(this.fileSystemManager, this);
    this.isEnabled = true;
    this.periodicInterval = 30000; // 30 seconds as per requirements
    this.quickSaveDelay = 5000; // 5 seconds for state changes
    this.maxRetries = 3; // Maximum retry attempts
    this.useAdaptiveInterval = true; // Use performance manager's adaptive intervals
    
    // Backup configuration
    this.backupRetentionDays = 30; // Keep backups for 30 days as per requirements
    this.maxDiskUsage = 100 * 1024 * 1024; // 100MB limit as per requirements
    this.backupCleanupInterval = 24 * 60 * 60 * 1000; // Clean up daily
    
    // Timers
    this.periodicTimer = null;
    this.quickSaveTimer = null;
    this.cleanupTimer = null;
    
    // State tracking
    this.lastGameState = null;
    this.lastSaveTime = null;
    this.saveInProgress = false;
    this.pendingStateChange = false;
    
    // Statistics
    this.stats = {
      totalSaves: 0,
      successfulSaves: 0,
      failedSaves: 0,
      retriedSaves: 0,
      totalBackups: 0,
      cleanedBackups: 0,
      lastSaveAttempt: null,
      lastSuccessfulSave: null,
      lastBackupCleanup: null,
      averageSaveTime: 0
    };
    
    // Setup performance manager event forwarding
    this.setupPerformanceEventForwarding();
    
    console.log('AutoSaveManager initialized with performance optimizations');
  }

  /**
   * Setup event forwarding from performance manager
   */
  setupPerformanceEventForwarding() {
    this.performanceManager.on('memory-warning', (data) => {
      this.emit('performance-warning', {
        type: 'memory',
        ...data
      });
    });
    
    this.performanceManager.on('memory-critical', (data) => {
      this.emit('performance-critical', {
        type: 'memory',
        ...data
      });
      
      // Trigger immediate optimization on critical memory usage
      this.performanceManager.performOptimization().catch(error => {
        console.error('Emergency optimization failed:', error.message);
      });
    });
    
    this.performanceManager.on('save-interval-changed', (data) => {
      this.emit('adaptive-interval-changed', data);
    });
    
    this.performanceManager.on('optimization-complete', (data) => {
      this.emit('performance-optimized', data);
    });
  }

  /**
   * Starts the auto-save system with periodic and change-based saving
   * @param {Object} options - Configuration options
   */
  async startAutoSave(options = {}) {
    try {
      // Update configuration if provided
      if (options.periodicInterval) {
        this.periodicInterval = options.periodicInterval;
      }
      if (options.quickSaveDelay) {
        this.quickSaveDelay = options.quickSaveDelay;
      }
      if (options.enabled !== undefined) {
        this.isEnabled = options.enabled;
      }

      if (!this.isEnabled) {
        console.log('Auto-save is disabled');
        return;
      }

      // Ensure file system is ready
      await this.fileSystemManager.ensureSaveDirectory();
      
      // Start periodic auto-save timer
      this.startPeriodicSave();
      
      // Start backup cleanup timer
      this.startBackupCleanup();
      
      this.emit('auto-save-started', {
        periodicInterval: this.periodicInterval,
        quickSaveDelay: this.quickSaveDelay,
        backupRetentionDays: this.backupRetentionDays
      });
      
      console.log(`Auto-save started - Periodic: ${this.periodicInterval}ms, Quick: ${this.quickSaveDelay}ms, Backup retention: ${this.backupRetentionDays} days`);
    } catch (error) {
      this.emit('auto-save-error', { error: error.message, context: 'startup' });
      throw new Error(`Failed to start auto-save: ${error.message}`);
    }
  }

  /**
   * Stops the auto-save system and clears all timers
   */
  stopAutoSave() {
    // Clear timers
    if (this.periodicTimer) {
      clearTimeout(this.periodicTimer);
      this.periodicTimer = null;
    }
    
    if (this.quickSaveTimer) {
      clearTimeout(this.quickSaveTimer);
      this.quickSaveTimer = null;
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.isEnabled = false;
    this.pendingStateChange = false;
    
    // Cleanup performance manager
    if (this.performanceManager) {
      this.performanceManager.cleanup();
    }
    
    this.emit('auto-save-stopped');
    console.log('Auto-save stopped');
  }

  /**
   * Starts the periodic save timer with adaptive interval support
   */
  startPeriodicSave() {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
    }
    
    const startTimer = () => {
      const interval = this.useAdaptiveInterval ? 
        this.performanceManager.getCurrentSaveInterval() : 
        this.periodicInterval;
        
      this.periodicTimer = setTimeout(async () => {
        if (this.isEnabled && !this.saveInProgress) {
          try {
            await this.performPeriodicSave();
          } catch (error) {
            console.error('Periodic save failed:', error.message);
            this.emit('auto-save-error', { 
              error: error.message, 
              context: 'periodic-save',
              timestamp: Date.now()
            });
          }
        }
        
        // Restart timer with potentially new interval
        if (this.isEnabled) {
          startTimer();
        }
      }, interval);
    };
    
    startTimer();
    
    // Listen for interval changes from performance manager
    this.performanceManager.on('save-interval-changed', (data) => {
      if (this.useAdaptiveInterval && this.periodicTimer) {
        clearTimeout(this.periodicTimer);
        startTimer();
        
        this.emit('adaptive-interval-updated', {
          oldInterval: data.oldInterval,
          newInterval: data.newInterval,
          activityLevel: data.activityLevel,
          timestamp: data.timestamp
        });
      }
    });
  }

  /**
   * Starts the backup cleanup timer
   */
  startBackupCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(async () => {
      if (this.isEnabled) {
        try {
          await this.cleanupOldBackups();
        } catch (error) {
          console.error('Backup cleanup failed:', error.message);
          this.emit('cleanup-error', { 
            error: error.message, 
            timestamp: Date.now()
          });
        }
      }
    }, this.backupCleanupInterval);
  }

  /**
   * Triggers a save when game state changes
   * @param {Object} gameState - Current game state
   */
  onStateChange(gameState) {
    if (!this.isEnabled || !gameState) {
      return;
    }

    // Record activity for adaptive save frequency
    this.performanceManager.recordActivity('game-state-change');

    // Check if state actually changed
    if (this.hasStateChanged(gameState)) {
      this.lastGameState = this.deepClone(gameState);
      this.pendingStateChange = true;
      
      // Clear existing quick save timer and set new one
      if (this.quickSaveTimer) {
        clearTimeout(this.quickSaveTimer);
      }
      
      this.quickSaveTimer = setTimeout(async () => {
        if (this.pendingStateChange && !this.saveInProgress) {
          try {
            await this.performQuickSave(gameState);
            this.pendingStateChange = false;
          } catch (error) {
            console.error('Quick save failed:', error.message);
            this.emit('auto-save-error', { 
              error: error.message, 
              context: 'quick-save',
              timestamp: Date.now()
            });
          }
        }
      }, this.quickSaveDelay);
    }
  }

  /**
   * Performs a periodic save operation
   */
  async performPeriodicSave() {
    if (!this.lastGameState) {
      console.log('No game state available for periodic save');
      return;
    }

    const filename = this.generateSaveFilename('autosave');
    await this.saveGameStateWithRetry(this.lastGameState, filename, 'periodic');
    
    // Create backup after successful periodic save
    try {
      await this.createTimestampedBackup(this.lastGameState);
    } catch (error) {
      console.warn('Failed to create backup during periodic save:', error.message);
      // Don't fail the main save operation due to backup failure
    }
  }

  /**
   * Performs a quick save operation triggered by state changes
   * @param {Object} gameState - Current game state
   */
  async performQuickSave(gameState) {
    const filename = this.generateSaveFilename('quicksave');
    await this.saveGameStateWithRetry(gameState, filename, 'quick');
  }

  /**
   * Creates a timestamped backup of the game state
   * @param {Object} gameState - Game state to backup
   * @returns {Promise<Object>} Backup result
   */
  async createTimestampedBackup(gameState) {
    try {
      // Check disk space before creating backup
      const diskUsage = await this.fileSystemManager.getDiskUsage();
      if (diskUsage.usagePercentage > 90) {
        console.warn('Disk usage high, cleaning up old backups before creating new one');
        await this.cleanupOldBackups();
      }
      
      const backupFilename = this.generateBackupFilename();
      
      // Add backup metadata
      const backupData = {
        ...gameState,
        backupMetadata: {
          timestamp: Date.now(),
          originalSaveType: 'backup',
          version: '1.0.0',
          isAutoBackup: true
        }
      };
      
      const result = await this.fileSystemManager.writeGameData(backupFilename, backupData);
      
      this.stats.totalBackups++;
      
      this.emit('backup-created', {
        filename: result.filename,
        size: result.size,
        timestamp: result.timestamp
      });
      
      console.log(`Backup created: ${result.filename} (${result.size} bytes)`);
      
      return result;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Cleans up old backup files based on retention policy
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldBackups() {
    try {
      const saveFiles = await this.fileSystemManager.listSaveFiles();
      const backupFiles = saveFiles.filter(file => file.isBackup || file.filename.includes('backup_'));
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.backupRetentionDays);
      
      let cleanedCount = 0;
      let freedSpace = 0;
      
      for (const backupFile of backupFiles) {
        if (backupFile.created < cutoffDate) {
          try {
            const deleteResult = await this.fileSystemManager.deleteSaveFile(backupFile.filename);
            cleanedCount++;
            freedSpace += deleteResult.deletedSize;
            
            console.log(`Cleaned up old backup: ${backupFile.filename}`);
          } catch (error) {
            console.warn(`Failed to delete backup ${backupFile.filename}: ${error.message}`);
          }
        }
      }
      
      // Also clean up if we're over disk usage limit
      const diskUsage = await this.fileSystemManager.getDiskUsage();
      if (diskUsage.usagePercentage > 95) {
        // Remove oldest backups until we're under 90%
        const sortedBackups = backupFiles
          .filter(file => file.created >= cutoffDate) // Only consider non-expired backups
          .sort((a, b) => a.created - b.created); // Oldest first
        
        for (const backup of sortedBackups) {
          if (diskUsage.usagePercentage <= 90) break;
          
          try {
            const deleteResult = await this.fileSystemManager.deleteSaveFile(backup.filename);
            cleanedCount++;
            freedSpace += deleteResult.deletedSize;
            
            // Recalculate disk usage
            const newDiskUsage = await this.fileSystemManager.getDiskUsage();
            diskUsage.usagePercentage = newDiskUsage.usagePercentage;
            
            console.log(`Cleaned up backup due to disk space: ${backup.filename}`);
          } catch (error) {
            console.warn(`Failed to delete backup ${backup.filename}: ${error.message}`);
          }
        }
      }
      
      this.stats.cleanedBackups += cleanedCount;
      this.stats.lastBackupCleanup = Date.now();
      
      if (cleanedCount > 0) {
        this.emit('backup-cleanup', {
          cleanedCount: cleanedCount,
          freedSpace: freedSpace,
          timestamp: Date.now()
        });
        
        console.log(`Backup cleanup completed: ${cleanedCount} files removed, ${Math.round(freedSpace / 1024)} KB freed`);
      }
      
      return {
        cleanedCount: cleanedCount,
        freedSpace: freedSpace,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to cleanup old backups: ${error.message}`);
    }
  }

  /**
   * Saves game state with validation, retry logic and error handling
   * @param {Object} gameState - Game state to save
   * @param {string} filename - Target filename
   * @param {string} saveType - Type of save (periodic, quick, manual)
   * @param {number} retryCount - Current retry attempt
   */
  async saveGameStateWithRetry(gameState, filename, saveType = 'manual', retryCount = 0) {
    if (this.saveInProgress && saveType !== 'manual') {
      console.log(`Save already in progress, skipping ${saveType} save`);
      return;
    }

    this.saveInProgress = true;
    const startTime = Date.now();
    
    try {
      this.stats.totalSaves++;
      this.stats.lastSaveAttempt = startTime;
      
      // Validate and repair game state before saving
      const validationResult = await this.dataValidator.validateGameState(gameState);
      
      let saveData = gameState;
      if (validationResult.wasRepaired) {
        console.log(`Game state repaired before save: ${validationResult.repairedFields.length} fields fixed`);
        saveData = validationResult.repairedData;
        
        this.emit('save-data-repaired', {
          filename: filename,
          repairedFields: validationResult.repairedFields,
          saveType: saveType,
          timestamp: Date.now()
        });
      }
      
      // Check for critical validation errors
      if (!validationResult.isValid) {
        const criticalErrors = validationResult.errors.filter(error => error.severity === 'critical');
        if (criticalErrors.length > 0) {
          throw new Error(`Critical validation errors: ${criticalErrors.map(e => e.message).join(', ')}`);
        }
      }
      
      // Add metadata to game state
      const finalSaveData = {
        ...saveData,
        saveMetadata: {
          timestamp: startTime,
          saveType: saveType,
          version: '1.0.0',
          retryCount: retryCount,
          wasRepaired: validationResult.wasRepaired,
          validationTime: validationResult.validationTime
        }
      };

      // Perform the save operation
      const result = await this.fileSystemManager.writeGameData(filename, finalSaveData);
      
      // Update statistics
      const saveTime = Date.now() - startTime;
      this.updateSaveStatistics(saveTime, true);
      this.lastSaveTime = result.timestamp;
      
      // Emit success event
      this.emit('save-success', {
        filename: result.filename,
        saveType: saveType,
        size: result.size,
        duration: saveTime,
        retryCount: retryCount,
        wasRepaired: validationResult.wasRepaired,
        timestamp: result.timestamp
      });
      
      console.log(`${saveType} save successful: ${result.filename} (${result.size} bytes, ${saveTime}ms)`);
      
    } catch (error) {
      this.updateSaveStatistics(Date.now() - startTime, false);
      
      // Use the error handler for comprehensive error handling
      try {
        const errorResult = await this.errorHandler.handleSaveError(error, gameState, filename, saveType, retryCount);
        
        // If error handler succeeded, update our statistics
        if (errorResult && errorResult.success) {
          const saveTime = Date.now() - startTime;
          this.updateSaveStatistics(saveTime, true);
          this.lastSaveTime = Date.now();
          
          this.emit('save-success', {
            filename: errorResult.filename || filename,
            saveType: saveType,
            size: errorResult.size || 0,
            duration: saveTime,
            retryCount: retryCount,
            recoveryUsed: true,
            timestamp: Date.now()
          });
        }
        
      } catch (finalError) {
        // All error handling failed
        this.emit('save-failed', {
          filename: filename,
          saveType: saveType,
          error: finalError.message,
          originalError: error.message,
          retryCount: retryCount,
          maxRetries: this.maxRetries,
          timestamp: Date.now()
        });
        
        console.error(`Save failed permanently: ${finalError.message}`);
        throw finalError;
      }
    } finally {
      this.saveInProgress = false;
    }
  }

  /**
   * Manually saves the current game state
   * @param {Object} gameState - Game state to save
   * @param {string} customFilename - Optional custom filename
   * @returns {Promise<Object>} Save result
   */
  async saveGameState(gameState, customFilename = null) {
    if (!gameState) {
      throw new Error('Game state is required for manual save');
    }

    const filename = customFilename || this.generateSaveFilename('manual');
    
    // Update last known state
    this.lastGameState = this.deepClone(gameState);
    
    // Perform save with retry logic
    await this.saveGameStateWithRetry(gameState, filename, 'manual');
    
    return {
      success: true,
      filename: filename,
      timestamp: Date.now()
    };
  }

  /**
   * Loads the most recent game state with validation and repair
   * @returns {Promise<Object>} Loaded and validated game state
   */
  async loadGameState() {
    try {
      const saveFiles = await this.fileSystemManager.listSaveFiles();
      
      if (saveFiles.length === 0) {
        throw new Error('No save files found');
      }
      
      // Try to load files in order of preference (newest non-backup first)
      const sortedFiles = saveFiles.sort((a, b) => {
        // Prioritize non-backup files
        if (a.isBackup !== b.isBackup) {
          return a.isBackup ? 1 : -1;
        }
        // Then sort by modification time (newest first)
        return b.modified - a.modified;
      });
      
      let lastError = null;
      
      for (const saveFile of sortedFiles) {
        try {
          console.log(`Attempting to load: ${saveFile.filename}`);
          
          const result = await this.fileSystemManager.readGameData(saveFile.filename);
          
          // Validate and repair the loaded data
          const validationResult = await this.dataValidator.validateGameState(result.data);
          
          let finalData = result.data;
          
          if (!validationResult.isValid) {
            console.warn(`Loaded data has validation issues, attempting repair...`);
            
            // Attempt to repair corrupted data
            const repairResult = await this.dataValidator.repairCorruptedData(result.data, validationResult);
            
            if (repairResult.success) {
              console.log(`Data successfully repaired: ${repairResult.appliedFixes.length} fixes applied`);
              finalData = repairResult.repairedData;
              
              this.emit('load-data-repaired', {
                filename: saveFile.filename,
                appliedFixes: repairResult.appliedFixes,
                unresolvedIssues: repairResult.unresolvedIssues,
                timestamp: Date.now()
              });
              
              // Save the repaired data back to ensure consistency
              try {
                await this.saveGameState(finalData, `repaired_${saveFile.filename}`);
              } catch (saveError) {
                console.warn(`Could not save repaired data: ${saveError.message}`);
              }
              
            } else {
              console.error(`Data repair failed for ${saveFile.filename}, trying next file...`);
              lastError = new Error(`Data corruption could not be repaired: ${repairResult.unresolvedIssues.length} unresolved issues`);
              continue;
            }
          }
          
          // Update last known state
          this.lastGameState = this.deepClone(finalData);
          
          this.emit('load-success', {
            filename: saveFile.filename,
            wasRepaired: validationResult.wasRepaired || !validationResult.isValid,
            validationTime: validationResult.validationTime,
            timestamp: Date.now()
          });
          
          return {
            success: true,
            data: finalData,
            filename: saveFile.filename,
            wasRepaired: validationResult.wasRepaired || !validationResult.isValid,
            validationResult: validationResult,
            timestamp: Date.now()
          };
          
        } catch (fileError) {
          console.warn(`Failed to load ${saveFile.filename}: ${fileError.message}`);
          lastError = fileError;
          continue;
        }
      }
      
      // If we get here, all files failed to load
      const errorMessage = lastError ? lastError.message : 'All save files are corrupted or unreadable';
      
      // Try to recover from backup as last resort
      try {
        console.log('Attempting backup recovery...');
        const backupRecovery = await this.errorHandler.recoverFromBackup('latest');
        
        if (backupRecovery.success) {
          this.lastGameState = this.deepClone(backupRecovery.data);
          
          this.emit('load-backup-recovery', {
            backupFilename: backupRecovery.backupFilename,
            backupAge: backupRecovery.backupAge,
            timestamp: Date.now()
          });
          
          return {
            success: true,
            data: backupRecovery.data,
            filename: backupRecovery.backupFilename,
            wasRecoveredFromBackup: true,
            backupAge: backupRecovery.backupAge,
            timestamp: Date.now()
          };
        }
      } catch (backupError) {
        console.error('Backup recovery also failed:', backupError.message);
      }
      
      this.emit('load-failed', {
        error: errorMessage,
        filesAttempted: sortedFiles.length,
        timestamp: Date.now()
      });
      
      throw new Error(`Failed to load game state: ${errorMessage}`);
      
    } catch (error) {
      this.emit('load-failed', {
        error: error.message,
        timestamp: Date.now()
      });
      throw new Error(`Failed to load game state: ${error.message}`);
    }
  }

  /**
   * Checks if the game state has changed compared to the last known state
   * @param {Object} currentState - Current game state
   * @returns {boolean} True if state has changed
   */
  hasStateChanged(currentState) {
    if (!this.lastGameState) {
      return true;
    }
    
    // Compare critical game state properties
    const criticalProps = ['player', 'script', 'server', 'battery', 'achievements'];
    
    for (const prop of criticalProps) {
      if (JSON.stringify(currentState[prop]) !== JSON.stringify(this.lastGameState[prop])) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Generates a filename for save files
   * @param {string} saveType - Type of save (autosave, quicksave, manual)
   * @returns {string} Generated filename
   */
  generateSaveFilename(saveType) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${saveType}_${timestamp}.json`;
  }

  /**
   * Generates a filename for backup files
   * @returns {string} Generated backup filename
   */
  generateBackupFilename() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `backup_${timestamp}.json`;
  }

  /**
   * Updates save operation statistics
   * @param {number} duration - Save operation duration in milliseconds
   * @param {boolean} success - Whether the save was successful
   */
  updateSaveStatistics(duration, success) {
    if (success) {
      this.stats.successfulSaves++;
      this.stats.lastSuccessfulSave = Date.now();
      
      // Update average save time
      const totalSuccessfulTime = this.stats.averageSaveTime * (this.stats.successfulSaves - 1) + duration;
      this.stats.averageSaveTime = Math.round(totalSuccessfulTime / this.stats.successfulSaves);
    } else {
      this.stats.failedSaves++;
    }
  }

  /**
   * Creates a deep clone of an object
   * @param {Object} obj - Object to clone
   * @returns {Object} Deep cloned object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Gets comprehensive auto-save statistics including error handling, validation, and performance
   * @returns {Object} Statistics object
   */
  getStatistics() {
    const baseStats = {
      ...this.stats,
      isEnabled: this.isEnabled,
      periodicInterval: this.periodicInterval,
      quickSaveDelay: this.quickSaveDelay,
      backupRetentionDays: this.backupRetentionDays,
      saveInProgress: this.saveInProgress,
      lastSaveTime: this.lastSaveTime,
      hasGameState: !!this.lastGameState,
      useAdaptiveInterval: this.useAdaptiveInterval,
      currentSaveInterval: this.useAdaptiveInterval ? this.performanceManager.getCurrentSaveInterval() : this.periodicInterval
    };
    
    // Add error handling statistics
    const errorStats = this.errorHandler ? this.errorHandler.getErrorStatistics() : {};
    
    // Add validation statistics
    const validationStats = this.dataValidator ? this.dataValidator.getStatistics() : {};
    
    // Add performance statistics
    const performanceStats = this.performanceManager ? this.performanceManager.getPerformanceStatistics() : {};
    
    return {
      ...baseStats,
      errorHandling: errorStats,
      validation: validationStats,
      performance: performanceStats,
      robustness: {
        totalRecoveryAttempts: errorStats.totalErrors || 0,
        successfulRecoveries: (errorStats.totalErrors || 0) - (errorStats.consecutiveFailures || 0),
        isDegradedMode: errorStats.isDegradedMode || false,
        dataRepairRate: validationStats.repairRate || 0,
        performanceScore: performanceStats.overall?.performanceScore || 0,
        overallReliability: this.calculateReliabilityScore(baseStats, errorStats, validationStats, performanceStats)
      }
    };
  }

  /**
   * Calculates an overall reliability score based on various metrics
   * @param {Object} saveStats - Save operation statistics
   * @param {Object} errorStats - Error handling statistics
   * @param {Object} validationStats - Validation statistics
   * @param {Object} performanceStats - Performance statistics
   * @returns {number} Reliability score (0-100)
   */
  calculateReliabilityScore(saveStats, errorStats, validationStats, performanceStats = {}) {
    let score = 100;
    
    // Deduct points for failed saves (40% weight)
    if (saveStats.totalSaves > 0) {
      const failureRate = (saveStats.failedSaves / saveStats.totalSaves) * 100;
      score -= failureRate * 0.4;
    }
    
    // Deduct points for validation failures (25% weight)
    if (validationStats.totalValidations > 0) {
      const validationFailureRate = (validationStats.failedValidations / validationStats.totalValidations) * 100;
      score -= validationFailureRate * 0.25;
    }
    
    // Deduct points for being in degraded mode (20% weight)
    if (errorStats.isDegradedMode) {
      score -= 20;
    }
    
    // Deduct points for recent errors (10% weight)
    if (errorStats.recentErrors > 0) {
      score -= Math.min(errorStats.recentErrors * 1, 10);
    }
    
    // Performance impact (5% weight)
    if (performanceStats.overall?.performanceScore) {
      const performanceBonus = (performanceStats.overall.performanceScore - 50) * 0.05;
      score += performanceBonus;
    }
    
    // Memory health impact
    if (performanceStats.memory?.percentage > 95) {
      score -= 10; // Critical memory usage
    } else if (performanceStats.memory?.percentage > 80) {
      score -= 5; // High memory usage
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Updates auto-save configuration
   * @param {Object} config - Configuration updates
   */
  updateConfiguration(config) {
    if (config.enabled !== undefined) {
      this.isEnabled = config.enabled;
      if (!this.isEnabled) {
        this.stopAutoSave();
      } else if (!this.periodicTimer) {
        this.startPeriodicSave();
      }
    }
    
    if (config.periodicInterval !== undefined) {
      this.periodicInterval = config.periodicInterval;
      if (this.isEnabled) {
        this.startPeriodicSave(); // Restart with new interval
      }
    }
    
    if (config.quickSaveDelay !== undefined) {
      this.quickSaveDelay = config.quickSaveDelay;
    }
    
    if (config.backupRetentionDays !== undefined) {
      this.backupRetentionDays = config.backupRetentionDays;
    }
    
    this.emit('configuration-updated', {
      isEnabled: this.isEnabled,
      periodicInterval: this.periodicInterval,
      quickSaveDelay: this.quickSaveDelay,
      backupRetentionDays: this.backupRetentionDays
    });
  }

  /**
   * Gets the file system manager instance
   * @returns {FileSystemManager} File system manager
   */
  getFileSystemManager() {
    return this.fileSystemManager;
  }

  /**
   * Checks if auto-save is currently enabled
   * @returns {boolean} True if enabled
   */
  isAutoSaveEnabled() {
    return this.isEnabled;
  }

  /**
   * Forces an immediate save regardless of timers
   * @param {Object} gameState - Game state to save
   * @returns {Promise<Object>} Save result
   */
  async forceSave(gameState) {
    if (!gameState) {
      throw new Error('Game state is required for force save');
    }
    
    const filename = this.generateSaveFilename('force');
    await this.saveGameStateWithRetry(gameState, filename, 'manual');
    
    return {
      success: true,
      filename: filename,
      timestamp: Date.now()
    };
  }

  /**
   * Gets a list of all backup files
   * @returns {Promise<Array>} Array of backup file information
   */
  async getBackupFiles() {
    try {
      const saveFiles = await this.fileSystemManager.listSaveFiles();
      return saveFiles.filter(file => file.isBackup || file.filename.includes('backup_'));
    } catch (error) {
      throw new Error(`Failed to get backup files: ${error.message}`);
    }
  }

  /**
   * Manually triggers backup cleanup
   * @returns {Promise<Object>} Cleanup result
   */
  async manualBackupCleanup() {
    return await this.cleanupOldBackups();
  }

  /**
   * Creates a manual backup with custom name
   * @param {Object} gameState - Game state to backup
   * @param {string} backupName - Custom backup name
   * @returns {Promise<Object>} Backup result
   */
  async createManualBackup(gameState, backupName = null) {
    if (!gameState) {
      throw new Error('Game state is required for manual backup');
    }
    
    const filename = backupName ? `backup_manual_${backupName}_${Date.now()}.json` : this.generateBackupFilename();
    
    const backupData = {
      ...gameState,
      backupMetadata: {
        timestamp: Date.now(),
        originalSaveType: 'manual_backup',
        version: '1.0.0',
        isAutoBackup: false,
        customName: backupName
      }
    };
    
    const result = await this.fileSystemManager.writeGameData(filename, backupData);
    this.stats.totalBackups++;
    
    this.emit('manual-backup-created', {
      filename: result.filename,
      size: result.size,
      timestamp: result.timestamp,
      customName: backupName
    });
    
    return result;
  }

  /**
   * Validates the current game state manually
   * @param {Object} gameState - Game state to validate (optional, uses last known state if not provided)
   * @returns {Promise<Object>} Validation result
   */
  async validateCurrentGameState(gameState = null) {
    const stateToValidate = gameState || this.lastGameState;
    
    if (!stateToValidate) {
      throw new Error('No game state available for validation');
    }
    
    const validationResult = await this.dataValidator.validateGameState(stateToValidate);
    
    this.emit('manual-validation-complete', {
      isValid: validationResult.isValid,
      wasRepaired: validationResult.wasRepaired,
      errorCount: validationResult.errors.length,
      warningCount: validationResult.warnings.length,
      repairedFields: validationResult.repairedFields,
      timestamp: Date.now()
    });
    
    return validationResult;
  }

  /**
   * Performs a comprehensive health check of the save system
   * @returns {Promise<Object>} Health check result
   */
  async performHealthCheck() {
    const healthCheck = {
      timestamp: Date.now(),
      overall: 'healthy',
      issues: [],
      recommendations: [],
      statistics: {}
    };
    
    try {
      // Check file system health
      const diskUsage = await this.fileSystemManager.getDiskUsage();
      healthCheck.statistics.diskUsage = diskUsage;
      
      if (diskUsage.usagePercentage > 90) {
        healthCheck.issues.push({
          severity: 'warning',
          component: 'filesystem',
          message: `Disk usage is high: ${diskUsage.usagePercentage.toFixed(1)}%`,
          recommendation: 'Clean up old backup files'
        });
        healthCheck.recommendations.push('Run backup cleanup to free disk space');
      }
      
      // Check error handler status
      const errorStats = this.errorHandler.getErrorStatistics();
      healthCheck.statistics.errorHandling = errorStats;
      
      if (errorStats.isDegradedMode) {
        healthCheck.issues.push({
          severity: 'critical',
          component: 'error_handler',
          message: 'System is in degraded mode',
          recommendation: 'Investigate and resolve persistent save failures'
        });
        healthCheck.overall = 'degraded';
      }
      
      if (errorStats.recentErrors > 5) {
        healthCheck.issues.push({
          severity: 'warning',
          component: 'error_handler',
          message: `High number of recent errors: ${errorStats.recentErrors}`,
          recommendation: 'Check system resources and file permissions'
        });
      }
      
      // Check validation statistics
      const validationStats = this.dataValidator.getStatistics();
      healthCheck.statistics.validation = validationStats;
      
      if (validationStats.successRate < 90) {
        healthCheck.issues.push({
          severity: 'warning',
          component: 'validator',
          message: `Low validation success rate: ${validationStats.successRate.toFixed(1)}%`,
          recommendation: 'Review data integrity and consider schema updates'
        });
      }
      
      // Validate all save files
      try {
        const fileValidation = await this.fileSystemManager.validateAllFiles();
        healthCheck.statistics.fileValidation = fileValidation;
        
        if (fileValidation.invalidFiles > 0) {
          healthCheck.issues.push({
            severity: 'warning',
            component: 'filesystem',
            message: `${fileValidation.invalidFiles} corrupted save files detected`,
            recommendation: 'Run file repair or restore from backups'
          });
        }
      } catch (validationError) {
        healthCheck.issues.push({
          severity: 'error',
          component: 'filesystem',
          message: `File validation failed: ${validationError.message}`,
          recommendation: 'Check file system integrity'
        });
      }
      
      // Determine overall health
      const criticalIssues = healthCheck.issues.filter(issue => issue.severity === 'critical');
      const warningIssues = healthCheck.issues.filter(issue => issue.severity === 'warning');
      
      if (criticalIssues.length > 0) {
        healthCheck.overall = 'critical';
      } else if (warningIssues.length > 2) {
        healthCheck.overall = 'warning';
      }
      
      this.emit('health-check-complete', {
        overall: healthCheck.overall,
        issueCount: healthCheck.issues.length,
        criticalIssues: criticalIssues.length,
        warningIssues: warningIssues.length,
        timestamp: healthCheck.timestamp
      });
      
      return healthCheck;
      
    } catch (error) {
      healthCheck.overall = 'error';
      healthCheck.issues.push({
        severity: 'critical',
        component: 'health_check',
        message: `Health check failed: ${error.message}`,
        recommendation: 'Contact support or check system logs'
      });
      
      return healthCheck;
    }
  }

  /**
   * Repairs all corrupted save files
   * @returns {Promise<Object>} Repair result
   */
  async repairAllSaveFiles() {
    const repairResult = {
      timestamp: Date.now(),
      totalFiles: 0,
      repairedFiles: 0,
      unreparableFiles: 0,
      details: []
    };
    
    try {
      const saveFiles = await this.fileSystemManager.listSaveFiles();
      repairResult.totalFiles = saveFiles.length;
      
      for (const saveFile of saveFiles) {
        try {
          console.log(`Checking and repairing: ${saveFile.filename}`);
          
          // Load the file
          const fileData = await this.fileSystemManager.readGameData(saveFile.filename);
          
          // Validate and repair
          const validationResult = await this.dataValidator.validateGameState(fileData.data);
          
          if (!validationResult.isValid || validationResult.wasRepaired) {
            const repairAttempt = await this.dataValidator.repairCorruptedData(fileData.data, validationResult);
            
            if (repairAttempt.success) {
              // Save the repaired data
              const repairedFilename = `repaired_${saveFile.filename}`;
              await this.fileSystemManager.writeGameData(repairedFilename, repairAttempt.repairedData);
              
              repairResult.repairedFiles++;
              repairResult.details.push({
                filename: saveFile.filename,
                status: 'repaired',
                repairedFilename: repairedFilename,
                appliedFixes: repairAttempt.appliedFixes.length,
                unresolvedIssues: repairAttempt.unresolvedIssues.length
              });
              
            } else {
              repairResult.unreparableFiles++;
              repairResult.details.push({
                filename: saveFile.filename,
                status: 'unreparable',
                issues: repairAttempt.unresolvedIssues
              });
            }
          } else {
            repairResult.details.push({
              filename: saveFile.filename,
              status: 'healthy'
            });
          }
          
        } catch (fileError) {
          repairResult.unreparableFiles++;
          repairResult.details.push({
            filename: saveFile.filename,
            status: 'error',
            error: fileError.message
          });
        }
      }
      
      this.emit('repair-all-complete', {
        totalFiles: repairResult.totalFiles,
        repairedFiles: repairResult.repairedFiles,
        unreparableFiles: repairResult.unreparableFiles,
        timestamp: repairResult.timestamp
      });
      
      return repairResult;
      
    } catch (error) {
      throw new Error(`Repair operation failed: ${error.message}`);
    }
  }

  /**
   * Gets the error handler instance
   * @returns {SaveErrorHandler} Error handler instance
   */
  getErrorHandler() {
    return this.errorHandler;
  }

  /**
   * Gets the data validator instance
   * @returns {DataValidator} Data validator instance
   */
  getDataValidator() {
    return this.dataValidator;
  }

  /**
   * Gets the performance manager instance
   * @returns {PerformanceManager} Performance manager instance
   */
  getPerformanceManager() {
    return this.performanceManager;
  }

  /**
   * Updates performance configuration
   * @param {Object} config - Performance configuration updates
   */
  updatePerformanceConfiguration(config) {
    if (this.performanceManager) {
      this.performanceManager.updateConfiguration(config);
    }
    
    if (config.useAdaptiveInterval !== undefined) {
      this.useAdaptiveInterval = config.useAdaptiveInterval;
      
      // Restart periodic save with new configuration
      if (this.isEnabled) {
        this.startPeriodicSave();
      }
    }
  }

  /**
   * Performs manual performance optimization
   * @returns {Promise<Object>} Optimization result
   */
  async optimizePerformance() {
    if (!this.performanceManager) {
      throw new Error('Performance manager not available');
    }
    
    return await this.performanceManager.performOptimization();
  }

  /**
   * Records user activity for adaptive save frequency
   * @param {string} activityType - Type of activity
   */
  recordUserActivity(activityType = 'user-action') {
    if (this.performanceManager) {
      this.performanceManager.recordActivity(activityType);
    }
  }
}

module.exports = AutoSaveManager;