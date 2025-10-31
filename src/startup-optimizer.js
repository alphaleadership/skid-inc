const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * StartupOptimizer - Handles application startup optimizations
 * Includes asynchronous save loading, metadata caching, and startup time monitoring
 */
class StartupOptimizer extends EventEmitter {
  constructor(fileSystemManager, autoSaveManager) {
    super();
    
    this.fileSystemManager = fileSystemManager;
    this.autoSaveManager = autoSaveManager;
    
    // Startup configuration
    this.targetStartupTime = 3000; // 3 seconds as per requirements
    this.enableAsyncLoading = true;
    this.enableMetadataCache = true;
    this.enablePreloading = true;
    
    // Cache configuration
    this.metadataCache = new Map();
    this.cacheFile = null;
    this.cacheMaxAge = 24 * 60 * 60 * 1000; // 24 hours
    this.cacheVersion = '1.0.0';
    
    // Startup tracking
    this.startupMetrics = {
      startTime: null,
      endTime: null,
      totalTime: null,
      phases: {},
      cacheHits: 0,
      cacheMisses: 0,
      asyncOperations: 0,
      preloadedFiles: 0
    };
    
    // Preloaded data
    this.preloadedSaves = new Map();
    this.preloadedMetadata = null;
    
    // Initialize cache file path
    if (this.fileSystemManager) {
      this.cacheFile = path.join(this.fileSystemManager.getSaveDirectory(), '.startup_cache.json');
    }
    
    console.log('StartupOptimizer initialized');
  }

  /**
   * Starts the startup optimization process
   * @returns {Promise<Object>} Startup result
   */
  async startOptimizedStartup() {
    this.startupMetrics.startTime = Date.now();
    this.startupMetrics.phases = {};
    
    try {
      // Phase 1: Load metadata cache
      await this.executePhase('cache-load', async () => {
        if (this.enableMetadataCache) {
          await this.loadMetadataCache();
        }
      });
      
      // Phase 2: Initialize file system (if not already done)
      await this.executePhase('filesystem-init', async () => {
        if (this.fileSystemManager) {
          await this.fileSystemManager.ensureSaveDirectory();
        }
      });
      
      // Phase 3: Start asynchronous operations
      const asyncPromises = [];
      
      if (this.enableAsyncLoading) {
        // Start preloading save files asynchronously
        asyncPromises.push(this.executePhase('async-preload', async () => {
          await this.preloadSaveFiles();
        }));
        
        // Start metadata refresh asynchronously
        asyncPromises.push(this.executePhase('async-metadata', async () => {
          await this.refreshMetadataCache();
        }));
      }
      
      // Phase 4: Essential initialization (synchronous)
      await this.executePhase('essential-init', async () => {
        // Initialize auto-save manager if needed
        if (this.autoSaveManager && !this.autoSaveManager.isAutoSaveEnabled()) {
          await this.autoSaveManager.startAutoSave({
            periodicInterval: 30000,
            quickSaveDelay: 5000
          });
        }
      });
      
      // Phase 5: Wait for critical async operations (with timeout)
      if (asyncPromises.length > 0) {
        await this.executePhase('async-wait', async () => {
          await Promise.race([
            Promise.all(asyncPromises),
            this.createTimeout(2000) // Max 2 seconds for async operations
          ]);
        });
      }
      
      this.startupMetrics.endTime = Date.now();
      this.startupMetrics.totalTime = this.startupMetrics.endTime - this.startupMetrics.startTime;
      
      const result = {
        success: true,
        totalTime: this.startupMetrics.totalTime,
        targetTime: this.targetStartupTime,
        withinTarget: this.startupMetrics.totalTime <= this.targetStartupTime,
        phases: this.startupMetrics.phases,
        cacheStats: {
          hits: this.startupMetrics.cacheHits,
          misses: this.startupMetrics.cacheMisses,
          hitRate: this.calculateCacheHitRate()
        },
        preloadStats: {
          filesPreloaded: this.startupMetrics.preloadedFiles,
          asyncOperations: this.startupMetrics.asyncOperations
        }
      };
      
      this.emit('startup-complete', result);
      
      if (result.withinTarget) {
        console.log(`Startup completed in ${result.totalTime}ms (target: ${this.targetStartupTime}ms)`);
      } else {
        console.warn(`Startup took ${result.totalTime}ms, exceeding target of ${this.targetStartupTime}ms`);
      }
      
      return result;
      
    } catch (error) {
      this.startupMetrics.endTime = Date.now();
      this.startupMetrics.totalTime = this.startupMetrics.endTime - this.startupMetrics.startTime;
      
      const result = {
        success: false,
        error: error.message,
        totalTime: this.startupMetrics.totalTime,
        phases: this.startupMetrics.phases
      };
      
      this.emit('startup-failed', result);
      throw new Error(`Startup optimization failed: ${error.message}`);
    }
  }

  /**
   * Executes a startup phase and tracks timing
   * @param {string} phaseName - Name of the phase
   * @param {Function} phaseFunction - Function to execute
   */
  async executePhase(phaseName, phaseFunction) {
    const startTime = Date.now();
    
    try {
      await phaseFunction();
      
      const duration = Date.now() - startTime;
      this.startupMetrics.phases[phaseName] = {
        duration: duration,
        success: true,
        timestamp: startTime
      };
      
      this.emit('phase-complete', {
        phase: phaseName,
        duration: duration,
        success: true
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.startupMetrics.phases[phaseName] = {
        duration: duration,
        success: false,
        error: error.message,
        timestamp: startTime
      };
      
      this.emit('phase-failed', {
        phase: phaseName,
        duration: duration,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Loads metadata cache from disk
   */
  async loadMetadataCache() {
    if (!this.cacheFile) {
      return;
    }
    
    try {
      const cacheData = await fs.readFile(this.cacheFile, 'utf8');
      const cache = JSON.parse(cacheData);
      
      // Validate cache version and age
      if (cache.version === this.cacheVersion && 
          (Date.now() - cache.timestamp) < this.cacheMaxAge) {
        
        // Load cache entries
        if (cache.metadata) {
          for (const [key, value] of Object.entries(cache.metadata)) {
            this.metadataCache.set(key, value);
          }
        }
        
        this.preloadedMetadata = cache.saveMetadata || null;
        this.startupMetrics.cacheHits++;
        
        console.log(`Loaded metadata cache with ${this.metadataCache.size} entries`);
      } else {
        console.log('Metadata cache expired or version mismatch, will rebuild');
        this.startupMetrics.cacheMisses++;
      }
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Failed to load metadata cache:', error.message);
      }
      this.startupMetrics.cacheMisses++;
    }
  }

  /**
   * Saves metadata cache to disk
   */
  async saveMetadataCache() {
    if (!this.cacheFile) {
      return;
    }
    
    try {
      const cacheData = {
        version: this.cacheVersion,
        timestamp: Date.now(),
        metadata: Object.fromEntries(this.metadataCache),
        saveMetadata: this.preloadedMetadata
      };
      
      await fs.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2));
      console.log('Metadata cache saved successfully');
      
    } catch (error) {
      console.warn('Failed to save metadata cache:', error.message);
    }
  }

  /**
   * Preloads save files asynchronously for faster access
   */
  async preloadSaveFiles() {
    if (!this.fileSystemManager || !this.enablePreloading) {
      return;
    }
    
    try {
      const saveFiles = await this.fileSystemManager.listSaveFiles();
      
      // Preload the most recent save files (up to 5)
      const recentFiles = saveFiles
        .sort((a, b) => b.modified - a.modified)
        .slice(0, 5);
      
      const preloadPromises = recentFiles.map(async (file) => {
        try {
          // Check if we have cached metadata
          const cacheKey = `file_${file.filename}`;
          let fileMetadata = this.metadataCache.get(cacheKey);
          
          if (!fileMetadata) {
            // Load file stats and basic info
            const stats = await this.fileSystemManager.getFileStats(file.filename);
            fileMetadata = {
              filename: file.filename,
              size: stats.size,
              modified: stats.modified,
              created: stats.created,
              preloaded: true,
              timestamp: Date.now()
            };
            
            this.metadataCache.set(cacheKey, fileMetadata);
            this.startupMetrics.cacheMisses++;
          } else {
            this.startupMetrics.cacheHits++;
          }
          
          // Store preloaded metadata
          this.preloadedSaves.set(file.filename, fileMetadata);
          this.startupMetrics.preloadedFiles++;
          
        } catch (error) {
          console.warn(`Failed to preload ${file.filename}:`, error.message);
        }
      });
      
      await Promise.all(preloadPromises);
      this.startupMetrics.asyncOperations++;
      
      console.log(`Preloaded ${this.preloadedSaves.size} save files`);
      
    } catch (error) {
      console.warn('Failed to preload save files:', error.message);
    }
  }

  /**
   * Refreshes metadata cache asynchronously
   */
  async refreshMetadataCache() {
    if (!this.fileSystemManager || !this.enableMetadataCache) {
      return;
    }
    
    try {
      // Get current save system statistics
      const stats = await this.fileSystemManager.getSystemStatistics();
      this.preloadedMetadata = {
        ...stats,
        refreshed: Date.now(),
        cacheVersion: this.cacheVersion
      };
      
      this.startupMetrics.asyncOperations++;
      
      // Save updated cache
      await this.saveMetadataCache();
      
    } catch (error) {
      console.warn('Failed to refresh metadata cache:', error.message);
    }
  }

  /**
   * Gets preloaded save file metadata
   * @param {string} filename - Save file name
   * @returns {Object|null} Preloaded metadata or null
   */
  getPreloadedSaveMetadata(filename) {
    return this.preloadedSaves.get(filename) || null;
  }

  /**
   * Gets preloaded system metadata
   * @returns {Object|null} Preloaded metadata or null
   */
  getPreloadedSystemMetadata() {
    return this.preloadedMetadata;
  }

  /**
   * Checks if a save file is preloaded
   * @param {string} filename - Save file name
   * @returns {boolean} True if preloaded
   */
  isSavePreloaded(filename) {
    return this.preloadedSaves.has(filename);
  }

  /**
   * Loads a save file with optimization (uses preloaded data if available)
   * @param {string} filename - Save file name
   * @returns {Promise<Object>} Load result
   */
  async loadSaveFileOptimized(filename) {
    const startTime = Date.now();
    
    try {
      // Check if we have preloaded metadata
      const preloadedMeta = this.getPreloadedSaveMetadata(filename);
      
      if (preloadedMeta) {
        console.log(`Using preloaded metadata for ${filename}`);
        this.startupMetrics.cacheHits++;
      } else {
        this.startupMetrics.cacheMisses++;
      }
      
      // Load the actual file data
      const result = await this.fileSystemManager.readGameData(filename);
      
      // Add preloaded metadata if available
      if (preloadedMeta) {
        result.preloadedMetadata = preloadedMeta;
        result.wasPreloaded = true;
      }
      
      const loadTime = Date.now() - startTime;
      result.loadTime = loadTime;
      
      this.emit('save-loaded-optimized', {
        filename: filename,
        loadTime: loadTime,
        wasPreloaded: !!preloadedMeta,
        size: result.data ? JSON.stringify(result.data).length : 0
      });
      
      return result;
      
    } catch (error) {
      const loadTime = Date.now() - startTime;
      
      this.emit('save-load-failed', {
        filename: filename,
        loadTime: loadTime,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Creates a timeout promise
   * @param {number} ms - Timeout in milliseconds
   * @returns {Promise} Timeout promise
   */
  createTimeout(ms) {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ timeout: true }), ms);
    });
  }

  /**
   * Calculates cache hit rate
   * @returns {number} Hit rate percentage
   */
  calculateCacheHitRate() {
    const total = this.startupMetrics.cacheHits + this.startupMetrics.cacheMisses;
    return total > 0 ? (this.startupMetrics.cacheHits / total) * 100 : 0;
  }

  /**
   * Gets startup optimization statistics
   * @returns {Object} Statistics object
   */
  getStartupStatistics() {
    return {
      lastStartup: {
        ...this.startupMetrics,
        cacheHitRate: this.calculateCacheHitRate()
      },
      cache: {
        enabled: this.enableMetadataCache,
        size: this.metadataCache.size,
        maxAge: this.cacheMaxAge,
        version: this.cacheVersion,
        file: this.cacheFile
      },
      preloading: {
        enabled: this.enablePreloading,
        preloadedSaves: this.preloadedSaves.size,
        hasSystemMetadata: !!this.preloadedMetadata
      },
      configuration: {
        targetStartupTime: this.targetStartupTime,
        asyncLoading: this.enableAsyncLoading,
        metadataCache: this.enableMetadataCache,
        preloading: this.enablePreloading
      },
      performance: {
        averageStartupTime: this.calculateAverageStartupTime(),
        startupScore: this.calculateStartupScore()
      }
    };
  }

  /**
   * Calculates average startup time (simplified - would need history tracking)
   * @returns {number} Average startup time in milliseconds
   */
  calculateAverageStartupTime() {
    // For now, return the last startup time
    // In a full implementation, this would track startup history
    return this.startupMetrics.totalTime || 0;
  }

  /**
   * Calculates startup performance score (0-100)
   * @returns {number} Startup score
   */
  calculateStartupScore() {
    let score = 100;
    
    // Deduct points based on startup time
    if (this.startupMetrics.totalTime) {
      if (this.startupMetrics.totalTime > this.targetStartupTime * 2) {
        score -= 50; // Very slow startup
      } else if (this.startupMetrics.totalTime > this.targetStartupTime) {
        const excess = this.startupMetrics.totalTime - this.targetStartupTime;
        score -= (excess / this.targetStartupTime) * 30; // Proportional penalty
      }
    }
    
    // Add points for cache efficiency
    const cacheHitRate = this.calculateCacheHitRate();
    if (cacheHitRate > 80) {
      score += 10; // Good cache performance
    } else if (cacheHitRate > 50) {
      score += 5; // Decent cache performance
    }
    
    // Add points for preloading
    if (this.preloadedSaves.size > 0) {
      score += Math.min(10, this.preloadedSaves.size * 2); // Up to 10 points for preloading
    }
    
    // Deduct points for failed phases
    const failedPhases = Object.values(this.startupMetrics.phases || {})
      .filter(phase => !phase.success).length;
    score -= failedPhases * 10;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Updates startup optimization configuration
   * @param {Object} config - Configuration updates
   */
  updateConfiguration(config) {
    if (config.targetStartupTime !== undefined) {
      this.targetStartupTime = config.targetStartupTime;
    }
    
    if (config.enableAsyncLoading !== undefined) {
      this.enableAsyncLoading = config.enableAsyncLoading;
    }
    
    if (config.enableMetadataCache !== undefined) {
      this.enableMetadataCache = config.enableMetadataCache;
    }
    
    if (config.enablePreloading !== undefined) {
      this.enablePreloading = config.enablePreloading;
    }
    
    if (config.cacheMaxAge !== undefined) {
      this.cacheMaxAge = config.cacheMaxAge;
    }
    
    this.emit('configuration-updated', {
      targetStartupTime: this.targetStartupTime,
      enableAsyncLoading: this.enableAsyncLoading,
      enableMetadataCache: this.enableMetadataCache,
      enablePreloading: this.enablePreloading,
      cacheMaxAge: this.cacheMaxAge
    });
  }

  /**
   * Clears all caches and preloaded data
   */
  clearCaches() {
    this.metadataCache.clear();
    this.preloadedSaves.clear();
    this.preloadedMetadata = null;
    
    // Delete cache file
    if (this.cacheFile) {
      fs.unlink(this.cacheFile).catch(error => {
        if (error.code !== 'ENOENT') {
          console.warn('Failed to delete cache file:', error.message);
        }
      });
    }
    
    this.emit('caches-cleared', {
      timestamp: Date.now()
    });
    
    console.log('All caches cleared');
  }

  /**
   * Performs startup optimization maintenance
   * @returns {Promise<Object>} Maintenance result
   */
  async performMaintenance() {
    const maintenanceResult = {
      timestamp: Date.now(),
      actions: [],
      success: true
    };
    
    try {
      // Clean old cache entries
      let cleanedEntries = 0;
      const now = Date.now();
      
      for (const [key, value] of this.metadataCache.entries()) {
        if (value.timestamp && (now - value.timestamp) > this.cacheMaxAge) {
          this.metadataCache.delete(key);
          cleanedEntries++;
        }
      }
      
      if (cleanedEntries > 0) {
        maintenanceResult.actions.push({
          action: 'cache-cleanup',
          entriesRemoved: cleanedEntries
        });
      }
      
      // Update cache file
      await this.saveMetadataCache();
      maintenanceResult.actions.push({
        action: 'cache-save',
        success: true
      });
      
      this.emit('maintenance-complete', maintenanceResult);
      
      return maintenanceResult;
      
    } catch (error) {
      maintenanceResult.success = false;
      maintenanceResult.error = error.message;
      return maintenanceResult;
    }
  }

  /**
   * Cleanup method to free resources
   */
  cleanup() {
    this.clearCaches();
    this.removeAllListeners();
    console.log('StartupOptimizer cleaned up');
  }
}

module.exports = StartupOptimizer;