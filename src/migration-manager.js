const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

/**
 * MigrationManager - Handles migration of game data from localStorage to file system
 * Detects existing localStorage data and converts it to the new file-based format
 */
class MigrationManager {
  constructor(fileSystemManager) {
    this.fileSystemManager = fileSystemManager;
    this.localStorageKey = 'SKINC'; // Key used by the original game
    this.migrationCompleted = false;
  }

  /**
   * Detects if localStorage data exists that can be migrated
   * This method simulates localStorage detection since we can't directly access it from main process
   * @returns {Promise<Object>} Detection result with found data information
   */
  async detectLocalStorageData() {
    try {
      // In Electron, we can't directly access localStorage from the main process
      // This method will be called from the renderer process via IPC
      // For now, we return a structure that indicates no data found
      // The actual detection will happen in the renderer process
      
      return {
        found: false,
        dataSize: 0,
        gameVersion: null,
        playerLevel: null,
        lastSave: null,
        reason: 'Detection must be performed from renderer process'
      };
    } catch (error) {
      console.error('Error detecting localStorage data:', error.message);
      return {
        found: false,
        error: error.message,
        reason: 'Error during detection'
      };
    }
  }

  /**
   * Converts localStorage data format to the new file-based format
   * @param {Object} localStorageData - Raw data from localStorage
   * @returns {Object} Converted game state in new format
   */
  convertDataFormat(localStorageData) {
    try {
      // Validate input data
      if (!localStorageData || typeof localStorageData !== 'object') {
        throw new Error('Invalid localStorage data provided');
      }

      // Create the new game state format based on the design document schema
      const convertedGameState = {
        version: localStorageData.version || '0.33',
        timestamp: Date.now(),
        migrationSource: 'localStorage',
        migrationDate: new Date().toISOString(),
        
        // Player data conversion
        player: {
          username: localStorageData.player?.username || 'kiddie',
          money: localStorageData.player?.money || 0,
          totalMoney: localStorageData.player?.totalMoney || 0,
          exp: localStorageData.player?.exp || 0,
          totalExp: localStorageData.player?.totalExp || 0,
          expReq: localStorageData.player?.expReq || 100,
          level: localStorageData.player?.level || 1,
          botnet: localStorageData.player?.botnet || 0,
          prestigeCount: localStorageData.player?.prestigeCount || 0
        },

        // Script data conversion
        script: {
          unlocked: localStorageData.script?.unlocked || [],
          completed: localStorageData.script?.completed || [],
          totalCompleted: localStorageData.script?.totalCompleted || 0,
          available: localStorageData.script?.available || [],
          current: localStorageData.script?.current || null,
          time: localStorageData.script?.time || 0,
          maxTime: localStorageData.script?.maxTime || 0
        },

        // Server data conversion
        server: {
          owned: localStorageData.server?.owned || []
        },

        // Battery data conversion (added in version 0.32)
        battery: {
          level: localStorageData.battery?.level || 1,
          time: localStorageData.battery?.time || 0
        },

        // Achievements data conversion
        achievements: {
          owned: localStorageData.achievements?.owned || []
        },

        // Autoscript data conversion
        autoscript: {
          unlocked: localStorageData.autoscript?.unlocked || []
        },

        // Options data conversion
        options: {
          typed: localStorageData.options?.typed !== undefined ? localStorageData.options.typed : true
        },

        // Tutorial data conversion
        tutorial: {
          finish: localStorageData.tutorial?.finish || false
        },

        // Console data conversion (added in version 0.33)
        console: {
          grammarly: localStorageData.console?.grammarly || false
        }
      };

      console.log('Data conversion completed successfully');
      return convertedGameState;
    } catch (error) {
      throw new Error(`Failed to convert localStorage data: ${error.message}`);
    }
  }

  /**
   * Validates the integrity and completeness of migrated data
   * @param {Object} convertedData - Converted game state data
   * @returns {Object} Validation result
   */
  validateImportedData(convertedData) {
    try {
      const validation = {
        valid: true,
        warnings: [],
        errors: [],
        summary: {}
      };

      // Validate required top-level properties
      const requiredProps = ['version', 'timestamp', 'player', 'script', 'server', 'battery'];
      for (const prop of requiredProps) {
        if (!convertedData.hasOwnProperty(prop)) {
          validation.errors.push(`Missing required property: ${prop}`);
          validation.valid = false;
        }
      }

      // Validate player data
      if (convertedData.player) {
        const playerProps = ['username', 'money', 'exp', 'level'];
        for (const prop of playerProps) {
          if (!convertedData.player.hasOwnProperty(prop)) {
            validation.errors.push(`Missing required player property: ${prop}`);
            validation.valid = false;
          }
        }

        // Validate player data types and ranges
        if (typeof convertedData.player.level !== 'number' || convertedData.player.level < 1) {
          validation.warnings.push('Player level is invalid, defaulting to 1');
          convertedData.player.level = 1;
        }

        if (typeof convertedData.player.money !== 'number' || convertedData.player.money < 0) {
          validation.warnings.push('Player money is invalid, defaulting to 0');
          convertedData.player.money = 0;
        }

        if (typeof convertedData.player.exp !== 'number' || convertedData.player.exp < 0) {
          validation.warnings.push('Player experience is invalid, defaulting to 0');
          convertedData.player.exp = 0;
        }
      }

      // Validate script data
      if (convertedData.script) {
        if (!Array.isArray(convertedData.script.unlocked)) {
          validation.warnings.push('Script unlocked array is invalid, defaulting to empty array');
          convertedData.script.unlocked = [];
        }

        if (!Array.isArray(convertedData.script.completed)) {
          validation.warnings.push('Script completed array is invalid, defaulting to empty array');
          convertedData.script.completed = [];
        }

        if (typeof convertedData.script.totalCompleted !== 'number') {
          validation.warnings.push('Script totalCompleted is invalid, calculating from completed array');
          convertedData.script.totalCompleted = convertedData.script.completed.length;
        }
      }

      // Validate server data
      if (convertedData.server) {
        if (!Array.isArray(convertedData.server.owned)) {
          validation.warnings.push('Server owned array is invalid, defaulting to empty array');
          convertedData.server.owned = [];
        }
      }

      // Validate battery data
      if (convertedData.battery) {
        if (typeof convertedData.battery.level !== 'number' || convertedData.battery.level < 1) {
          validation.warnings.push('Battery level is invalid, defaulting to 1');
          convertedData.battery.level = 1;
        }

        if (typeof convertedData.battery.time !== 'number' || convertedData.battery.time < 0) {
          validation.warnings.push('Battery time is invalid, defaulting to 0');
          convertedData.battery.time = 0;
        }
      }

      // Validate achievements data
      if (convertedData.achievements) {
        if (!Array.isArray(convertedData.achievements.owned)) {
          validation.warnings.push('Achievements owned array is invalid, defaulting to empty array');
          convertedData.achievements.owned = [];
        }
      }

      // Create validation summary
      validation.summary = {
        playerLevel: convertedData.player?.level || 0,
        totalMoney: convertedData.player?.totalMoney || 0,
        totalExp: convertedData.player?.totalExp || 0,
        scriptsCompleted: convertedData.script?.totalCompleted || 0,
        achievementsOwned: convertedData.achievements?.owned?.length || 0,
        gameVersion: convertedData.version || 'unknown',
        migrationDate: convertedData.migrationDate || new Date().toISOString()
      };

      console.log(`Data validation completed: ${validation.valid ? 'PASSED' : 'FAILED'}`);
      console.log(`Warnings: ${validation.warnings.length}, Errors: ${validation.errors.length}`);

      return validation;
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
        summary: {}
      };
    }
  }

  /**
   * Performs the complete migration process from localStorage to file system
   * @param {Object} localStorageData - Raw localStorage data (base64 decoded)
   * @param {string} customFilename - Optional custom filename for the migrated save
   * @returns {Promise<Object>} Migration result
   */
  async importFromLocalStorage(localStorageData, customFilename = null) {
    try {
      console.log('Starting localStorage migration process...');

      // Step 1: Convert data format
      const convertedData = this.convertDataFormat(localStorageData);

      // Step 2: Validate converted data
      const validation = this.validateImportedData(convertedData);
      
      if (!validation.valid) {
        throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
      }

      // Step 3: Generate filename for migrated save
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = customFilename || `migrated_localStorage_${timestamp}.json`;

      // Step 4: Save converted data to file system
      const saveResult = await this.fileSystemManager.writeGameData(filename, convertedData);

      // Step 5: Update metadata to mark migration as completed
      const metadataManager = this.fileSystemManager.getMetadataManager();
      if (metadataManager) {
        await metadataManager.updateConfiguration({ migrationCompleted: true });
      }

      // Step 6: Create backup of original localStorage data
      const backupFilename = `localStorage_backup_${timestamp}.json`;
      await this.createLocalStorageBackup(localStorageData, backupFilename);

      this.migrationCompleted = true;

      const migrationResult = {
        success: true,
        filename: saveResult.filename,
        backupFilename: backupFilename,
        size: saveResult.size,
        timestamp: saveResult.timestamp,
        checksum: saveResult.checksum,
        validation: validation,
        message: 'Migration completed successfully'
      };

      console.log('localStorage migration completed successfully');
      return migrationResult;
    } catch (error) {
      console.error('Migration failed:', error.message);
      throw new Error(`Migration failed: ${error.message}`);
    }
  }

  /**
   * Creates a backup of the original localStorage data
   * @param {Object} localStorageData - Original localStorage data
   * @param {string} backupFilename - Filename for the backup
   * @returns {Promise<Object>} Backup result
   */
  async createLocalStorageBackup(localStorageData, backupFilename) {
    try {
      const backupData = {
        source: 'localStorage',
        backupDate: new Date().toISOString(),
        originalKey: this.localStorageKey,
        data: localStorageData,
        note: 'Backup of original localStorage data before migration to file system'
      };

      const result = await this.fileSystemManager.writeGameData(backupFilename, backupData);
      console.log(`localStorage backup created: ${backupFilename}`);
      return result;
    } catch (error) {
      console.warn(`Failed to create localStorage backup: ${error.message}`);
      // Don't fail the migration if backup creation fails
      return null;
    }
  }

  /**
   * Checks if migration has been completed
   * @returns {Promise<boolean>} True if migration was completed
   */
  async isMigrationCompleted() {
    try {
      const metadataManager = this.fileSystemManager.getMetadataManager();
      if (!metadataManager) {
        return false;
      }

      const metadata = metadataManager.getMetadata();
      return metadata.migrationCompleted || false;
    } catch (error) {
      console.error('Error checking migration status:', error.message);
      return false;
    }
  }

  /**
   * Resets migration status (for testing or re-migration)
   * @returns {Promise<void>}
   */
  async resetMigrationStatus() {
    try {
      const metadataManager = this.fileSystemManager.getMetadataManager();
      if (metadataManager) {
        await metadataManager.updateConfiguration({ migrationCompleted: false });
      }
      this.migrationCompleted = false;
      console.log('Migration status reset');
    } catch (error) {
      console.error('Failed to reset migration status:', error.message);
    }
  }

  /**
   * Gets migration statistics and information
   * @returns {Promise<Object>} Migration statistics
   */
  async getMigrationStatistics() {
    try {
      const metadataManager = this.fileSystemManager.getMetadataManager();
      const saveFiles = await this.fileSystemManager.listSaveFiles();
      
      // Find migrated files
      const migratedFiles = saveFiles.filter(file => 
        file.filename.includes('migrated_localStorage') || 
        file.filename.includes('localStorage_backup')
      );

      const statistics = {
        migrationCompleted: await this.isMigrationCompleted(),
        migratedFilesCount: migratedFiles.filter(f => f.filename.includes('migrated_localStorage')).length,
        backupFilesCount: migratedFiles.filter(f => f.filename.includes('localStorage_backup')).length,
        totalMigratedSize: migratedFiles.reduce((sum, file) => sum + file.size, 0),
        migratedFiles: migratedFiles.map(file => ({
          filename: file.filename,
          size: file.size,
          created: file.created,
          type: file.filename.includes('backup') ? 'backup' : 'migrated'
        }))
      };

      return statistics;
    } catch (error) {
      console.error('Failed to get migration statistics:', error.message);
      return {
        migrationCompleted: false,
        migratedFilesCount: 0,
        backupFilesCount: 0,
        totalMigratedSize: 0,
        migratedFiles: [],
        error: error.message
      };
    }
  }

  /**
   * Decodes base64 encoded localStorage data (as used by the original game)
   * @param {string} encodedData - Base64 encoded data string
   * @returns {Object} Decoded game data
   */
  decodeLocalStorageData(encodedData) {
    try {
      // The original game uses a custom base64 encoding function
      // We need to reverse the process: b64uDecode -> JSON.parse
      const decodedString = this.b64uDecode(encodedData);
      const gameData = JSON.parse(decodedString);
      
      console.log('localStorage data decoded successfully');
      return gameData;
    } catch (error) {
      throw new Error(`Failed to decode localStorage data: ${error.message}`);
    }
  }

  /**
   * Custom base64 decode function matching the original game's encoding
   * @param {string} what - Base64 encoded string
   * @returns {string} Decoded string
   */
  b64uDecode(what) {
    try {
      return decodeURIComponent(
        Buffer.from(what, 'base64')
          .toString('binary')
          .split('')
          .map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
    } catch (error) {
      throw new Error(`Base64 decode error: ${error.message}`);
    }
  }

  /**
   * Gets the localStorage key used by the original game
   * @returns {string} localStorage key
   */
  getLocalStorageKey() {
    return this.localStorageKey;
  }
}

module.exports = MigrationManager;