const zlib = require('zlib');
const { promisify } = require('util');
const { EventEmitter } = require('events');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * PerformanceManager - Handles performance optimizations for the save system
 * Includes data compression, memory monitoring, and adaptive save frequency
 */
class PerformanceManager extends EventEmitter {
  constructor() {
    super();
    
    // Memory monitoring configuration
    this.memoryLimit = 200 * 1024 * 1024; // 200MB limit as per requirements
    this.memoryCheckInterval = 30000; // Check every 30 seconds
    this.memoryWarningThreshold = 0.8; // Warn at 80% of limit
    this.memoryCriticalThreshold = 0.95; // Critical at 95% of limit
    
    // Compression configuration
    this.compressionEnabled = true;
    this.compressionLevel = 6; // Balance between speed and compression ratio
    this.compressionThreshold = 1024; // Only compress files larger than 1KB
    
    // Activity tracking for adaptive save frequency
    this.activityTracker = {
      lastActivity: Date.now(),
      activityCount: 0,
      activityWindow: 60000, // 1 minute window
      lowActivityThreshold: 5, // Less than 5 activities per minute = low activity
      highActivityThreshold: 30 // More than 30 activities per minute = high activity
    };
    
    // Adaptive save frequency configuration
    this.adaptiveSaveEnabled = true;
    this.baseSaveInterval = 30000; // 30 seconds base interval
    this.lowActivityMultiplier = 2; // Save every 60 seconds during low activity
    this.highActivityMultiplier = 0.5; // Save every 15 seconds during high activity
    this.currentSaveInterval = this.baseSaveInterval;
    
    // Performance statistics
    this.stats = {
      compressionRatio: 0,
      totalCompressedSaves: 0,
      totalUncompressedSaves: 0,
      averageCompressionTime: 0,
      averageDecompressionTime: 0,
      memoryUsageHistory: [],
      adaptiveIntervalChanges: 0,
      lastMemoryCheck: null,
      currentMemoryUsage: 0,
      peakMemoryUsage: 0
    };
    
    // Start monitoring
    this.startMemoryMonitoring();
    
    console.log('PerformanceManager initialized');
  }

  /**
   * Starts memory monitoring with periodic checks
   */
  startMemoryMonitoring() {
    this.memoryTimer = setInterval(() => {
      this.checkMemoryUsage();
    }, this.memoryCheckInterval);
    
    // Initial memory check
    this.checkMemoryUsage();
  }

  /**
   * Stops memory monitoring
   */
  stopMemoryMonitoring() {
    if (this.memoryTimer) {
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
    }
  }

  /**
   * Checks current memory usage and emits warnings if necessary
   */
  checkMemoryUsage() {
    try {
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.heapUsed + memoryUsage.external;
      
      this.stats.currentMemoryUsage = totalMemory;
      this.stats.lastMemoryCheck = Date.now();
      
      // Update peak memory usage
      if (totalMemory > this.stats.peakMemoryUsage) {
        this.stats.peakMemoryUsage = totalMemory;
      }
      
      // Add to history (keep last 100 entries)
      this.stats.memoryUsageHistory.push({
        timestamp: Date.now(),
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        total: totalMemory
      });
      
      if (this.stats.memoryUsageHistory.length > 100) {
        this.stats.memoryUsageHistory.shift();
      }
      
      // Check thresholds
      const usagePercentage = totalMemory / this.memoryLimit;
      
      if (usagePercentage >= this.memoryCriticalThreshold) {
        this.emit('memory-critical', {
          currentUsage: totalMemory,
          limit: this.memoryLimit,
          percentage: usagePercentage * 100,
          timestamp: Date.now()
        });
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          console.log('Forced garbage collection due to high memory usage');
        }
        
      } else if (usagePercentage >= this.memoryWarningThreshold) {
        this.emit('memory-warning', {
          currentUsage: totalMemory,
          limit: this.memoryLimit,
          percentage: usagePercentage * 100,
          timestamp: Date.now()
        });
      }
      
      // Emit regular memory status
      this.emit('memory-status', {
        currentUsage: totalMemory,
        limit: this.memoryLimit,
        percentage: usagePercentage * 100,
        isHealthy: usagePercentage < this.memoryWarningThreshold,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Memory check failed:', error.message);
    }
  }

  /**
   * Compresses data using gzip compression
   * @param {string|Buffer} data - Data to compress
   * @returns {Promise<Object>} Compression result
   */
  async compressData(data) {
    if (!this.compressionEnabled) {
      return {
        compressed: false,
        data: data,
        originalSize: Buffer.byteLength(data),
        compressedSize: Buffer.byteLength(data),
        compressionRatio: 1,
        compressionTime: 0
      };
    }
    
    const startTime = Date.now();
    const inputBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    
    // Only compress if data is larger than threshold
    if (inputBuffer.length < this.compressionThreshold) {
      return {
        compressed: false,
        data: data,
        originalSize: inputBuffer.length,
        compressedSize: inputBuffer.length,
        compressionRatio: 1,
        compressionTime: 0
      };
    }
    
    try {
      const compressedBuffer = await gzip(inputBuffer, {
        level: this.compressionLevel,
        chunkSize: 16 * 1024 // 16KB chunks for better performance
      });
      
      const compressionTime = Date.now() - startTime;
      const compressionRatio = inputBuffer.length / compressedBuffer.length;
      
      // Update statistics
      this.stats.totalCompressedSaves++;
      this.updateCompressionStats(compressionTime, compressionRatio);
      
      return {
        compressed: true,
        data: compressedBuffer,
        originalSize: inputBuffer.length,
        compressedSize: compressedBuffer.length,
        compressionRatio: compressionRatio,
        compressionTime: compressionTime
      };
      
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error.message);
      this.stats.totalUncompressedSaves++;
      
      return {
        compressed: false,
        data: data,
        originalSize: inputBuffer.length,
        compressedSize: inputBuffer.length,
        compressionRatio: 1,
        compressionTime: 0,
        error: error.message
      };
    }
  }

  /**
   * Decompresses gzip-compressed data
   * @param {Buffer} compressedData - Compressed data buffer
   * @returns {Promise<Object>} Decompression result
   */
  async decompressData(compressedData) {
    const startTime = Date.now();
    
    try {
      const decompressedBuffer = await gunzip(compressedData);
      const decompressionTime = Date.now() - startTime;
      
      // Update statistics
      this.updateDecompressionStats(decompressionTime);
      
      return {
        success: true,
        data: decompressedBuffer.toString('utf8'),
        originalSize: compressedData.length,
        decompressedSize: decompressedBuffer.length,
        decompressionTime: decompressionTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        decompressionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Records user activity for adaptive save frequency
   * @param {string} activityType - Type of activity (e.g., 'game-action', 'ui-interaction')
   */
  recordActivity(activityType = 'general') {
    const now = Date.now();
    
    // Clean old activities outside the window
    const windowStart = now - this.activityTracker.activityWindow;
    
    this.activityTracker.lastActivity = now;
    this.activityTracker.activityCount++;
    
    // Calculate activity rate and adjust save frequency if needed
    if (this.adaptiveSaveEnabled) {
      this.updateAdaptiveSaveFrequency();
    }
    
    this.emit('activity-recorded', {
      activityType: activityType,
      timestamp: now,
      currentInterval: this.currentSaveInterval
    });
  }

  /**
   * Updates adaptive save frequency based on activity level
   */
  updateAdaptiveSaveFrequency() {
    const now = Date.now();
    const windowStart = now - this.activityTracker.activityWindow;
    
    // Calculate activities per minute
    const activitiesPerMinute = this.activityTracker.activityCount;
    
    let newInterval = this.baseSaveInterval;
    let activityLevel = 'normal';
    
    if (activitiesPerMinute < this.activityTracker.lowActivityThreshold) {
      // Low activity - save less frequently
      newInterval = this.baseSaveInterval * this.lowActivityMultiplier;
      activityLevel = 'low';
    } else if (activitiesPerMinute > this.activityTracker.highActivityThreshold) {
      // High activity - save more frequently
      newInterval = this.baseSaveInterval * this.highActivityMultiplier;
      activityLevel = 'high';
    }
    
    // Only update if there's a significant change
    if (Math.abs(newInterval - this.currentSaveInterval) > 5000) { // 5 second threshold
      const oldInterval = this.currentSaveInterval;
      this.currentSaveInterval = newInterval;
      this.stats.adaptiveIntervalChanges++;
      
      this.emit('save-interval-changed', {
        oldInterval: oldInterval,
        newInterval: newInterval,
        activityLevel: activityLevel,
        activitiesPerMinute: activitiesPerMinute,
        timestamp: now
      });
      
      console.log(`Adaptive save interval changed: ${oldInterval}ms -> ${newInterval}ms (${activityLevel} activity)`);
    }
    
    // Reset activity counter for next window
    this.activityTracker.activityCount = 0;
  }

  /**
   * Gets the current adaptive save interval
   * @returns {number} Current save interval in milliseconds
   */
  getCurrentSaveInterval() {
    return this.currentSaveInterval;
  }

  /**
   * Updates compression statistics
   * @param {number} compressionTime - Time taken for compression
   * @param {number} compressionRatio - Compression ratio achieved
   */
  updateCompressionStats(compressionTime, compressionRatio) {
    // Update average compression time
    const totalCompressions = this.stats.totalCompressedSaves;
    this.stats.averageCompressionTime = 
      ((this.stats.averageCompressionTime * (totalCompressions - 1)) + compressionTime) / totalCompressions;
    
    // Update average compression ratio
    this.stats.compressionRatio = 
      ((this.stats.compressionRatio * (totalCompressions - 1)) + compressionRatio) / totalCompressions;
  }

  /**
   * Updates decompression statistics
   * @param {number} decompressionTime - Time taken for decompression
   */
  updateDecompressionStats(decompressionTime) {
    // Simple moving average for decompression time
    const alpha = 0.1; // Smoothing factor
    this.stats.averageDecompressionTime = 
      (alpha * decompressionTime) + ((1 - alpha) * this.stats.averageDecompressionTime);
  }

  /**
   * Optimizes memory usage by clearing caches and forcing garbage collection
   * @returns {Object} Optimization result
   */
  optimizeMemoryUsage() {
    const beforeMemory = process.memoryUsage();
    
    try {
      // Clear memory usage history if it's too large
      if (this.stats.memoryUsageHistory.length > 50) {
        this.stats.memoryUsageHistory = this.stats.memoryUsageHistory.slice(-25);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const afterMemory = process.memoryUsage();
      const memoryFreed = beforeMemory.heapUsed - afterMemory.heapUsed;
      
      this.emit('memory-optimized', {
        memoryFreed: memoryFreed,
        beforeUsage: beforeMemory.heapUsed,
        afterUsage: afterMemory.heapUsed,
        timestamp: Date.now()
      });
      
      return {
        success: true,
        memoryFreed: memoryFreed,
        beforeUsage: beforeMemory.heapUsed,
        afterUsage: afterMemory.heapUsed
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Gets comprehensive performance statistics
   * @returns {Object} Performance statistics
   */
  getPerformanceStatistics() {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapUsed + memoryUsage.external;
    
    return {
      memory: {
        current: totalMemory,
        limit: this.memoryLimit,
        percentage: (totalMemory / this.memoryLimit) * 100,
        peak: this.stats.peakMemoryUsage,
        isHealthy: (totalMemory / this.memoryLimit) < this.memoryWarningThreshold,
        lastCheck: this.stats.lastMemoryCheck,
        historyLength: this.stats.memoryUsageHistory.length
      },
      compression: {
        enabled: this.compressionEnabled,
        ratio: this.stats.compressionRatio,
        totalCompressed: this.stats.totalCompressedSaves,
        totalUncompressed: this.stats.totalUncompressedSaves,
        averageCompressionTime: this.stats.averageCompressionTime,
        averageDecompressionTime: this.stats.averageDecompressionTime,
        threshold: this.compressionThreshold,
        level: this.compressionLevel
      },
      adaptiveSave: {
        enabled: this.adaptiveSaveEnabled,
        currentInterval: this.currentSaveInterval,
        baseInterval: this.baseSaveInterval,
        intervalChanges: this.stats.adaptiveIntervalChanges,
        lastActivity: this.activityTracker.lastActivity,
        activityCount: this.activityTracker.activityCount
      },
      overall: {
        timestamp: Date.now(),
        performanceScore: this.calculatePerformanceScore()
      }
    };
  }

  /**
   * Calculates an overall performance score (0-100)
   * @returns {number} Performance score
   */
  calculatePerformanceScore() {
    let score = 100;
    
    // Memory usage impact (30% weight)
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapUsed + memoryUsage.external;
    const memoryPercentage = (totalMemory / this.memoryLimit) * 100;
    
    if (memoryPercentage > 95) {
      score -= 30;
    } else if (memoryPercentage > 80) {
      score -= 20;
    } else if (memoryPercentage > 60) {
      score -= 10;
    }
    
    // Compression efficiency impact (20% weight)
    if (this.compressionEnabled && this.stats.compressionRatio > 1) {
      const compressionBonus = Math.min(20, (this.stats.compressionRatio - 1) * 10);
      score += compressionBonus;
    }
    
    // Average compression time impact (20% weight)
    if (this.stats.averageCompressionTime > 1000) { // More than 1 second
      score -= 20;
    } else if (this.stats.averageCompressionTime > 500) { // More than 500ms
      score -= 10;
    }
    
    // Adaptive save effectiveness (15% weight)
    if (this.adaptiveSaveEnabled && this.stats.adaptiveIntervalChanges > 0) {
      score += 15; // Bonus for adaptive behavior
    }
    
    // Recent performance issues (15% weight)
    const recentMemoryIssues = this.stats.memoryUsageHistory
      .slice(-10)
      .filter(entry => (entry.total / this.memoryLimit) > this.memoryWarningThreshold)
      .length;
    
    if (recentMemoryIssues > 5) {
      score -= 15;
    } else if (recentMemoryIssues > 2) {
      score -= 8;
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Updates performance configuration
   * @param {Object} config - Configuration updates
   */
  updateConfiguration(config) {
    if (config.compressionEnabled !== undefined) {
      this.compressionEnabled = config.compressionEnabled;
    }
    
    if (config.compressionLevel !== undefined) {
      this.compressionLevel = Math.max(1, Math.min(9, config.compressionLevel));
    }
    
    if (config.compressionThreshold !== undefined) {
      this.compressionThreshold = config.compressionThreshold;
    }
    
    if (config.adaptiveSaveEnabled !== undefined) {
      this.adaptiveSaveEnabled = config.adaptiveSaveEnabled;
    }
    
    if (config.baseSaveInterval !== undefined) {
      this.baseSaveInterval = config.baseSaveInterval;
      this.currentSaveInterval = config.baseSaveInterval;
    }
    
    if (config.memoryLimit !== undefined) {
      this.memoryLimit = config.memoryLimit;
    }
    
    this.emit('configuration-updated', {
      compressionEnabled: this.compressionEnabled,
      compressionLevel: this.compressionLevel,
      adaptiveSaveEnabled: this.adaptiveSaveEnabled,
      baseSaveInterval: this.baseSaveInterval,
      memoryLimit: this.memoryLimit,
      timestamp: Date.now()
    });
  }

  /**
   * Performs a comprehensive performance optimization
   * @returns {Promise<Object>} Optimization result
   */
  async performOptimization() {
    const optimizationResult = {
      timestamp: Date.now(),
      actions: [],
      memoryBefore: process.memoryUsage(),
      memoryAfter: null,
      success: true
    };
    
    try {
      // 1. Optimize memory usage
      const memoryOpt = this.optimizeMemoryUsage();
      optimizationResult.actions.push({
        action: 'memory-optimization',
        success: memoryOpt.success,
        memoryFreed: memoryOpt.memoryFreed || 0
      });
      
      // 2. Clean up old memory history
      if (this.stats.memoryUsageHistory.length > 50) {
        const oldLength = this.stats.memoryUsageHistory.length;
        this.stats.memoryUsageHistory = this.stats.memoryUsageHistory.slice(-25);
        optimizationResult.actions.push({
          action: 'history-cleanup',
          success: true,
          entriesRemoved: oldLength - this.stats.memoryUsageHistory.length
        });
      }
      
      // 3. Reset activity tracker if it's been running too long
      const now = Date.now();
      if (now - this.activityTracker.lastActivity > this.activityTracker.activityWindow * 2) {
        this.activityTracker.activityCount = 0;
        optimizationResult.actions.push({
          action: 'activity-reset',
          success: true
        });
      }
      
      optimizationResult.memoryAfter = process.memoryUsage();
      
      this.emit('optimization-complete', {
        actionsCount: optimizationResult.actions.length,
        memoryFreed: optimizationResult.memoryBefore.heapUsed - optimizationResult.memoryAfter.heapUsed,
        timestamp: optimizationResult.timestamp
      });
      
      return optimizationResult;
      
    } catch (error) {
      optimizationResult.success = false;
      optimizationResult.error = error.message;
      return optimizationResult;
    }
  }

  /**
   * Cleanup method to stop all monitoring and free resources
   */
  cleanup() {
    this.stopMemoryMonitoring();
    this.removeAllListeners();
    console.log('PerformanceManager cleaned up');
  }
}

module.exports = PerformanceManager;